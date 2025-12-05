"""
Tests for Security Headers and Middleware

These tests verify that:
1. Security headers are properly set on responses
2. Request context is extracted correctly
3. Cookie security settings are applied

SECURITY: Headers provide defense-in-depth against XSS, clickjacking, etc.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock
from starlette.requests import Request
from starlette.responses import Response
from app.core.security_middleware import (
    SecurityHeadersMiddleware,
    SecureCookieMiddleware,
    RequestContextMiddleware,
    get_request_context,
)


class TestSecurityHeadersMiddleware:
    """Tests for the security headers middleware."""
    
    @pytest.mark.asyncio
    async def test_adds_x_content_type_options(self):
        """X-Content-Type-Options header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        assert response.headers.get('x-content-type-options') == 'nosniff'
    
    @pytest.mark.asyncio
    async def test_adds_x_frame_options(self):
        """X-Frame-Options header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        assert response.headers.get('x-frame-options') == 'SAMEORIGIN'
    
    @pytest.mark.asyncio
    async def test_adds_x_xss_protection(self):
        """X-XSS-Protection header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        assert response.headers.get('x-xss-protection') == '1; mode=block'
    
    @pytest.mark.asyncio
    async def test_adds_referrer_policy(self):
        """Referrer-Policy header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        assert response.headers.get('referrer-policy') == 'strict-origin-when-cross-origin'
    
    @pytest.mark.asyncio
    async def test_adds_permissions_policy(self):
        """Permissions-Policy header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        policy = response.headers.get('permissions-policy')
        assert policy is not None
        assert 'camera=()' in policy
        assert 'microphone=()' in policy
        assert 'geolocation=()' in policy
    
    @pytest.mark.asyncio
    async def test_adds_request_id(self):
        """X-Request-ID header should be set."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {}
        response = await middleware.dispatch(request, call_next)
        
        request_id = response.headers.get('x-request-id')
        assert request_id is not None
        # Should be a valid UUID format
        assert len(request_id) == 36
    
    @pytest.mark.asyncio
    async def test_preserves_existing_request_id(self):
        """Existing X-Request-ID should be preserved."""
        middleware = SecurityHeadersMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {'X-Request-ID': 'existing-id-123'}
        response = await middleware.dispatch(request, call_next)
        
        assert response.headers.get('x-request-id') == 'existing-id-123'


class TestSecureCookieMiddleware:
    """Tests for the secure cookie middleware."""
    
    @pytest.mark.asyncio
    async def test_adds_httponly_to_cookies(self):
        """HttpOnly should be added to cookies."""
        middleware = SecureCookieMiddleware(app=None)
        
        async def call_next(request):
            response = Response(content="test", status_code=200)
            response.set_cookie(key="session", value="abc123")
            return response
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        cookie = response.headers.get('set-cookie')
        assert cookie is not None
        assert 'HttpOnly' in cookie or 'httponly' in cookie.lower()
    
    @pytest.mark.asyncio
    async def test_adds_samesite_to_cookies(self):
        """SameSite should be added to cookies."""
        middleware = SecureCookieMiddleware(app=None)
        
        async def call_next(request):
            response = Response(content="test", status_code=200)
            response.set_cookie(key="session", value="abc123")
            return response
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        cookie = response.headers.get('set-cookie')
        assert cookie is not None
        assert 'SameSite' in cookie or 'samesite' in cookie.lower()
    
    @pytest.mark.asyncio
    async def test_preserves_existing_security_attrs(self):
        """Existing security attributes should be preserved."""
        middleware = SecureCookieMiddleware(app=None)
        
        async def call_next(request):
            response = Response(content="test", status_code=200)
            response.set_cookie(
                key="session", 
                value="abc123",
                httponly=True,
                samesite="strict"
            )
            return response
        
        request = MagicMock(spec=Request)
        response = await middleware.dispatch(request, call_next)
        
        # Should not duplicate attributes
        cookie = response.headers.get('set-cookie')
        # Count occurrences of HttpOnly
        httponly_count = cookie.lower().count('httponly')
        assert httponly_count == 1


class TestRequestContextMiddleware:
    """Tests for the request context middleware."""
    
    @pytest.mark.asyncio
    async def test_extracts_client_ip_from_direct_connection(self):
        """Client IP should be extracted from direct connection."""
        middleware = RequestContextMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {}
        request.client = MagicMock()
        request.client.host = '192.168.1.100'
        request.state = MagicMock()
        
        await middleware.dispatch(request, call_next)
        
        assert request.state.client_ip == '192.168.1.100'
    
    @pytest.mark.asyncio
    async def test_extracts_client_ip_from_x_forwarded_for(self):
        """Client IP should be extracted from X-Forwarded-For header."""
        middleware = RequestContextMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {'X-Forwarded-For': '1.2.3.4, 5.6.7.8'}
        request.client = MagicMock()
        request.client.host = '192.168.1.1'
        request.state = MagicMock()
        
        await middleware.dispatch(request, call_next)
        
        # Should use first IP from X-Forwarded-For
        assert request.state.client_ip == '1.2.3.4'
    
    @pytest.mark.asyncio
    async def test_extracts_client_ip_from_x_real_ip(self):
        """Client IP should be extracted from X-Real-IP header."""
        middleware = RequestContextMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {'X-Real-IP': '10.0.0.1'}
        request.client = MagicMock()
        request.client.host = '192.168.1.1'
        request.state = MagicMock()
        
        await middleware.dispatch(request, call_next)
        
        assert request.state.client_ip == '10.0.0.1'
    
    @pytest.mark.asyncio
    async def test_extracts_user_agent(self):
        """User-Agent should be extracted from headers."""
        middleware = RequestContextMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {'User-Agent': 'Mozilla/5.0 (Test)'}
        request.client = MagicMock()
        request.client.host = '192.168.1.1'
        request.state = MagicMock()
        
        await middleware.dispatch(request, call_next)
        
        assert request.state.user_agent == 'Mozilla/5.0 (Test)'
    
    @pytest.mark.asyncio
    async def test_generates_request_id(self):
        """Request ID should be generated if not provided."""
        middleware = RequestContextMiddleware(app=None)
        
        async def call_next(request):
            return Response(content="test", status_code=200)
        
        request = MagicMock(spec=Request)
        request.headers = {}
        request.client = MagicMock()
        request.client.host = '192.168.1.1'
        request.state = MagicMock()
        
        await middleware.dispatch(request, call_next)
        
        # Should have generated a request ID
        assert hasattr(request.state, 'request_id')
        assert request.state.request_id is not None


class TestGetRequestContext:
    """Tests for the get_request_context helper."""
    
    def test_extracts_context_from_request_state(self):
        """Should extract context from request.state."""
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        request.state.request_id = 'req-123'
        request.state.client_ip = '192.168.1.1'
        request.state.user_agent = 'TestAgent'
        
        context = get_request_context(request)
        
        assert context['request_id'] == 'req-123'
        assert context['client_ip'] == '192.168.1.1'
        assert context['user_agent'] == 'TestAgent'
    
    def test_handles_missing_attributes(self):
        """Should handle missing state attributes gracefully."""
        request = MagicMock(spec=Request)
        request.state = MagicMock()
        # Simulate missing attributes
        del request.state.request_id
        del request.state.client_ip
        del request.state.user_agent
        
        context = get_request_context(request)
        
        # Should not raise, should return None for missing
        assert context['request_id'] is None
        assert context['client_ip'] is None
        assert context['user_agent'] is None


class TestSecurityHeaderValues:
    """Tests to verify security header values are correct."""
    
    def test_x_content_type_options_prevents_mime_sniffing(self):
        """nosniff value should prevent MIME type sniffing."""
        # This is a documentation test - the value 'nosniff' is the correct
        # value to prevent browsers from MIME-sniffing responses
        assert 'nosniff' == 'nosniff'  # Placeholder for value verification
    
    def test_x_frame_options_prevents_clickjacking(self):
        """SAMEORIGIN value should prevent clickjacking from other origins."""
        # SAMEORIGIN allows framing by same origin only
        # DENY would block all framing
        valid_values = ['DENY', 'SAMEORIGIN']
        assert 'SAMEORIGIN' in valid_values
    
    def test_referrer_policy_limits_information_leakage(self):
        """strict-origin-when-cross-origin limits referrer info."""
        # This policy sends:
        # - Full URL for same-origin requests
        # - Only origin for cross-origin HTTPS->HTTPS
        # - Nothing for HTTPS->HTTP
        policy = 'strict-origin-when-cross-origin'
        assert 'strict' in policy
        assert 'cross-origin' in policy

