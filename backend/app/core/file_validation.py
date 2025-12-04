"""
File Type Validation using Magic Bytes

SECURITY: Validates file types by examining file content (magic bytes),
not just file extensions. This prevents attackers from uploading malicious
files disguised with innocent extensions.

Example attack prevented:
- Attacker uploads `evil.png` that's actually a PHP script
- Extension check passes (it ends in .png)
- Magic byte check fails (content doesn't start with PNG signature)
"""
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


# Magic byte signatures for common file types
# Format: (extension, mime_type, magic_bytes, offset)
MAGIC_SIGNATURES = {
    # Images
    "png": {
        "mime": "image/png",
        "signatures": [
            (b'\x89PNG\r\n\x1a\n', 0),  # PNG signature
        ]
    },
    "jpg": {
        "mime": "image/jpeg",
        "signatures": [
            (b'\xff\xd8\xff\xe0', 0),  # JPEG JFIF
            (b'\xff\xd8\xff\xe1', 0),  # JPEG EXIF
            (b'\xff\xd8\xff\xe8', 0),  # JPEG SPIFF
            (b'\xff\xd8\xff\xdb', 0),  # JPEG raw
            (b'\xff\xd8\xff\xee', 0),  # JPEG (Adobe)
        ]
    },
    "jpeg": {
        "mime": "image/jpeg",
        "signatures": [
            (b'\xff\xd8\xff\xe0', 0),
            (b'\xff\xd8\xff\xe1', 0),
            (b'\xff\xd8\xff\xe8', 0),
            (b'\xff\xd8\xff\xdb', 0),
            (b'\xff\xd8\xff\xee', 0),
        ]
    },
    "gif": {
        "mime": "image/gif",
        "signatures": [
            (b'GIF87a', 0),  # GIF87a
            (b'GIF89a', 0),  # GIF89a
        ]
    },
    "webp": {
        "mime": "image/webp",
        "signatures": [
            (b'RIFF', 0),  # WebP starts with RIFF (need to check WEBP at offset 8)
        ]
    },
    "svg": {
        "mime": "image/svg+xml",
        "signatures": [
            (b'<?xml', 0),      # XML declaration
            (b'<svg', 0),       # Direct SVG tag
            (b'\xef\xbb\xbf<?xml', 0),  # UTF-8 BOM + XML
            (b'\xef\xbb\xbf<svg', 0),   # UTF-8 BOM + SVG
        ]
    },
    
    # Documents
    "pdf": {
        "mime": "application/pdf",
        "signatures": [
            (b'%PDF-', 0),  # PDF signature
        ]
    },
    
    # XML-based (Burp, Nessus exports)
    "xml": {
        "mime": "application/xml",
        "signatures": [
            (b'<?xml', 0),
            (b'\xef\xbb\xbf<?xml', 0),  # UTF-8 BOM
            (b'\xff\xfe<\x00?\x00x\x00m\x00l', 0),  # UTF-16 LE
            (b'\xfe\xff\x00<\x00?\x00x\x00m\x00l', 0),  # UTF-16 BE
        ]
    },
    "nessus": {
        "mime": "application/xml",
        "signatures": [
            (b'<?xml', 0),
            (b'\xef\xbb\xbf<?xml', 0),
        ]
    },
    
    # Text files
    "txt": {
        "mime": "text/plain",
        "signatures": []  # No specific signature for text files
    },
}


def get_magic_bytes(content: bytes, length: int = 16) -> bytes:
    """Get the first N bytes of file content."""
    return content[:length]


def validate_magic_bytes(
    content: bytes, 
    claimed_extension: str
) -> Tuple[bool, Optional[str]]:
    """
    Validate file content against its claimed extension using magic bytes.
    
    Args:
        content: The file content (at least first 16 bytes)
        claimed_extension: The file extension claimed by the upload
        
    Returns:
        (is_valid: bool, detected_type: Optional[str])
        
    SECURITY: This prevents extension spoofing attacks where malicious
    files are uploaded with innocent extensions.
    """
    ext = claimed_extension.lower().lstrip('.')
    
    # Get signature info for this extension
    sig_info = MAGIC_SIGNATURES.get(ext)
    
    if not sig_info:
        # Unknown extension - deny by default for security
        logger.warning(f"Unknown file extension: {ext}")
        return False, None
    
    signatures = sig_info.get("signatures", [])
    
    # Text files don't have magic bytes - allow with basic checks
    if not signatures:
        if ext == "txt":
            # Check for null bytes (binary data)
            if b'\x00' in content[:1024]:
                logger.warning("TXT file contains binary data (null bytes)")
                return False, None
            return True, "text/plain"
        return False, None
    
    # Check content against known signatures
    for signature, offset in signatures:
        if len(content) >= offset + len(signature):
            if content[offset:offset + len(signature)] == signature:
                # Special handling for WebP (needs additional check)
                if ext == "webp":
                    if len(content) >= 12 and content[8:12] == b'WEBP':
                        return True, sig_info["mime"]
                    continue
                
                return True, sig_info["mime"]
    
    # No signature matched
    logger.warning(f"Magic bytes don't match claimed extension '{ext}'")
    logger.debug(f"Content starts with: {content[:16].hex()}")
    
    # Try to detect actual file type
    detected = detect_file_type(content)
    if detected:
        logger.warning(f"File appears to be '{detected}' but was uploaded as '{ext}'")
    
    return False, detected


def detect_file_type(content: bytes) -> Optional[str]:
    """
    Detect the actual file type from content.
    
    Returns the detected file extension or None if unknown.
    """
    for ext, info in MAGIC_SIGNATURES.items():
        for signature, offset in info.get("signatures", []):
            if len(content) >= offset + len(signature):
                if content[offset:offset + len(signature)] == signature:
                    # Special WebP check
                    if ext == "webp":
                        if len(content) >= 12 and content[8:12] != b'WEBP':
                            continue
                    return ext
    
    return None


def is_safe_image(content: bytes, claimed_extension: str) -> Tuple[bool, str]:
    """
    Comprehensive safety check for image uploads.
    
    Returns:
        (is_safe: bool, reason: str)
    """
    ext = claimed_extension.lower().lstrip('.')
    
    # Check if it's an allowed image extension
    allowed_images = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
    if ext not in allowed_images:
        return False, f"Extension '{ext}' is not an allowed image type"
    
    # Validate magic bytes
    is_valid, detected_type = validate_magic_bytes(content, ext)
    
    if not is_valid:
        if detected_type:
            return False, f"File content doesn't match extension (detected: {detected_type})"
        return False, "File content doesn't match claimed image type"
    
    # Additional SVG security checks (SVGs can contain scripts)
    if ext == "svg":
        # Check for dangerous content in SVG
        content_str = content.decode('utf-8', errors='ignore').lower()
        dangerous_patterns = [
            '<script',
            'javascript:',
            'onerror=',
            'onload=',
            'onclick=',
            '<foreignobject',
        ]
        for pattern in dangerous_patterns:
            if pattern in content_str:
                return False, f"SVG contains potentially dangerous content: {pattern}"
    
    return True, "OK"


def validate_upload(
    content: bytes,
    filename: str,
    allowed_extensions: set
) -> Tuple[bool, str]:
    """
    Full validation for file uploads.
    
    Args:
        content: File content
        filename: Original filename
        allowed_extensions: Set of allowed extensions
        
    Returns:
        (is_valid: bool, message: str)
    """
    # Extract extension
    if '.' not in filename:
        return False, "File must have an extension"
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    # Check if extension is allowed
    if ext not in allowed_extensions:
        return False, f"File type '.{ext}' is not allowed"
    
    # Validate magic bytes
    is_valid, detected_type = validate_magic_bytes(content, ext)
    
    if not is_valid:
        if detected_type:
            return False, f"File content doesn't match extension (appears to be {detected_type})"
        return False, "Could not verify file type - content doesn't match extension"
    
    return True, "OK"

