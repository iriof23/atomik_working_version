"""
Finding management routes

SECURITY: Evidence fields contain HTML from rich text editor.
All HTML content is sanitized before storage to prevent XSS.

AUDIT: All CRUD operations are logged for compliance and security monitoring.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.core.security_middleware import get_request_context
from app.db import db
from app.services.rich_text_service import RichTextService
from app.services.audit_service import audit_service, AuditAction

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response models
class FindingCreate(BaseModel):
    title: str
    description: str
    severity: str
    project_id: str
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve_id: Optional[str] = None
    affected_systems: Optional[str] = None
    affected_assets_json: Optional[str] = None  # JSON array of affected assets
    affected_assets_count: Optional[int] = None
    evidence: Optional[str] = None  # PoC/Evidence content
    remediation: Optional[str] = None
    references: Optional[str] = None
    template_id: Optional[str] = None


class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    cve_id: Optional[str] = None
    affected_systems: Optional[str] = None
    affected_assets_json: Optional[str] = None  # JSON array of affected assets
    affected_assets_count: Optional[int] = None
    evidence: Optional[str] = None  # PoC/Evidence content
    remediation: Optional[str] = None
    references: Optional[str] = None
    status: Optional[str] = None


class EvidenceResponse(BaseModel):
    id: str
    filename: str
    filepath: str
    filesize: int
    mimetype: str
    caption: Optional[str]
    created_at: str


class FindingStatsResponse(BaseModel):
    """Response model for findings statistics"""
    total: int
    total_open: int
    critical: int
    critical_open: int
    high: int
    high_open: int
    medium: int
    medium_open: int
    low: int
    low_open: int


class FindingResponse(BaseModel):
    id: str
    reference_id: Optional[str]  # Professional Finding ID (e.g., "ACME-001")
    title: str
    description: str
    severity: str
    cvss_score: Optional[float]
    cvss_vector: Optional[str]
    cve_id: Optional[str]
    affected_systems: Optional[str]
    affected_assets_json: Optional[str]  # JSON array of affected assets
    affected_assets_count: int
    evidence: Optional[str]  # PoC/Evidence content
    remediation: Optional[str]
    references: Optional[str]
    status: str
    project_id: str
    project_name: str
    client_name: Optional[str]  # Added for generating unique Finding IDs
    client_code: Optional[str]  # Client ticker code
    created_by_id: str
    created_by_name: str
    template_id: Optional[str]
    created_at: str
    updated_at: str
    evidence_count: int  # Count of uploaded evidence files


@router.get("/", response_model=list[FindingResponse])
async def list_findings(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """List all findings"""
    where_clause = {}
    
    # Filter by organization through project->client relationship
    if current_user.organizationId:
        where_clause["project"] = {
            "client": {"organizationId": current_user.organizationId}
        }
    
    if project_id:
        where_clause["projectId"] = project_id
    
    if severity:
        where_clause["severity"] = severity
    
    if status:
        where_clause["status"] = status
    
    findings = await db.finding.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        include={
            "project": {
                "include": {
                    "client": True  # Include client for generating unique Finding IDs
                }
            },
            "createdBy": True,
            "evidences": True
        },
        order={"createdAt": "desc"}
    )
    
    return [
        FindingResponse(
            id=finding.id,
            reference_id=finding.referenceId,
            title=finding.title,
            description=finding.description,
            severity=finding.severity,
            cvss_score=finding.cvssScore,
            cvss_vector=finding.cvssVector,
            cve_id=finding.cveId,
            affected_systems=finding.affectedSystems,
            affected_assets_json=finding.affectedAssetsJson,
            affected_assets_count=finding.affectedAssetsCount or 0,
            evidence=finding.evidence,
            remediation=finding.remediation,
            references=finding.references,
            status=finding.status,
            project_id=finding.projectId,
            project_name=finding.project.name,
            client_name=finding.project.client.name if finding.project.client else None,
            client_code=finding.project.client.code if finding.project.client else None,
            created_by_id=finding.createdById,
            created_by_name=finding.createdBy.name,
            template_id=finding.templateId,
            created_at=finding.createdAt.isoformat(),
            updated_at=finding.updatedAt.isoformat(),
            evidence_count=len(finding.evidences) if finding.evidences else 0,
        )
        for finding in findings
    ]


@router.get("/stats", response_model=FindingStatsResponse)
async def get_findings_stats(
    current_user = Depends(get_current_user)
):
    """
    Get aggregated findings statistics for the dashboard.
    Returns total counts and counts by severity, both overall and for OPEN status only.
    """
    where_clause = {}
    
    # Filter by organization through project->client relationship
    if current_user.organizationId:
        where_clause["project"] = {
            "client": {"organizationId": current_user.organizationId}
        }
    
    # Fetch all findings for the organization
    findings = await db.finding.find_many(
        where=where_clause,
        include={
            "project": {
                "include": {
                    "client": True
                }
            }
        }
    )
    
    # Calculate stats
    stats = {
        "total": 0,
        "total_open": 0,
        "critical": 0,
        "critical_open": 0,
        "high": 0,
        "high_open": 0,
        "medium": 0,
        "medium_open": 0,
        "low": 0,
        "low_open": 0,
    }
    
    for finding in findings:
        severity = finding.severity.upper() if finding.severity else ""
        is_open = finding.status == "OPEN"
        
        stats["total"] += 1
        if is_open:
            stats["total_open"] += 1
        
        if severity == "CRITICAL":
            stats["critical"] += 1
            if is_open:
                stats["critical_open"] += 1
        elif severity == "HIGH":
            stats["high"] += 1
            if is_open:
                stats["high_open"] += 1
        elif severity == "MEDIUM":
            stats["medium"] += 1
            if is_open:
                stats["medium_open"] += 1
        elif severity in ("LOW", "INFO"):
            stats["low"] += 1
            if is_open:
                stats["low_open"] += 1
    
    return FindingStatsResponse(**stats)


async def generate_finding_reference_id(client_id: str) -> str:
    """
    Generate a unique Finding ID for a client.
    Format: CLIENT_CODE-XXX (e.g., ACME-001, ACME-002)
    Uses atomic increment to prevent race conditions.
    """
    # Increment the client's finding counter and get the new value
    updated_client = await db.client.update(
        where={"id": client_id},
        data={"findingCounter": {"increment": 1}}
    )
    
    # Get the client code (or generate a fallback)
    client_code = updated_client.code or "FND"
    next_number = updated_client.findingCounter or 1
    
    # Format as CLIENT-001, CLIENT-002, etc.
    return f"{client_code}-{next_number:03d}"


@router.post("/", response_model=FindingResponse, status_code=status.HTTP_201_CREATED)
async def create_finding(
    finding_data: FindingCreate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Create a new finding"""
    # Get request context for audit logging
    ctx = get_request_context(request)
    
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": finding_data.project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        # AUDIT: Log access denied
        await audit_service.log_access_denied(
            resource="Finding",
            user_id=current_user.id,
            user_email=current_user.email,
            reason="Organization mismatch",
            ip_address=ctx.get("client_ip"),
            user_agent=ctx.get("user_agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Convert severity to uppercase to match database enum
    severity_upper = finding_data.severity.upper() if finding_data.severity else "MEDIUM"
    
    # Generate a unique Finding Reference ID (e.g., ACME-001)
    reference_id = await generate_finding_reference_id(project.clientId)
    logger.info(f"Generated Finding ID: {reference_id} for client {project.clientId}")
    
    # SECURITY: Sanitize HTML fields from rich text editor
    sanitized_description = RichTextService.sanitize_html(finding_data.description) if finding_data.description else None
    sanitized_evidence = RichTextService.sanitize_html(finding_data.evidence) if finding_data.evidence else None
    sanitized_remediation = RichTextService.sanitize_html(finding_data.remediation) if finding_data.remediation else None
    
    finding = await db.finding.create(
        data={
            "referenceId": reference_id,  # The professional Finding ID
            "title": finding_data.title,
            "description": sanitized_description,
            "severity": severity_upper,
            "projectId": finding_data.project_id,
            "createdById": current_user.id,
            "cvssScore": finding_data.cvss_score,
            "cvssVector": finding_data.cvss_vector,
            "cveId": finding_data.cve_id,
            "affectedSystems": finding_data.affected_systems,
            "affectedAssetsJson": finding_data.affected_assets_json,
            "affectedAssetsCount": finding_data.affected_assets_count or 0,
            "evidence": sanitized_evidence,
            "remediation": sanitized_remediation,
            "references": finding_data.references,
            "templateId": finding_data.template_id,
            "status": "OPEN",
        },
        include={
            "project": {
                "include": {
                    "client": True  # Include client for generating unique Finding IDs
                }
            },
            "createdBy": True,
            "evidences": True
        }
    )
    
    # AUDIT: Log finding creation
    await audit_service.log_create(
        resource="Finding",
        resource_id=finding.id,
        resource_name=f"{reference_id}: {finding.title}",
        user_id=current_user.id,
        user_email=current_user.email,
        organization_id=current_user.organizationId,
        details={
            "reference_id": reference_id,
            "severity": severity_upper,
            "project_id": finding_data.project_id,
            "project_name": project.name,
        },
        ip_address=ctx.get("client_ip"),
        user_agent=ctx.get("user_agent"),
        request_id=ctx.get("request_id"),
    )
    
    return FindingResponse(
        id=finding.id,
        reference_id=finding.referenceId,
        title=finding.title,
        description=finding.description,
        severity=finding.severity,
        cvss_score=finding.cvssScore,
        cvss_vector=finding.cvssVector,
        cve_id=finding.cveId,
        affected_systems=finding.affectedSystems,
        affected_assets_json=finding.affectedAssetsJson,
        affected_assets_count=finding.affectedAssetsCount or 0,
        evidence=finding.evidence,
        remediation=finding.remediation,
        references=finding.references,
        status=finding.status,
        project_id=finding.projectId,
        project_name=finding.project.name,
        client_name=finding.project.client.name if finding.project.client else None,
        client_code=finding.project.client.code if finding.project.client else None,
        created_by_id=finding.createdById,
        created_by_name=finding.createdBy.name,
        template_id=finding.templateId,
        created_at=finding.createdAt.isoformat(),
        updated_at=finding.updatedAt.isoformat(),
        evidence_count=len(finding.evidences) if finding.evidences else 0,
    )


@router.get("/{finding_id}", response_model=FindingResponse)
async def get_finding(
    finding_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific finding by ID"""
    finding = await db.finding.find_unique(
        where={"id": finding_id},
        include={
            "project": {"include": {"client": True}},
            "createdBy": True,
            "evidences": True
        }
    )
    
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found"
        )
    
    # Check organization access
    if current_user.organizationId and finding.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return FindingResponse(
        id=finding.id,
        reference_id=finding.referenceId,
        title=finding.title,
        description=finding.description,
        severity=finding.severity,
        cvss_score=finding.cvssScore,
        cvss_vector=finding.cvssVector,
        cve_id=finding.cveId,
        affected_systems=finding.affectedSystems,
        affected_assets_json=finding.affectedAssetsJson,
        affected_assets_count=finding.affectedAssetsCount or 0,
        evidence=finding.evidence,
        remediation=finding.remediation,
        references=finding.references,
        status=finding.status,
        project_id=finding.projectId,
        project_name=finding.project.name,
        client_name=finding.project.client.name if finding.project.client else None,
        client_code=finding.project.client.code if finding.project.client else None,
        created_by_id=finding.createdById,
        created_by_name=finding.createdBy.name,
        template_id=finding.templateId,
        created_at=finding.createdAt.isoformat(),
        updated_at=finding.updatedAt.isoformat(),
        evidence_count=len(finding.evidences) if finding.evidences else 0,
    )


@router.put("/{finding_id}", response_model=FindingResponse)
async def update_finding(
    finding_id: str,
    finding_data: FindingUpdate,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Update a finding"""
    logger.info(f"Updating finding {finding_id} by user {current_user.id}")
    logger.debug(f"Update data: {finding_data}")
    
    # Get request context for audit logging
    ctx = get_request_context(request)
    
    try:
        finding = await db.finding.find_unique(
            where={"id": finding_id},
            include={"project": {"include": {"client": True}}}
        )
        
        if not finding:
            logger.warning(f"Finding not found: {finding_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Finding not found"
            )
        
        # Check organization access
        if current_user.organizationId and finding.project.client.organizationId != current_user.organizationId:
            logger.warning(f"Access denied for user {current_user.id} to finding {finding_id}")
            # AUDIT: Log access denied
            await audit_service.log_access_denied(
                resource="Finding",
                resource_id=finding_id,
                user_id=current_user.id,
                user_email=current_user.email,
                reason="Organization mismatch",
                ip_address=ctx.get("client_ip"),
                user_agent=ctx.get("user_agent"),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Build update data
        update_data = {}
        if finding_data.title is not None:
            update_data["title"] = finding_data.title
        if finding_data.description is not None:
            # SECURITY: Sanitize HTML content
            update_data["description"] = RichTextService.sanitize_html(finding_data.description)
        if finding_data.severity is not None:
            # Convert severity to uppercase for database enum
            update_data["severity"] = finding_data.severity.upper()
        if finding_data.cvss_score is not None:
            update_data["cvssScore"] = finding_data.cvss_score
        if finding_data.cvss_vector is not None:
            update_data["cvssVector"] = finding_data.cvss_vector
        if finding_data.cve_id is not None:
            update_data["cveId"] = finding_data.cve_id
        if finding_data.affected_systems is not None:
            update_data["affectedSystems"] = finding_data.affected_systems
        if finding_data.affected_assets_json is not None:
            update_data["affectedAssetsJson"] = finding_data.affected_assets_json
        if finding_data.affected_assets_count is not None:
            update_data["affectedAssetsCount"] = finding_data.affected_assets_count
        if finding_data.evidence is not None:
            # SECURITY: Sanitize HTML from rich text editor before storage
            update_data["evidence"] = RichTextService.sanitize_html(finding_data.evidence)
        if finding_data.remediation is not None:
            # SECURITY: Sanitize HTML content
            update_data["remediation"] = RichTextService.sanitize_html(finding_data.remediation)
        if finding_data.references is not None:
            update_data["references"] = finding_data.references
        if finding_data.status is not None:
            # Convert status to uppercase for database enum
            update_data["status"] = finding_data.status.upper()
        
        logger.debug(f"Applying update_data: {update_data}")
        
        updated_finding = await db.finding.update(
            where={"id": finding_id},
            data=update_data,
            include={
                "project": {
                    "include": {
                        "client": True  # Include client for generating unique Finding IDs
                    }
                },
                "createdBy": True,
                "evidences": True
            }
        )
        
        logger.info(f"Successfully updated finding {finding_id}")
        
        # AUDIT: Log finding update
        await audit_service.log_update(
            resource="Finding",
            resource_id=finding_id,
            resource_name=f"{updated_finding.referenceId}: {updated_finding.title}",
            user_id=current_user.id,
            user_email=current_user.email,
            organization_id=current_user.organizationId,
            changes=update_data,
            ip_address=ctx.get("client_ip"),
            user_agent=ctx.get("user_agent"),
            request_id=ctx.get("request_id"),
        )
        
        return FindingResponse(
            id=updated_finding.id,
            reference_id=updated_finding.referenceId,
            title=updated_finding.title,
            description=updated_finding.description,
            severity=updated_finding.severity,
            cvss_score=updated_finding.cvssScore,
            cvss_vector=updated_finding.cvssVector,
            cve_id=updated_finding.cveId,
            affected_systems=updated_finding.affectedSystems,
            affected_assets_json=updated_finding.affectedAssetsJson,
            affected_assets_count=updated_finding.affectedAssetsCount or 0,
            evidence=updated_finding.evidence,
            remediation=updated_finding.remediation,
            references=updated_finding.references,
            status=updated_finding.status,
            project_id=updated_finding.projectId,
            project_name=updated_finding.project.name,
            client_name=updated_finding.project.client.name if updated_finding.project.client else None,
            client_code=updated_finding.project.client.code if updated_finding.project.client else None,
            created_by_id=updated_finding.createdById,
            created_by_name=updated_finding.createdBy.name,
            template_id=updated_finding.templateId,
            created_at=updated_finding.createdAt.isoformat(),
            updated_at=updated_finding.updatedAt.isoformat(),
            evidence_count=len(updated_finding.evidences) if updated_finding.evidences else 0,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update finding {finding_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update finding: {str(e)}"
        )


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    finding_id: str,
    request: Request,
    current_user = Depends(get_current_user)
):
    """Delete a finding"""
    # Get request context for audit logging
    ctx = get_request_context(request)
    
    finding = await db.finding.find_unique(
        where={"id": finding_id},
        include={"project": {"include": {"client": True}}}
    )
    
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found"
        )
    
    # Check organization access
    if current_user.organizationId and finding.project.client.organizationId != current_user.organizationId:
        # AUDIT: Log access denied
        await audit_service.log_access_denied(
            resource="Finding",
            resource_id=finding_id,
            user_id=current_user.id,
            user_email=current_user.email,
            reason="Organization mismatch",
            ip_address=ctx.get("client_ip"),
            user_agent=ctx.get("user_agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Capture finding details before deletion for audit
    finding_details = {
        "reference_id": finding.referenceId,
        "title": finding.title,
        "severity": finding.severity,
        "project_id": finding.projectId,
    }
    
    await db.finding.delete(where={"id": finding_id})
    
    # AUDIT: Log finding deletion
    await audit_service.log_delete(
        resource="Finding",
        resource_id=finding_id,
        resource_name=f"{finding.referenceId}: {finding.title}",
        user_id=current_user.id,
        user_email=current_user.email,
        organization_id=current_user.organizationId,
        details=finding_details,
        ip_address=ctx.get("client_ip"),
        user_agent=ctx.get("user_agent"),
        request_id=ctx.get("request_id"),
    )
    
    return None


@router.get("/{finding_id}/evidences", response_model=list[EvidenceResponse])
async def list_finding_evidences(
    finding_id: str,
    current_user = Depends(get_current_user)
):
    """List all evidence for a finding"""
    finding = await db.finding.find_unique(
        where={"id": finding_id},
        include={
            "project": {"include": {"client": True}},
            "evidences": True,
        }
    )
    
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found"
        )
    
    # Check organization access
    if current_user.organizationId and finding.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return [
        EvidenceResponse(
            id=evidence.id,
            filename=evidence.filename,
            filepath=evidence.filepath,
            filesize=evidence.filesize,
            mimetype=evidence.mimetype,
            caption=evidence.caption,
            created_at=evidence.createdAt.isoformat(),
        )
        for evidence in finding.evidences
    ]
