"""
Tests for Rate Limiting

These tests verify that:
1. Rate limits are properly enforced
2. Different endpoints have appropriate limits
3. Rate limit headers are correctly set
4. Rate limiting resets after the window expires

SECURITY: Prevents brute force attacks, API abuse, and DoS.
"""
import pytest
import time
from app.core.rate_limit import (
    InMemoryRateLimiter,
    get_rate_limit_for_path,
    RATE_LIMITS,
)


class TestInMemoryRateLimiter:
    """Tests for the in-memory rate limiter."""
    
    def test_allows_requests_under_limit(self):
        """Requests under the limit should be allowed."""
        limiter = InMemoryRateLimiter()
        
        # Make 5 requests (under default 60 limit)
        for i in range(5):
            allowed, remaining = limiter.is_allowed('test_key', limit=10)
            assert allowed is True
            assert remaining >= 0
    
    def test_blocks_requests_over_limit(self):
        """Requests over the limit should be blocked."""
        limiter = InMemoryRateLimiter()
        limit = 5
        
        # Make requests up to the limit
        for i in range(limit):
            allowed, _ = limiter.is_allowed('test_key', limit=limit)
            assert allowed is True
        
        # Next request should be blocked
        allowed, remaining = limiter.is_allowed('test_key', limit=limit)
        assert allowed is False
        assert remaining == 0
    
    def test_remaining_count_decreases(self):
        """Remaining count should decrease with each request."""
        limiter = InMemoryRateLimiter()
        limit = 10
        
        for i in range(5):
            allowed, remaining = limiter.is_allowed('test_key', limit=limit)
            assert allowed is True
            # Remaining should decrease (roughly, might vary by 1)
            assert remaining <= limit - i
    
    def test_different_keys_have_separate_limits(self):
        """Different keys should have independent rate limits."""
        limiter = InMemoryRateLimiter()
        limit = 3
        
        # Exhaust limit for key1
        for _ in range(limit):
            limiter.is_allowed('key1', limit=limit)
        
        # key1 should be blocked
        allowed1, _ = limiter.is_allowed('key1', limit=limit)
        assert allowed1 is False
        
        # key2 should still be allowed
        allowed2, _ = limiter.is_allowed('key2', limit=limit)
        assert allowed2 is True
    
    def test_cleanup_removes_old_entries(self):
        """Old entries should be cleaned up."""
        limiter = InMemoryRateLimiter()
        limiter.cleanup_interval = 0  # Force cleanup on every call
        
        # Add some requests
        limiter.is_allowed('test_key', limit=10)
        
        # Verify key exists
        assert 'test_key' in limiter.requests
        
        # Manually age the entries
        limiter.requests['test_key'] = [time.time() - 120]  # 2 minutes ago
        
        # Trigger cleanup
        limiter._cleanup()
        
        # Old entries should be removed
        assert len(limiter.requests.get('test_key', [])) == 0


class TestRateLimitConfiguration:
    """Tests for rate limit configuration per endpoint."""
    
    def test_auth_endpoint_has_stricter_limit(self):
        """Auth endpoints should have lower limits (brute force protection)."""
        limit = get_rate_limit_for_path('/api/auth/login')
        
        assert limit == RATE_LIMITS['/api/auth/']
        assert limit < RATE_LIMITS['default']
    
    def test_upload_endpoint_has_limit(self):
        """Upload endpoints should have limits."""
        limit = get_rate_limit_for_path('/api/uploads/screenshot')
        
        assert limit == RATE_LIMITS['/api/uploads/']
    
    def test_import_endpoint_has_lowest_limit(self):
        """Import endpoints should have the lowest limits (heavy operations)."""
        limit = get_rate_limit_for_path('/api/imports/burp/123')
        
        assert limit == RATE_LIMITS['/api/imports/']
        # Import should have the lowest limit
        assert limit <= min(
            RATE_LIMITS['/api/auth/'],
            RATE_LIMITS['/api/uploads/'],
        )
    
    def test_ai_endpoint_has_limit(self):
        """AI endpoints should have limits (expensive operations)."""
        limit = get_rate_limit_for_path('/api/v1/ai/generate')
        
        assert limit == RATE_LIMITS['/api/v1/ai/']
    
    def test_unknown_endpoint_gets_default_limit(self):
        """Unknown endpoints should get the default limit."""
        limit = get_rate_limit_for_path('/api/unknown/endpoint')
        
        assert limit == RATE_LIMITS['default']
    
    def test_findings_endpoint_gets_default_limit(self):
        """Standard API endpoints should get default limit."""
        limit = get_rate_limit_for_path('/api/findings/')
        
        assert limit == RATE_LIMITS['default']


class TestRateLimitBehavior:
    """Tests for rate limit behavior edge cases."""
    
    def test_burst_followed_by_block(self):
        """Rapid burst of requests should eventually be blocked."""
        limiter = InMemoryRateLimiter()
        limit = 10
        
        blocked_at = None
        for i in range(20):
            allowed, _ = limiter.is_allowed('burst_test', limit=limit)
            if not allowed:
                blocked_at = i
                break
        
        assert blocked_at is not None
        assert blocked_at == limit
    
    def test_rate_limit_key_includes_path(self):
        """Rate limit should be per-path, not just per-IP."""
        limiter = InMemoryRateLimiter()
        limit = 3
        
        # Exhaust limit for path1
        for _ in range(limit):
            limiter.is_allowed('ip:path1', limit=limit)
        
        # path1 should be blocked
        allowed1, _ = limiter.is_allowed('ip:path1', limit=limit)
        assert allowed1 is False
        
        # path2 should still work
        allowed2, _ = limiter.is_allowed('ip:path2', limit=limit)
        assert allowed2 is True


class TestRateLimitHeaders:
    """Tests for rate limit response headers format."""
    
    def test_remaining_is_non_negative(self):
        """Remaining count should never be negative."""
        limiter = InMemoryRateLimiter()
        limit = 3
        
        # Make more requests than the limit
        for _ in range(10):
            _, remaining = limiter.is_allowed('test', limit=limit)
            assert remaining >= 0
    
    def test_allowed_returns_correct_remaining(self):
        """When allowed, remaining should reflect requests left."""
        limiter = InMemoryRateLimiter()
        limit = 5
        
        allowed, remaining = limiter.is_allowed('test', limit=limit)
        
        assert allowed is True
        assert remaining == limit - 1  # One request made


class TestEndpointSpecificLimits:
    """Tests for specific endpoint rate limits."""
    
    def test_auth_endpoints_protected(self):
        """All auth endpoints should have protection."""
        auth_paths = [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/refresh',
            '/api/auth/me',
        ]
        
        for path in auth_paths:
            limit = get_rate_limit_for_path(path)
            assert limit == RATE_LIMITS['/api/auth/'], f"Wrong limit for {path}"
    
    def test_upload_endpoints_protected(self):
        """All upload endpoints should have protection."""
        upload_paths = [
            '/api/uploads/screenshot',
            '/api/uploads/evidence',
        ]
        
        for path in upload_paths:
            limit = get_rate_limit_for_path(path)
            assert limit == RATE_LIMITS['/api/uploads/'], f"Wrong limit for {path}"
    
    def test_import_endpoints_protected(self):
        """All import endpoints should have protection."""
        import_paths = [
            '/api/imports/burp/123',
            '/api/imports/nessus/456',
        ]
        
        for path in import_paths:
            limit = get_rate_limit_for_path(path)
            assert limit == RATE_LIMITS['/api/imports/'], f"Wrong limit for {path}"

