"""
Client management routes

SECURITY: Input validation on all client data fields.
"""
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from prisma import Prisma

from app.api.routes.auth import get_current_user
from app.core.validators import (
    sanitize_string, 
    validate_phone, 
    validate_url,
    MAX_TITLE_LENGTH,
    MAX_SHORT_TEXT_LENGTH,
    MAX_URL_LENGTH
)
from app.db import db


router = APIRouter()


def generate_client_code(name: str) -> str:
    """
    Generate a short client code from the company name.
    Examples:
        - "Acme Corporation" -> "ACME"
        - "Tesla Motors" -> "TSLA"
        - "Google Inc" -> "GOOG"
        - "International Business Machines" -> "IBM"
    """
    # Remove special characters and convert to uppercase
    clean_name = re.sub(r'[^a-zA-Z\s]', '', name).upper()
    words = clean_name.split()
    
    if not words:
        return "CLI"  # Default fallback
    
    if len(words) == 1:
        # Single word: take first 4 characters
        return words[0][:4]
    elif len(words) == 2:
        # Two words: first 2 chars of each
        return words[0][:2] + words[1][:2]
    else:
        # Multiple words: first char of each (up to 4)
        return ''.join(word[0] for word in words[:4])


async def get_unique_client_code(base_code: str, organization_id: Optional[str]) -> str:
    """
    Ensure the client code is unique within the organization.
    If "ACME" exists, try "ACM1", "ACM2", etc.
    """
    code = base_code
    counter = 1
    
    while True:
        where_clause = {"code": code}
        if organization_id:
            where_clause["organizationId"] = organization_id
            
        existing = await db.client.find_first(where=where_clause)
        if not existing:
            return code
        
        # Code exists, try with number suffix
        code = f"{base_code[:3]}{counter}"
        counter += 1
        
        if counter > 99:  # Safety limit
            import uuid
            return base_code[:2] + uuid.uuid4().hex[:2].upper()


# Request/Response models
class ClientCreate(BaseModel):
    name: str
    code: Optional[str] = None  # Optional: auto-generated if not provided
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
    
    # Input validation
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Client name is required')
        return sanitize_string(v, MAX_TITLE_LENGTH)
    
    @field_validator('contact_phone')
    @classmethod
    def validate_contact_phone(cls, v):
        if v:
            return validate_phone(v)
        return v
    
    @field_validator('website_url')
    @classmethod
    def validate_website(cls, v):
        if v:
            return validate_url(v)
        return v
    
    @field_validator('contact_name', 'address', 'industry', 'company_size', 'notes')
    @classmethod
    def sanitize_text_fields(cls, v):
        if v:
            return sanitize_string(v, MAX_SHORT_TEXT_LENGTH)
        return v


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None  # Can be manually updated
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
    
    # Input validation (same as ClientCreate but name is optional)
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v:
            return sanitize_string(v, MAX_TITLE_LENGTH)
        return v
    
    @field_validator('contact_phone')
    @classmethod
    def validate_contact_phone(cls, v):
        if v:
            return validate_phone(v)
        return v
    
    @field_validator('website_url')
    @classmethod
    def validate_website(cls, v):
        if v:
            return validate_url(v)
        return v
    
    @field_validator('contact_name', 'address', 'industry', 'company_size', 'notes')
    @classmethod
    def sanitize_text_fields(cls, v):
        if v:
            return sanitize_string(v, MAX_SHORT_TEXT_LENGTH)
        return v


class ClientResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]  # Client ticker code (e.g., "ACME")
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
    finding_counter: int  # Current finding count for this client
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
            code=client.code,
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
            finding_counter=client.findingCounter or 0,
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
    # Generate or use provided client code
    if client_data.code:
        # Use provided code (uppercase)
        client_code = client_data.code.upper()
    else:
        # Auto-generate from name
        base_code = generate_client_code(client_data.name)
        client_code = await get_unique_client_code(base_code, current_user.organizationId)
    
    client = await db.client.create(
        data={
            "name": client_data.name,
            "code": client_code,
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
            "findingCounter": 0,
        }
    )
    
    return ClientResponse(
        id=client.id,
        name=client.name,
        code=client.code,
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
        finding_counter=client.findingCounter or 0,
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
        code=client.code,
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
        finding_counter=client.findingCounter or 0,
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
    if client_data.code is not None:
        update_data["code"] = client_data.code.upper()
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
        code=updated_client.code,
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
        finding_counter=updated_client.findingCounter or 0,
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
