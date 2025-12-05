"""
Tests for HTML Sanitization (XSS Prevention)

These tests verify that malicious HTML/JavaScript is properly sanitized
while preserving safe content from the rich text editor.

SECURITY: These tests are critical for preventing XSS attacks.
"""
import pytest
from app.services.rich_text_service import RichTextService


class TestXSSPrevention:
    """Tests for blocking XSS attack vectors."""
    
    def test_blocks_script_tags(self):
        """Script tags should be completely removed."""
        malicious = '<p>Hello</p><script>alert("XSS")</script><p>World</p>'
        result = RichTextService.sanitize_html(malicious)
        
        assert '<script>' not in result
        assert 'alert' not in result
        assert '<p>Hello</p>' in result
        assert '<p>World</p>' in result
    
    def test_blocks_script_with_encoding(self):
        """Encoded script tags should also be blocked."""
        # Various encoding attempts
        payloads = [
            '<script>alert(1)</script>',
            '<SCRIPT>alert(1)</SCRIPT>',
            '<ScRiPt>alert(1)</ScRiPt>',
            '<script src="evil.js"></script>',
            '<script type="text/javascript">alert(1)</script>',
        ]
        
        for payload in payloads:
            result = RichTextService.sanitize_html(payload)
            assert '<script' not in result.lower(), f"Failed to block: {payload}"
    
    def test_blocks_onerror_attribute(self):
        """onerror attributes should be removed from images."""
        malicious = '<img src="x" onerror="alert(\'XSS\')">'
        result = RichTextService.sanitize_html(malicious)
        
        assert 'onerror' not in result
        # img tag might still be there but without the handler
    
    def test_blocks_onload_attribute(self):
        """onload attributes should be removed."""
        malicious = '<body onload="alert(\'XSS\')"><p>Test</p></body>'
        result = RichTextService.sanitize_html(malicious)
        
        assert 'onload' not in result
    
    def test_blocks_onclick_attribute(self):
        """onclick attributes should be removed."""
        malicious = '<a href="#" onclick="alert(\'XSS\')">Click me</a>'
        result = RichTextService.sanitize_html(malicious)
        
        assert 'onclick' not in result
    
    def test_blocks_javascript_urls(self):
        """javascript: URLs should be blocked or sanitized."""
        malicious = '<a href="javascript:alert(\'XSS\')">Click me</a>'
        result = RichTextService.sanitize_html(malicious)
        
        # Either the href is removed or the whole link
        assert 'javascript:' not in result.lower()
    
    def test_blocks_data_urls_with_script(self):
        """data: URLs containing scripts should be blocked."""
        malicious = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
        result = RichTextService.sanitize_html(malicious)
        
        # data: URLs for non-images should be blocked
        assert '<script>' not in result
    
    def test_blocks_event_handlers(self):
        """All event handler attributes should be blocked."""
        event_handlers = [
            'onmouseover', 'onmouseout', 'onmousedown', 'onmouseup',
            'onfocus', 'onblur', 'onchange', 'onsubmit',
            'onkeydown', 'onkeyup', 'onkeypress',
        ]
        
        for handler in event_handlers:
            malicious = f'<div {handler}="alert(1)">Test</div>'
            result = RichTextService.sanitize_html(malicious)
            assert handler not in result.lower(), f"Failed to block: {handler}"
    
    def test_blocks_iframe_tags(self):
        """iframe tags should be removed."""
        malicious = '<iframe src="https://evil.com"></iframe>'
        result = RichTextService.sanitize_html(malicious)
        
        assert '<iframe' not in result.lower()
    
    def test_blocks_object_tags(self):
        """object tags should be removed."""
        malicious = '<object data="evil.swf"></object>'
        result = RichTextService.sanitize_html(malicious)
        
        assert '<object' not in result.lower()
    
    def test_blocks_embed_tags(self):
        """embed tags should be removed."""
        malicious = '<embed src="evil.swf">'
        result = RichTextService.sanitize_html(malicious)
        
        assert '<embed' not in result.lower()
    
    def test_blocks_svg_with_script(self):
        """SVG containing scripts should have scripts removed."""
        malicious = '''<svg><script>alert(1)</script></svg>'''
        result = RichTextService.sanitize_html(malicious)
        
        assert '<script>' not in result


class TestSafeHTMLPreservation:
    """Tests to ensure safe HTML is preserved."""
    
    def test_preserves_paragraphs(self):
        """Paragraph tags should be preserved."""
        html = '<p>This is a paragraph.</p>'
        result = RichTextService.sanitize_html(html)
        
        assert '<p>' in result
        assert '</p>' in result
        assert 'This is a paragraph.' in result
    
    def test_preserves_formatting(self):
        """Bold, italic, underline should be preserved."""
        html = '<b>bold</b> <i>italic</i> <u>underline</u> <s>strike</s>'
        result = RichTextService.sanitize_html(html)
        
        assert '<b>' in result
        assert '<i>' in result
        assert '<u>' in result
        assert '<s>' in result
    
    def test_preserves_lists(self):
        """Ordered and unordered lists should be preserved."""
        html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
        result = RichTextService.sanitize_html(html)
        
        assert '<ul>' in result
        assert '<li>' in result
    
    def test_preserves_headings(self):
        """Heading tags should be preserved."""
        html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
        result = RichTextService.sanitize_html(html)
        
        assert '<h1>' in result
        assert '<h2>' in result
        assert '<h3>' in result
    
    def test_preserves_code_blocks(self):
        """Code and pre tags should be preserved."""
        html = '<pre><code>function test() { return 1; }</code></pre>'
        result = RichTextService.sanitize_html(html)
        
        assert '<pre>' in result
        assert '<code>' in result
    
    def test_preserves_safe_links(self):
        """Links with safe URLs should be preserved."""
        html = '<a href="https://example.com">Link</a>'
        result = RichTextService.sanitize_html(html)
        
        assert '<a ' in result
        assert 'href=' in result
        assert 'https://example.com' in result
    
    def test_preserves_images(self):
        """Safe images should be preserved."""
        html = '<img src="/uploads/test.png" alt="Test image">'
        result = RichTextService.sanitize_html(html)
        
        assert '<img' in result
        assert 'src=' in result
    
    def test_preserves_tables(self):
        """Table elements should be preserved."""
        html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>'
        result = RichTextService.sanitize_html(html)
        
        assert '<table>' in result
        assert '<thead>' in result
        assert '<tbody>' in result
        assert '<tr>' in result
        assert '<th>' in result
        assert '<td>' in result
    
    def test_preserves_blockquotes(self):
        """Blockquote tags should be preserved."""
        html = '<blockquote>A wise quote</blockquote>'
        result = RichTextService.sanitize_html(html)
        
        assert '<blockquote>' in result


class TestEdgeCases:
    """Tests for edge cases and complex scenarios."""
    
    def test_handles_empty_input(self):
        """Empty input should return empty output."""
        assert RichTextService.sanitize_html('') == ''
        assert RichTextService.sanitize_html(None) is None
    
    def test_handles_plain_text(self):
        """Plain text without HTML should pass through."""
        text = 'This is plain text without any HTML.'
        result = RichTextService.sanitize_html(text)
        
        assert text in result
    
    def test_handles_nested_malicious_tags(self):
        """Nested malicious content should be fully sanitized."""
        malicious = '<div><p><script>alert(1)</script></p><span onclick="evil()">text</span></div>'
        result = RichTextService.sanitize_html(malicious)
        
        assert '<script>' not in result
        assert 'onclick' not in result
        assert 'text' in result
    
    def test_handles_malformed_html(self):
        """Malformed HTML should not cause errors."""
        malformed = '<p>Unclosed paragraph<script>alert(1)'
        result = RichTextService.sanitize_html(malformed)
        
        # Should not raise, script should be removed
        assert '<script>' not in result
    
    def test_handles_real_finding_content(self):
        """Real-world finding content should be properly handled."""
        finding_html = '''
        <h2>SQL Injection Vulnerability</h2>
        <p>A <strong>critical</strong> SQL injection vulnerability was found in the login form.</p>
        <h3>Proof of Concept</h3>
        <pre><code>
        ' OR '1'='1' --
        </code></pre>
        <h3>Impact</h3>
        <ul>
            <li>Authentication bypass</li>
            <li>Data exfiltration</li>
        </ul>
        <h3>Remediation</h3>
        <p>Use parameterized queries:</p>
        <pre><code>
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        </code></pre>
        '''
        result = RichTextService.sanitize_html(finding_html)
        
        # Structure should be preserved
        assert '<h2>' in result
        assert '<h3>' in result
        assert '<pre>' in result
        assert '<code>' in result
        assert '<ul>' in result
        assert '<li>' in result
        # Content should be preserved
        assert 'SQL Injection' in result
        assert "' OR '1'='1'" in result
    
    def test_preserves_code_with_html_entities(self):
        """Code containing HTML-like strings should be preserved."""
        html = '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>'
        result = RichTextService.sanitize_html(html)
        
        # The escaped version should remain
        assert '&lt;' in result or '<script>' not in result


class TestImageSecurity:
    """Tests specifically for image handling."""
    
    def test_allows_data_image_urls(self):
        """data:image/ URLs should be allowed for inline images."""
        html = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="test">'
        result = RichTextService.sanitize_html(html)
        
        assert 'data:image/png' in result
    
    def test_allows_relative_upload_urls(self):
        """Relative /uploads/ URLs should be allowed."""
        html = '<img src="/uploads/screenshot-123.png" alt="Evidence">'
        result = RichTextService.sanitize_html(html)
        
        assert '/uploads/' in result
    
    def test_allows_https_image_urls(self):
        """HTTPS image URLs should be allowed."""
        html = '<img src="https://example.com/image.png" alt="External">'
        result = RichTextService.sanitize_html(html)
        
        assert 'https://example.com' in result
    
    def test_preserves_image_attributes(self):
        """Safe image attributes should be preserved."""
        html = '<img src="/uploads/test.png" alt="Test" width="500" height="300" data-align="center">'
        result = RichTextService.sanitize_html(html)
        
        assert 'alt=' in result
        # width/height may or may not be preserved depending on config

