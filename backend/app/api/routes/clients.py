"""
Client management routes
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from prisma import Prisma

from app.api.routes.auth import get_current_user
from app.db import db


router = APIRouter()


# Request/Response models
class ClientCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website_url: Optional[str] = None
    status: Optional[str] = "Prospect"
    risk_level: Optional[str] = "Medium"
    tags: Optional[str] = None  # JSON array as string
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website_url: Optional[str] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(BaseModel):
    id: str
    name: str
    contact_name: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address: Optional[str]
    industry: Optional[str]
    company_size: Optional[str]
    website_url: Optional[str]
    status: Optional[str]
    risk_level: Optional[str]
    tags: Optional[str]
    notes: Optional[str]
    organization_id: Optional[str]
    created_at: str
    updated_at: str


@router.get("/", response_model=list[ClientResponse])
async def list_clients(
    skip: int = 0,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """List all clients for the current user's organization"""
    where_clause = {}
    
    # Filter by organization in docker mode
    if current_user.organizationId:
        where_clause["organizationId"] = current_user.organizationId
    
    clients = await db.client.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        order={"createdAt": "desc"}
    )
    
    return [
        ClientResponse(
            id=client.id,
            name=client.name,
            contact_name=client.contactName,
            contact_email=client.contactEmail,
            contact_phone=client.contactPhone,
            address=client.address,
            industry=client.industry,
            company_size=client.companySize,
            website_url=client.websiteUrl,
            status=client.status,
            risk_level=client.riskLevel,
            tags=client.tags,
            notes=client.notes,
            organization_id=client.organizationId,
            created_at=client.createdAt.isoformat(),
            updated_at=client.updatedAt.isoformat(),
        )
        for client in clients
    ]


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    current_user = Depends(get_current_user)
):
    """Create a new client"""
    client = await db.client.create(
        data={
            "name": client_data.name,
            "contactName": client_data.contact_name,
            "contactEmail": client_data.contact_email,
            "contactPhone": client_data.contact_phone,
            "address": client_data.address,
            "industry": client_data.industry,
            "companySize": client_data.company_size,
            "websiteUrl": client_data.website_url,
            "status": client_data.status,
            "riskLevel": client_data.risk_level,
            "tags": client_data.tags,
            "notes": client_data.notes,
            "organizationId": current_user.organizationId,
        }
    )
    
    return ClientResponse(
        id=client.id,
        name=client.name,
        contact_name=client.contactName,
        contact_email=client.contactEmail,
        contact_phone=client.contactPhone,
        address=client.address,
        industry=client.industry,
        company_size=client.companySize,
        website_url=client.websiteUrl,
        status=client.status,
        risk_level=client.riskLevel,
        tags=client.tags,
        notes=client.notes,
        organization_id=client.organizationId,
        created_at=client.createdAt.isoformat(),
        updated_at=client.updatedAt.isoformat(),
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific client by ID"""
    client = await db.client.find_unique(where={"id": client_id})
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Check organization access
    if current_user.organizationId and client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ClientResponse(
        id=client.id,
        name=client.name,
        contact_name=client.contactName,
        contact_email=client.contactEmail,
        contact_phone=client.contactPhone,
        address=client.address,
        industry=client.industry,
        company_size=client.companySize,
        website_url=client.websiteUrl,
        status=client.status,
        risk_level=client.riskLevel,
        tags=client.tags,
        notes=client.notes,
        organization_id=client.organizationId,
        created_at=client.createdAt.isoformat(),
        updated_at=client.updatedAt.isoformat(),
    )


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    client_data: ClientUpdate,
    current_user = Depends(get_current_user)
):
    """Update a client"""
    client = await db.client.find_unique(where={"id": client_id})
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Check organization access
    if current_user.organizationId and client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update data
    update_data = {}
    if client_data.name is not None:
        update_data["name"] = client_data.name
    if client_data.contact_name is not None:
        update_data["contactName"] = client_data.contact_name
    if client_data.contact_email is not None:
        update_data["contactEmail"] = client_data.contact_email
    if client_data.contact_phone is not None:
        update_data["contactPhone"] = client_data.contact_phone
    if client_data.address is not None:
        update_data["address"] = client_data.address
    if client_data.industry is not None:
        update_data["industry"] = client_data.industry
    if client_data.company_size is not None:
        update_data["companySize"] = client_data.company_size
    if client_data.website_url is not None:
        update_data["websiteUrl"] = client_data.website_url
    if client_data.status is not None:
        update_data["status"] = client_data.status
    if client_data.risk_level is not None:
        update_data["riskLevel"] = client_data.risk_level
    if client_data.tags is not None:
        update_data["tags"] = client_data.tags
    if client_data.notes is not None:
        update_data["notes"] = client_data.notes
    
    updated_client = await db.client.update(
        where={"id": client_id},
        data=update_data
    )
    
    return ClientResponse(
        id=updated_client.id,
        name=updated_client.name,
        contact_name=updated_client.contactName,
        contact_email=updated_client.contactEmail,
        contact_phone=updated_client.contactPhone,
        address=updated_client.address,
        industry=updated_client.industry,
        company_size=updated_client.companySize,
        website_url=updated_client.websiteUrl,
        status=updated_client.status,
        risk_level=updated_client.riskLevel,
        tags=updated_client.tags,
        notes=updated_client.notes,
        organization_id=updated_client.organizationId,
        created_at=updated_client.createdAt.isoformat(),
        updated_at=updated_client.updatedAt.isoformat(),
    )


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a client"""
    client = await db.client.find_unique(where={"id": client_id})
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Check organization access
    if current_user.organizationId and client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    await db.client.delete(where={"id": client_id})
    return None
