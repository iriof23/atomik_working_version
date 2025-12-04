"""
Rich Text Service for Report Generation

Converts Markdown content to sanitized HTML for PDF generation
and plain text for DOCX/summary fields.

SECURITY: This service is critical for preventing XSS attacks.
All HTML output from rich text editors must be sanitized here.
"""
import markdown
import bleach
import re
from typing import Optional, Callable
from urllib.parse import urlparse


class RichTextService:
    """Service for converting and sanitizing rich text content."""
    
    # Allowed HTML tags for PDF rendering
    # SECURITY: img tag is allowed but with strict attribute filtering
    ALLOWED_TAGS = [
        'p', 'b', 'i', 'strong', 'em', 
        'ul', 'ol', 'li', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'code', 'pre', 'br', 'hr',
        'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'span', 'div',
        'img',  # Images allowed with strict attribute filtering
    ]
    
    # Allowed attributes for HTML tags
    # SECURITY: NO event handlers (onerror, onload, onclick, etc.)
    ALLOWED_ATTRIBUTES = {
        '*': ['class', 'id'],
        'a': ['href', 'title', 'target', 'rel'],
        # img: Safe attributes only - NO onerror, onload, onclick, etc.
        'img': ['src', 'alt', 'title', 'width', 'height', 'data-align', 'data-caption'],
        'td': ['colspan', 'rowspan'],
        'th': ['colspan', 'rowspan'],
    }
    
    # Allowed URL schemes for links and images
    ALLOWED_PROTOCOLS = ['http', 'https', 'mailto', 'data']
    
    @staticmethod
    def _filter_img_src(tag: str, name: str, value: str) -> bool:
        """
        Custom filter to validate image sources.
        
        SECURITY: Prevents javascript: URLs and other dangerous schemes.
        Only allows:
        - http:// and https:// URLs
        - /uploads/ paths (our own uploads)
        - data:image/ URLs (base64 images, only image types)
        """
        if tag != 'img' or name != 'src':
            return True  # Let other attributes pass through normally
        
        if not value:
            return False
        
        value = value.strip().lower()
        
        # Allow our uploads path
        if value.startswith('/uploads/'):
            return True
        
        # Allow http/https URLs
        if value.startswith(('http://', 'https://')):
            return True
        
        # Allow base64 image data URLs (only actual image types)
        if value.startswith('data:image/'):
            # Ensure it's a valid image type
            valid_types = ['data:image/png', 'data:image/jpeg', 'data:image/jpg', 
                          'data:image/gif', 'data:image/webp', 'data:image/svg+xml']
            if any(value.startswith(t) for t in valid_types):
                return True
        
        # Block everything else (javascript:, vbscript:, etc.)
        return False
    
    @classmethod
    def _get_attribute_filter(cls) -> Callable:
        """
        Returns an attribute filter function for bleach.
        Combines allowed attributes with custom src validation.
        """
        def filter_attributes(tag: str, name: str, value: str) -> bool:
            # First check if attribute is in allowed list
            allowed_for_tag = cls.ALLOWED_ATTRIBUTES.get(tag, [])
            allowed_for_all = cls.ALLOWED_ATTRIBUTES.get('*', [])
            
            if name not in allowed_for_tag and name not in allowed_for_all:
                return False
            
            # Special handling for img src
            if tag == 'img' and name == 'src':
                return cls._filter_img_src(tag, name, value)
            
            # Special handling for href - block javascript: URLs
            if name == 'href':
                value_lower = value.strip().lower()
                if value_lower.startswith(('javascript:', 'vbscript:', 'data:')):
                    return False
            
            return True
        
        return filter_attributes
    
    # Markdown extensions for enhanced parsing
    MARKDOWN_EXTENSIONS = [
        'extra',           # Tables, fenced code, footnotes, etc.
        'codehilite',      # Syntax highlighting for code blocks
        'tables',          # Table support
        'fenced_code',     # Fenced code blocks (```)
        'nl2br',           # Newlines to <br>
        'sane_lists',      # Better list handling
    ]

    @classmethod
    def to_html(cls, text: str, strip_unsafe: bool = True) -> str:
        """
        Converts Markdown to sanitized HTML for the PDF engine.
        
        Args:
            text: Markdown formatted text
            strip_unsafe: Whether to sanitize HTML (default: True)
            
        Returns:
            Sanitized HTML string
        """
        if not text:
            return ""
        
        # Convert Markdown to HTML
        html = markdown.markdown(
            text, 
            extensions=RichTextService.MARKDOWN_EXTENSIONS,
            extension_configs={
                'codehilite': {
                    'css_class': 'highlight',
                    'linenums': False,
                }
            }
        )
        
        if strip_unsafe:
            # Sanitize HTML to prevent XSS
            # SECURITY: Uses custom attribute filter to validate img src URLs
            html = bleach.clean(
                html, 
                tags=RichTextService.ALLOWED_TAGS, 
                attributes=cls._get_attribute_filter(),
                protocols=cls.ALLOWED_PROTOCOLS,
                strip=True
            )
        
        return html

    @staticmethod
    def to_plain(text: str) -> str:
        """
        Strips all formatting for summary fields in DOCX or plain text exports.
        
        Args:
            text: Markdown or HTML formatted text
            
        Returns:
            Plain text string with no formatting
        """
        if not text:
            return ""
        
        # First convert Markdown to HTML
        html = markdown.markdown(text)
        
        # Strip all HTML tags
        plain = bleach.clean(html, tags=[], strip=True)
        
        # Clean up extra whitespace
        plain = re.sub(r'\s+', ' ', plain).strip()
        
        return plain

    @classmethod
    def sanitize_html(cls, html: str) -> str:
        """
        Sanitizes existing HTML content (e.g., from rich text editor).
        
        SECURITY: This is the primary sanitization point for user-submitted HTML.
        All content from the rich text editor should pass through here before storage.
        
        Args:
            html: Raw HTML string
            
        Returns:
            Sanitized HTML string with:
            - Dangerous tags stripped (script, iframe, object, etc.)
            - Event handlers removed (onerror, onload, onclick, etc.)
            - Image URLs validated (no javascript: or vbscript:)
            - Link URLs validated (no javascript: schemes)
        """
        if not html:
            return ""
        
        return bleach.clean(
            html,
            tags=cls.ALLOWED_TAGS,
            attributes=cls._get_attribute_filter(),
            protocols=cls.ALLOWED_PROTOCOLS,
            strip=True
        )

    @staticmethod
    def html_to_markdown(html: str) -> str:
        """
        Converts HTML back to Markdown (basic conversion).
        Useful for editing existing content.
        
        Args:
            html: HTML string
            
        Returns:
            Markdown formatted string
        """
        if not html:
            return ""
        
        # Basic HTML to Markdown conversion using regex
        text = html
        
        # Convert common HTML tags to Markdown
        replacements = [
            (r'<strong>(.*?)</strong>', r'**\1**'),
            (r'<b>(.*?)</b>', r'**\1**'),
            (r'<em>(.*?)</em>', r'*\1*'),
            (r'<i>(.*?)</i>', r'*\1*'),
            (r'<h1>(.*?)</h1>', r'# \1\n'),
            (r'<h2>(.*?)</h2>', r'## \1\n'),
            (r'<h3>(.*?)</h3>', r'### \1\n'),
            (r'<h4>(.*?)</h4>', r'#### \1\n'),
            (r'<code>(.*?)</code>', r'`\1`'),
            (r'<br\s*/?>', '\n'),
            (r'<hr\s*/?>', '\n---\n'),
            (r'<p>(.*?)</p>', r'\1\n\n'),
            (r'<li>(.*?)</li>', r'- \1\n'),
        ]
        
        for pattern, replacement in replacements:
            text = re.sub(pattern, replacement, text, flags=re.DOTALL | re.IGNORECASE)
        
        # Strip remaining HTML tags
        text = bleach.clean(text, tags=[], strip=True)
        
        # Clean up whitespace
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        
        return text

    @staticmethod
    def escape_for_pdf(text: str) -> str:
        """
        Escapes special characters for PDF generation engines like WeasyPrint.
        
        Args:
            text: Text to escape
            
        Returns:
            Escaped text safe for PDF rendering
        """
        if not text:
            return ""
        
        # Escape characters that might break PDF rendering
        escapes = [
            ('&', '&amp;'),
            ('<', '&lt;'),
            ('>', '&gt;'),
        ]
        
        for char, escape in escapes:
            text = text.replace(char, escape)
        
        return text

    @staticmethod
    def truncate(text: str, max_length: int = 200, suffix: str = '...') -> str:
        """
        Truncates text to a maximum length, preserving word boundaries.
        
        Args:
            text: Text to truncate
            max_length: Maximum length (default: 200)
            suffix: Suffix to append if truncated (default: '...')
            
        Returns:
            Truncated text
        """
        if not text or len(text) <= max_length:
            return text or ""
        
        # Find the last space before max_length
        truncated = text[:max_length].rsplit(' ', 1)[0]
        
        return truncated + suffix


# Singleton instance for easy import
rich_text_service = RichTextService()

