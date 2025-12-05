"""
Admin Routes for System Management

SECURITY: These routes are restricted to admin users only.
Provides database backup, audit log viewing, and system health.
"""
import logging
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.core.backup import (
    backup_database,
    list_backups,
    cleanup_backups,
    get_backup_manager,
)
from app.db import db

logger = logging.getLogger(__name__)
router = APIRouter()


class BackupInfo(BaseModel):
    """Backup information response model."""
    filename: str
    path: str
    size: int
    size_mb: float
    created: str
    checksum: Optional[str] = None


class BackupListResponse(BaseModel):
    """Response model for listing backups."""
    backups: List[BackupInfo]
    total_count: int
    total_size_mb: float


class BackupResponse(BaseModel):
    """Response model for backup creation."""
    success: bool
    filename: str
    path: str
    size_mb: float
    checksum: str
    message: str


class AuditLogEntry(BaseModel):
    """Audit log entry model."""
    id: str
    timestamp: str
    user_email: Optional[str] = None
    action: str
    resource: str
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    ip_address: Optional[str] = None
    success: bool
    error_msg: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Response model for audit log listing."""
    logs: List[AuditLogEntry]
    total_count: int
    page: int
    page_size: int


def require_admin(current_user = Depends(get_current_user)):
    """
    Dependency to require admin role.
    
    SECURITY: Restricts endpoint access to admin users only.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.post("/backup", response_model=BackupResponse)
async def create_backup(admin_user = Depends(require_admin)):
    """
    Create a database backup.
    
    SECURITY: Admin only. Creates compressed backup with checksum.
    """
    try:
        logger.info(f"Backup initiated by admin {admin_user.email}")
        
        backup_file = await backup_database()
        
        # Get backup info
        manager = get_backup_manager()
        backups = manager.list_backups()
        backup_info = next(
            (b for b in backups if b["filename"] == backup_file.name),
            None
        )
        
        if backup_info:
            return BackupResponse(
                success=True,
                filename=backup_info["filename"],
                path=backup_info["path"],
                size_mb=backup_info["size_mb"],
                checksum=backup_info["checksum"] or "",
                message="Backup created successfully"
            )
        else:
            return BackupResponse(
                success=True,
                filename=backup_file.name,
                path=str(backup_file),
                size_mb=backup_file.stat().st_size / (1024 * 1024),
                checksum="",
                message="Backup created successfully"
            )
            
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup failed: {str(e)}"
        )


@router.get("/backups", response_model=BackupListResponse)
async def get_backups(admin_user = Depends(require_admin)):
    """
    List all available backups.
    
    SECURITY: Admin only.
    """
    backups = list_backups()
    
    total_size = sum(b["size"] for b in backups)
    
    return BackupListResponse(
        backups=[BackupInfo(**b) for b in backups],
        total_count=len(backups),
        total_size_mb=round(total_size / (1024 * 1024), 2)
    )


@router.delete("/backups/cleanup")
async def cleanup_old_backups(
    retention_days: int = Query(default=30, ge=1, le=365),
    admin_user = Depends(require_admin)
):
    """
    Remove backups older than retention period.
    
    SECURITY: Admin only.
    """
    removed = cleanup_backups(retention_days)
    
    return {
        "success": True,
        "removed_count": removed,
        "retention_days": retention_days,
        "message": f"Removed {removed} old backup(s)"
    }


@router.get("/audit-logs", response_model=AuditLogResponse)
async def get_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=100),
    action: Optional[str] = None,
    resource: Optional[str] = None,
    user_email: Optional[str] = None,
    success: Optional[bool] = None,
    days: int = Query(default=7, ge=1, le=90),
    admin_user = Depends(require_admin)
):
    """
    List audit log entries.
    
    SECURITY: Admin only. Supports filtering and pagination.
    """
    # Build filter conditions
    where_conditions = {}
    
    if action:
        where_conditions["action"] = action
    if resource:
        where_conditions["resource"] = resource
    if user_email:
        where_conditions["userEmail"] = {"contains": user_email}
    if success is not None:
        where_conditions["success"] = success
    
    # Time filter
    cutoff = datetime.utcnow() - timedelta(days=days)
    where_conditions["timestamp"] = {"gte": cutoff}
    
    # Get total count
    total_count = await db.auditlog.count(where=where_conditions)
    
    # Get paginated results
    skip = (page - 1) * page_size
    logs = await db.auditlog.find_many(
        where=where_conditions,
        order={"timestamp": "desc"},
        skip=skip,
        take=page_size,
    )
    
    return AuditLogResponse(
        logs=[
            AuditLogEntry(
                id=log.id,
                timestamp=log.timestamp.isoformat(),
                user_email=log.userEmail,
                action=log.action,
                resource=log.resource,
                resource_id=log.resourceId,
                resource_name=log.resourceName,
                ip_address=log.ipAddress,
                success=log.success,
                error_msg=log.errorMsg,
            )
            for log in logs
        ],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


@router.get("/audit-logs/stats")
async def get_audit_stats(
    days: int = Query(default=7, ge=1, le=90),
    admin_user = Depends(require_admin)
):
    """
    Get audit log statistics.
    
    SECURITY: Admin only.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Get counts by action
    total = await db.auditlog.count(
        where={"timestamp": {"gte": cutoff}}
    )
    
    failed = await db.auditlog.count(
        where={
            "timestamp": {"gte": cutoff},
            "success": False
        }
    )
    
    # Get security events
    security_events = await db.auditlog.count(
        where={
            "timestamp": {"gte": cutoff},
            "action": {"in": ["LOGIN_FAILED", "RATE_LIMITED", "ACCESS_DENIED"]}
        }
    )
    
    return {
        "period_days": days,
        "total_events": total,
        "failed_events": failed,
        "security_events": security_events,
        "success_rate": round((total - failed) / total * 100, 2) if total > 0 else 100,
    }


@router.get("/health/detailed")
async def detailed_health_check(admin_user = Depends(require_admin)):
    """
    Detailed system health check.
    
    SECURITY: Admin only. Exposes system info.
    """
    import psutil
    import platform
    
    # Database check
    try:
        await db.user.count()
        db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Backup check
    backups = list_backups()
    latest_backup = backups[0] if backups else None
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "system": {
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage("/").percent,
        },
        "database": {
            "status": db_status,
        },
        "backup": {
            "total_backups": len(backups),
            "latest_backup": latest_backup["created"] if latest_backup else None,
        }
    }

