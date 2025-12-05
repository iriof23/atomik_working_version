"""
AI Service for generating professional penetration testing content.

Uses OpenAI GPT models with a structured persona to produce high-quality,
professional pentest report content.
"""
import os
import logging
from typing import Optional
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Professional Pentest Persona
PENTEST_PERSONA = """You are a Senior Penetration Tester writing a final report for a corporate client. Your tone is professional, objective, and technical but accessible. Do not include any conversational filler."""


class AIService:
    """
    AI Service for generating penetration testing report content.
    
    Provides methods for generating finding descriptions, remediation steps,
    executive summaries, and other report content using OpenAI's GPT models.
    """
    
    def __init__(self):
        """Initialize the AI service with OpenAI client."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not set. AI features will return mock responses.")
            self.client = None
        else:
            self.client = AsyncOpenAI(api_key=api_key)
        
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    async def generate_finding_text(
        self,
        finding_title: str,
        severity: str,
        current_description: Optional[str] = None,
        max_tokens: int = 1500
    ) -> str:
        """
        Generate a professional, detailed finding description.
        
        Args:
            finding_title: The title of the security finding
            severity: The severity level (Critical, High, Medium, Low, Info)
            current_description: Optional existing description to improve
            max_tokens: Maximum tokens for the response
            
        Returns:
            Formatted markdown text with description, impact, and remediation
        """
        prompt = f"""
Task: Improve and expand the description for this security finding.

Title: {finding_title}
Severity: {severity}
Current Draft: "{current_description or 'N/A'}"

Instructions:
1. Write a detailed, professional description of the vulnerability.
2. Explain the potential business impact if exploited.
3. Provide clear, actionable remediation steps.
4. Output ONLY the generated text formatted in Markdown. Do not add phrases like "Here is the text".
"""
        
        return await self._generate(prompt, max_tokens)
    
    async def generate_remediation(
        self,
        finding_title: str,
        severity: str,
        description: Optional[str] = None,
        max_tokens: int = 800
    ) -> str:
        """
        Generate detailed remediation steps for a finding.
        
        Args:
            finding_title: The title of the security finding
            severity: The severity level
            description: Optional description for context
            max_tokens: Maximum tokens for the response
            
        Returns:
            Formatted markdown remediation steps
        """
        prompt = f"""
Task: Generate detailed remediation steps for this security finding.

Title: {finding_title}
Severity: {severity}
Description: {description or 'Not provided'}

Instructions:
1. Provide step-by-step remediation instructions.
2. Include code examples or configuration changes where applicable.
3. Prioritize actions based on effectiveness and ease of implementation.
4. Include verification steps to confirm the fix.
5. Output ONLY the remediation steps in Markdown format.
"""
        
        return await self._generate(prompt, max_tokens)
    
    async def generate_executive_summary(
        self,
        findings_summary: str,
        total_findings: int,
        critical_count: int,
        high_count: int,
        medium_count: int,
        low_count: int,
        max_tokens: int = 1000
    ) -> str:
        """
        Generate an executive summary for a penetration test report.
        
        Args:
            findings_summary: Brief summary of key findings
            total_findings: Total number of findings
            critical_count: Number of critical findings
            high_count: Number of high findings
            medium_count: Number of medium findings
            low_count: Number of low findings
            max_tokens: Maximum tokens for the response
            
        Returns:
            Formatted executive summary in markdown
        """
        prompt = f"""
Task: Write an executive summary for a penetration test report.

Findings Overview:
- Total Findings: {total_findings}
- Critical: {critical_count}
- High: {high_count}
- Medium: {medium_count}
- Low: {low_count}

Key Findings Summary:
{findings_summary}

Instructions:
1. Write a concise executive summary suitable for C-level executives.
2. Highlight the overall security posture and key risks.
3. Provide high-level recommendations prioritized by business impact.
4. Keep technical jargon minimal while maintaining accuracy.
5. Output ONLY the executive summary in Markdown format.
"""
        
        return await self._generate(prompt, max_tokens)
    
    async def fix_grammar(
        self,
        text: str,
        max_tokens: int = 500
    ) -> str:
        """
        Fix grammar and improve clarity of text.
        
        Args:
            text: The text to fix
            max_tokens: Maximum tokens for the response
            
        Returns:
            Corrected text
        """
        prompt = f"""
Task: Fix grammar and improve clarity of the following text while maintaining its technical accuracy.

Text: "{text}"

Instructions:
1. Correct any grammatical errors.
2. Improve sentence structure for clarity.
3. Maintain technical terminology and accuracy.
4. Output ONLY the corrected text without any additional commentary.
"""
        
        return await self._generate(prompt, max_tokens)

    async def rewrite_text(
        self,
        text: str,
        max_tokens: int = 1000
    ) -> str:
        """
        Rewrite text to be more professional and objective.
        
        Args:
            text: The text to rewrite
            max_tokens: Maximum tokens for the response
            
        Returns:
            Rewritten text
        """
        prompt = f"""
Task: Rewrite the following text to be more professional, objective, and suitable for a formal security assessment report.

Text: "{text}"

Instructions:
1. Adopt a professional, third-person objective tone.
2. Remove any colloquialisms, slang, or first-person references.
3. Ensure the language is precise and concise.
4. Output ONLY the rewritten text.
"""
        return await self._generate(prompt, max_tokens)

    async def expand_text(
        self,
        text: str,
        max_tokens: int = 1000
    ) -> str:
        """
        Expand rough notes or bullet points into full paragraphs.
        
        Args:
            text: The notes to expand
            max_tokens: Maximum tokens for the response
            
        Returns:
            Expanded text
        """
        prompt = f"""
Task: Expand the following notes or bullet points into full, well-structured paragraphs suitable for a security report.

Input Text: "{text}"

Instructions:
1. Convert bullet points and shorthand into complete sentences.
2. Add necessary transition words to improve flow.
3. Maintain the original technical meaning and facts.
4. Output ONLY the expanded text.
"""
        return await self._generate(prompt, max_tokens)
    
    async def translate_finding(
        self,
        text: str,
        target_language: str,
        max_tokens: int = 1000
    ) -> str:
        """
        Translate finding content to another language.
        
        Args:
            text: The text to translate
            target_language: The target language (e.g., "Spanish", "French")
            max_tokens: Maximum tokens for the response
            
        Returns:
            Translated text
        """
        prompt = f"""
Task: Translate the following security finding content to {target_language}.

Text: "{text}"

Instructions:
1. Maintain technical accuracy in the translation.
2. Use appropriate security terminology in the target language.
3. Preserve any code snippets or technical identifiers.
4. Output ONLY the translated text.
"""
        
        return await self._generate(prompt, max_tokens)
    
    async def _generate(self, prompt: str, max_tokens: int) -> str:
        """
        Internal method to generate content using OpenAI API.
        
        Args:
            prompt: The user prompt
            max_tokens: Maximum tokens for the response
            
        Returns:
            Generated text content
        """
        if not self.client:
            # Return a structured mock response when API key is not configured
            logger.info("AI service called without API key - returning mock response")
            return self._get_mock_response(prompt)
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": PENTEST_PERSONA
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.7,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise RuntimeError(f"Failed to generate AI content: {str(e)}")
    
    def _get_mock_response(self, prompt: str) -> str:
        """
        Generate a mock response when OpenAI API is not available.
        
        Args:
            prompt: The original prompt (used to determine response type)
            
        Returns:
            A structured mock response
        """
        if "remediation" in prompt.lower():
            return """## Remediation Steps

1. **Immediate Action**: Apply the security patch or update to the latest version.
2. **Configuration Update**: Review and harden the affected component's configuration.
3. **Access Control**: Implement principle of least privilege for affected resources.
4. **Monitoring**: Enable logging and alerting for suspicious activity.

### Verification
After implementing the fixes, verify by:
- Running a follow-up vulnerability scan
- Reviewing application logs for anomalies
- Testing the specific attack vector to confirm mitigation"""
        
        elif "executive summary" in prompt.lower():
            return """## Executive Summary

This penetration test assessment identified several security vulnerabilities that require attention. The overall security posture shows room for improvement, particularly in access control and input validation areas.

### Key Recommendations
1. Address critical and high-severity findings within 30 days
2. Implement a regular security assessment schedule
3. Enhance security awareness training for development teams
4. Review and update security policies and procedures"""
        
        else:
            return """## Vulnerability Description

This vulnerability allows an attacker to potentially compromise the affected system or application. The issue stems from insufficient input validation or improper security controls.

### Business Impact
If exploited, this vulnerability could lead to:
- Unauthorized access to sensitive data
- Disruption of business operations
- Regulatory compliance violations
- Reputational damage

### Remediation
To address this vulnerability:
1. Apply the recommended security patches
2. Implement proper input validation
3. Review access controls and permissions
4. Enable security monitoring and logging"""


# Singleton instance
ai_service = AIService()

