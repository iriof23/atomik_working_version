"""
Nessus XML Parser Service

Parses Nessus (.nessus) XML export files and converts findings to Atomik format.
Handles the NessusClientData_v2 format with ReportHost and ReportItem elements.

Nessus XML Structure:
<NessusClientData_v2>
  <Report>
    <ReportHost>
      <ReportItem pluginID="..." severity="...">
        <plugin_name>...</plugin_name>
        <description>...</description>
        <solution>...</solution>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>
"""
import xml.etree.ElementTree as ET
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from html import unescape
import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class NessusFinding:
    """Represents a parsed Nessus finding in Atomik-compatible format"""
    plugin_id: str
    plugin_name: str
    host: str
    host_ip: str
    port: str
    protocol: str
    severity: str  # Critical, High, Medium, Low, Informational
    severity_num: int  # Original 0-4 value
    description: str
    solution: str
    synopsis: Optional[str] = None
    plugin_output: Optional[str] = None
    risk_factor: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve_ids: List[str] = field(default_factory=list)
    cwe_ids: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    see_also: Optional[str] = None
    exploit_available: bool = False
    exploitability_ease: Optional[str] = None


class NessusParser:
    """
    Parses Nessus XML exports into Atomik-compatible findings.
    
    Supports NessusClientData_v2 format from Nessus Professional,
    Nessus Expert, and Tenable.io exports.
    """
    
    # Map Nessus severity (0-4) to Atomik severity
    SEVERITY_MAP = {
        0: 'Informational',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Critical',
    }
    
    @staticmethod
    def _clean_text(text: str) -> str:
        """Clean text content - unescape HTML and normalize whitespace."""
        if not text:
            return ""
        
        # Unescape HTML entities
        text = unescape(text)
        
        # Normalize whitespace but preserve paragraph breaks
        lines = text.split('\n')
        cleaned_lines = [line.strip() for line in lines]
        text = '\n'.join(cleaned_lines)
        
        return text.strip()
    
    @staticmethod
    def _get_text(element: Optional[ET.Element]) -> str:
        """Safely get text from an XML element."""
        if element is None:
            return ""
        return element.text or ""
    
    @staticmethod
    def _get_attr(element: ET.Element, attr: str, default: str = "") -> str:
        """Safely get attribute from an XML element."""
        return element.get(attr, default)
    
    @staticmethod
    def _parse_float(value: str) -> Optional[float]:
        """Parse a float value, returning None if invalid."""
        try:
            return float(value) if value else None
        except ValueError:
            return None
    
    def _extract_references(self, item: ET.Element) -> List[str]:
        """Extract all reference URLs from a ReportItem."""
        refs = []
        
        # See also field
        see_also = self._get_text(item.find('see_also'))
        if see_also:
            # Split by newlines or spaces
            urls = re.findall(r'https?://[^\s<>"]+', see_also)
            refs.extend(urls)
        
        # Individual reference elements
        for ref in item.findall('xref'):
            refs.append(self._get_text(ref))
        
        return refs
    
    def _extract_cves(self, item: ET.Element) -> List[str]:
        """Extract CVE IDs from a ReportItem."""
        cves = []
        
        for cve_el in item.findall('cve'):
            cve = self._get_text(cve_el)
            if cve:
                cves.append(cve)
        
        return cves
    
    def _extract_cwes(self, item: ET.Element) -> List[str]:
        """Extract CWE IDs from a ReportItem."""
        cwes = []
        
        for cwe_el in item.findall('cwe'):
            cwe = self._get_text(cwe_el)
            if cwe:
                cwes.append(f"CWE-{cwe}")
        
        return cwes
    
    def _parse_report_item(
        self, 
        item: ET.Element, 
        host_name: str, 
        host_ip: str
    ) -> NessusFinding:
        """Parse a single ReportItem into a NessusFinding."""
        
        # Basic attributes
        plugin_id = self._get_attr(item, 'pluginID')
        severity_num = int(self._get_attr(item, 'severity', '0'))
        port = self._get_attr(item, 'port', '0')
        protocol = self._get_attr(item, 'protocol', 'tcp')
        plugin_name = self._get_attr(item, 'pluginName')
        
        # Map severity
        severity = self.SEVERITY_MAP.get(severity_num, 'Informational')
        
        # Content fields
        description = self._clean_text(self._get_text(item.find('description')))
        solution = self._clean_text(self._get_text(item.find('solution')))
        synopsis = self._clean_text(self._get_text(item.find('synopsis')))
        plugin_output = self._clean_text(self._get_text(item.find('plugin_output')))
        risk_factor = self._get_text(item.find('risk_factor'))
        see_also = self._get_text(item.find('see_also'))
        
        # CVSS
        cvss_score = self._parse_float(self._get_text(item.find('cvss_base_score')))
        cvss_vector = self._get_text(item.find('cvss_vector'))
        
        # If no CVSS v2, try v3
        if cvss_score is None:
            cvss_score = self._parse_float(self._get_text(item.find('cvss3_base_score')))
            cvss_vector = self._get_text(item.find('cvss3_vector')) or cvss_vector
        
        # Exploit info
        exploit_available = self._get_text(item.find('exploit_available')) == 'true'
        exploitability_ease = self._get_text(item.find('exploitability_ease'))
        
        # References
        cves = self._extract_cves(item)
        cwes = self._extract_cwes(item)
        refs = self._extract_references(item)
        
        return NessusFinding(
            plugin_id=plugin_id,
            plugin_name=plugin_name,
            host=host_name,
            host_ip=host_ip,
            port=port,
            protocol=protocol,
            severity=severity,
            severity_num=severity_num,
            description=description,
            solution=solution,
            synopsis=synopsis,
            plugin_output=plugin_output,
            risk_factor=risk_factor,
            cvss_score=cvss_score,
            cvss_vector=cvss_vector,
            cve_ids=cves,
            cwe_ids=cwes,
            references=refs,
            see_also=see_also,
            exploit_available=exploit_available,
            exploitability_ease=exploitability_ease,
        )
    
    def parse_xml(self, xml_content: str) -> List[NessusFinding]:
        """
        Parse Nessus XML export content.
        
        Args:
            xml_content: Raw XML string from Nessus export
            
        Returns:
            List of NessusFinding objects
        """
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            logger.error(f"Failed to parse Nessus XML: {e}")
            raise ValueError(f"Invalid XML format: {e}")
        
        findings = []
        
        # Find all Report elements
        for report in root.findall('.//Report'):
            # Find all ReportHost elements
            for host in report.findall('ReportHost'):
                host_name = host.get('name', 'Unknown')
                
                # Get host properties for IP
                host_ip = host_name
                properties = host.find('HostProperties')
                if properties is not None:
                    for tag in properties.findall('tag'):
                        if tag.get('name') == 'host-ip':
                            host_ip = tag.text or host_name
                            break
                
                # Parse all ReportItems for this host
                for item in host.findall('ReportItem'):
                    try:
                        finding = self._parse_report_item(item, host_name, host_ip)
                        findings.append(finding)
                    except Exception as e:
                        plugin_id = item.get('pluginID', 'unknown')
                        logger.warning(f"Failed to parse plugin {plugin_id}: {e}")
                        continue
        
        logger.info(f"Parsed {len(findings)} findings from Nessus XML")
        return findings
    
    def to_atomik_format(self, finding: NessusFinding) -> Dict[str, Any]:
        """
        Convert a NessusFinding to Atomik finding format.
        
        Returns:
            Dictionary ready for Atomik API
        """
        # Build description with synopsis
        description_parts = []
        
        if finding.synopsis:
            description_parts.append(f"<p><strong>Synopsis:</strong> {finding.synopsis}</p>")
        
        if finding.description:
            description_parts.append(f"<div>{finding.description}</div>")
        
        description = "\n".join(description_parts) if description_parts else finding.plugin_name
        
        # Build evidence from plugin output
        evidence_parts = []
        
        # Add target info
        target = f"{finding.host}:{finding.port}/{finding.protocol}"
        evidence_parts.append(f"<p><strong>Target:</strong> {target}</p>")
        
        if finding.host_ip != finding.host:
            evidence_parts.append(f"<p><strong>IP:</strong> {finding.host_ip}</p>")
        
        # Add plugin output as evidence
        if finding.plugin_output:
            output_escaped = self._escape_html(finding.plugin_output[:3000])
            if len(finding.plugin_output) > 3000:
                output_escaped += "\n... (truncated)"
            evidence_parts.append(f"""
<h4>Scanner Output</h4>
<pre><code>{output_escaped}</code></pre>
""")
        
        # Add exploit info if available
        if finding.exploit_available:
            evidence_parts.append(f"<p><strong>⚠️ Exploit Available:</strong> {finding.exploitability_ease or 'Yes'}</p>")
        
        evidence = "\n".join(evidence_parts) if evidence_parts else None
        
        # Build references
        refs_parts = []
        
        if finding.cve_ids:
            cve_links = ", ".join(finding.cve_ids)
            refs_parts.append(f"<p><strong>CVE:</strong> {cve_links}</p>")
        
        if finding.cwe_ids:
            cwe_links = ", ".join(finding.cwe_ids)
            refs_parts.append(f"<p><strong>CWE:</strong> {cwe_links}</p>")
        
        if finding.references:
            refs_parts.append("<p><strong>References:</strong></p><ul>")
            for ref in finding.references[:10]:  # Limit to 10 refs
                refs_parts.append(f"<li><a href=\"{ref}\">{ref}</a></li>")
            refs_parts.append("</ul>")
        
        references = "\n".join(refs_parts) if refs_parts else None
        
        # Build affected systems
        affected_systems = f"{finding.host}:{finding.port}"
        
        return {
            "title": finding.plugin_name,
            "description": description,
            "severity": finding.severity,
            "cvss_score": finding.cvss_score,
            "cvss_vector": finding.cvss_vector,
            "cve_id": finding.cve_ids[0] if finding.cve_ids else None,
            "evidence": evidence,
            "remediation": finding.solution,
            "references": references,
            "affected_systems": affected_systems,
            "affected_assets_count": 1,
            "source": "nessus",
            "source_id": f"{finding.plugin_id}-{finding.host}-{finding.port}",
        }
    
    @staticmethod
    def _escape_html(text: str) -> str:
        """Escape HTML special characters for safe display in <pre> tags."""
        return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


# Singleton instance
nessus_parser = NessusParser()
