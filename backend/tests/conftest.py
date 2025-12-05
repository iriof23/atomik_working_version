"""
Pytest Configuration and Fixtures

This file contains shared fixtures and configuration for all tests.
"""
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_db():
    """Mock database for testing without actual database connection."""
    mock = MagicMock()
    mock.auditlog = MagicMock()
    mock.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
    return mock


@pytest.fixture
def sample_finding_html():
    """Sample HTML content from a rich text editor."""
    return '''
    <h2>SQL Injection</h2>
    <p>A <strong>critical</strong> vulnerability was found.</p>
    <pre><code>' OR '1'='1' --</code></pre>
    <ul>
        <li>Impact: High</li>
        <li>Likelihood: High</li>
    </ul>
    '''


@pytest.fixture
def malicious_html_samples():
    """Collection of malicious HTML payloads for XSS testing."""
    return [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<a href="javascript:alert(\'XSS\')">Click</a>',
        '<div onmouseover="alert(\'XSS\')">Hover</div>',
        '<iframe src="https://evil.com"></iframe>',
        '<object data="evil.swf"></object>',
        '<embed src="evil.swf">',
        '<svg onload="alert(\'XSS\')">',
        '<body onload="alert(\'XSS\')">',
        '<input onfocus="alert(\'XSS\')" autofocus>',
    ]


@pytest.fixture
def png_magic_bytes():
    """Valid PNG file magic bytes."""
    return b'\x89PNG\r\n\x1a\n' + b'\x00' * 100


@pytest.fixture
def jpeg_magic_bytes():
    """Valid JPEG file magic bytes."""
    return b'\xff\xd8\xff\xe0' + b'\x00' * 100


@pytest.fixture
def gif_magic_bytes():
    """Valid GIF file magic bytes."""
    return b'GIF89a' + b'\x00' * 100


@pytest.fixture
def pdf_magic_bytes():
    """Valid PDF file magic bytes."""
    return b'%PDF-1.4' + b'\x00' * 100


@pytest.fixture
def safe_svg():
    """Safe SVG content without scripts."""
    return b'''<?xml version="1.0"?>
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100" height="100" fill="blue"/>
        <circle cx="50" cy="50" r="40" fill="red"/>
    </svg>'''


@pytest.fixture
def malicious_svg():
    """Malicious SVG with embedded script."""
    return b'''<?xml version="1.0"?>
    <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert('XSS')</script>
        <rect width="100" height="100"/>
    </svg>'''


@pytest.fixture
def mock_request():
    """Mock Starlette Request object."""
    from starlette.requests import Request
    
    request = MagicMock(spec=Request)
    request.headers = {}
    request.client = MagicMock()
    request.client.host = '127.0.0.1'
    request.state = MagicMock()
    request.url = MagicMock()
    request.url.path = '/api/test'
    request.method = 'GET'
    
    return request


# Event loop fixture for async tests
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

