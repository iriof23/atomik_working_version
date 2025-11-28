"""
Organization API routes for syncing Clerk organizations with the database.

This implements "Just-In-Time" sync to ensure organizations exist in the database
before billing webhooks need to update them.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.api.routes.auth import get_current_user
from app.db import db

router = APIRouter()


class OrgSyncRequest(BaseModel):
    """Request body for organization sync"""
    id: str  # Clerk organization ID (e.g., "org_...")
    name: str
    slug: str


class OrgSyncResponse(BaseModel):
    """Response from organization sync"""
    id: str
    name: str
    slug: str
    plan: str
    creditBalance: int
    created: bool  # True if newly created, False if updated


@router.post("/sync", response_model=OrgSyncResponse)
async def sync_organization(
    org_data: OrgSyncRequest,
    current_user = Depends(get_current_user)
):
    """
    Sync a Clerk organization to the database.
    
    This endpoint is called by the frontend whenever the active organization changes.
    It ensures the organization exists in the database with default billing settings.
    
    - If the org doesn't exist: Create it with FREE plan and 10 credits
    - If the org exists: Update name/slug but preserve plan/credits
    - Link the current user to this organization
    """
    try:
        print(f"🔄 Syncing organization: {org_data.id} ({org_data.name})")
        
        # Check if organization already exists
        existing_org = await db.organization.find_unique(
            where={"id": org_data.id}
        )
        
        created = False
        
        if existing_org:
            # Organization exists - update name/slug but preserve billing data
            print(f"  📝 Updating existing organization")
            org = await db.organization.update(
                where={"id": org_data.id},
                data={
                    "name": org_data.name,
                    "slug": org_data.slug,
                }
            )
        else:
            # Organization doesn't exist - create with defaults
            print(f"  🆕 Creating new organization")
            org = await db.organization.create(
                data={
                    "id": org_data.id,  # Use Clerk's org ID as our ID
                    "name": org_data.name,
                    "slug": org_data.slug,
                    "plan": "FREE",
                    "creditBalance": 10,
                }
            )
            created = True
        
        # Link the current user to this organization (if not already linked)
        if current_user.organizationId != org_data.id:
            print(f"  🔗 Linking user {current_user.id} to organization {org_data.id}")
            await db.user.update(
                where={"id": current_user.id},
                data={"organizationId": org_data.id}
            )
        
        print(f"  ✅ Organization sync complete: {org.id}")
        
        return OrgSyncResponse(
            id=org.id,
            name=org.name,
            slug=org.slug,
            plan=org.plan,
            creditBalance=org.creditBalance,
            created=created
        )
        
    except Exception as e:
        print(f"  ❌ Error syncing organization: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync organization: {str(e)}"
        )


@router.get("/current")
async def get_current_organization(
    current_user = Depends(get_current_user)
):
    """
    Get the current user's organization with billing info.
    """
    if not current_user.organizationId:
        return None
    
    org = await db.organization.find_unique(
        where={"id": current_user.organizationId}
    )
    
    if not org:
        return None
    
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "creditBalance": org.creditBalance,
        "subscriptionStatus": org.subscriptionStatus,
        "subscriptionId": org.subscriptionId,
        "paddleCustomerId": org.paddleCustomerId,
    }

