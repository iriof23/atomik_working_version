"""
Template management routes
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.db import db


router = APIRouter()


# Request/Response models
class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str
    content: str
    is_public: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    is_public: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    type: str
    content: str
    organization_id: Optional[str]
    is_public: bool
    created_at: str
    updated_at: str


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = Query(None),
    current_user = Depends(get_current_user)
):
    """List all templates (organization + public)"""
    or_conditions = [
        {"isPublic": True},
        {"organizationId": current_user.organizationId} if current_user.organizationId else {"organizationId": None}
    ]
    
    where_clause = {"OR": or_conditions}
    
    # If type filter is provided, wrap in AND with uppercase enum value
    if type:
        type_upper = type.upper()  # Convert "finding" -> "FINDING" for Prisma enum
        where_clause = {
            "AND": [
                {"OR": or_conditions},
                {"type": type_upper}
            ]
        }
    
    templates = await db.template.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"}
    )
    
    return [
        TemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            type=template.type,
            content=template.content,
            organization_id=template.organizationId,
            is_public=template.isPublic,
            created_at=template.createdAt.isoformat(),
            updated_at=template.updatedAt.isoformat(),
        )
        for template in templates
    ]


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: TemplateCreate,
    current_user = Depends(get_current_user)
):
    """Create a new template"""
    template = await db.template.create(
        data={
            "name": template_data.name,
            "description": template_data.description,
            "type": template_data.type,
            "content": template_data.content,
            "organizationId": current_user.organizationId,
            "isPublic": template_data.is_public,
        }
    )
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        type=template.type,
        content=template.content,
        organization_id=template.organizationId,
        is_public=template.isPublic,
        created_at=template.createdAt.isoformat(),
        updated_at=template.updatedAt.isoformat(),
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific template by ID"""
    template = await db.template.find_unique(where={"id": template_id})
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Check access (public or same organization)
    if not template.isPublic:
        if current_user.organizationId != template.organizationId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        type=template.type,
        content=template.content,
        organization_id=template.organizationId,
        is_public=template.isPublic,
        created_at=template.createdAt.isoformat(),
        updated_at=template.updatedAt.isoformat(),
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template_data: TemplateUpdate,
    current_user = Depends(get_current_user)
):
    """Update a template"""
    template = await db.template.find_unique(where={"id": template_id})
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Check ownership
    if current_user.organizationId != template.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update data
    update_data = {}
    if template_data.name is not None:
        update_data["name"] = template_data.name
    if template_data.description is not None:
        update_data["description"] = template_data.description
    if template_data.content is not None:
        update_data["content"] = template_data.content
    if template_data.is_public is not None:
        update_data["isPublic"] = template_data.is_public
    
    updated_template = await db.template.update(
        where={"id": template_id},
        data=update_data
    )
    
    return TemplateResponse(
        id=updated_template.id,
        name=updated_template.name,
        description=updated_template.description,
        type=updated_template.type,
        content=updated_template.content,
        organization_id=updated_template.organizationId,
        is_public=updated_template.isPublic,
        created_at=updated_template.createdAt.isoformat(),
        updated_at=updated_template.updatedAt.isoformat(),
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a template"""
    template = await db.template.find_unique(where={"id": template_id})
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )
    
    # Check ownership
    if current_user.organizationId != template.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await db.template.delete(where={"id": template_id})
    return None
