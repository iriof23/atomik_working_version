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


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ProjectMemberInResponse(BaseModel):
    """Project member data included in project response"""
    id: str
    userId: str
    userName: Optional[str]
    userEmail: str
    role: str
    assignedAt: str


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    start_date: Optional[str]
    end_date: Optional[str]
    client_id: str
    client_name: str
    lead_id: str
    lead_name: str
    created_at: str
    updated_at: str
    finding_count: int
    report_count: int
    members: Optional[List[ProjectMemberInResponse]] = None


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


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """List all projects"""
    where_clause = {}
    
    # Filter by organization through client relationship
    if current_user.organizationId:
        where_clause["client"] = {"organizationId": current_user.organizationId}
    
    if status:
        where_clause["status"] = status
    
    if client_id:
        where_clause["clientId"] = client_id
    
    projects = await db.project.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        include={
            "client": True,
            "lead": True,
            "_count": {
                "select": {
                    "findings": True,
                    "reports": True,
                }
            }
        },
        order={"createdAt": "desc"}
    )
    
    return [
        ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            start_date=project.startDate.isoformat() if project.startDate else None,
            end_date=project.endDate.isoformat() if project.endDate else None,
            client_id=project.clientId,
            client_name=project.client.name,
            lead_id=project.leadId,
            lead_name=project.lead.name,
            created_at=project.createdAt.isoformat(),
            updated_at=project.updatedAt.isoformat(),
            finding_count=project._count.findings,
            report_count=project._count.reports,
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
            "status": "PLANNING",
        },
        include={
            "client": True,
            "lead": True,
            "_count": {
                "select": {
                    "findings": True,
                    "reports": True,
                }
            }
        }
    )
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        start_date=project.startDate.isoformat() if project.startDate else None,
        end_date=project.endDate.isoformat() if project.endDate else None,
        client_id=project.clientId,
        client_name=project.client.name,
        lead_id=project.leadId,
        lead_name=project.lead.name,
        created_at=project.createdAt.isoformat(),
        updated_at=project.updatedAt.isoformat(),
        finding_count=project._count.findings,
        report_count=project._count.reports,
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
            "_count": {
                "select": {
                    "findings": True,
                    "reports": True,
                }
            }
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
        client_id=project.clientId,
        client_name=project.client.name,
        lead_id=project.leadId,
        lead_name=project.lead.name,
        created_at=project.createdAt.isoformat(),
        updated_at=project.updatedAt.isoformat(),
        finding_count=project._count.findings,
        report_count=project._count.reports,
        members=members,
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
    
    updated_project = await db.project.update(
        where={"id": project_id},
        data=update_data,
        include={
            "client": True,
            "lead": True,
            "_count": {
                "select": {
                    "findings": True,
                    "reports": True,
                }
            }
        }
    )
    
    return ProjectResponse(
        id=updated_project.id,
        name=updated_project.name,
        description=updated_project.description,
        status=updated_project.status,
        start_date=updated_project.startDate.isoformat() if updated_project.startDate else None,
        end_date=updated_project.endDate.isoformat() if updated_project.endDate else None,
        client_id=updated_project.clientId,
        client_name=updated_project.client.name,
        lead_id=updated_project.leadId,
        lead_name=updated_project.lead.name,
        created_at=updated_project.createdAt.isoformat(),
        updated_at=updated_project.updatedAt.isoformat(),
        finding_count=updated_project._count.findings,
        report_count=updated_project._count.reports,
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
