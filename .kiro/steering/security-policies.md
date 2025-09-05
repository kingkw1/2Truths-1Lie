---
include: always
---

# Mobile Security Guidelines

## Mobile Authentication and Authorization
- Use secure JWT-based authentication optimized for mobile app lifecycles
- Implement biometric authentication (Touch ID, Face ID, fingerprint) where appropriate
- Store sensitive tokens in mobile secure storage (iOS Keychain, Android Keystore)
- Never expose authentication tokens in mobile app logs or debugging tools
- Verify user permissions on all mobile API requests with device context validation

## Mobile Data Validation & Sanitization
- Sanitize all user inputs both client-side (mobile app) and server-side
- Use strict schema validation for mobile API inputs with mobile-specific constraints
- Enforce mobile-appropriate limits on uploaded media (file size, resolution, duration)
- Validate camera and microphone permissions before accessing device features
- Validate merged video file integrity and segment metadata consistency
- Implement server-side content scanning for uploaded video files
- Enforce compression parameters to prevent resource exhaustion attacks

## Mobile Transport Security
- Use HTTPS/TLS for all mobile-to-server communication
- Implement certificate pinning in mobile app to prevent man-in-the-middle attacks
- Use secure WebSocket connections for real-time mobile features
- Encrypt sensitive data in transit with mobile-optimized encryption protocols

## Mobile Data Privacy & Storage
- Store personal and biometric data encrypted using mobile platform secure storage
- Implement on-device encryption for sensitive cached data
- Use platform-specific privacy frameworks (iOS Privacy Framework, Android Privacy APIs)
- Handle mobile app backgrounding securely (clear sensitive data from memory)
- Implement mobile-specific data retention policies for cached content

## Mobile-Specific Security Considerations
- Request minimal necessary device permissions (camera, microphone, storage)
- Handle mobile app installation and update security (code signing, app store verification)
- Implement mobile app integrity checks to prevent tampering
- Secure mobile deep links and URL schemes from malicious redirects
- Protect against mobile-specific attacks (SMS interception, SIM swapping)

## Mobile Rate Limiting & Abuse Protection
- Implement mobile-aware rate limiting based on device ID and user patterns
- Protect against mobile-specific abuse (automated app interactions, device farming)
- Use device fingerprinting and behavioral analytics for mobile fraud detection
- Implement progressive mobile app lockout for suspicious activity
- Rate limit video upload endpoints to prevent storage abuse
- Monitor unusual upload patterns (large files, frequent uploads, suspicious compression ratios)

## Mobile Dependency & Vulnerability Management
- Regularly audit React Native and Expo dependencies for mobile security vulnerabilities
- Monitor mobile platform security updates and apply promptly
- Use mobile-specific security scanning tools for native dependencies
- Implement mobile app security testing in CI/CD pipeline

## Mobile Logging & Monitoring
- Log mobile-specific security events (permission requests, biometric auth attempts)
- Implement mobile crash reporting with privacy-safe data collection
- Use mobile analytics to detect unusual app usage patterns
- Avoid logging sensitive mobile data (device IDs, biometric data, camera content)
- Implement mobile-specific error tracking and security incident response

---