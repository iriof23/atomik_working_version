"""
Tests for Audit Logging Service

These tests verify that:
1. Audit events are properly logged
2. All required fields are captured
3. Different action types are handled correctly
4. Error handling doesn't break the application

SECURITY: Audit logging is critical for compliance and incident response.
"""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.audit_service import (
    AuditService,
    AuditAction,
    audit_service,
)


class TestAuditAction:
    """Tests for AuditAction enum."""
    
    def test_crud_actions_exist(self):
        """CRUD actions should be defined."""
        assert AuditAction.CREATE.value == 'CREATE'
        assert AuditAction.READ.value == 'READ'
        assert AuditAction.UPDATE.value == 'UPDATE'
        assert AuditAction.DELETE.value == 'DELETE'
    
    def test_auth_actions_exist(self):
        """Authentication actions should be defined."""
        assert AuditAction.LOGIN_SUCCESS.value == 'LOGIN_SUCCESS'
        assert AuditAction.LOGIN_FAILED.value == 'LOGIN_FAILED'
        assert AuditAction.LOGOUT.value == 'LOGOUT'
        assert AuditAction.TOKEN_REFRESH.value == 'TOKEN_REFRESH'
    
    def test_security_actions_exist(self):
        """Security event actions should be defined."""
        assert AuditAction.RATE_LIMITED.value == 'RATE_LIMITED'
        assert AuditAction.ACCESS_DENIED.value == 'ACCESS_DENIED'
        assert AuditAction.INVALID_INPUT.value == 'INVALID_INPUT'
    
    def test_import_export_actions_exist(self):
        """Import/export actions should be defined."""
        assert AuditAction.IMPORT.value == 'IMPORT'
        assert AuditAction.EXPORT.value == 'EXPORT'
        assert AuditAction.DOWNLOAD.value == 'DOWNLOAD'


class TestAuditServiceLog:
    """Tests for the main log method."""
    
    @pytest.mark.asyncio
    async def test_log_creates_audit_entry(self):
        """Log method should create audit entry in database."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            result = await AuditService.log(
                action=AuditAction.CREATE,
                resource='Finding',
                resource_id='finding-456',
                user_id='user-789',
                user_email='test@example.com',
            )
            
            assert result == 'audit-123'
            mock_db.auditlog.create.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_log_includes_all_fields(self):
        """Log should include all provided fields."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            await AuditService.log(
                action=AuditAction.UPDATE,
                resource='Client',
                resource_id='client-123',
                resource_name='Acme Corp',
                user_id='user-456',
                user_email='admin@acme.com',
                organization_id='org-789',
                details={'changes': {'name': 'New Name'}},
                ip_address='192.168.1.1',
                user_agent='Mozilla/5.0',
                request_id='req-abc',
                success=True,
            )
            
            call_args = mock_db.auditlog.create.call_args
            data = call_args.kwargs['data']
            
            assert data['action'] == 'UPDATE'
            assert data['resource'] == 'Client'
            assert data['resourceId'] == 'client-123'
            assert data['resourceName'] == 'Acme Corp'
            assert data['userId'] == 'user-456'
            assert data['userEmail'] == 'admin@acme.com'
            assert data['organizationId'] == 'org-789'
            assert data['ipAddress'] == '192.168.1.1'
            assert data['userAgent'] == 'Mozilla/5.0'
            assert data['requestId'] == 'req-abc'
            assert data['success'] is True
    
    @pytest.mark.asyncio
    async def test_log_serializes_details_to_json(self):
        """Details dict should be serialized to JSON."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            details = {'key': 'value', 'number': 42}
            
            await AuditService.log(
                action=AuditAction.CREATE,
                resource='Test',
                details=details,
            )
            
            call_args = mock_db.auditlog.create.call_args
            data = call_args.kwargs['data']
            
            # Details should be JSON string
            assert isinstance(data['details'], str)
            parsed = json.loads(data['details'])
            assert parsed == details
    
    @pytest.mark.asyncio
    async def test_log_handles_database_error(self):
        """Database errors should not propagate (audit shouldn't break app)."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(side_effect=Exception('DB Error'))
            
            # Should not raise
            result = await AuditService.log(
                action=AuditAction.CREATE,
                resource='Test',
            )
            
            # Should return None on error
            assert result is None
    
    @pytest.mark.asyncio
    async def test_log_handles_json_serialization_error(self):
        """Non-serializable details should be handled gracefully."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            # Datetime objects aren't directly JSON serializable
            from datetime import datetime
            details = {'timestamp': datetime.now()}
            
            # Should not raise
            result = await AuditService.log(
                action=AuditAction.CREATE,
                resource='Test',
                details=details,
            )
            
            # Should still succeed (datetime should be converted to string)
            assert result == 'audit-123'


class TestAuditServiceConvenienceMethods:
    """Tests for convenience methods (log_create, log_update, etc.)."""
    
    @pytest.mark.asyncio
    async def test_log_create(self):
        """log_create should use CREATE action."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_create(
                resource='Finding',
                resource_id='finding-123',
                resource_name='SQL Injection',
                user_id='user-456',
            )
            
            mock_log.assert_called_once()
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.CREATE
    
    @pytest.mark.asyncio
    async def test_log_update_includes_changes(self):
        """log_update should include changes in details."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            changes = {'severity': 'HIGH', 'status': 'FIXED'}
            
            await AuditService.log_update(
                resource='Finding',
                resource_id='finding-123',
                changes=changes,
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.UPDATE
            assert call_args.kwargs['details'] == {'changes': changes}
    
    @pytest.mark.asyncio
    async def test_log_delete(self):
        """log_delete should use DELETE action."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_delete(
                resource='Project',
                resource_id='project-123',
                resource_name='Q4 Pentest',
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.DELETE
    
    @pytest.mark.asyncio
    async def test_log_auth_success(self):
        """log_auth_success should log successful authentication."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_auth_success(
                user_id='user-123',
                user_email='user@example.com',
                auth_method='clerk',
                ip_address='192.168.1.1',
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.LOGIN_SUCCESS
            assert call_args.kwargs['details'] == {'auth_method': 'clerk'}
    
    @pytest.mark.asyncio
    async def test_log_auth_failed(self):
        """log_auth_failed should log failed authentication."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_auth_failed(
                email='attacker@evil.com',
                reason='Invalid password',
                ip_address='1.2.3.4',
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.LOGIN_FAILED
            assert call_args.kwargs['success'] is False
            assert call_args.kwargs['error_msg'] == 'Invalid password'
    
    @pytest.mark.asyncio
    async def test_log_rate_limited(self):
        """log_rate_limited should log rate limit events."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_rate_limited(
                endpoint='/api/auth/login',
                ip_address='1.2.3.4',
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.RATE_LIMITED
            assert call_args.kwargs['resource'] == 'API'
            assert call_args.kwargs['resource_name'] == '/api/auth/login'
            assert call_args.kwargs['success'] is False
    
    @pytest.mark.asyncio
    async def test_log_access_denied(self):
        """log_access_denied should log access denied events."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_access_denied(
                resource='Finding',
                resource_id='finding-123',
                user_id='user-456',
                reason='Organization mismatch',
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.ACCESS_DENIED
            assert call_args.kwargs['success'] is False
            assert call_args.kwargs['error_msg'] == 'Organization mismatch'
    
    @pytest.mark.asyncio
    async def test_log_import(self):
        """log_import should log import operations."""
        with patch.object(AuditService, 'log', new_callable=AsyncMock) as mock_log:
            mock_log.return_value = 'audit-123'
            
            await AuditService.log_import(
                import_type='Burp Suite XML',
                resource='Finding',
                user_id='user-123',
                details={'count': 15, 'skipped': 2},
            )
            
            call_args = mock_log.call_args
            assert call_args.kwargs['action'] == AuditAction.IMPORT
            assert call_args.kwargs['resource_name'] == 'Burp Suite XML'


class TestAuditServiceGlobalInstance:
    """Tests for the global audit_service instance."""
    
    def test_global_instance_exists(self):
        """Global audit_service instance should exist."""
        assert audit_service is not None
        assert isinstance(audit_service, type(AuditService))


class TestAuditLoggingIntegration:
    """Integration-style tests for audit logging scenarios."""
    
    @pytest.mark.asyncio
    async def test_finding_crud_audit_trail(self):
        """Complete CRUD audit trail for a finding."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            # Create
            await AuditService.log_create(
                resource='Finding',
                resource_id='finding-123',
                resource_name='SQL Injection',
                user_id='user-456',
            )
            
            # Update
            await AuditService.log_update(
                resource='Finding',
                resource_id='finding-123',
                changes={'severity': 'CRITICAL'},
                user_id='user-456',
            )
            
            # Delete
            await AuditService.log_delete(
                resource='Finding',
                resource_id='finding-123',
                resource_name='SQL Injection',
                user_id='user-456',
            )
            
            # Should have 3 audit log entries
            assert mock_db.auditlog.create.call_count == 3
    
    @pytest.mark.asyncio
    async def test_security_event_audit_trail(self):
        """Security events should be properly logged."""
        with patch('app.services.audit_service.db') as mock_db:
            mock_db.auditlog = MagicMock()
            mock_db.auditlog.create = AsyncMock(return_value=MagicMock(id='audit-123'))
            
            # Failed login
            await AuditService.log_auth_failed(
                email='attacker@evil.com',
                reason='Invalid credentials',
                ip_address='1.2.3.4',
            )
            
            # Rate limit hit
            await AuditService.log_rate_limited(
                endpoint='/api/auth/login',
                ip_address='1.2.3.4',
            )
            
            # Access denied
            await AuditService.log_access_denied(
                resource='Project',
                resource_id='project-123',
                user_id='user-456',
                reason='Not a member',
            )
            
            # All security events logged
            assert mock_db.auditlog.create.call_count == 3
            
            # Verify all were marked as failures
            for call in mock_db.auditlog.create.call_args_list:
                data = call.kwargs['data']
                assert data['success'] is False

