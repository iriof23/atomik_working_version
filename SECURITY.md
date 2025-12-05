# Atomik Security Implementation Guide

> **Last Updated:** December 2024  
> **Status:** Production-Ready Security Framework

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Phase 1: Frontend XSS Protection](#phase-1-frontend-xss-protection)
3. [Phase 2: Backend XSS Prevention](#phase-2-backend-xss-prevention)
4. [Phase 3: Scan Import Security](#phase-3-scan-import-security)
5. [Phase 4: Rate Limiting & Input Validation](#phase-4-rate-limiting--input-validation)
6. [Phase 5: Authentication & Audit Logging](#phase-5-authentication--audit-logging)
7. [Phase 6: Content Security Policy](#phase-6-content-security-policy)
8. [Configuration Reference](#configuration-reference)
9. [Security Checklist](#security-checklist)

---

## Security Overview

Atomik implements a defense-in-depth security strategy with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Frontend     │ DOMPurify, CSP, Code Detection        │
│  Layer 2: API Gateway  │ Rate Limiting, Security Headers       │
│  Layer 3: Auth         │ Clerk JWKS, Secure Cookies            │
│  Layer 4: Backend      │ Input Validation, HTML Sanitization   │
│  Layer 5: Database     │ Multi-tenancy, Audit Logging          │
│  Layer 6: Files        │ Magic Bytes, SVG Sanitization         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Frontend XSS Protection

**Status:** ✅ Complete  
**Files:** `frontend/src/lib/sanitize.ts`

### Features Implemented

| Feature | Description | Attack Prevented |
|---------|-------------|------------------|
| **DOMPurify Integration** | HTML sanitization before rendering | Stored XSS |
| **Code Detection** | Auto-detects payloads/code snippets | Script injection |
| **Safe Tag Allowlist** | Only permits safe HTML tags | Malicious tags |
| **Attribute Filtering** | Blocks `onerror`, `onload`, etc. | Event handler XSS |

### Allowed HTML Tags
```
b, i, u, s, strong, em, p, br, ul, ol, li, 
blockquote, pre, code, h1-h6, a, img, span, div, table, 
thead, tbody, tr, th, td, hr
```

### Blocked Attributes
```
onerror, onload, onclick, onmouseover, onfocus, onblur
```

### Code Detection Patterns
- SQL injection: `SELECT`, `UNION`, `DROP TABLE`
- XSS payloads: `<script>`, `javascript:`, `onerror=`
- Shell commands: `$(`, backticks, `; rm -rf`
- XML/HTML: `<?xml`, `<!DOCTYPE`

### Usage
```typescript
import { sanitizeHtml, looksLikeCode } from '@/lib/sanitize';

// Sanitize before rendering
const safeHtml = sanitizeHtml(untrustedHtml);

// Check if content should be in code block
if (looksLikeCode(pastedContent)) {
  editor.commands.insertContent({ type: 'codeBlock', content: pastedContent });
}
```

---

## Phase 2: Backend XSS Prevention

**Status:** ✅ Complete  
**Files:** `backend/app/services/rich_text_service.py`, `backend/app/api/routes/uploads.py`

### Features Implemented

| Feature | Description | Attack Prevented |
|---------|-------------|------------------|
| **Bleach Sanitization** | Server-side HTML cleaning | Stored XSS |
| **SVG Sanitization** | Removes scripts from SVGs | SVG-based XSS |
| **CSP on /uploads/** | Restricts uploaded content execution | Malicious uploads |
| **URL Scheme Validation** | Only allows safe URL schemes | JavaScript URLs |

### Backend Sanitization (Bleach)
```python
ALLOWED_TAGS = ['p', 'b', 'i', 'u', 's', 'strong', 'em', 'br', 'ul', 'ol', 
                'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 
                'h5', 'h6', 'a', 'img', 'span', 'div', 'table', 'thead', 
                'tbody', 'tr', 'th', 'td', 'hr']

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'data-align', 'data-caption'],
    # Event handlers explicitly blocked
}
```

### SVG Sanitization
```python
def sanitize_svg(content: bytes) -> bytes:
    # Removes: <script>, onclick, onerror, onload, javascript:
```

### CSP Headers for /uploads/
```nginx
location /uploads/ {
    add_header Content-Security-Policy "default-src 'none'; img-src 'self'; 
               style-src 'none'; script-src 'none'; object-src 'none'; 
               frame-ancestors 'none';";
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "DENY";
}
```

---

## Phase 3: Scan Import Security

**Status:** ✅ Complete  
**Files:** `backend/app/services/burp_parser.py`, `backend/app/services/nessus_parser.py`, `backend/app/services/qualys_parser.py`, `backend/app/api/routes/imports.py`

### Features Implemented

| Feature | Description | Attack Prevented |
|---------|-------------|------------------|
| **XML Parsing Safety** | Standard XML parsing with error handling | XXE attacks |
| **Content Sanitization** | Sanitizes imported descriptions | Imported XSS |
| **Base64 Validation** | Validates decoded content | Binary injection |
| **Duplicate Prevention** | Tracks source/sourceId | Data integrity |
| **HTML Escaping** | Escapes code in evidence | XSS from payloads |

### Supported Import Formats

| Scanner | File Types | Endpoint | Status |
|---------|------------|----------|--------|
| **Burp Suite** | `.xml` | `/api/imports/burp/{project_id}` | ✅ |
| **Nessus** | `.nessus`, `.xml` | `/api/imports/nessus/{project_id}` | ✅ |
| **Qualys** | `.xml` | `/api/imports/qualys/{project_id}` | ✅ |

### Parser Features

#### Burp Suite Parser
- Parses `<issue>` elements
- Extracts request/response pairs (base64 decoded)
- Maps confidence levels
- Extracts CWE IDs from classifications

#### Nessus Parser
- Parses `NessusClientData_v2` format
- Extracts CVSS scores (v2 and v3)
- Maps severity (0-4) to Critical/High/Medium/Low/Info
- Includes plugin output as evidence
- Tracks exploit availability

#### Qualys Parser
- Supports multiple Qualys XML formats
- Extracts QID, CVE, Bugtraq references
- Includes PCI compliance flags
- Maps severity (1-5) to Atomik levels

### Database Tracking
```prisma
model Finding {
  source   String?  // "burp", "nessus", "qualys", "manual"
  sourceId String?  // Original ID from scanner
  @@unique([source, sourceId, projectId])
}
```

### Import API Usage

```bash
# Import Burp Suite findings
curl -X POST /api/imports/burp/{project_id} \
  -F "file=@burp_export.xml" \
  -F "skip_informational=true"

# Import Nessus findings
curl -X POST /api/imports/nessus/{project_id} \
  -F "file=@scan.nessus" \
  -F "skip_informational=false"

# Import Qualys findings
curl -X POST /api/imports/qualys/{project_id} \
  -F "file=@qualys_report.xml"

# List available import sources
curl /api/imports/sources
```

---

## Phase 4: Rate Limiting & Input Validation

**Status:** ✅ Complete  
**Files:** `backend/app/core/rate_limit.py`, `backend/app/core/file_validation.py`, `backend/app/core/validators.py`

### Rate Limiting Configuration

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `/api/auth/*` | 20/min | Prevent brute force |
| `/api/uploads/*` | 30/min | Prevent upload abuse |
| `/api/imports/*` | 10/min | Heavy operations |
| `/api/v1/ai/*` | 20/min | Expensive operations |
| Default | 60/min | Standard protection |

### Response Headers
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 60  (when exceeded)
```

### Magic Byte Validation

| File Type | Magic Bytes | Validated |
|-----------|-------------|-----------|
| PNG | `\x89PNG\r\n\x1a\n` | ✅ |
| JPEG | `\xff\xd8\xff` | ✅ |
| GIF | `GIF87a` / `GIF89a` | ✅ |
| WebP | `RIFF....WEBP` | ✅ |
| SVG | `<?xml` / `<svg` | ✅ |
| PDF | `%PDF-` | ✅ |
| XML | `<?xml` | ✅ |

### Input Validators
```python
# Available validators
validate_email(email)      # RFC-compliant email
validate_phone(phone)      # International formats
validate_url(url)          # Safe URL schemes only
validate_uuid(uuid)        # UUID format
validate_filename(name)    # Path traversal prevention
sanitize_string(text)      # Null bytes, length limits
```

---

## Phase 5: Authentication & Audit Logging

**Status:** ✅ Complete  
**Files:** `backend/app/core/clerk_auth.py`, `backend/app/core/security_middleware.py`, `backend/app/services/audit_service.py`

### Clerk JWKS Token Verification

```python
# Production mode (CLERK_SKIP_VERIFICATION=false)
1. Fetch JWKS from Clerk's /.well-known/jwks.json
2. Extract signing key from token header
3. Verify signature using RS256
4. Validate: exp, nbf, iat, iss claims
5. Return verified claims or reject
```

### Security Headers (All Responses)

| Header | Value | Protection |
|--------|-------|------------|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=()...` | Feature restriction |
| `X-Request-ID` | UUID | Request tracing |

### Secure Cookie Settings

| Attribute | Value | Protection |
|-----------|-------|------------|
| `HttpOnly` | `true` | XSS cookie theft |
| `SameSite` | `Lax` | CSRF attacks |
| `Secure` | `true` (prod) | HTTPS only |

### Audit Log Events

| Action | Resource | Captured Data |
|--------|----------|---------------|
| `CREATE` | Finding, Client, Project | Full details, user, IP |
| `UPDATE` | Finding, Client, Project | Changes (before/after) |
| `DELETE` | Finding, Client, Project | Deleted resource info |
| `LOGIN_SUCCESS` | User | Auth method, IP |
| `LOGIN_FAILED` | User | Email attempted, reason |
| `RATE_LIMITED` | API | Endpoint, IP |
| `ACCESS_DENIED` | Any | Resource, reason |
| `IMPORT` | Scan data | Source, count |
| `EXPORT` | Report | Format, recipient |

### Audit Log Schema
```prisma
model AuditLog {
  id             String   @id
  timestamp      DateTime
  userId         String?
  userEmail      String?
  action         AuditAction
  resource       String
  resourceId     String?
  resourceName   String?
  details        String?  // JSON
  ipAddress      String?
  userAgent      String?
  requestId      String?
  organizationId String?
  success        Boolean
  errorMsg       String?
}
```

---

## Phase 6: Content Security Policy

**Status:** ✅ Complete  
**Files:** `docker/nginx.conf`, `frontend/index.html`

### CSP Directives Implemented

```
default-src 'self';
script-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com;
font-src 'self' data:;
connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.accounts.dev;
frame-src https://*.clerk.accounts.dev https://challenges.cloudflare.com;
frame-ancestors 'self';
base-uri 'self';
form-action 'self';
```

### CSP Directive Explanations

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Default fallback - only same origin |
| `script-src` | `'self'` + Clerk | Allow app scripts + Clerk auth |
| `style-src` | `'self' 'unsafe-inline'` | Allow Tailwind inline styles |
| `img-src` | `'self' data: blob:` + Clerk | Allow images, base64, blobs, Clerk avatars |
| `font-src` | `'self' data:` | Allow fonts and data URIs |
| `connect-src` | `'self'` + Clerk | Allow API calls and Clerk |
| `frame-src` | Clerk domains | Allow Clerk auth iframes |
| `frame-ancestors` | `'self'` | Prevent embedding in other sites |
| `base-uri` | `'self'` | Prevent base tag injection |
| `form-action` | `'self'` | Forms can only submit to same origin |

### Security Headers (All Responses)

| Header | Frontend | API | Uploads |
|--------|----------|-----|---------|
| `X-Content-Type-Options: nosniff` | ✅ | ✅ | ✅ |
| `X-Frame-Options` | SAMEORIGIN | DENY | DENY |
| `X-XSS-Protection: 1; mode=block` | ✅ | ✅ | ✅ |
| `Referrer-Policy` | ✅ | ✅ | - |
| `Permissions-Policy` | ✅ | - | - |
| `Content-Security-Policy` | Full CSP | - | Restrictive |

### Attacks Prevented by CSP

| Attack | CSP Protection |
|--------|----------------|
| **Inline Script Injection** | `script-src 'self'` - no inline scripts |
| **External Script Loading** | Only whitelisted domains |
| **Data Exfiltration** | `connect-src` limits endpoints |
| **Clickjacking** | `frame-ancestors 'self'` |
| **Form Hijacking** | `form-action 'self'` |
| **Base Tag Injection** | `base-uri 'self'` |

---

## Phase 7: Security Testing

**Status:** ✅ Complete  
**Files:** `backend/tests/test_*.py`

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| `test_sanitization.py` | XSS prevention, safe HTML | HTML sanitization |
| `test_file_validation.py` | Magic bytes, SVG security | File uploads |
| `test_rate_limit.py` | Rate limiting behavior | API protection |
| `test_audit_service.py` | Audit logging | Compliance |
| `test_security_headers.py` | Response headers | Defense-in-depth |

### Running Security Tests

```bash
# Run all tests
cd backend
pytest tests/ -v

# Run specific security test suite
pytest tests/test_sanitization.py -v

# Run with coverage report
pytest tests/ --cov=app --cov-report=html

# Run only XSS tests
pytest tests/test_sanitization.py::TestXSSPrevention -v
```

### Test Categories

#### XSS Prevention Tests
```python
test_blocks_script_tags          # <script> removal
test_blocks_onerror_attribute    # Event handler removal
test_blocks_javascript_urls      # javascript: URL blocking
test_blocks_iframe_tags          # iframe removal
test_preserves_safe_html         # Safe content preserved
```

#### File Validation Tests
```python
test_valid_png_file              # Magic byte verification
test_rejects_php_as_png          # Extension spoofing prevention
test_rejects_svg_with_script     # SVG sanitization
```

#### Rate Limiting Tests
```python
test_allows_requests_under_limit # Normal operation
test_blocks_requests_over_limit  # Enforcement
test_auth_endpoint_has_stricter_limit # Per-endpoint limits
```

#### Audit Service Tests
```python
test_log_creates_audit_entry     # Audit creation
test_log_auth_failed             # Security event logging
test_log_access_denied           # Access control logging
```

---

## Phase 8: Database Security

**Status:** ✅ Complete  
**Files:** `backend/app/core/encryption.py`, `backend/app/core/backup.py`, `backend/app/api/routes/admin.py`

### Field-Level Encryption

Sensitive database fields can be encrypted using AES-256-GCM.

```python
from app.core.encryption import encrypt_field, decrypt_field

# Encrypt before storing
encrypted_email = encrypt_field("user@example.com")
# Result: "$enc$base64encodeddata..."

# Decrypt when reading
email = decrypt_field(encrypted_email)
```

#### Encryption Features

| Feature | Description |
|---------|-------------|
| **Algorithm** | AES-256-GCM (authenticated encryption) |
| **Key Derivation** | PBKDF2 with 100,000 iterations |
| **Nonce** | Unique random 96-bit nonce per encryption |
| **Format** | `$enc$` prefix + base64(nonce + ciphertext) |

#### Security Properties

- **Confidentiality:** AES-256 encryption
- **Integrity:** GCM authentication tag
- **Semantic Security:** Random nonce prevents pattern analysis
- **Backward Compatible:** Unencrypted data returned as-is

### Database Backup System

Automated backup with compression, checksums, and retention management.

```bash
# Create backup via API (admin only)
POST /api/admin/backup

# List backups
GET /api/admin/backups

# Cleanup old backups
DELETE /api/admin/backups/cleanup?retention_days=30
```

#### Backup Features

| Feature | Description |
|---------|-------------|
| **Compression** | GZIP compression |
| **Integrity** | SHA256 checksum |
| **Retention** | Configurable cleanup (default 30 days) |
| **Verification** | Checksum validation before restore |

### Connection Security

Database connection settings for production:

```bash
# PostgreSQL SSL Mode
DATABASE_SSL_MODE=require  # Options: disable, prefer, require, verify-ca, verify-full

# Connection Pooling
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20
DATABASE_POOL_TIMEOUT=30
```

#### SSL Modes

| Mode | Description | Production |
|------|-------------|------------|
| `disable` | No SSL | ❌ |
| `prefer` | Use SSL if available | ⚠️ |
| `require` | Require SSL | ✅ |
| `verify-ca` | Verify server certificate | ✅ |
| `verify-full` | Verify certificate + hostname | ✅✅ |

### Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/backup` | POST | Create backup |
| `/api/admin/backups` | GET | List backups |
| `/api/admin/backups/cleanup` | DELETE | Remove old backups |
| `/api/admin/audit-logs` | GET | View audit logs |
| `/api/admin/audit-logs/stats` | GET | Audit statistics |
| `/api/admin/health/detailed` | GET | System health |

---

## Configuration Reference

### Environment Variables

```bash
# Authentication
CLERK_ISSUER_URL=https://your-instance.clerk.accounts.dev
CLERK_SKIP_VERIFICATION=false  # Set to 'true' ONLY for development

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Security
DEBUG=false  # Enables Secure cookie flag when false

# File Uploads
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=png,jpg,jpeg,gif,pdf,xml,nessus,txt
```

### Docker Compose Security Settings

```yaml
services:
  backend:
    environment:
      - CLERK_SKIP_VERIFICATION=false
      - DEBUG=false
    read_only: true  # Recommended
    security_opt:
      - no-new-privileges:true
```

---

## Security Checklist

### Before Production Deployment

- [ ] Set `CLERK_SKIP_VERIFICATION=false`
- [ ] Set `DEBUG=false`
- [ ] Configure HTTPS/TLS certificates
- [ ] Review rate limit settings
- [ ] Enable audit log retention policy
- [ ] Configure log aggregation (e.g., CloudWatch, Datadog)
- [ ] Set up security monitoring alerts
- [ ] Review CORS origins
- [ ] Enable database encryption at rest
- [ ] Configure backup strategy

### Ongoing Security

- [ ] Monitor audit logs for suspicious activity
- [ ] Review rate limit hits weekly
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Conduct security review annually

---

## Vulnerability Reporting

If you discover a security vulnerability, please report it to:
- Email: security@atomik.io
- Do NOT create public GitHub issues for security vulnerabilities

---

*This document is maintained as part of Atomik's security program.*

