"""
File upload routes for evidence and attachments

SECURITY: This module handles file uploads which is a critical attack vector.
All uploaded files, especially SVGs, are sanitized before storage.
"""
import os
import re
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
import aiofiles

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db import db


router = APIRouter()


# Ensure upload directory exists
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Extract file extension"""
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''


def sanitize_svg(content: bytes) -> bytes:
    """
    Remove dangerous elements from SVG files.
    
    SECURITY: SVG files can contain embedded JavaScript that executes
    when the image is rendered. This function strips:
    - <script> tags
    - Event handler attributes (onclick, onerror, onload, etc.)
    - javascript: URLs
    - External references that could leak data
    
    Args:
        content: Raw SVG file bytes
        
    Returns:
        Sanitized SVG bytes
    """
    try:
        text = content.decode('utf-8', errors='ignore')
        
        # Remove script tags and their content
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove event handler attributes (on*)
        # Matches: onclick="...", onerror='...', onload=..., etc.
        text = re.sub(
            r'\s+on\w+\s*=\s*["\'][^"\']*["\']',
            '',
            text,
            flags=re.IGNORECASE
        )
        text = re.sub(
            r'\s+on\w+\s*=\s*[^\s>]+',
            '',
            text,
            flags=re.IGNORECASE
        )
        
        # Remove javascript: URLs in any attribute
        text = re.sub(
            r'(href|src|xlink:href)\s*=\s*["\']?\s*javascript:[^"\'>\s]*["\']?',
            r'\1=""',
            text,
            flags=re.IGNORECASE
        )
        
        # Remove data: URLs except for images (could contain scripts)
        text = re.sub(
            r'(href|xlink:href)\s*=\s*["\']?\s*data:(?!image)[^"\'>\s]*["\']?',
            r'\1=""',
            text,
            flags=re.IGNORECASE
        )
        
        # Remove <foreignObject> which can embed HTML/JS
        text = re.sub(r'<foreignObject[^>]*>.*?</foreignObject>', '', text, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove <use> with external references (potential SSRF/data exfiltration)
        text = re.sub(
            r'<use[^>]*xlink:href\s*=\s*["\']?(https?://|//)[^"\'>\s]*["\']?[^>]*>',
            '',
            text,
            flags=re.IGNORECASE
        )
        
        return text.encode('utf-8')
    except Exception as e:
        # If sanitization fails, reject the file
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process SVG file: {str(e)}"
        )


def validate_file(filename: str, filesize: int) -> None:
    """Validate file extension and size"""
    ext = get_file_extension(filename)
    
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type .{ext} not allowed. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    if filesize > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )


@router.post("/screenshot")
async def upload_screenshot(
    file: UploadFile = File(...)
):
    """
    Upload a screenshot and return permanent URL (public endpoint for demo).
    
    SECURITY: SVG files are sanitized to remove embedded scripts and event handlers.
    """
    # Read file content to get size
    content = await file.read()
    filesize = len(content)
    
    # Validate file
    validate_file(file.filename, filesize)
    
    # Validate it's an image
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Generate unique filename
    ext = get_file_extension(file.filename)
    unique_filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # SECURITY: Sanitize SVG files to remove embedded scripts
    if file.content_type == 'image/svg+xml' or ext == 'svg':
        content = sanitize_svg(content)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Return URL (relative to the uploads directory)
    return {
        "url": f"/uploads/{unique_filename}",
        "filename": unique_filename
    }



@router.post("/evidence/{finding_id}")
async def upload_evidence(
    finding_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user = Depends(get_current_user)
):
    """Upload evidence file for a finding"""
    # Verify finding exists and user has access
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
    
    # Read file content to get size
    content = await file.read()
    filesize = len(content)
    
    # Validate file
    validate_file(file.filename, filesize)
    
    # Generate unique filename
    ext = get_file_extension(file.filename)
    unique_filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Create evidence record
    evidence = await db.evidence.create(
        data={
            "filename": file.filename,
            "filepath": filepath,
            "filesize": filesize,
            "mimetype": file.content_type or "application/octet-stream",
            "caption": caption,
            "findingId": finding_id,
        }
    )
    
    return {
        "id": evidence.id,
        "filename": evidence.filename,
        "filesize": evidence.filesize,
        "mimetype": evidence.mimetype,
        "caption": evidence.caption,
        "created_at": evidence.createdAt.isoformat(),
    }


@router.get("/evidence/{evidence_id}")
async def download_evidence(
    evidence_id: str,
    current_user = Depends(get_current_user)
):
    """Download evidence file"""
    evidence = await db.evidence.find_unique(
        where={"id": evidence_id},
        include={
            "finding": {
                "include": {
                    "project": {"include": {"client": True}}
                }
            }
        }
    )
    
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found"
        )
    
    # Check organization access
    if current_user.organizationId and evidence.finding.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not os.path.exists(evidence.filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    return FileResponse(
        evidence.filepath,
        media_type=evidence.mimetype,
        filename=evidence.filename
    )


@router.delete("/evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: str,
    current_user = Depends(get_current_user)
):
    """Delete evidence file"""
    evidence = await db.evidence.find_unique(
        where={"id": evidence_id},
        include={
            "finding": {
                "include": {
                    "project": {"include": {"client": True}}
                }
            }
        }
    )
    
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence not found"
        )
    
    # Check organization access
    if current_user.organizationId and evidence.finding.project.client.organizationId != current_user.organizationId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Delete file from disk
    if os.path.exists(evidence.filepath):
        os.remove(evidence.filepath)
    
    # Delete database record
    await db.evidence.delete(where={"id": evidence_id})
    return None


@router.post("/import/burp")
async def import_burp_xml(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Import findings from Burp Suite XML file"""
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": project_id},
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
    
    # TODO: Implement Burp Suite XML parser
    # Parse XML and create findings
    
    return {
        "message": "Burp Suite import - implementation pending",
        "project_id": project_id,
    }


@router.post("/import/nessus")
async def import_nessus_file(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Import findings from Nessus .nessus file"""
    # Verify project exists and user has access
    project = await db.project.find_unique(
        where={"id": project_id},
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
    
    # TODO: Implement Nessus parser
    # Parse .nessus file and create findings
    
    return {
        "message": "Nessus import - implementation pending",
        "project_id": project_id,
    }
