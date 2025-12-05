"""
Qualys XML Parser Service

Parses Qualys vulnerability scan XML export files and converts findings to Atomik format.
Supports Qualys VM (Vulnerability Management) scan report format.

Qualys XML Structure:
<SCAN>
  <HOST>
    <IP>...</IP>
    <VULN>
      <QID>...</QID>
      <TITLE>...</TITLE>
      <SEVERITY>...</SEVERITY>
    </VULN>
  </HOST>
</SCAN>
"""
import xml.etree.ElementTree as ET
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from html import unescape
import re
import logging

logger = logging.getLogger(__name__)


@dataclass
class QualysFinding:
    """Represents a parsed Qualys finding in Atomik-compatible format"""
    qid: str  # Qualys ID
    title: str
    host_ip: str
    host_dns: Optional[str]
    port: Optional[str]
    protocol: Optional[str]
    severity: str  # Critical, High, Medium, Low, Informational
    severity_num: int  # Original 1-5 value
    category: Optional[str]
    consequence: Optional[str]
    solution: Optional[str]
    diagnosis: Optional[str]
    result: Optional[str]  # Scan result/evidence
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve_ids: List[str] = field(default_factory=list)
    vendor_refs: List[str] = field(default_factory=list)
    bugtraq_ids: List[str] = field(default_factory=list)
    pci_flag: bool = False
    exploitability: Optional[str] = None


class QualysParser:
    """
    Parses Qualys XML exports into Atomik-compatible findings.
    
    Supports Qualys VM scan report format from Qualys Cloud Platform
    and Qualys Virtual Scanner Appliance.
    """
    
    # Map Qualys severity (1-5) to Atomik severity
    # Qualys: 1=Info, 2=Low, 3=Medium, 4=High, 5=Critical
    SEVERITY_MAP = {
        1: 'Informational',
        2: 'Low',
        3: 'Medium',
        4: 'High',
        5: 'Critical',
    }
    
    @staticmethod
    def _clean_text(text: str) -> str:
        """Clean text content - unescape HTML and normalize whitespace."""
        if not text:
            return ""
        
        # Unescape HTML entities
        text = unescape(text)
        
        # Remove CDATA markers if present
        text = re.sub(r'<!\[CDATA\[|\]\]>', '', text)
        
        return text.strip()
    
    @staticmethod
    def _get_text(element: Optional[ET.Element]) -> str:
        """Safely get text from an XML element."""
        if element is None:
            return ""
        return element.text or ""
    
    @staticmethod
    def _parse_int(value: str, default: int = 0) -> int:
        """Parse an integer value, returning default if invalid."""
        try:
            return int(value) if value else default
        except ValueError:
            return default
    
    @staticmethod
    def _parse_float(value: str) -> Optional[float]:
        """Parse a float value, returning None if invalid."""
        try:
            return float(value) if value else None
        except ValueError:
            return None
    
    def _extract_cves(self, vuln: ET.Element) -> List[str]:
        """Extract CVE IDs from a VULN element."""
        cves = []
        
        # Try CVE_ID_LIST structure
        cve_list = vuln.find('CVE_ID_LIST')
        if cve_list is not None:
            for cve_el in cve_list.findall('.//CVE_ID'):
                cve = self._get_text(cve_el.find('ID'))
                if cve:
                    cves.append(cve)
        
        # Also try direct CVE elements
        for cve_el in vuln.findall('CVE_ID'):
            cve = self._get_text(cve_el)
            if cve and cve not in cves:
                cves.append(cve)
        
        return cves
    
    def _extract_vendor_refs(self, vuln: ET.Element) -> List[str]:
        """Extract vendor references from a VULN element."""
        refs = []
        
        vendor_list = vuln.find('VENDOR_REFERENCE_LIST')
        if vendor_list is not None:
            for ref in vendor_list.findall('.//VENDOR_REFERENCE'):
                ref_id = self._get_text(ref.find('ID'))
                ref_url = self._get_text(ref.find('URL'))
                if ref_url:
                    refs.append(ref_url)
                elif ref_id:
                    refs.append(ref_id)
        
        return refs
    
    def _extract_bugtraqs(self, vuln: ET.Element) -> List[str]:
        """Extract Bugtraq IDs from a VULN element."""
        bugtraqs = []
        
        bugtraq_list = vuln.find('BUGTRAQ_ID_LIST')
        if bugtraq_list is not None:
            for bt in bugtraq_list.findall('.//BUGTRAQ_ID'):
                bt_id = self._get_text(bt.find('ID'))
                if bt_id:
                    bugtraqs.append(f"BID-{bt_id}")
        
        return bugtraqs
    
    def _parse_vuln(
        self, 
        vuln: ET.Element, 
        host_ip: str,
        host_dns: Optional[str]
    ) -> QualysFinding:
        """Parse a single VULN element into a QualysFinding."""
        
        # Basic fields
        qid = self._get_text(vuln.find('QID'))
        title = self._clean_text(self._get_text(vuln.find('TITLE')))
        severity_num = self._parse_int(self._get_text(vuln.find('SEVERITY')), 1)
        
        # Map severity
        severity = self.SEVERITY_MAP.get(severity_num, 'Informational')
        
        # Port info (might be nested or direct)
        port = self._get_text(vuln.find('PORT'))
        protocol = self._get_text(vuln.find('PROTOCOL'))
        
        # Content fields
        category = self._clean_text(self._get_text(vuln.find('CATEGORY')))
        consequence = self._clean_text(self._get_text(vuln.find('CONSEQUENCE')))
        solution = self._clean_text(self._get_text(vuln.find('SOLUTION')))
        diagnosis = self._clean_text(self._get_text(vuln.find('DIAGNOSIS')))
        result = self._clean_text(self._get_text(vuln.find('RESULT')))
        
        # CVSS
        cvss_score = self._parse_float(self._get_text(vuln.find('CVSS_BASE')))
        cvss_vector = self._get_text(vuln.find('CVSS_TEMPORAL'))
        
        # Try CVSS3 if v2 not present
        if cvss_score is None:
            cvss_score = self._parse_float(self._get_text(vuln.find('CVSS3_BASE')))
            cvss_vector = self._get_text(vuln.find('CVSS3_TEMPORAL')) or cvss_vector
        
        # PCI compliance flag
        pci_flag = self._get_text(vuln.find('PCI_FLAG')) == '1'
        
        # Exploitability
        exploitability = self._get_text(vuln.find('EXPLOITABILITY'))
        
        # References
        cves = self._extract_cves(vuln)
        vendor_refs = self._extract_vendor_refs(vuln)
        bugtraqs = self._extract_bugtraqs(vuln)
        
        return QualysFinding(
            qid=qid,
            title=title,
            host_ip=host_ip,
            host_dns=host_dns,
            port=port,
            protocol=protocol,
            severity=severity,
            severity_num=severity_num,
            category=category,
            consequence=consequence,
            solution=solution,
            diagnosis=diagnosis,
            result=result,
            cvss_score=cvss_score,
            cvss_vector=cvss_vector,
            cve_ids=cves,
            vendor_refs=vendor_refs,
            bugtraq_ids=bugtraqs,
            pci_flag=pci_flag,
            exploitability=exploitability,
        )
    
    def parse_xml(self, xml_content: str) -> List[QualysFinding]:
        """
        Parse Qualys XML export content.
        
        Args:
            xml_content: Raw XML string from Qualys export
            
        Returns:
            List of QualysFinding objects
        """
        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            logger.error(f"Failed to parse Qualys XML: {e}")
            raise ValueError(f"Invalid XML format: {e}")
        
        findings = []
        
        # Try different Qualys XML structures
        # Structure 1: SCAN/HOST/VULN
        for host in root.findall('.//HOST'):
            host_ip = self._get_text(host.find('IP'))
            host_dns = self._get_text(host.find('DNS')) or self._get_text(host.find('NETBIOS'))
            
            for vuln in host.findall('.//VULN'):
                try:
                    finding = self._parse_vuln(vuln, host_ip, host_dns)
                    findings.append(finding)
                except Exception as e:
                    qid = self._get_text(vuln.find('QID'))
                    logger.warning(f"Failed to parse QID {qid}: {e}")
                    continue
        
        # Structure 2: ASSET_DATA_REPORT format
        if not findings:
            for host in root.findall('.//HOST_LIST/HOST'):
                host_ip = self._get_text(host.find('IP'))
                host_dns = self._get_text(host.find('DNS'))
                
                for vuln in host.findall('.//VULN_INFO_LIST/VULN_INFO'):
                    try:
                        finding = self._parse_vuln(vuln, host_ip, host_dns)
                        findings.append(finding)
                    except Exception as e:
                        qid = self._get_text(vuln.find('QID'))
                        logger.warning(f"Failed to parse QID {qid}: {e}")
                        continue
        
        # Structure 3: Simple VULN_LIST
        if not findings:
            for vuln in root.findall('.//VULN'):
                try:
                    # Get host info from attributes if available
                    host_ip = vuln.get('ip', 'Unknown')
                    host_dns = vuln.get('dns')
                    finding = self._parse_vuln(vuln, host_ip, host_dns)
                    findings.append(finding)
                except Exception as e:
                    qid = self._get_text(vuln.find('QID'))
                    logger.warning(f"Failed to parse QID {qid}: {e}")
                    continue
        
        logger.info(f"Parsed {len(findings)} findings from Qualys XML")
        return findings
    
    def to_atomik_format(self, finding: QualysFinding) -> Dict[str, Any]:
        """
        Convert a QualysFinding to Atomik finding format.
        
        Returns:
            Dictionary ready for Atomik API
        """
        # Build description
        description_parts = []
        
        if finding.category:
            description_parts.append(f"<p><strong>Category:</strong> {finding.category}</p>")
        
        if finding.diagnosis:
            description_parts.append(f"<div><h4>Diagnosis</h4>{finding.diagnosis}</div>")
        
        if finding.consequence:
            description_parts.append(f"<div><h4>Consequence</h4>{finding.consequence}</div>")
        
        description = "\n".join(description_parts) if description_parts else finding.title
        
        # Build evidence from scan result
        evidence_parts = []
        
        # Add target info
        target = finding.host_ip
        if finding.port:
            target += f":{finding.port}"
        if finding.protocol:
            target += f"/{finding.protocol}"
        
        evidence_parts.append(f"<p><strong>Target:</strong> {target}</p>")
        
        if finding.host_dns:
            evidence_parts.append(f"<p><strong>DNS:</strong> {finding.host_dns}</p>")
        
        # Add scan result as evidence
        if finding.result:
            result_escaped = self._escape_html(finding.result[:3000])
            if len(finding.result) > 3000:
                result_escaped += "\n... (truncated)"
            evidence_parts.append(f"""
<h4>Scan Result</h4>
<pre><code>{result_escaped}</code></pre>
""")
        
        # Add PCI flag if set
        if finding.pci_flag:
            evidence_parts.append("<p><strong>⚠️ PCI Compliance Issue</strong></p>")
        
        # Add exploitability info
        if finding.exploitability:
            evidence_parts.append(f"<p><strong>Exploitability:</strong> {finding.exploitability}</p>")
        
        evidence = "\n".join(evidence_parts) if evidence_parts else None
        
        # Build references
        refs_parts = []
        
        if finding.cve_ids:
            cve_links = ", ".join(finding.cve_ids)
            refs_parts.append(f"<p><strong>CVE:</strong> {cve_links}</p>")
        
        if finding.bugtraq_ids:
            bugtraq_links = ", ".join(finding.bugtraq_ids)
            refs_parts.append(f"<p><strong>Bugtraq:</strong> {bugtraq_links}</p>")
        
        if finding.vendor_refs:
            refs_parts.append("<p><strong>Vendor References:</strong></p><ul>")
            for ref in finding.vendor_refs[:10]:  # Limit to 10 refs
                if ref.startswith('http'):
                    refs_parts.append(f"<li><a href=\"{ref}\">{ref}</a></li>")
                else:
                    refs_parts.append(f"<li>{ref}</li>")
            refs_parts.append("</ul>")
        
        references = "\n".join(refs_parts) if refs_parts else None
        
        # Build affected systems
        affected_systems = finding.host_ip
        if finding.host_dns:
            affected_systems = f"{finding.host_dns} ({finding.host_ip})"
        
        return {
            "title": finding.title,
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
            "source": "qualys",
            "source_id": f"QID-{finding.qid}-{finding.host_ip}",
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
qualys_parser = QualysParser()

