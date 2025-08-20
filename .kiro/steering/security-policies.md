---
include: always
---

# Security Guidelines

## Authentication and Authorization
- Use secure JWT-based authentication with short expiration times.
- Store sensitive tokens securely and never expose them in logs or UI.
- Verify user permissions on all API requests before data retrieval or modification.

## Data Validation & Sanitization
- Sanitize all user inputs server-side to prevent injection attacks.
- Use strict schema validation (e.g., Joi, Yup) on API inputs.
- Enforce length and format constraints especially on uploaded media and text fields.

## Transport Security
- Use HTTPS for all client-server communication.
- Enforce HSTS headers on backend and application server responses.

## Data Privacy
- Store personal and biometric data encrypted at rest.
- Transmit sensitive files and tokens encrypted using TLS.
- Implement data retention and purge policies, especially for uploaded user videos/audio.
- Ensure all stored data complies with applicable laws (HIPAA, GDPR if possible).

## Rate Limiting & Brute Force Protection
- Rate limit API endpoints to prevent abuse.
- Implement account lockout or captcha after repeated failed login or suspicious behavior.

## Dependency & Vulnerability Management
- Regularly audit and update dependencies using tools like npm audit or Snyk.
- Avoid using deprecated or vulnerable packages.

## Logging & Monitoring
- Log authentication and critical actions for security audits.
- Avoid logging sensitive user content or tokens.
- Use error tracking tools (Sentry, Rollbar) for anomaly detection.

---