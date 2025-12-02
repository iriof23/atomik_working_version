"""
Report management and generation routes
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from app.api.routes.auth import get_current_user
from app.db import db

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)


# Request/Response models
class ReportCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="Report title")
    project_id: str = Field(..., description="ID of the project this report belongs to")
    report_type: str = Field(default="PENTEST", description="Type of report")
    template_id: Optional[str] = Field(None, description="Optional template ID")
    
    @field_validator('report_type')
    @classmethod
    def validate_report_type(cls, v: str) -> str:
        """Validate report type is one of the allowed values"""
        allowed_types = ["PENTEST", "VULNERABILITY_ASSESSMENT", "COMPLIANCE", "EXECUTIVE_SUMMARY"]
        if v.upper() not in allowed_types:
            raise ValueError(f"report_type must be one of: {', '.join(allowed_types)}")
        return v.upper()


class ReportResponse(BaseModel):
    id: str
    title: str
    report_type: str
    status: str
    project_id: str
    project_name: str
    generated_by_id: str
    generated_by_name: str
    template_id: Optional[str]
    pdf_path: Optional[str]
    created_at: str
    updated_at: str
    generated_at: Optional[str]


@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """List all reports"""
    where_clause = {}
    
    # Filter by organization through project->client relationship
    if current_user.organizationId:
        where_clause["project"] = {
            "client": {"organizationId": current_user.organizationId}
        }
    
    if project_id:
        where_clause["projectId"] = project_id
    
    reports = await db.report.find_many(
        where=where_clause,
        skip=skip,
        take=limit,
        include={
            "project": True,
            "generatedBy": True,
        },
        order={"createdAt": "desc"}
    )
    
    return [
        ReportResponse(
            id=report.id,
            title=report.title,
            report_type=report.reportType,
            status=report.status,
            project_id=report.projectId,
            project_name=report.project.name,
            generated_by_id=report.generatedById,
            generated_by_name=report.generatedBy.name,
            template_id=report.templateId,
            pdf_path=report.pdfPath,
            created_at=report.createdAt.isoformat(),
            updated_at=report.updatedAt.isoformat(),
            generated_at=report.generatedAt.isoformat() if report.generatedAt else None,
        )
        for report in reports
    ]


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: ReportCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """
    Create a new report (initiates generation)
    
    Creates a draft report for the specified project. The report will be in DRAFT status
    and can be edited before final generation.
    """
    try:
        # Verify project exists and user has access
        logger.info(f"Creating report for project {report_data.project_id} by user {current_user.id}")
        
        project = await db.project.find_unique(
            where={"id": report_data.project_id},
            include={"client": True}
        )
        
        if not project:
            logger.warning(f"Project not found: {report_data.project_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project not found: {report_data.project_id}"
            )
        
        # Check organization access
        if current_user.organizationId and project.client.organizationId != current_user.organizationId:
            logger.warning(
                f"Access denied: User {current_user.id} (org: {current_user.organizationId}) "
                f"tried to create report for project {report_data.project_id} "
                f"(org: {project.client.organizationId})"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to create reports for this project"
            )
        
        # Validate template if provided
        if report_data.template_id:
            template = await db.template.find_unique(
                where={"id": report_data.template_id}
            )
            if not template:
                logger.warning(f"Template not found: {report_data.template_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template not found: {report_data.template_id}"
                )
        
        # Create the report with all required fields
        report = await db.report.create(
            data={
                "title": report_data.title.strip(),
                "reportType": report_data.report_type,
                "projectId": report_data.project_id,
                "generatedById": current_user.id,
                "templateId": report_data.template_id,
                "status": "DRAFT",
            },
            include={
                "project": True,
                "generatedBy": True,
            }
        )
        logger.info(f"Successfully created report {report.id} for project {report_data.project_id}")
        
        # TODO: Add background task for PDF generation
        # background_tasks.add_task(generate_report_pdf, report.id)
        
        return ReportResponse(
            id=report.id,
            title=report.title,
            report_type=report.reportType,
            status=report.status,
            project_id=report.projectId,
            project_name=report.project.name,
            generated_by_id=report.generatedById,
            generated_by_name=report.generatedBy.name,
            template_id=report.templateId,
            pdf_path=report.pdfPath,
            created_at=report.createdAt.isoformat(),
            updated_at=report.updatedAt.isoformat(),
            generated_at=report.generatedAt.isoformat() if report.generatedAt else None,
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch any unexpected errors
        logger.error(f"Unexpected error creating report: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while creating the report: {str(e)}"
        )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Get a specific report by ID"""
    report = await db.report.find_unique(
        where={"id": report_id},
        include={
            "project": {"include": {"client": True}},
            "generatedBy": True,
        }
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.reportType,
        status=report.status,
        project_id=report.projectId,
        project_name=report.project.name,
        generated_by_id=report.generatedById,
        generated_by_name=report.generatedBy.name,
        template_id=report.templateId,
        pdf_path=report.pdfPath,
        created_at=report.createdAt.isoformat(),
        updated_at=report.updatedAt.isoformat(),
        generated_at=report.generatedAt.isoformat() if report.generatedAt else None,
    )


class ReportUpdate(BaseModel):
    """Request model for updating a report"""
    title: Optional[str] = Field(None, max_length=500)
    html_content: Optional[str] = Field(None, description="HTML content of the report narrative")
    status: Optional[str] = Field(None, description="Report status")
    
    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed_statuses = ["DRAFT", "GENERATING", "COMPLETED", "FAILED"]
        if v.upper() not in allowed_statuses:
            raise ValueError(f"status must be one of: {', '.join(allowed_statuses)}")
        return v.upper()


class ReportDetailResponse(BaseModel):
    """Detailed report response including content"""
    id: str
    title: str
    report_type: str
    status: str
    html_content: Optional[str]
    project_id: str
    project_name: str
    client_name: str
    generated_by_id: str
    generated_by_name: str
    template_id: Optional[str]
    pdf_path: Optional[str]
    created_at: str
    updated_at: str
    generated_at: Optional[str]


@router.get("/{report_id}/detail", response_model=ReportDetailResponse)
async def get_report_detail(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Get detailed report including content"""
    report = await db.report.find_unique(
        where={"id": report_id},
        include={
            "project": {"include": {"client": True}},
            "generatedBy": True,
        }
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ReportDetailResponse(
        id=report.id,
        title=report.title,
        report_type=report.reportType,
        status=report.status,
        html_content=report.htmlContent,
        project_id=report.projectId,
        project_name=report.project.name,
        client_name=report.project.client.name,
        generated_by_id=report.generatedById,
        generated_by_name=report.generatedBy.name,
        template_id=report.templateId,
        pdf_path=report.pdfPath,
        created_at=report.createdAt.isoformat(),
        updated_at=report.updatedAt.isoformat(),
        generated_at=report.generatedAt.isoformat() if report.generatedAt else None,
    )


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    report_data: ReportUpdate,
    current_user = Depends(get_current_user)
):
    """Update a report"""
    logger.info(f"Updating report {report_id} by user {current_user.id}")
    
    report = await db.report.find_unique(
        where={"id": report_id},
        include={
            "project": {"include": {"client": True}},
            "generatedBy": True,
        }
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Build update data
    update_data = {}
    if report_data.title is not None:
        update_data["title"] = report_data.title.strip()
    if report_data.html_content is not None:
        update_data["htmlContent"] = report_data.html_content
    if report_data.status is not None:
        update_data["status"] = report_data.status
    
    if not update_data:
        # Nothing to update, return current report
        return ReportResponse(
            id=report.id,
            title=report.title,
            report_type=report.reportType,
            status=report.status,
            project_id=report.projectId,
            project_name=report.project.name,
            generated_by_id=report.generatedById,
            generated_by_name=report.generatedBy.name,
            template_id=report.templateId,
            pdf_path=report.pdfPath,
            created_at=report.createdAt.isoformat(),
            updated_at=report.updatedAt.isoformat(),
            generated_at=report.generatedAt.isoformat() if report.generatedAt else None,
        )
    
    # Update the report
    updated_report = await db.report.update(
        where={"id": report_id},
        data=update_data,
        include={
            "project": True,
            "generatedBy": True,
        }
    )
    
    logger.info(f"Successfully updated report {report_id}")
    
    return ReportResponse(
        id=updated_report.id,
        title=updated_report.title,
        report_type=updated_report.reportType,
        status=updated_report.status,
        project_id=updated_report.projectId,
        project_name=updated_report.project.name,
        generated_by_id=updated_report.generatedById,
        generated_by_name=updated_report.generatedBy.name,
        template_id=updated_report.templateId,
        pdf_path=updated_report.pdfPath,
        created_at=updated_report.createdAt.isoformat(),
        updated_at=updated_report.updatedAt.isoformat(),
        generated_at=updated_report.generatedAt.isoformat() if updated_report.generatedAt else None,
    )


@router.post("/{report_id}/generate")
async def generate_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Generate PDF for a report"""
    report = await db.report.find_unique(
        where={"id": report_id},
        include={"project": {"include": {"client": True}}}
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update status to generating
    await db.report.update(
        where={"id": report_id},
        data={"status": "GENERATING"}
    )
    
    # TODO: Add background task for PDF generation
    # background_tasks.add_task(generate_report_pdf, report_id)
    
    return {"message": "Report generation started", "report_id": report_id}


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Download generated PDF report"""
    report = await db.report.find_unique(
        where={"id": report_id},
        include={"project": {"include": {"client": True}}}
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not report.pdfPath or report.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report PDF not available"
        )
    
    # TODO: Return actual file
    # return FileResponse(report.pdfPath, media_type="application/pdf", filename=f"{report.title}.pdf")
    
    return {"message": "Download endpoint - implementation pending"}


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    current_user = Depends(get_current_user)
):
    """Delete a report"""
    report = await db.report.find_unique(
        where={"id": report_id},
        include={"project": {"include": {"client": True}}}
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check organization access
    if current_user.organizationId and report.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # TODO: Delete PDF file if exists
    
    await db.report.delete(where={"id": report_id})
    return None
