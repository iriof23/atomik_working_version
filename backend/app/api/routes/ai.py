"""
AI generation routes with credit deduction
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.api.routes.auth import get_current_user
from app.db import db
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])


# Cost mapping for different AI operations
COST_MAP = {
    "generate_finding": 5,
    "remediation": 5,
    "fix_grammar": 1,
    "rewrite": 1,
    "expand": 1,
    "generate_summary": 10,
    "translate": 2,
}


# Request/Response models
class GenerateRequest(BaseModel):
    type: str  # e.g., "generate_finding", "remediation", "fix_grammar"
    # For finding generation
    finding_title: Optional[str] = None
    severity: Optional[str] = None
    current_description: Optional[str] = None
    # For grammar/translate
    text: Optional[str] = None
    target_language: Optional[str] = None
    # For executive summary
    findings_summary: Optional[str] = None
    total_findings: Optional[int] = None
    critical_count: Optional[int] = None
    high_count: Optional[int] = None
    medium_count: Optional[int] = None
    low_count: Optional[int] = None


class GenerateResponse(BaseModel):
    result: str
    credits_used: int
    remaining_credits: int


@router.post("/generate", response_model=GenerateResponse)
async def generate_ai_content(
    request: GenerateRequest,
    current_user = Depends(get_current_user)
):
    """
    Generate AI content with credit deduction.
    
    Charges credits based on the operation type. Blocks the request if
    insufficient credits are available.
    """
    try:
        # Validate request type
        if request.type not in COST_MAP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid AI operation type. Must be one of: {', '.join(COST_MAP.keys())}"
            )
        
        # Calculate cost
        cost = COST_MAP[request.type]
        
        # Get user's organization (required for credit deduction)
        if not current_user.organizationId:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must belong to an organization to use AI features"
            )
        
        # Check credit balance
        organization = await db.organization.find_unique(
            where={"id": current_user.organizationId}
        )
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        
        if organization.creditBalance < cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required: {cost}, Available: {organization.creditBalance}"
            )
        
        # Deduct credits and log usage (atomic transaction)
        updated_org = await db.organization.update(
            where={"id": organization.id},
            data={
                "creditBalance": {
                    "decrement": cost
                }
            }
        )
        
        # Log the AI usage
        await db.aiusagelog.create(
            data={
                "userId": current_user.id,
                "organizationId": organization.id,
                "action": request.type,
                "cost": cost,
                "metadata": f"Type: {request.type}, Title: {request.finding_title or 'N/A'}"
            }
        )
        
        # Call the appropriate AI service method based on request type
        try:
            if request.type == "generate_finding":
                if not request.finding_title:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="finding_title is required for generate_finding"
                    )
                result = await ai_service.generate_finding_text(
                    finding_title=request.finding_title,
                    severity=request.severity or "Medium",
                    current_description=request.current_description
                )
            
            elif request.type == "remediation":
                if not request.finding_title:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="finding_title is required for remediation"
                    )
                result = await ai_service.generate_remediation(
                    finding_title=request.finding_title,
                    severity=request.severity or "Medium",
                    description=request.current_description
                )
            
            elif request.type == "fix_grammar":
                if not request.text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="text is required for fix_grammar"
                    )
                result = await ai_service.fix_grammar(text=request.text)

            elif request.type == "rewrite":
                if not request.text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="text is required for rewrite"
                    )
                result = await ai_service.rewrite_text(text=request.text)

            elif request.type == "expand":
                if not request.text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="text is required for expand"
                    )
                result = await ai_service.expand_text(text=request.text)
            
            elif request.type == "generate_summary":
                result = await ai_service.generate_executive_summary(
                    findings_summary=request.findings_summary or "",
                    total_findings=request.total_findings or 0,
                    critical_count=request.critical_count or 0,
                    high_count=request.high_count or 0,
                    medium_count=request.medium_count or 0,
                    low_count=request.low_count or 0
                )
            
            elif request.type == "translate":
                if not request.text or not request.target_language:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="text and target_language are required for translate"
                    )
                result = await ai_service.translate_finding(
                    text=request.text,
                    target_language=request.target_language
                )
            
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown operation type: {request.type}"
                )
        
        except RuntimeError as e:
            # AI service error - refund credits
            await db.organization.update(
                where={"id": organization.id},
                data={"creditBalance": {"increment": cost}}
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )
        
        return GenerateResponse(
            result=result,
            credits_used=cost,
            remaining_credits=updated_org.creditBalance
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"❌ AI Generation Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI content: {str(e)}"
        )

