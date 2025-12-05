"""
Project management routes
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.db import db
from prisma.enums import ProjectRole


router = APIRouter()


# Request/Response models
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    project_type: Optional[str] = None
    scope: Optional[str] = None  # JSON array as string
    methodology: Optional[str] = None
    compliance_frameworks: Optional[str] = None  # JSON array as string
    priority: Optional[str] = "Medium"
    status: Optional[str] = "PLANNING"  # Default status


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    project_type: Optional[str] = None
    scope: Optional[str] = None
    methodology: Optional[str] = None
    compliance_frameworks: Optional[str] = None
    priority: Optional[str] = None


class ProjectMemberInResponse(BaseModel):
    """Project member data included in project response"""
    id: str
    userId: str
    userName: Optional[str]
    userEmail: str
    role: str
    assignedAt: str


class FindingsSeverityCount(BaseModel):
    """Breakdown of findings by severity level"""
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    start_date: Optional[str]
    end_date: Optional[str]
    project_type: Optional[str]
    scope: Optional[str]
    methodology: Optional[str]
    compliance_frameworks: Optional[str]
    priority: Optional[str]
    client_id: str
    client_name: str
    lead_id: str
    lead_name: str
    created_at: str
    updated_at: str
    finding_count: int
    findings_by_severity: FindingsSeverityCount  # Breakdown by severity
    report_count: int
    members: Optional[List[ProjectMemberInResponse]] = None
    # Retest fields
    is_retest: bool = False
    parent_project_id: Optional[str] = None
    parent_project_name: Optional[str] = None
    retest_count: int = 0  # Number of retests created from this project


class AvailableMemberResponse(BaseModel):
    """Response model for available organization members"""
    id: str
    email: str
    firstName: Optional[str]
    lastName: Optional[str]
    imageUrl: Optional[str]
    name: Optional[str]


class ProjectMemberAdd(BaseModel):
    """Request model for adding a project member"""
    userId: str
    role: ProjectRole  # LEAD, TESTER, or VIEWER


class ProjectMemberUpdate(BaseModel):
    """Request model for updating a project member's role"""
    role: ProjectRole


class ProjectMemberResponse(BaseModel):
    """Response model for project member"""
    id: str
    userId: str
    userName: Optional[str]
    userEmail: str
    role: str
    assignedAt: str


def _count_findings_by_severity(findings) -> FindingsSeverityCount:
    """Helper function to count findings by severity level"""
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    if findings:
        for finding in findings:
            severity = (finding.severity or "").upper()
            if severity == "CRITICAL":
                counts["critical"] += 1
            elif severity == "HIGH":
                counts["high"] += 1
            elif severity == "MEDIUM":
                counts["medium"] += 1
            elif severity in ("LOW", "INFO"):
                counts["low"] += 1
    return FindingsSeverityCount(**counts)


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """List all projects"""
    import logging
    logger = logging.getLogger(__name__)
    
    where_clause = {}
    
    # Filter by organization through client relationship
    if current_user.organizationId:
        where_clause["client"] = {"organizationId": current_user.organizationId}
        logger.info(f"Filtering projects by organization: {current_user.organizationId}")
    else:
        logger.info("No organizationId for user, returning all projects")
    
    if status:
        where_clause["status"] = status
        logger.info(f"Filtering by status: {status}")
    
    if client_id:
        where_clause["clientId"] = client_id
        logger.info(f"Filtering by client_id: {client_id}")
    
    logger.info(f"Query where_clause: {where_clause}")
    logger.info(f"User ID: {current_user.id}, Organization ID: {current_user.organizationId}")
    
    projects = await db.project.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        include={
            "client": True,
            "lead": True,
            "findings": True,  # Include to get count
            "reports": True,   # Include to get count
            "parentProject": True,  # For retest info
            "retests": True,  # Count of retests
        },
        order={"createdAt": "desc"}
    )
    
    logger.info(f"Found {len(projects)} projects for user {current_user.id}")
    if len(projects) > 0:
        for p in projects:
            logger.info(f"  - Project: {p.name} (ID: {p.id}), Client Org: {p.client.organizationId if p.client else 'None'}")
    else:
        # Debug: Check if there are any projects at all
        all_projects = await db.project.find_many(
            take=5,
            include={"client": True}
        )
        logger.info(f"Total projects in DB (any org): {len(all_projects)}")
        for p in all_projects:
            logger.info(f"  - All Project: {p.name}, Client Org: {p.client.organizationId if p.client else 'No client'}")
    
    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            start_date=project.startDate.isoformat() if project.startDate else None,
            end_date=project.endDate.isoformat() if project.endDate else None,
            project_type=project.projectType,
            scope=project.scope,
            methodology=project.methodology,
            compliance_frameworks=project.complianceFrameworks,
            priority=project.priority,
            client_id=project.clientId,
            client_name=project.client.name,
            lead_id=project.leadId,
            lead_name=project.lead.name,
            created_at=project.createdAt.isoformat(),
            updated_at=project.updatedAt.isoformat(),
            finding_count=len(project.findings),
            findings_by_severity=_count_findings_by_severity(project.findings),
            report_count=len(project.reports),
            is_retest=project.isRetest or False,
            parent_project_id=project.parentProjectId,
            parent_project_name=project.parentProject.name if project.parentProject else None,
            retest_count=len(project.retests) if project.retests else 0,
        )
        for project in projects
    ]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user = Depends(get_current_user)
):
    """Create a new project"""
    # Verify client exists and user has access
    client = await db.client.find_unique(where={"id": project_data.client_id})
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    if current_user.organizationId and client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    project = await db.project.create(
        data={
            "name": project_data.name,
            "description": project_data.description,
            "clientId": project_data.client_id,
            "leadId": current_user.id,
            "startDate": project_data.start_date,
            "endDate": project_data.end_date,
            "status": project_data.status or "PLANNING",
            "projectType": project_data.project_type,
            "scope": project_data.scope,
            "methodology": project_data.methodology,
            "complianceFrameworks": project_data.compliance_frameworks,
            "priority": project_data.priority,
        },
        include={
            "client": True,
            "lead": True,
            "findings": True,  # Include to get count
            "reports": True,    # Include to get count
        }
    )
    
    # Fetch project with counts for response
    project_with_counts = await db.project.find_unique(
        where={"id": project.id},
        include={
            "client": True,
            "lead": True,
            "findings": True,  # Include to get count
            "reports": True,  # Include to get count
        }
    )
    
    return ProjectResponse(
        id=project_with_counts.id,
        name=project_with_counts.name,
        description=project_with_counts.description,
        status=project_with_counts.status,
        start_date=project_with_counts.startDate.isoformat() if project_with_counts.startDate else None,
        end_date=project_with_counts.endDate.isoformat() if project_with_counts.endDate else None,
        project_type=project_with_counts.projectType,
        scope=project_with_counts.scope,
        methodology=project_with_counts.methodology,
        compliance_frameworks=project_with_counts.complianceFrameworks,
        priority=project_with_counts.priority,
        client_id=project_with_counts.clientId,
        client_name=project_with_counts.client.name,
        lead_id=project_with_counts.leadId,
        lead_name=project_with_counts.lead.name,
        created_at=project_with_counts.createdAt.isoformat(),
        updated_at=project_with_counts.updatedAt.isoformat(),
        finding_count=len(project_with_counts.findings),
        findings_by_severity=_count_findings_by_severity(project_with_counts.findings),
        report_count=len(project_with_counts.reports),
        is_retest=False,  # New projects are not retests
        parent_project_id=None,
        parent_project_name=None,
        retest_count=0,
    )


# ============== Project Team Management Endpoints ==============
# NOTE: This route MUST come before /{project_id} to avoid route shadowing
@router.get("/available-members", response_model=list[AvailableMemberResponse])
async def get_available_members(
    current_user = Depends(get_current_user)
):
    """
    Get all users in the current user's organization who are available to be assigned to projects.
    
    This populates the dropdown menu for adding team members.
    
    If the user doesn't belong to an organization, returns the current user themselves
    as the only candidate (allows solo founders to assign themselves to projects).
    
    Returns empty list on error to prevent frontend crashes.
    """
    try:
        # Safety Check: If user has no team, they can only assign themselves
        if not current_user.organizationId:
            print(f"⚠️ User {current_user.id} has no organizationId, returning self as only candidate")
            return [
                AvailableMemberResponse(
                    id=current_user.id,
                    email=current_user.email,
                    firstName=current_user.firstName,
                    lastName=current_user.lastName,
                    imageUrl=current_user.imageUrl,
                    name=current_user.name,
                )
            ]
        
        print(f"🔍 Fetching members for organization: {current_user.organizationId}")
        
        # Fetch Team Members
        members = await db.user.find_many(
            where={
                "organizationId": current_user.organizationId
            },
            select={
                "id": True,
                "email": True,
                "firstName": True,
                "lastName": True,
                "imageUrl": True,
                "name": True,
            },
            order_by={"email": "asc"}
        )
        
        print(f"✅ Found {len(members)} members in organization")
        
        # Convert to response model
        return [
            AvailableMemberResponse(
                id=member.id,
                email=member.email,
                firstName=member.firstName,
                lastName=member.lastName,
                imageUrl=member.imageUrl,
                name=member.name,
            )
            for member in members
        ]
        
    except Exception as e:
        print(f"❌ TEAM FETCH ERROR: {str(e)}")
        print(f"   Current User ID: {current_user.id if current_user else 'None'}")
        print(f"   Organization ID: {current_user.organizationId if current_user else 'None'}")
        import traceback
        traceback.print_exc()
        # Return empty list on crash to prevent frontend white screen
        return []


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific project by ID with team members"""
    project = await db.project.find_unique(
        where={"id": project_id},
        include={
            "client": True,
            "lead": True,
            "members": {
                "include": {
                    "user": True
                }
            },
            "findings": True,
            "reports": True,
            "parentProject": True,  # For retest info
            "retests": True,  # Count of retests
        }
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organization access
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Format members for response
    members = None
    if project.members:
        members = [
            ProjectMemberInResponse(
                id=member.id,
                userId=member.userId,
                userName=member.user.name or f"{member.user.firstName or ''} {member.user.lastName or ''}".strip() or None,
                userEmail=member.user.email,
                role=member.role,
                assignedAt=member.assignedAt.isoformat(),
            )
            for member in project.members
        ]
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        start_date=project.startDate.isoformat() if project.startDate else None,
        end_date=project.endDate.isoformat() if project.endDate else None,
        project_type=project.projectType,
        scope=project.scope,
        methodology=project.methodology,
        compliance_frameworks=project.complianceFrameworks,
        priority=project.priority,
        client_id=project.clientId,
        client_name=project.client.name,
        lead_id=project.leadId,
        lead_name=project.lead.name,
        created_at=project.createdAt.isoformat(),
        updated_at=project.updatedAt.isoformat(),
        finding_count=len(project.findings) if project.findings else 0,
        findings_by_severity=_count_findings_by_severity(project.findings),
        report_count=len(project.reports) if project.reports else 0,
        members=members,
        is_retest=project.isRetest or False,
        parent_project_id=project.parentProjectId,
        parent_project_name=project.parentProject.name if project.parentProject else None,
        retest_count=len(project.retests) if project.retests else 0,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user = Depends(get_current_user)
):
    """Update a project"""
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organization access
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update data
    update_data = {}
    if project_data.name is not None:
        update_data["name"] = project_data.name
    if project_data.description is not None:
        update_data["description"] = project_data.description
    if project_data.status is not None:
        update_data["status"] = project_data.status
    if project_data.start_date is not None:
        update_data["startDate"] = project_data.start_date
    if project_data.end_date is not None:
        update_data["endDate"] = project_data.end_date
    if project_data.project_type is not None:
        update_data["projectType"] = project_data.project_type
    if project_data.scope is not None:
        update_data["scope"] = project_data.scope
    if project_data.methodology is not None:
        update_data["methodology"] = project_data.methodology
    if project_data.compliance_frameworks is not None:
        update_data["complianceFrameworks"] = project_data.compliance_frameworks
    if project_data.priority is not None:
        update_data["priority"] = project_data.priority
    
    updated_project = await db.project.update(
        where={"id": project_id},
        data=update_data,
        include={
            "client": True,
            "lead": True,
            "findings": True,
            "reports": True,
            "parentProject": True,
            "retests": True,
        }
    )
    
    return ProjectResponse(
        id=updated_project.id,
        name=updated_project.name,
        description=updated_project.description,
        status=updated_project.status,
        start_date=updated_project.startDate.isoformat() if updated_project.startDate else None,
        end_date=updated_project.endDate.isoformat() if updated_project.endDate else None,
        project_type=updated_project.projectType,
        scope=updated_project.scope,
        methodology=updated_project.methodology,
        compliance_frameworks=updated_project.complianceFrameworks,
        priority=updated_project.priority,
        client_id=updated_project.clientId,
        client_name=updated_project.client.name,
        lead_id=updated_project.leadId,
        lead_name=updated_project.lead.name,
        created_at=updated_project.createdAt.isoformat(),
        updated_at=updated_project.updatedAt.isoformat(),
        finding_count=len(updated_project.findings) if updated_project.findings else 0,
        findings_by_severity=_count_findings_by_severity(updated_project.findings),
        report_count=len(updated_project.reports) if updated_project.reports else 0,
        is_retest=updated_project.isRetest or False,
        parent_project_id=updated_project.parentProjectId,
        parent_project_name=updated_project.parentProject.name if updated_project.parentProject else None,
        retest_count=len(updated_project.retests) if updated_project.retests else 0,
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a project"""
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organization access
    if current_user.organizationId and project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await db.project.delete(where={"id": project_id})
    return None


# ============== Project Team Management Endpoints ==============

@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: str,
    member_data: ProjectMemberAdd,
    current_user = Depends(get_current_user)
):
    """
    Add a user to a project team with a specific role.
    
    Security checks:
    - Project must belong to user's organization
    - User being added must belong to user's organization
    - Prevents duplicate memberships (handled by unique constraint)
    """
    if not current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    # Verify project exists and belongs to user's organization
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Project does not belong to your organization"
        )
    
    # Verify user exists and belongs to user's organization
    user_to_add = await db.user.find_unique(
        where={"id": member_data.userId}
    )
    
    if not user_to_add:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_to_add.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not belong to your organization"
        )
    
    # Role validation is handled by Pydantic using the ProjectRole enum
    
    # Check if user is already a member (unique constraint will also prevent this)
    existing_member = await db.projectmember.find_first(
        where={
            "projectId": project_id,
            "userId": member_data.userId
        }
    )
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this project"
        )
    
    # Create project member
    project_member = await db.projectmember.create(
        data={
            "projectId": project_id,
            "userId": member_data.userId,
            "role": member_data.role,
        },
        include={"user": True}
    )
    
    return ProjectMemberResponse(
        id=project_member.id,
        userId=project_member.userId,
        userName=project_member.user.name or f"{project_member.user.firstName or ''} {project_member.user.lastName or ''}".strip(),
        userEmail=project_member.user.email,
        role=project_member.role,
        assignedAt=project_member.assignedAt.isoformat(),
    )


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user = Depends(get_current_user)
):
    """
    Remove a user from a project team.
    
    Security checks:
    - Project must belong to user's organization
    - User being removed must belong to user's organization
    """
    if not current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    # Verify project exists and belongs to user's organization
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Project does not belong to your organization"
        )
    
    # Verify user exists and belongs to user's organization
    user_to_remove = await db.user.find_unique(
        where={"id": user_id}
    )
    
    if not user_to_remove:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_to_remove.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not belong to your organization"
        )
    
    # Find and delete the project member
    project_member = await db.projectmember.find_first(
        where={
            "projectId": project_id,
            "userId": user_id
        }
    )
    
    if not project_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this project"
        )
    
    await db.projectmember.delete(where={"id": project_member.id})
    return None


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def get_project_members(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get all members assigned to a project.
    
    Security checks:
    - Project must belong to user's organization
    """
    if not current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    # Verify project exists and belongs to user's organization
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Project does not belong to your organization"
        )
    
    # Fetch all project members with user details
    members = await db.projectmember.find_many(
        where={"projectId": project_id},
        include={"user": True},
        order_by={"assignedAt": "asc"}
    )
    
    return [
        ProjectMemberResponse(
            id=member.id,
            userId=member.userId,
            userName=member.user.name or f"{member.user.firstName or ''} {member.user.lastName or ''}".strip() or None,
            userEmail=member.user.email,
            role=member.role,
            assignedAt=member.assignedAt.isoformat(),
        )
        for member in members
    ]


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
async def update_project_member_role(
    project_id: str,
    user_id: str,
    member_data: ProjectMemberUpdate,
    current_user = Depends(get_current_user)
):
    """
    Update a project member's role.
    
    Security checks:
    - Project must belong to user's organization
    - User being updated must belong to user's organization
    """
    if not current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    # Verify project exists and belongs to user's organization
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"client": True}
    )
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    if project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Project does not belong to your organization"
        )
    
    # Find the project member
    project_member = await db.projectmember.find_first(
        where={
            "projectId": project_id,
            "userId": user_id
        },
        include={"user": True}
    )
    
    if not project_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this project"
        )
    
    # Update the role
    updated_member = await db.projectmember.update(
        where={"id": project_member.id},
        data={"role": member_data.role},
        include={"user": True}
    )
    
    return ProjectMemberResponse(
        id=updated_member.id,
        userId=updated_member.userId,
        userName=updated_member.user.name or f"{updated_member.user.firstName or ''} {updated_member.user.lastName or ''}".strip() or None,
        userEmail=updated_member.user.email,
        role=updated_member.role,
        assignedAt=updated_member.assignedAt.isoformat(),
    )


# ============== Retest Workflow Endpoints ==============

@router.post("/{project_id}/retest", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_retest(
    project_id: str,
    current_user = Depends(get_current_user)
):
    """
    Create a retest project from an existing project.
    
    This will:
    1. Create a new project with name: "{Original Name} - Retest"
    2. Link to parent project via parentProjectId
    3. Clone ALL findings with:
       - Same referenceId (e.g., ACME-001 stays ACME-001)
       - Status reset to OPEN
       - Clear evidence (fresh proof needed)
       - Keep description, remediation, severity, CVSS
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Fetch the original project with findings and reports
    original_project = await db.project.find_unique(
        where={"id": project_id},
        include={
            "client": True,
            "lead": True,
            "findings": True,
            "reports": True,  # Include reports to clone narrative content
        }
    )
    
    if not original_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check organization access
    if current_user.organizationId and original_project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Count existing retests to number them (e.g., "Project - Retest 2")
    existing_retests = await db.project.count(
        where={"parentProjectId": project_id}
    )
    
    retest_suffix = " - Retest" if existing_retests == 0 else f" - Retest {existing_retests + 1}"
    
    logger.info(f"Creating retest for project '{original_project.name}' with {len(original_project.findings)} findings")
    
    # Create the retest project
    retest_project = await db.project.create(
        data={
            "name": f"{original_project.name}{retest_suffix}",
            "description": f"Retest of: {original_project.name}",
            "clientId": original_project.clientId,
            "leadId": current_user.id,
            "status": "IN_PROGRESS",  # Retests typically start in progress
            "projectType": original_project.projectType,
            "scope": original_project.scope,
            "methodology": original_project.methodology,
            "complianceFrameworks": original_project.complianceFrameworks,
            "priority": original_project.priority,
            "isRetest": True,
            "parentProjectId": project_id,
        },
        include={
            "client": True,
            "lead": True,
        }
    )
    
    logger.info(f"Created retest project '{retest_project.name}' (ID: {retest_project.id})")
    
    # Clone all findings from the original project
    retest_number = existing_retests + 1
    cloned_findings_count = 0
    for finding in original_project.findings:
        # Append retest suffix to referenceId to avoid unique constraint violation
        new_reference_id = f"{finding.referenceId}-R{retest_number}" if finding.referenceId else None
        await db.finding.create(
            data={
                "referenceId": new_reference_id,  # Append -R1, -R2, etc. for retests
                "title": finding.title,
                "description": finding.description,
                "severity": finding.severity,
                "cvssScore": finding.cvssScore,
                "cvssVector": finding.cvssVector,
                "cveId": finding.cveId,
                "remediation": finding.remediation,
                "references": finding.references,
                "affectedSystems": finding.affectedSystems,
                "affectedAssetsJson": finding.affectedAssetsJson,
                "affectedAssetsCount": finding.affectedAssetsCount,
                # Reset fields for fresh verification:
                "status": "OPEN",  # Reset to OPEN for re-verification
                "evidence": None,  # Clear evidence - needs fresh proof
                "projectId": retest_project.id,
                "createdById": current_user.id,
                "templateId": finding.templateId,
            }
        )
        cloned_findings_count += 1
    
    logger.info(f"Cloned {cloned_findings_count} findings to retest project")
    
    # Clone reports from the original project (preserves narrative content: Executive Summary, Methodology, Scope)
    cloned_reports_count = 0
    for report in original_project.reports:
        await db.report.create(
            data={
                "title": f"{report.title} - Retest {retest_number}",
                "reportType": report.reportType,
                "status": "DRAFT",  # Reset to DRAFT for new review
                "projectId": retest_project.id,
                "generatedById": current_user.id,
                "templateId": report.templateId,
                "htmlContent": report.htmlContent,  # Clone the narrative content!
            }
        )
        cloned_reports_count += 1
    
    logger.info(f"Cloned {cloned_reports_count} reports with narrative content to retest project")
    
    # Fetch the complete retest project with counts
    complete_retest = await db.project.find_unique(
        where={"id": retest_project.id},
        include={
            "client": True,
            "lead": True,
            "findings": True,
            "reports": True,
            "parentProject": True,
        }
    )
    
    return ProjectResponse(
        id=complete_retest.id,
        name=complete_retest.name,
        description=complete_retest.description,
        status=complete_retest.status,
        start_date=complete_retest.startDate.isoformat() if complete_retest.startDate else None,
        end_date=complete_retest.endDate.isoformat() if complete_retest.endDate else None,
        project_type=complete_retest.projectType,
        scope=complete_retest.scope,
        methodology=complete_retest.methodology,
        compliance_frameworks=complete_retest.complianceFrameworks,
        priority=complete_retest.priority,
        client_id=complete_retest.clientId,
        client_name=complete_retest.client.name,
        lead_id=complete_retest.leadId,
        lead_name=complete_retest.lead.name,
        created_at=complete_retest.createdAt.isoformat(),
        updated_at=complete_retest.updatedAt.isoformat(),
        finding_count=len(complete_retest.findings),
        findings_by_severity=_count_findings_by_severity(complete_retest.findings),
        report_count=len(complete_retest.reports),
        is_retest=complete_retest.isRetest,
        parent_project_id=complete_retest.parentProjectId,
        parent_project_name=complete_retest.parentProject.name if complete_retest.parentProject else None,
        retest_count=0,
    )
