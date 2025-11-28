"""
Billing API routes for Paddle integration
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from typing import Optional
import hmac
import hashlib
import json
from datetime import datetime

from app.api.routes.auth import get_current_user
from app.db import db

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/info")
async def get_billing_info(
    current_user = Depends(get_current_user)
):
    """
    Get current user's billing information (plan, credits, subscription status)
    """
    try:
        # Fetch user with organization data
        user = await db.user.find_unique(
            where={"id": current_user["id"]},
            include={
                "organization": True
            }
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Determine plan and credits
        # If user has an organization, use organization's plan and credits
        if user.organization:
            org = user.organization
            return {
                "plan": org.plan,
                "creditBalance": org.creditBalance,
                "subscriptionStatus": org.subscriptionStatus,
                "subscriptionId": org.subscriptionId,
                "paddleCustomerId": org.paddleCustomerId,
                "updateUrl": org.updateUrl,
                "cancelUrl": org.cancelUrl,
                "source": "organization"
            }
        else:
            # Individual user - use personal credits
            return {
                "plan": "FREE",
                "creditBalance": user.creditBalance,
                "subscriptionStatus": None,
                "subscriptionId": None,
                "paddleCustomerId": None,
                "updateUrl": None,
                "cancelUrl": None,
                "source": "user"
            }
            
    except Exception as e:
        print(f"Error fetching billing info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/organization/{organization_id}")
async def get_organization_billing(
    organization_id: str,
    current_user = Depends(get_current_user)
):
    """
    Get organization's billing information
    """
    try:
        # Verify user belongs to this organization
        user = await db.user.find_unique(
            where={"id": current_user["id"]}
        )
        
        if user.organizationId != organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Fetch organization
        org = await db.organization.find_unique(
            where={"id": organization_id}
        )
        
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        return {
            "plan": org.plan,
            "creditBalance": org.creditBalance,
            "subscriptionStatus": org.subscriptionStatus,
            "subscriptionId": org.subscriptionId,
            "paddleCustomerId": org.paddleCustomerId,
            "updateUrl": org.updateUrl,
            "cancelUrl": org.cancelUrl
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching organization billing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def paddle_webhook(
    request: Request,
    paddle_signature: Optional[str] = Header(None, alias="Paddle-Signature")
):
    """
    Handle Paddle webhook events
    
    Paddle sends webhooks for:
    - subscription.created
    - subscription.updated
    - subscription.canceled
    - transaction.completed
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # TODO: Verify Paddle signature (important for production!)
        # For now, we'll log and process
        # if not verify_paddle_signature(body, paddle_signature):
        #     raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse webhook data
        data = json.loads(body)
        event_type = data.get("event_type")
        
        print(f"Received Paddle webhook: {event_type}")
        print(f"Webhook data: {json.dumps(data, indent=2)}")
        
        # Handle different event types
        if event_type == "subscription.created":
            await handle_subscription_created(data, db)
        elif event_type == "subscription.updated":
            await handle_subscription_updated(data, db)
        elif event_type == "subscription.canceled":
            await handle_subscription_canceled(data, db)
        elif event_type == "transaction.completed":
            await handle_transaction_completed(data, db)
        else:
            print(f"Unhandled event type: {event_type}")
        
        return {"status": "success"}
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        # Return 200 to prevent Paddle from retrying
        return {"status": "error", "message": str(e)}


async def handle_subscription_created(data: dict, db):
    """Handle new subscription creation"""
    try:
        subscription_data = data.get("data", {})
        customer_id = subscription_data.get("customer_id")
        subscription_id = subscription_data.get("id")
        status = subscription_data.get("status")
        
        # Get custom data to identify user/org
        custom_data = subscription_data.get("custom_data", {})
        user_id = custom_data.get("user_id")
        org_id = custom_data.get("organization_id")
        
        # Determine plan from items
        items = subscription_data.get("items", [])
        plan = determine_plan_from_items(items)
        
        # Update organization or user
        if org_id:
            await db.organization.update(
                where={"id": org_id},
                data={
                    "paddleCustomerId": customer_id,
                    "subscriptionId": subscription_id,
                    "subscriptionStatus": status,
                    "plan": plan,
                    "creditBalance": get_credits_for_plan(plan)
                }
            )
        elif user_id:
            # For individual subscriptions (if supported)
            pass
        
        print(f"Subscription created: {subscription_id} for customer {customer_id}")
        
    except Exception as e:
        print(f"Error handling subscription.created: {e}")
        raise


async def handle_subscription_updated(data: dict, db):
    """Handle subscription updates (plan changes, status changes)"""
    try:
        subscription_data = data.get("data", {})
        subscription_id = subscription_data.get("id")
        status = subscription_data.get("status")
        
        # Find organization by subscription ID
        org = await db.organization.find_first(
            where={"subscriptionId": subscription_id}
        )
        
        if org:
            # Determine new plan
            items = subscription_data.get("items", [])
            plan = determine_plan_from_items(items)
            
            # Update organization
            await db.organization.update(
                where={"id": org.id},
                data={
                    "subscriptionStatus": status,
                    "plan": plan,
                    "creditBalance": get_credits_for_plan(plan)
                }
            )
            
            print(f"Subscription updated: {subscription_id} to plan {plan}")
        
    except Exception as e:
        print(f"Error handling subscription.updated: {e}")
        raise


async def handle_subscription_canceled(data: dict, db):
    """Handle subscription cancellation"""
    try:
        subscription_data = data.get("data", {})
        subscription_id = subscription_data.get("id")
        
        # Find organization by subscription ID
        org = await db.organization.find_first(
            where={"subscriptionId": subscription_id}
        )
        
        if org:
            # Downgrade to free plan
            await db.organization.update(
                where={"id": org.id},
                data={
                    "subscriptionStatus": "canceled",
                    "plan": "FREE",
                    "creditBalance": 10  # Free tier credits
                }
            )
            
            print(f"Subscription canceled: {subscription_id}")
        
    except Exception as e:
        print(f"Error handling subscription.canceled: {e}")
        raise


async def handle_transaction_completed(data: dict, db):
    """Handle one-time purchases (credit packs)"""
    try:
        transaction_data = data.get("data", {})
        customer_id = transaction_data.get("customer_id")
        
        # Get custom data
        custom_data = transaction_data.get("custom_data", {})
        user_id = custom_data.get("user_id")
        org_id = custom_data.get("organization_id")
        
        # Determine credits purchased
        items = transaction_data.get("items", [])
        credits_purchased = determine_credits_from_items(items)
        
        # Add credits to organization or user
        if org_id:
            org = await db.organization.find_unique(where={"id": org_id})
            if org:
                await db.organization.update(
                    where={"id": org_id},
                    data={
                        "creditBalance": org.creditBalance + credits_purchased
                    }
                )
        elif user_id:
            user = await db.user.find_unique(where={"id": user_id})
            if user:
                await db.user.update(
                    where={"id": user_id},
                    data={
                        "creditBalance": user.creditBalance + credits_purchased
                    }
                )
        
        print(f"Credits added: {credits_purchased} for customer {customer_id}")
        
    except Exception as e:
        print(f"Error handling transaction.completed: {e}")
        raise


def determine_plan_from_items(items: list) -> str:
    """Determine plan type from Paddle items"""
    # Map Paddle price IDs to plans
    PRICE_ID_MAP = {
        "pri_01kb5djzbeyaev2k64nzkayfbx": "PRO",
        "pri_01kb5dphg35030j7e9crrcqxd8": "AGENCY"
    }
    
    for item in items:
        price_id = item.get("price", {}).get("id")
        if price_id in PRICE_ID_MAP:
            return PRICE_ID_MAP[price_id]
    
    return "FREE"


def determine_credits_from_items(items: list) -> int:
    """Determine credits from one-time purchase items"""
    # Map Paddle price IDs to credit amounts
    CREDIT_PACK_MAP = {
        "pri_01kb5dww39pc83mag1x8dtrzyw": 500,   # $15 pack
        "pri_01kb5e09hfcpdpzxvxmzg3c179": 2000   # $50 pack
    }
    
    total_credits = 0
    for item in items:
        price_id = item.get("price", {}).get("id")
        quantity = item.get("quantity", 1)
        if price_id in CREDIT_PACK_MAP:
            total_credits += CREDIT_PACK_MAP[price_id] * quantity
    
    return total_credits


def get_credits_for_plan(plan: str) -> int:
    """Get monthly credit allocation for a plan"""
    PLAN_CREDITS = {
        "FREE": 10,
        "PRO": 500,
        "AGENCY": 2000
    }
    return PLAN_CREDITS.get(plan, 10)


def verify_paddle_signature(body: bytes, signature: str) -> bool:
    """
    Verify Paddle webhook signature
    TODO: Implement proper signature verification for production
    """
    # Get webhook secret from environment
    # webhook_secret = os.getenv("PADDLE_WEBHOOK_SECRET")
    # 
    # if not webhook_secret:
    #     return False
    # 
    # expected_signature = hmac.new(
    #     webhook_secret.encode(),
    #     body,
    #     hashlib.sha256
    # ).hexdigest()
    # 
    # return hmac.compare_digest(signature, expected_signature)
    
    return True  # TODO: Implement for production

