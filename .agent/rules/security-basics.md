---
name: security-basics
mode: always_on
description: Core security constraints (No hardcoded secrets, Input Validation, XSUAA).
---

# Security Basics

## Authentication & Authorization
- All API endpoints require authentication
- Use SAP BTP XSUAA for production deployments
- Implement role-based access control (RBAC) for all entities
- Never store passwords in plain text

## Input Validation
- Validate all user inputs on both frontend and backend
- Sanitize data before database operations
- Use parameterized queries (CQL) to prevent injection attacks
- Whitelist allowed file types for uploads

## Data Protection
- **Never log sensitive data**: passwords, API keys, tokens, PII
- Encrypt sensitive data at rest (use environment variables for keys)
- Use HTTPS for all production endpoints
- Mask PII in logs and error messages

## API Security
- Implement rate limiting on public endpoints
- Configure CORS properly (whitelist allowed origins)
- Set security headers (use Helmet.js or equivalent)
- Keep dependencies up-to-date (`npm audit` regularly)

## Error Handling
- Never expose stack traces or internal errors to clients
- Use generic error messages for authentication failures
- Log security events (failed logins, unauthorized access attempts)
