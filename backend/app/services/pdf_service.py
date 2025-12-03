"""
PDF Service - Premium PDF Generator Service

Renders pixel-perfect, magazine-quality PDFs using Playwright and Jinja2.
Part of the Atomik Report Engine.
"""
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Literal

from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright, Browser, Page

logger = logging.getLogger(__name__)

# Template directory path
TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "pdf"

# Available templates
TEMPLATE_OPTIONS = {
    "classic": {
        "file": "report_classic.html",
        "name": "Classic Premium",
        "description": "Dark header, structured cards, professional look"
    },
    "apple": {
        "file": "report_apple.html", 
        "name": "Apple Minimal",
        "description": "Clean, spacious, Apple-inspired design"
    }
}

# Default template
DEFAULT_TEMPLATE = "classic"


class PDFService:
    """
    Premium PDF Generation Service using Playwright.
    
    Renders Jinja2 HTML templates into high-quality PDF documents
    with full CSS support, web fonts, and print backgrounds.
    """
    
    def __init__(self):
        """Initialize the PDF service with Jinja2 environment."""
        self._browser: Optional[Browser] = None
        self._playwright = None
        self._jinja_env = self._create_jinja_env()
    
    def _create_jinja_env(self) -> Environment:
        """
        Setup Jinja2 Environment.
        
        Loader points to app/templates/pdf directory.
        """
        # Ensure templates directory exists
        TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
        
        env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=False,  # We use |safe filter for HTML content
            trim_blocks=True,
            lstrip_blocks=True,
        )
        
        return env
    
    async def generate(self, context: Dict[str, Any], template_id: str = None) -> bytes:
        """
        Generate PDF from context dictionary.
        
        Args:
            context: Dictionary containing all report data for template rendering
            template_id: Template to use ('classic' or 'apple'). Defaults to 'classic'.
            
        Returns:
            PDF content as bytes
            
        Raises:
            RuntimeError: If PDF generation fails
        """
        # Determine template file
        template_id = template_id or DEFAULT_TEMPLATE
        if template_id not in TEMPLATE_OPTIONS:
            logger.warning(f"Unknown template '{template_id}', falling back to default")
            template_id = DEFAULT_TEMPLATE
        
        template_file = TEMPLATE_OPTIONS[template_id]["file"]
        logger.info(f"Generating PDF with template: {template_id} ({template_file})")
        
        try:
            # Step 1: Setup Jinja2 Environment (already done in __init__)
            # Step 2: Render the template
            template = self._jinja_env.get_template(template_file)
            html_content = template.render(context)
            
            logger.debug(f"Rendered HTML template: {len(html_content)} characters")
            
            # Step 3: Launch Playwright
            if not self._playwright:
                self._playwright = await async_playwright().start()
            
            browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ]
            )
            
            try:
                # Step 4: New Page
                page: Page = await browser.new_page()
                
                # Step 5: Set Content
                await page.set_content(
                    html_content,
                    wait_until="networkidle"
                )
                
                # Allow time for fonts and images to load
                await page.wait_for_timeout(500)
                
                # Step 6: Print to PDF
                pdf_bytes = await page.pdf(
                    format="A4",
                    print_background=True,
                    margin={
                        "top": "0",
                        "bottom": "0",
                        "left": "0",
                        "right": "0"
                    }  # We handle margins in CSS
                )
                
                logger.info(f"Generated PDF: {len(pdf_bytes)} bytes")
                
                return pdf_bytes
                
            finally:
                await browser.close()
                
        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}", exc_info=True)
            raise RuntimeError(f"PDF generation failed: {str(e)}")
    
    async def close(self):
        """Close Playwright instance."""
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
    
    async def generate_from_report_id(self, report_id: str, template_id: str = None) -> bytes:
        """
        Convenience method: Generate PDF from report ID.
        
        Builds context using ReportDataService and generates PDF.
        
        Args:
            report_id: UUID of the report to generate
            template_id: Template to use ('classic' or 'apple')
            
        Returns:
            PDF content as bytes
        """
        from app.services.report_data_service import ReportDataService
        
        # Build context
        context_obj = await ReportDataService.build_context(report_id)
        context = ReportDataService.context_to_dict(context_obj)
        
        # Generate PDF with selected template
        return await self.generate(context, template_id)
    
    @staticmethod
    def get_available_templates() -> Dict[str, Dict[str, str]]:
        """
        Get list of available PDF templates.
        
        Returns:
            Dictionary of template options with id, name, and description
        """
        return TEMPLATE_OPTIONS


# Singleton instance
pdf_service = PDFService()
