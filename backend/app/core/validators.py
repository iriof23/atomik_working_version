"""
Input Validation Utilities

SECURITY: Provides reusable validators for common input types.
These help prevent injection attacks and ensure data integrity.
"""
import re
from typing import Optional
from pydantic import field_validator, model_validator
import html


# Maximum lengths for various fields
MAX_TITLE_LENGTH = 500
MAX_DESCRIPTION_LENGTH = 100000  # 100KB - for rich text
MAX_SHORT_TEXT_LENGTH = 1000
MAX_URL_LENGTH = 2048
MAX_EMAIL_LENGTH = 320  # RFC 5321
MAX_PHONE_LENGTH = 50


# Regex patterns
EMAIL_PATTERN = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

# Phone pattern - allows international formats
PHONE_PATTERN = re.compile(
    r'^[\d\s\-\+\(\)\.]+$'
)

# UUID pattern
UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)

# Safe text pattern - alphanumeric, spaces, and common punctuation
SAFE_TEXT_PATTERN = re.compile(
    r'^[\w\s\-\.,!?@#$%&*()\'\"]+$',
    re.UNICODE
)

# URL pattern - basic validation
URL_PATTERN = re.compile(
    r'^https?://[^\s<>"{}|\\^`\[\]]+$',
    re.IGNORECASE
)


def sanitize_string(value: str, max_length: int = MAX_SHORT_TEXT_LENGTH) -> str:
    """
    Sanitize a string input.
    
    - Strips whitespace
    - Truncates to max length
    - Removes null bytes
    """
    if not value:
        return value
    
    # Remove null bytes (can break database/queries)
    value = value.replace('\x00', '')
    
    # Strip whitespace
    value = value.strip()
    
    # Truncate
    if len(value) > max_length:
        value = value[:max_length]
    
    return value


def validate_email(email: str) -> str:
    """Validate and normalize email address."""
    if not email:
        return email
    
    email = sanitize_string(email, MAX_EMAIL_LENGTH).lower()
    
    if not EMAIL_PATTERN.match(email):
        raise ValueError("Invalid email address format")
    
    return email


def validate_phone(phone: str) -> str:
    """Validate phone number format."""
    if not phone:
        return phone
    
    phone = sanitize_string(phone, MAX_PHONE_LENGTH)
    
    if not PHONE_PATTERN.match(phone):
        raise ValueError("Invalid phone number format")
    
    return phone


def validate_uuid(uuid_str: str) -> str:
    """Validate UUID format."""
    if not uuid_str:
        return uuid_str
    
    uuid_str = sanitize_string(uuid_str, 36).lower()
    
    if not UUID_PATTERN.match(uuid_str):
        raise ValueError("Invalid UUID format")
    
    return uuid_str


def validate_url(url: str) -> str:
    """Validate URL format."""
    if not url:
        return url
    
    url = sanitize_string(url, MAX_URL_LENGTH)
    
    if not URL_PATTERN.match(url):
        raise ValueError("Invalid URL format")
    
    # Prevent javascript: and data: URLs (XSS)
    url_lower = url.lower()
    if url_lower.startswith('javascript:') or url_lower.startswith('data:'):
        raise ValueError("URL scheme not allowed")
    
    return url


def validate_severity(severity: str) -> str:
    """Validate severity level."""
    allowed = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL', 'INFO'}
    severity = sanitize_string(severity, 20).upper()
    
    # Handle common variations
    if severity == 'INFO':
        severity = 'INFORMATIONAL'
    
    if severity not in allowed:
        raise ValueError(f"Invalid severity. Must be one of: {', '.join(allowed)}")
    
    return severity


def validate_status(status: str) -> str:
    """Validate finding status."""
    allowed = {'OPEN', 'IN_PROGRESS', 'FIXED', 'ACCEPTED_RISK'}
    status = sanitize_string(status, 20).upper()
    
    # Handle common variations
    status = status.replace(' ', '_').replace('-', '_')
    
    if status not in allowed:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(allowed)}")
    
    return status


def escape_html_content(text: str) -> str:
    """
    Escape HTML special characters for safe display.
    Use this for plain text fields that shouldn't contain HTML.
    """
    if not text:
        return text
    
    return html.escape(text)


def validate_filename(filename: str) -> str:
    """
    Validate and sanitize a filename.
    
    SECURITY: Prevents path traversal attacks.
    """
    if not filename:
        raise ValueError("Filename is required")
    
    filename = sanitize_string(filename, 255)
    
    # Remove path separators (prevents path traversal)
    filename = filename.replace('/', '').replace('\\', '')
    
    # Remove null bytes
    filename = filename.replace('\x00', '')
    
    # Check for empty filename after sanitization
    if not filename or filename in ('.', '..'):
        raise ValueError("Invalid filename")
    
    return filename


class ValidatedMixin:
    """
    Mixin class providing common validators for Pydantic models.
    
    Usage:
        class MyModel(ValidatedMixin, BaseModel):
            email: Optional[str] = None
            phone: Optional[str] = None
    """
    
    @field_validator('email', mode='before', check_fields=False)
    @classmethod
    def validate_email_field(cls, v):
        if v:
            return validate_email(v)
        return v
    
    @field_validator('phone', mode='before', check_fields=False)
    @classmethod
    def validate_phone_field(cls, v):
        if v:
            return validate_phone(v)
        return v


def validate_rich_text(text: str, max_length: int = MAX_DESCRIPTION_LENGTH) -> str:
    """
    Validate rich text content (HTML from editor).
    
    Note: Actual HTML sanitization is done by RichTextService.
    This just does length and basic checks.
    """
    if not text:
        return text
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Check length
    if len(text) > max_length:
        raise ValueError(f"Content too long (max {max_length} characters)")
    
    return text

