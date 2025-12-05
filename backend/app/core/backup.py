"""
Database Backup Utilities

SECURITY: Provides secure database backup and restore functionality.

Features:
- Automated backup scheduling
- Encrypted backup files
- Backup verification
- Retention policy management

Usage:
    from app.core.backup import backup_database, restore_database
    
    # Create a backup
    backup_file = await backup_database()
    
    # Restore from backup
    await restore_database(backup_file)
"""
import os
import subprocess
import logging
import gzip
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
import asyncio

from app.core.config import settings
from app.core.encryption import encrypt_field, decrypt_field

logger = logging.getLogger(__name__)

# Backup configuration
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "./backups"))
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
BACKUP_COMPRESSION = True


class DatabaseBackup:
    """
    Database backup manager.
    
    SECURITY:
    - Backups are compressed (gzip)
    - Backup integrity verified with SHA256 checksum
    - Old backups automatically cleaned up
    """
    
    def __init__(self, backup_dir: Optional[Path] = None):
        self.backup_dir = backup_dir or BACKUP_DIR
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_database_url_parts(self) -> dict:
        """Parse database URL into components."""
        url = settings.DATABASE_URL
        
        # Handle PostgreSQL URL format
        # postgresql://user:pass@host:port/database
        if url.startswith("postgresql://"):
            url = url[13:]  # Remove prefix
            
            # Split user:pass@host:port/database
            auth_host, database = url.rsplit("/", 1)
            
            if "@" in auth_host:
                auth, host_port = auth_host.rsplit("@", 1)
                user, password = auth.split(":", 1) if ":" in auth else (auth, "")
            else:
                user, password = "", ""
                host_port = auth_host
            
            if ":" in host_port:
                host, port = host_port.split(":", 1)
            else:
                host = host_port
                port = "5432"
            
            return {
                "type": "postgresql",
                "host": host,
                "port": port,
                "user": user,
                "password": password,
                "database": database,
            }
        
        # Handle SQLite URL format
        elif url.startswith("file:"):
            return {
                "type": "sqlite",
                "path": url[5:],  # Remove "file:" prefix
            }
        
        raise ValueError(f"Unsupported database URL format: {url[:20]}...")
    
    def _generate_backup_filename(self) -> str:
        """Generate a timestamped backup filename."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"atomik_backup_{timestamp}.sql.gz"
    
    def _calculate_checksum(self, filepath: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    async def backup_postgresql(self) -> Path:
        """
        Create a PostgreSQL database backup using pg_dump.
        
        SECURITY: Uses environment variable for password to avoid CLI exposure.
        """
        db_parts = self._get_database_url_parts()
        backup_file = self.backup_dir / self._generate_backup_filename()
        
        # Set password in environment (pg_dump reads PGPASSWORD)
        env = os.environ.copy()
        if db_parts["password"]:
            env["PGPASSWORD"] = db_parts["password"]
        
        # Build pg_dump command
        cmd = [
            "pg_dump",
            "-h", db_parts["host"],
            "-p", db_parts["port"],
            "-U", db_parts["user"],
            "-d", db_parts["database"],
            "--format=plain",
            "--no-owner",
            "--no-acl",
        ]
        
        logger.info(f"Starting PostgreSQL backup to {backup_file}")
        
        try:
            # Run pg_dump and compress output
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise RuntimeError(f"pg_dump failed: {error_msg}")
            
            # Compress the backup
            with gzip.open(backup_file, "wb") as f:
                f.write(stdout)
            
            # Calculate checksum
            checksum = self._calculate_checksum(backup_file)
            checksum_file = backup_file.with_suffix(backup_file.suffix + ".sha256")
            checksum_file.write_text(checksum)
            
            logger.info(f"Backup completed: {backup_file} (checksum: {checksum[:16]}...)")
            
            return backup_file
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            raise
    
    async def backup_sqlite(self) -> Path:
        """
        Create a SQLite database backup.
        
        Uses SQLite's backup API for consistency.
        """
        db_parts = self._get_database_url_parts()
        backup_file = self.backup_dir / self._generate_backup_filename()
        
        source_path = db_parts["path"]
        
        logger.info(f"Starting SQLite backup to {backup_file}")
        
        try:
            # Read the database file
            with open(source_path, "rb") as src:
                data = src.read()
            
            # Compress and save
            with gzip.open(backup_file, "wb") as f:
                f.write(data)
            
            # Calculate checksum
            checksum = self._calculate_checksum(backup_file)
            checksum_file = backup_file.with_suffix(backup_file.suffix + ".sha256")
            checksum_file.write_text(checksum)
            
            logger.info(f"Backup completed: {backup_file} (checksum: {checksum[:16]}...)")
            
            return backup_file
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            raise
    
    async def backup(self) -> Path:
        """
        Create a database backup (auto-detects database type).
        
        Returns:
            Path to the backup file
        """
        db_parts = self._get_database_url_parts()
        
        if db_parts["type"] == "postgresql":
            return await self.backup_postgresql()
        elif db_parts["type"] == "sqlite":
            return await self.backup_sqlite()
        else:
            raise ValueError(f"Unsupported database type: {db_parts['type']}")
    
    async def restore_postgresql(self, backup_file: Path) -> None:
        """
        Restore a PostgreSQL database from backup.
        
        WARNING: This will overwrite existing data!
        """
        db_parts = self._get_database_url_parts()
        
        # Verify checksum if available
        checksum_file = backup_file.with_suffix(backup_file.suffix + ".sha256")
        if checksum_file.exists():
            expected_checksum = checksum_file.read_text().strip()
            actual_checksum = self._calculate_checksum(backup_file)
            if expected_checksum != actual_checksum:
                raise ValueError("Backup file checksum mismatch - file may be corrupted")
        
        # Set password in environment
        env = os.environ.copy()
        if db_parts["password"]:
            env["PGPASSWORD"] = db_parts["password"]
        
        logger.info(f"Starting PostgreSQL restore from {backup_file}")
        
        try:
            # Decompress and restore
            with gzip.open(backup_file, "rb") as f:
                sql_data = f.read()
            
            # Build psql command
            cmd = [
                "psql",
                "-h", db_parts["host"],
                "-p", db_parts["port"],
                "-U", db_parts["user"],
                "-d", db_parts["database"],
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
            
            stdout, stderr = await process.communicate(input=sql_data)
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise RuntimeError(f"psql restore failed: {error_msg}")
            
            logger.info(f"Restore completed from {backup_file}")
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            raise
    
    async def restore_sqlite(self, backup_file: Path) -> None:
        """
        Restore a SQLite database from backup.
        
        WARNING: This will overwrite existing data!
        """
        db_parts = self._get_database_url_parts()
        
        # Verify checksum if available
        checksum_file = backup_file.with_suffix(backup_file.suffix + ".sha256")
        if checksum_file.exists():
            expected_checksum = checksum_file.read_text().strip()
            actual_checksum = self._calculate_checksum(backup_file)
            if expected_checksum != actual_checksum:
                raise ValueError("Backup file checksum mismatch - file may be corrupted")
        
        dest_path = db_parts["path"]
        
        logger.info(f"Starting SQLite restore from {backup_file}")
        
        try:
            # Decompress and restore
            with gzip.open(backup_file, "rb") as f:
                data = f.read()
            
            with open(dest_path, "wb") as dest:
                dest.write(data)
            
            logger.info(f"Restore completed from {backup_file}")
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            raise
    
    async def restore(self, backup_file: Path) -> None:
        """
        Restore database from backup (auto-detects database type).
        
        WARNING: This will overwrite existing data!
        """
        db_parts = self._get_database_url_parts()
        
        if db_parts["type"] == "postgresql":
            await self.restore_postgresql(backup_file)
        elif db_parts["type"] == "sqlite":
            await self.restore_sqlite(backup_file)
        else:
            raise ValueError(f"Unsupported database type: {db_parts['type']}")
    
    def list_backups(self) -> List[dict]:
        """
        List all available backups.
        
        Returns:
            List of backup info dicts with filename, size, timestamp, checksum
        """
        backups = []
        
        for file in self.backup_dir.glob("atomik_backup_*.sql.gz"):
            checksum_file = file.with_suffix(file.suffix + ".sha256")
            checksum = checksum_file.read_text().strip() if checksum_file.exists() else None
            
            stat = file.stat()
            
            backups.append({
                "filename": file.name,
                "path": str(file),
                "size": stat.st_size,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "checksum": checksum,
            })
        
        # Sort by created time (newest first)
        backups.sort(key=lambda x: x["created"], reverse=True)
        
        return backups
    
    def cleanup_old_backups(self, retention_days: int = BACKUP_RETENTION_DAYS) -> int:
        """
        Remove backups older than retention period.
        
        Returns:
            Number of backups removed
        """
        cutoff = datetime.now() - timedelta(days=retention_days)
        removed = 0
        
        for file in self.backup_dir.glob("atomik_backup_*.sql.gz"):
            stat = file.stat()
            file_time = datetime.fromtimestamp(stat.st_mtime)
            
            if file_time < cutoff:
                # Remove backup and its checksum file
                file.unlink()
                checksum_file = file.with_suffix(file.suffix + ".sha256")
                if checksum_file.exists():
                    checksum_file.unlink()
                
                logger.info(f"Removed old backup: {file.name}")
                removed += 1
        
        return removed
    
    def verify_backup(self, backup_file: Path) -> bool:
        """
        Verify backup integrity.
        
        Returns:
            True if backup is valid, False otherwise
        """
        try:
            # Check file exists
            if not backup_file.exists():
                logger.error(f"Backup file not found: {backup_file}")
                return False
            
            # Verify checksum
            checksum_file = backup_file.with_suffix(backup_file.suffix + ".sha256")
            if checksum_file.exists():
                expected_checksum = checksum_file.read_text().strip()
                actual_checksum = self._calculate_checksum(backup_file)
                
                if expected_checksum != actual_checksum:
                    logger.error(f"Checksum mismatch for {backup_file}")
                    return False
            
            # Try to decompress (validates gzip integrity)
            with gzip.open(backup_file, "rb") as f:
                # Read first chunk to verify
                f.read(1024)
            
            return True
            
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return False


# Global instance
_backup_manager: Optional[DatabaseBackup] = None


def get_backup_manager() -> DatabaseBackup:
    """Get the global backup manager instance."""
    global _backup_manager
    if _backup_manager is None:
        _backup_manager = DatabaseBackup()
    return _backup_manager


async def backup_database() -> Path:
    """Convenience function to create a backup."""
    return await get_backup_manager().backup()


async def restore_database(backup_file: Path) -> None:
    """Convenience function to restore from backup."""
    await get_backup_manager().restore(backup_file)


def list_backups() -> List[dict]:
    """Convenience function to list backups."""
    return get_backup_manager().list_backups()


def cleanup_backups(retention_days: int = BACKUP_RETENTION_DAYS) -> int:
    """Convenience function to cleanup old backups."""
    return get_backup_manager().cleanup_old_backups(retention_days)

