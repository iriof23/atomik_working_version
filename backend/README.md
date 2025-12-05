# Atomik Backend

FastAPI backend for the Atomik penetration testing report generation platform.

## Quick Start

```bash
# Install dependencies
poetry install

# Generate Prisma client
prisma generate

# Run development server
uvicorn app.main:app --reload
```

## Project Structure

```
backend/
├── app/
│   ├── api/routes/          # API endpoints
│   │   ├── auth.py          # Authentication (Clerk + legacy)
│   │   ├── findings.py      # Finding CRUD
│   │   ├── clients.py       # Client management
│   │   ├── projects.py      # Project management
│   │   ├── reports.py       # Report generation
│   │   ├── uploads.py       # File uploads
│   │   └── imports.py       # Scan imports (Burp)
│   ├── core/                # Core modules
│   │   ├── config.py        # Settings
│   │   ├── security.py      # JWT, password hashing
│   │   ├── clerk_auth.py    # Clerk JWKS verification
│   │   ├── rate_limit.py    # Rate limiting middleware
│   │   ├── file_validation.py  # Magic byte validation
│   │   ├── validators.py    # Input validators
│   │   └── security_middleware.py  # Security headers
│   ├── services/            # Business logic
│   │   ├── audit_service.py # Audit logging
│   │   ├── rich_text_service.py  # HTML sanitization
│   │   ├── burp_parser.py   # Burp XML parsing
│   │   └── pdf_service.py   # PDF generation
│   └── main.py              # FastAPI app
├── prisma/
│   └── schema.prisma        # Database schema
├── tests/                   # Test suites
│   ├── test_sanitization.py # XSS prevention tests
│   ├── test_file_validation.py  # File upload tests
│   ├── test_rate_limit.py   # Rate limiting tests
│   ├── test_audit_service.py    # Audit logging tests
│   └── test_security_headers.py # Header tests
└── pyproject.toml           # Dependencies
```

## Security Features

### 1. XSS Prevention
- **Frontend:** DOMPurify sanitization
- **Backend:** Bleach sanitization
- See `app/services/rich_text_service.py`

### 2. File Upload Security
- Magic byte validation (not just extension)
- SVG script removal
- See `app/core/file_validation.py`

### 3. Rate Limiting
- Sliding window algorithm
- Per-endpoint limits
- See `app/core/rate_limit.py`

### 4. Audit Logging
- All CRUD operations logged
- Security events tracked
- See `app/services/audit_service.py`

### 5. Authentication
- Clerk JWKS token verification
- Secure cookie settings
- See `app/core/clerk_auth.py`

## Running Tests

```bash
# Install dev dependencies
poetry install --with dev

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test suite
pytest tests/test_sanitization.py -v

# Run only failing tests
pytest tests/ --lf
```

### Test Suites

| Suite | Description |
|-------|-------------|
| `test_sanitization.py` | XSS prevention, HTML sanitization |
| `test_file_validation.py` | Magic bytes, SVG security |
| `test_rate_limit.py` | Rate limiting behavior |
| `test_audit_service.py` | Audit logging |
| `test_security_headers.py` | Response headers |

## API Documentation

When running locally, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/atomik

# Authentication
CLERK_ISSUER_URL=https://your-instance.clerk.accounts.dev
CLERK_SKIP_VERIFICATION=false  # true only for development

# Security
SECRET_KEY=your-secret-key
DEBUG=false

# File Storage
UPLOAD_DIR=./uploads
MAX_UPLOAD_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Redis (for production rate limiting)
REDIS_URL=redis://localhost:6379/0
```

## Docker

```bash
# Build
docker build -t atomik-backend .

# Run
docker run -p 8000:8000 atomik-backend
```

## Security Documentation

See [SECURITY.md](../SECURITY.md) for comprehensive security documentation.
