"""
Finding management routes
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.db import db


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


class FindingResponse(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    cvss_score: Optional[float]
    cvss_vector: Optional[str]
    cve_id: Optional[str]
    affected_systems: Optional[str]
    remediation: Optional[str]
    references: Optional[str]
    status: str
    project_id: str
    project_name: str
    client_name: Optional[str]  # Added for generating unique Finding IDs
    created_by_id: str
    created_by_name: str
    template_id: Optional[str]
    created_at: str
    updated_at: str
    evidence_count: int


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
            title=finding.title,
            description=finding.description,
            severity=finding.severity,
            cvss_score=finding.cvssScore,
            cvss_vector=finding.cvssVector,
            cve_id=finding.cveId,
            affected_systems=finding.affectedSystems,
            remediation=finding.remediation,
            references=finding.references,
            status=finding.status,
            project_id=finding.projectId,
            project_name=finding.project.name,
            client_name=finding.project.client.name if finding.project.client else None,
            created_by_id=finding.createdById,
            created_by_name=finding.createdBy.name,
            template_id=finding.templateId,
            created_at=finding.createdAt.isoformat(),
            updated_at=finding.updatedAt.isoformat(),
            evidence_count=len(finding.evidences) if finding.evidences else 0,
        )
        for finding in findings
    ]


@router.post("/", response_model=FindingResponse, status_code=status.HTTP_201_CREATED)
async def create_finding(
    finding_data: FindingCreate,
    current_user = Depends(get_current_user)
):
    """Create a new finding"""
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    finding = await db.finding.create(
        data={
            "title": finding_data.title,
            "description": finding_data.description,
            "severity": finding_data.severity,
            "projectId": finding_data.project_id,
            "createdById": current_user.id,
            "cvssScore": finding_data.cvss_score,
            "cvssVector": finding_data.cvss_vector,
            "cveId": finding_data.cve_id,
            "affectedSystems": finding_data.affected_systems,
            "remediation": finding_data.remediation,
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
    
    return FindingResponse(
        id=finding.id,
        title=finding.title,
        description=finding.description,
        severity=finding.severity,
        cvss_score=finding.cvssScore,
        cvss_vector=finding.cvssVector,
        cve_id=finding.cveId,
        affected_systems=finding.affectedSystems,
        remediation=finding.remediation,
        references=finding.references,
        status=finding.status,
        project_id=finding.projectId,
        project_name=finding.project.name,
        client_name=finding.project.client.name if finding.project.client else None,
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
        title=finding.title,
        description=finding.description,
        severity=finding.severity,
        cvss_score=finding.cvssScore,
        cvss_vector=finding.cvssVector,
        cve_id=finding.cveId,
        affected_systems=finding.affectedSystems,
        remediation=finding.remediation,
        references=finding.references,
        status=finding.status,
        project_id=finding.projectId,
        project_name=finding.project.name,
        client_name=finding.project.client.name if finding.project.client else None,
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
    current_user = Depends(get_current_user)
):
    """Update a finding"""
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update data
    update_data = {}
    if finding_data.title is not None:
        update_data["title"] = finding_data.title
    if finding_data.description is not None:
        update_data["description"] = finding_data.description
    if finding_data.severity is not None:
        update_data["severity"] = finding_data.severity
    if finding_data.cvss_score is not None:
        update_data["cvssScore"] = finding_data.cvss_score
    if finding_data.cvss_vector is not None:
        update_data["cvssVector"] = finding_data.cvss_vector
    if finding_data.cve_id is not None:
        update_data["cveId"] = finding_data.cve_id
    if finding_data.affected_systems is not None:
        update_data["affectedSystems"] = finding_data.affected_systems
    if finding_data.remediation is not None:
        update_data["remediation"] = finding_data.remediation
    if finding_data.references is not None:
        update_data["references"] = finding_data.references
    if finding_data.status is not None:
        update_data["status"] = finding_data.status
    
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
    
    return FindingResponse(
        id=updated_finding.id,
        title=updated_finding.title,
        description=updated_finding.description,
        severity=updated_finding.severity,
        cvss_score=updated_finding.cvssScore,
        cvss_vector=updated_finding.cvssVector,
        cve_id=updated_finding.cveId,
        affected_systems=updated_finding.affectedSystems,
        remediation=updated_finding.remediation,
        references=updated_finding.references,
        status=updated_finding.status,
        project_id=updated_finding.projectId,
        project_name=updated_finding.project.name,
        client_name=updated_finding.project.client.name if updated_finding.project.client else None,
        created_by_id=updated_finding.createdById,
        created_by_name=updated_finding.createdBy.name,
        template_id=updated_finding.templateId,
        created_at=updated_finding.createdAt.isoformat(),
        updated_at=updated_finding.updatedAt.isoformat(),
        evidence_count=len(updated_finding.evidences) if updated_finding.evidences else 0,
    )


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    finding_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a finding"""
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await db.finding.delete(where={"id": finding_id})
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
