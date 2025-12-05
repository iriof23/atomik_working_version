"""
Tests for File Validation (Magic Bytes & SVG Sanitization)

These tests verify that:
1. File types are validated by content (magic bytes), not just extension
2. SVG files are sanitized to remove embedded scripts
3. Malicious files disguised with innocent extensions are rejected

SECURITY: Prevents upload of malicious files disguised as images.
"""
import pytest
from app.core.file_validation import (
    validate_magic_bytes,
    is_safe_image,
    validate_upload,
    detect_file_type,
)


class TestMagicByteValidation:
    """Tests for magic byte file type verification."""
    
    def test_valid_png_file(self):
        """Valid PNG files should be accepted."""
        # PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        is_valid, mime = validate_magic_bytes(png_bytes, 'png')
        
        assert is_valid is True
        assert mime == 'image/png'
    
    def test_valid_jpeg_file(self):
        """Valid JPEG files should be accepted."""
        # JPEG magic bytes: FF D8 FF E0 (JFIF) or FF D8 FF E1 (EXIF)
        jpeg_bytes = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        
        is_valid, mime = validate_magic_bytes(jpeg_bytes, 'jpg')
        
        assert is_valid is True
        assert mime == 'image/jpeg'
    
    def test_valid_gif_file(self):
        """Valid GIF files should be accepted."""
        # GIF magic bytes: GIF89a or GIF87a
        gif_bytes = b'GIF89a' + b'\x00' * 100
        
        is_valid, mime = validate_magic_bytes(gif_bytes, 'gif')
        
        assert is_valid is True
        assert mime == 'image/gif'
    
    def test_valid_pdf_file(self):
        """Valid PDF files should be accepted."""
        # PDF magic bytes: %PDF-
        pdf_bytes = b'%PDF-1.4' + b'\x00' * 100
        
        is_valid, mime = validate_magic_bytes(pdf_bytes, 'pdf')
        
        assert is_valid is True
        assert mime == 'application/pdf'
    
    def test_valid_xml_file(self):
        """Valid XML files should be accepted."""
        xml_bytes = b'<?xml version="1.0"?><root></root>'
        
        is_valid, mime = validate_magic_bytes(xml_bytes, 'xml')
        
        assert is_valid is True
        assert mime == 'application/xml'


class TestMagicByteSpoofingPrevention:
    """Tests to prevent file type spoofing attacks."""
    
    def test_rejects_php_as_png(self):
        """PHP file with .png extension should be rejected."""
        php_content = b'<?php echo "evil"; ?>'
        
        is_valid, _ = validate_magic_bytes(php_content, 'png')
        
        assert is_valid is False
    
    def test_rejects_html_as_png(self):
        """HTML file with .png extension should be rejected."""
        html_content = b'<!DOCTYPE html><html><body>Evil</body></html>'
        
        is_valid, _ = validate_magic_bytes(html_content, 'png')
        
        assert is_valid is False
    
    def test_rejects_javascript_as_jpg(self):
        """JavaScript file with .jpg extension should be rejected."""
        js_content = b'function evil() { alert(1); }'
        
        is_valid, _ = validate_magic_bytes(js_content, 'jpg')
        
        assert is_valid is False
    
    def test_rejects_exe_as_gif(self):
        """Executable with .gif extension should be rejected."""
        # PE executable magic bytes: MZ
        exe_content = b'MZ' + b'\x00' * 100
        
        is_valid, _ = validate_magic_bytes(exe_content, 'gif')
        
        assert is_valid is False
    
    def test_rejects_empty_file(self):
        """Empty files should be rejected."""
        empty_content = b''
        
        is_valid, _ = validate_magic_bytes(empty_content, 'png')
        
        assert is_valid is False
    
    def test_rejects_text_as_image(self):
        """Plain text disguised as image should be rejected."""
        text_content = b'This is just plain text pretending to be an image.'
        
        is_valid, _ = validate_magic_bytes(text_content, 'png')
        
        assert is_valid is False


class TestFileTypeDetection:
    """Tests for automatic file type detection."""
    
    def test_detects_png(self):
        """Should detect PNG from content."""
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        detected = detect_file_type(png_bytes)
        
        assert detected == 'png'
    
    def test_detects_jpeg(self):
        """Should detect JPEG from content."""
        jpeg_bytes = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        
        detected = detect_file_type(jpeg_bytes)
        
        assert detected in ['jpg', 'jpeg']
    
    def test_detects_gif(self):
        """Should detect GIF from content."""
        gif_bytes = b'GIF89a' + b'\x00' * 100
        
        detected = detect_file_type(gif_bytes)
        
        assert detected == 'gif'
    
    def test_detects_pdf(self):
        """Should detect PDF from content."""
        pdf_bytes = b'%PDF-1.4' + b'\x00' * 100
        
        detected = detect_file_type(pdf_bytes)
        
        assert detected == 'pdf'
    
    def test_returns_none_for_unknown(self):
        """Should return None for unknown file types."""
        random_bytes = b'\x00\x01\x02\x03\x04\x05'
        
        detected = detect_file_type(random_bytes)
        
        assert detected is None


class TestSVGSecurity:
    """Tests for SVG file security."""
    
    def test_valid_svg_accepted(self):
        """Valid SVG without scripts should be accepted."""
        svg_content = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="blue"/>
        </svg>'''
        
        is_safe, reason = is_safe_image(svg_content, 'svg')
        
        assert is_safe is True
    
    def test_rejects_svg_with_script(self):
        """SVG containing <script> should be rejected."""
        malicious_svg = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg">
            <script>alert('XSS')</script>
            <rect width="100" height="100"/>
        </svg>'''
        
        is_safe, reason = is_safe_image(malicious_svg, 'svg')
        
        assert is_safe is False
        assert 'script' in reason.lower()
    
    def test_rejects_svg_with_javascript_url(self):
        """SVG with javascript: URL should be rejected."""
        malicious_svg = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg">
            <a href="javascript:alert('XSS')">
                <rect width="100" height="100"/>
            </a>
        </svg>'''
        
        is_safe, reason = is_safe_image(malicious_svg, 'svg')
        
        assert is_safe is False
        assert 'javascript' in reason.lower()
    
    def test_rejects_svg_with_onerror(self):
        """SVG with onerror handler should be rejected."""
        malicious_svg = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg">
            <image href="x" onerror="alert('XSS')"/>
        </svg>'''
        
        is_safe, reason = is_safe_image(malicious_svg, 'svg')
        
        assert is_safe is False
        assert 'onerror' in reason.lower()
    
    def test_rejects_svg_with_onload(self):
        """SVG with onload handler should be rejected."""
        malicious_svg = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
            <rect width="100" height="100"/>
        </svg>'''
        
        is_safe, reason = is_safe_image(malicious_svg, 'svg')
        
        assert is_safe is False
        assert 'onload' in reason.lower()
    
    def test_rejects_svg_with_foreignobject(self):
        """SVG with foreignObject (can embed HTML) should be rejected."""
        malicious_svg = b'''<?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg">
            <foreignObject width="100" height="100">
                <div>HTML inside SVG!</div>
            </foreignObject>
        </svg>'''
        
        is_safe, reason = is_safe_image(malicious_svg, 'svg')
        
        assert is_safe is False
        assert 'foreignobject' in reason.lower()


class TestUploadValidation:
    """Tests for complete upload validation."""
    
    def test_validates_png_upload(self):
        """Complete PNG upload should pass validation."""
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        is_valid, message = validate_upload(
            content=png_bytes,
            filename='screenshot.png',
            allowed_extensions={'png', 'jpg', 'gif'}
        )
        
        assert is_valid is True
        assert message == 'OK'
    
    def test_rejects_disallowed_extension(self):
        """Files with disallowed extensions should be rejected."""
        exe_bytes = b'MZ' + b'\x00' * 100
        
        is_valid, message = validate_upload(
            content=exe_bytes,
            filename='virus.exe',
            allowed_extensions={'png', 'jpg', 'gif'}
        )
        
        assert is_valid is False
        assert 'not allowed' in message.lower()
    
    def test_rejects_no_extension(self):
        """Files without extension should be rejected."""
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        is_valid, message = validate_upload(
            content=png_bytes,
            filename='noextension',
            allowed_extensions={'png', 'jpg', 'gif'}
        )
        
        assert is_valid is False
        assert 'extension' in message.lower()
    
    def test_rejects_mismatched_content(self):
        """Files where content doesn't match extension should be rejected."""
        php_bytes = b'<?php echo "evil"; ?>'
        
        is_valid, message = validate_upload(
            content=php_bytes,
            filename='evil.png',
            allowed_extensions={'png', 'jpg', 'gif'}
        )
        
        assert is_valid is False
        assert "doesn't match" in message.lower() or 'verify' in message.lower()


class TestEdgeCases:
    """Tests for edge cases in file validation."""
    
    def test_handles_uppercase_extension(self):
        """Uppercase extensions should be handled."""
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        is_valid, _ = validate_magic_bytes(png_bytes, 'PNG')
        
        assert is_valid is True
    
    def test_handles_extension_with_dot(self):
        """Extensions with leading dot should be handled."""
        png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * 100
        
        is_valid, _ = validate_magic_bytes(png_bytes, '.png')
        
        assert is_valid is True
    
    def test_handles_jpeg_vs_jpg(self):
        """Both .jpeg and .jpg should be accepted for JPEG files."""
        jpeg_bytes = b'\xff\xd8\xff\xe0' + b'\x00' * 100
        
        is_valid_jpeg, _ = validate_magic_bytes(jpeg_bytes, 'jpeg')
        is_valid_jpg, _ = validate_magic_bytes(jpeg_bytes, 'jpg')
        
        assert is_valid_jpeg is True
        assert is_valid_jpg is True
    
    def test_handles_utf8_bom_xml(self):
        """XML with UTF-8 BOM should be accepted."""
        xml_with_bom = b'\xef\xbb\xbf<?xml version="1.0"?><root></root>'
        
        is_valid, _ = validate_magic_bytes(xml_with_bom, 'xml')
        
        assert is_valid is True

