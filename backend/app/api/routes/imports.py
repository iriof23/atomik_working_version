"""
Import routes for external scan tools (Burp Suite, Nessus, etc.)

Allows importing findings from external security tools into Atomik projects.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.api.routes.findings import generate_finding_reference_id
from app.db import db
from app.services.burp_parser import burp_parser
from app.services.nessus_parser import nessus_parser
from app.services.qualys_parser import qualys_parser
from app.services.rich_text_service import RichTextService

logger = logging.getLogger(__name__)

router = APIRouter()


class ImportedFinding(BaseModel):
    """Response model for an imported finding"""
    id: str
    reference_id: Optional[str]
    title: str
    severity: str
    source: str
    source_id: Optional[str]


class ImportResponse(BaseModel):
    """Response model for import operation"""
    success: bool
    message: str
    imported_count: int
    skipped_count: int
    findings: List[ImportedFinding]


@router.post("/burp/{project_id}", response_model=ImportResponse)
async def import_burp_findings(
    project_id: str,
    file: UploadFile = File(...),
    skip_informational: bool = Form(default=False),
    current_user = Depends(get_current_user)
):
    """
    Import findings from a Burp Suite XML export file.
    
    Args:
        project_id: The project to import findings into
        file: Burp Suite XML export file
        skip_informational: Skip importing Informational severity findings
        
    Returns:
        ImportResponse with count and list of imported findings
    """
    logger.info(f"Starting Burp import for project {project_id} by user {current_user.id}")
    
    # Validate file type
    if not file.filename or not file.filename.endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an XML file"
        )
    
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Read and parse XML
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            xml_content = content.decode('latin-1')
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not decode file: {str(e)}"
            )
    
    # Parse Burp XML
    try:
        burp_findings = burp_parser.parse_xml(xml_content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not burp_findings:
        return ImportResponse(
            success=True,
            message="No findings found in the Burp export file",
            imported_count=0,
            skipped_count=0,
            findings=[]
        )
    
    # Check for duplicates (by source_id)
    existing_findings = await db.finding.find_many(
        where={
            "projectId": project_id,
            "source": "burp"
        }
    )
    existing_source_ids = {f.sourceId for f in existing_findings if f.sourceId}
    
    imported_findings = []
    skipped_count = 0
    
    for burp_finding in burp_findings:
        # Skip informational if requested
        if skip_informational and burp_finding.severity == 'Informational':
            skipped_count += 1
            continue
        
        # Skip duplicates
        if burp_finding.serial_number in existing_source_ids:
            logger.info(f"Skipping duplicate finding: {burp_finding.title}")
            skipped_count += 1
            continue
        
        # Convert to Atomik format
        atomik_data = burp_parser.to_atomik_format(burp_finding)
        
        # Sanitize HTML content
        description = RichTextService.sanitize_html(atomik_data.get('description', '')) or None
        evidence = RichTextService.sanitize_html(atomik_data.get('evidence', '')) or None
        remediation = RichTextService.sanitize_html(atomik_data.get('remediation', '')) or None
        references = RichTextService.sanitize_html(atomik_data.get('references', '')) or None
        
        # Generate unique reference ID
        reference_id = await generate_finding_reference_id(project.clientId)
        
        # Create finding in database
        try:
            finding = await db.finding.create(
                data={
                    "referenceId": reference_id,
                    "title": atomik_data['title'],
                    "description": description,
                    "severity": atomik_data['severity'].upper(),
                    "projectId": project_id,
                    "createdById": current_user.id,
                    "evidence": evidence,
                    "remediation": remediation,
                    "references": references,
                    "affectedSystems": atomik_data.get('affected_systems'),
                    "affectedAssetsCount": atomik_data.get('affected_assets_count', 1),
                    "source": "burp",
                    "sourceId": atomik_data.get('source_id'),
                    "status": "OPEN",
                }
            )
            
            imported_findings.append(ImportedFinding(
                id=finding.id,
                reference_id=finding.referenceId,
                title=finding.title,
                severity=finding.severity,
                source="burp",
                source_id=finding.sourceId
            ))
            
            logger.info(f"Imported finding: {finding.title} ({finding.referenceId})")
            
        except Exception as e:
            logger.error(f"Failed to create finding '{atomik_data['title']}': {e}")
            skipped_count += 1
            continue
    
    message = f"Successfully imported {len(imported_findings)} findings"
    if skipped_count > 0:
        message += f" ({skipped_count} skipped)"
    
    logger.info(message)
    
    return ImportResponse(
        success=True,
        message=message,
        imported_count=len(imported_findings),
        skipped_count=skipped_count,
        findings=imported_findings
    )


@router.post("/nessus/{project_id}", response_model=ImportResponse)
async def import_nessus_findings(
    project_id: str,
    file: UploadFile = File(...),
    skip_informational: bool = Form(default=False),
    current_user = Depends(get_current_user)
):
    """
    Import findings from a Nessus XML (.nessus) export file.
    
    Args:
        project_id: The project to import findings into
        file: Nessus XML export file
        skip_informational: Skip importing Informational severity findings
        
    Returns:
        ImportResponse with count and list of imported findings
    """
    logger.info(f"Starting Nessus import for project {project_id} by user {current_user.id}")
    
    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename"
        )
    
    if not (file.filename.endswith('.nessus') or file.filename.endswith('.xml')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .nessus or .xml file"
        )
    
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Read and parse XML
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            xml_content = content.decode('latin-1')
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not decode file: {str(e)}"
            )
    
    # Parse Nessus XML
    try:
        nessus_findings = nessus_parser.parse_xml(xml_content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not nessus_findings:
        return ImportResponse(
            success=True,
            message="No findings found in the Nessus export file",
            imported_count=0,
            skipped_count=0,
            findings=[]
        )
    
    # Check for duplicates (by source_id)
    existing_findings = await db.finding.find_many(
        where={
            "projectId": project_id,
            "source": "nessus"
        }
    )
    existing_source_ids = {f.sourceId for f in existing_findings if f.sourceId}
    
    imported_findings = []
    skipped_count = 0
    
    for nessus_finding in nessus_findings:
        # Skip informational if requested
        if skip_informational and nessus_finding.severity == 'Informational':
            skipped_count += 1
            continue
        
        # Convert to Atomik format
        atomik_data = nessus_parser.to_atomik_format(nessus_finding)
        
        # Skip duplicates
        if atomik_data.get('source_id') in existing_source_ids:
            logger.debug(f"Skipping duplicate finding: {nessus_finding.plugin_name}")
            skipped_count += 1
            continue
        
        # Sanitize HTML content
        description = RichTextService.sanitize_html(atomik_data.get('description', '')) or None
        evidence = RichTextService.sanitize_html(atomik_data.get('evidence', '')) or None
        remediation = RichTextService.sanitize_html(atomik_data.get('remediation', '')) or None
        references = RichTextService.sanitize_html(atomik_data.get('references', '')) or None
        
        # Generate unique reference ID
        reference_id = await generate_finding_reference_id(project.clientId)
        
        # Create finding in database
        try:
            finding = await db.finding.create(
                data={
                    "referenceId": reference_id,
                    "title": atomik_data['title'],
                    "description": description,
                    "severity": atomik_data['severity'].upper(),
                    "projectId": project_id,
                    "createdById": current_user.id,
                    "cvssScore": atomik_data.get('cvss_score'),
                    "cvssVector": atomik_data.get('cvss_vector'),
                    "cveId": atomik_data.get('cve_id'),
                    "evidence": evidence,
                    "remediation": remediation,
                    "references": references,
                    "affectedSystems": atomik_data.get('affected_systems'),
                    "affectedAssetsCount": atomik_data.get('affected_assets_count', 1),
                    "source": "nessus",
                    "sourceId": atomik_data.get('source_id'),
                    "status": "OPEN",
                }
            )
            
            imported_findings.append(ImportedFinding(
                id=finding.id,
                reference_id=finding.referenceId,
                title=finding.title,
                severity=finding.severity,
                source="nessus",
                source_id=finding.sourceId
            ))
            
            logger.debug(f"Imported finding: {finding.title} ({finding.referenceId})")
            
        except Exception as e:
            logger.error(f"Failed to create finding '{atomik_data['title']}': {e}")
            skipped_count += 1
            continue
    
    message = f"Successfully imported {len(imported_findings)} findings"
    if skipped_count > 0:
        message += f" ({skipped_count} skipped)"
    
    logger.info(message)
    
    return ImportResponse(
        success=True,
        message=message,
        imported_count=len(imported_findings),
        skipped_count=skipped_count,
        findings=imported_findings
    )


@router.post("/qualys/{project_id}", response_model=ImportResponse)
async def import_qualys_findings(
    project_id: str,
    file: UploadFile = File(...),
    skip_informational: bool = Form(default=False),
    current_user = Depends(get_current_user)
):
    """
    Import findings from a Qualys XML export file.
    
    Args:
        project_id: The project to import findings into
        file: Qualys XML export file
        skip_informational: Skip importing Informational severity findings
        
    Returns:
        ImportResponse with count and list of imported findings
    """
    logger.info(f"Starting Qualys import for project {project_id} by user {current_user.id}")
    
    # Validate file type
    if not file.filename or not file.filename.endswith('.xml'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an XML file"
        )
    
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Read and parse XML
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            xml_content = content.decode('latin-1')
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not decode file: {str(e)}"
            )
    
    # Parse Qualys XML
    try:
        qualys_findings = qualys_parser.parse_xml(xml_content)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    if not qualys_findings:
        return ImportResponse(
            success=True,
            message="No findings found in the Qualys export file",
            imported_count=0,
            skipped_count=0,
            findings=[]
        )
    
    # Check for duplicates (by source_id)
    existing_findings = await db.finding.find_many(
        where={
            "projectId": project_id,
            "source": "qualys"
        }
    )
    existing_source_ids = {f.sourceId for f in existing_findings if f.sourceId}
    
    imported_findings = []
    skipped_count = 0
    
    for qualys_finding in qualys_findings:
        # Skip informational if requested
        if skip_informational and qualys_finding.severity == 'Informational':
            skipped_count += 1
            continue
        
        # Convert to Atomik format
        atomik_data = qualys_parser.to_atomik_format(qualys_finding)
        
        # Skip duplicates
        if atomik_data.get('source_id') in existing_source_ids:
            logger.debug(f"Skipping duplicate finding: {qualys_finding.title}")
            skipped_count += 1
            continue
        
        # Sanitize HTML content
        description = RichTextService.sanitize_html(atomik_data.get('description', '')) or None
        evidence = RichTextService.sanitize_html(atomik_data.get('evidence', '')) or None
        remediation = RichTextService.sanitize_html(atomik_data.get('remediation', '')) or None
        references = RichTextService.sanitize_html(atomik_data.get('references', '')) or None
        
        # Generate unique reference ID
        reference_id = await generate_finding_reference_id(project.clientId)
        
        # Create finding in database
        try:
            finding = await db.finding.create(
                data={
                    "referenceId": reference_id,
                    "title": atomik_data['title'],
                    "description": description,
                    "severity": atomik_data['severity'].upper(),
                    "projectId": project_id,
                    "createdById": current_user.id,
                    "cvssScore": atomik_data.get('cvss_score'),
                    "cvssVector": atomik_data.get('cvss_vector'),
                    "cveId": atomik_data.get('cve_id'),
                    "evidence": evidence,
                    "remediation": remediation,
                    "references": references,
                    "affectedSystems": atomik_data.get('affected_systems'),
                    "affectedAssetsCount": atomik_data.get('affected_assets_count', 1),
                    "source": "qualys",
                    "sourceId": atomik_data.get('source_id'),
                    "status": "OPEN",
                }
            )
            
            imported_findings.append(ImportedFinding(
                id=finding.id,
                reference_id=finding.referenceId,
                title=finding.title,
                severity=finding.severity,
                source="qualys",
                source_id=finding.sourceId
            ))
            
            logger.debug(f"Imported finding: {finding.title} ({finding.referenceId})")
            
        except Exception as e:
            logger.error(f"Failed to create finding '{atomik_data['title']}': {e}")
            skipped_count += 1
            continue
    
    message = f"Successfully imported {len(imported_findings)} findings"
    if skipped_count > 0:
        message += f" ({skipped_count} skipped)"
    
    logger.info(message)
    
    return ImportResponse(
        success=True,
        message=message,
        imported_count=len(imported_findings),
        skipped_count=skipped_count,
        findings=imported_findings
    )


@router.get("/sources")
async def list_import_sources(
    current_user = Depends(get_current_user)
):
    """
    List available import sources.
    """
    return {
        "sources": [
            {
                "id": "burp",
                "name": "Burp Suite",
                "description": "Import findings from Burp Suite Professional XML export",
                "file_types": [".xml"],
                "endpoint": "/api/imports/burp/{project_id}"
            },
            {
                "id": "nessus",
                "name": "Nessus",
                "description": "Import findings from Nessus .nessus or XML export",
                "file_types": [".nessus", ".xml"],
                "endpoint": "/api/imports/nessus/{project_id}"
            },
            {
                "id": "qualys",
                "name": "Qualys",
                "description": "Import findings from Qualys VM scan XML export",
                "file_types": [".xml"],
                "endpoint": "/api/imports/qualys/{project_id}"
            },
        ]
    }

