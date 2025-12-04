"""
Rate Limiting Middleware for API Protection

Implements sliding window rate limiting using Redis (docker mode)
or in-memory storage (desktop mode).

SECURITY: Prevents brute force attacks, API abuse, and DoS attempts.
"""
import time
import logging
from typing import Dict, Optional, Callable
from collections import defaultdict
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """
    Simple in-memory rate limiter for desktop mode.
    Uses a sliding window algorithm.
    """
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 60  # seconds
        self.last_cleanup = time.time()
    
    def _cleanup(self):
        """Remove old request timestamps"""
        now = time.time()
        if now - self.last_cleanup < self.cleanup_interval:
            return
        
        cutoff = now - 60  # 1 minute window
        for key in list(self.requests.keys()):
            self.requests[key] = [t for t in self.requests[key] if t > cutoff]
            if not self.requests[key]:
                del self.requests[key]
        
        self.last_cleanup = now
    
    def is_allowed(self, key: str, limit: int) -> tuple[bool, int]:
        """
        Check if request is allowed under rate limit.
        
        Returns:
            (allowed: bool, remaining: int)
        """
        self._cleanup()
        
        now = time.time()
        window_start = now - 60  # 1 minute window
        
        # Filter to only requests in current window
        self.requests[key] = [t for t in self.requests[key] if t > window_start]
        
        current_count = len(self.requests[key])
        remaining = max(0, limit - current_count)
        
        if current_count >= limit:
            return False, remaining
        
        self.requests[key].append(now)
        return True, remaining - 1


class RedisRateLimiter:
    """
    Redis-based rate limiter for docker/production mode.
    Uses sorted sets for efficient sliding window.
    """
    def __init__(self, redis_client):
        self.redis = redis_client
        self.window_size = 60  # 1 minute
    
    async def is_allowed(self, key: str, limit: int) -> tuple[bool, int]:
        """
        Check if request is allowed under rate limit using Redis.
        
        Returns:
            (allowed: bool, remaining: int)
        """
        now = time.time()
        window_start = now - self.window_size
        
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiry on the key
        pipe.expire(key, self.window_size + 1)
        
        results = await pipe.execute()
        current_count = results[1]
        
        remaining = max(0, limit - current_count)
        
        if current_count >= limit:
            return False, remaining
        
        return True, remaining


# Global in-memory limiter instance
_in_memory_limiter = InMemoryRateLimiter()
_redis_limiter: Optional[RedisRateLimiter] = None


def get_rate_limiter():
    """Get the appropriate rate limiter based on deployment mode."""
    global _redis_limiter
    
    if settings.is_docker_mode:
        if _redis_limiter is None:
            try:
                import redis.asyncio as redis
                redis_client = redis.from_url(settings.REDIS_URL)
                _redis_limiter = RedisRateLimiter(redis_client)
            except Exception as e:
                logger.warning(f"Failed to initialize Redis rate limiter: {e}. Falling back to in-memory.")
                return _in_memory_limiter
        return _redis_limiter
    
    return _in_memory_limiter


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check X-Forwarded-For header (set by nginx/proxies)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Get the first IP (original client)
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct connection IP
    if request.client:
        return request.client.host
    
    return "unknown"


# Rate limit configurations for different endpoints
RATE_LIMITS = {
    # Sensitive operations - stricter limits
    "/api/auth/": 20,        # Auth endpoints: 20 req/min
    "/api/uploads/": 30,     # File uploads: 30 req/min
    "/api/imports/": 10,     # Scan imports: 10 req/min
    "/api/v1/ai/": 20,       # AI endpoints: 20 req/min
    
    # Standard API - default limits
    "default": settings.RATE_LIMIT_PER_MINUTE,  # 60 req/min
}


def get_rate_limit_for_path(path: str) -> int:
    """Get the appropriate rate limit for a given path."""
    for prefix, limit in RATE_LIMITS.items():
        if prefix != "default" and path.startswith(prefix):
            return limit
    return RATE_LIMITS["default"]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    
    SECURITY: Protects against:
    - Brute force authentication attacks
    - API abuse and scraping
    - Denial of Service (DoS) attempts
    - Resource exhaustion
    """
    
    # Paths to exclude from rate limiting
    EXCLUDED_PATHS = {
        "/",
        "/health",
        "/api/docs",
        "/api/redoc",
        "/api/openapi.json",
    }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for excluded paths
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)
        
        # Skip static files
        if request.url.path.startswith("/uploads/"):
            return await call_next(request)
        
        # Get client identifier
        client_ip = get_client_ip(request)
        
        # Include user ID if authenticated (for per-user limits)
        user_id = request.headers.get("X-User-ID", "")
        rate_key = f"rate_limit:{client_ip}:{user_id}:{request.url.path}"
        
        # Get appropriate rate limit
        limit = get_rate_limit_for_path(request.url.path)
        
        # Check rate limit
        limiter = get_rate_limiter()
        
        if isinstance(limiter, RedisRateLimiter):
            allowed, remaining = await limiter.is_allowed(rate_key, limit)
        else:
            allowed, remaining = limiter.is_allowed(rate_key, limit)
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for {client_ip} on {request.url.path}")
            
            return Response(
                content='{"detail": "Rate limit exceeded. Please try again later."}',
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={
                    "Content-Type": "application/json",
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "60",
                },
                media_type="application/json"
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response


def rate_limit(limit: int = None):
    """
    Decorator for applying custom rate limits to specific endpoints.
    
    Usage:
        @router.post("/sensitive-endpoint")
        @rate_limit(limit=5)  # 5 requests per minute
        async def sensitive_endpoint():
            ...
    """
    def decorator(func: Callable) -> Callable:
        func._rate_limit = limit or settings.RATE_LIMIT_PER_MINUTE
        return func
    return decorator

