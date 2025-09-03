# Strict Validation System Documentation

## Overview

This document describes the comprehensive validation system implemented for the media upload feature, ensuring strict server/client validation of file format, size, and duration before acceptance.

## Implementation Summary

### Server-Side Validation

#### Enhanced GameplayValidationService

**Location**: `backend/services/validation_service.py`

**Key Features**:
- Comprehensive file validation before upload
- Security-focused filename validation
- Video metadata and technical specification validation
- Configurable validation limits and requirements

**Validation Categories**:

1. **File Format Validation**
   - MIME type verification (video/* only)
   - Supported formats: MP4, WebM, QuickTime, MOV
   - Dangerous extension detection (.exe, .bat, .cmd, etc.)
   - File extension whitelist enforcement

2. **File Size Validation**
   - Minimum size: 100KB (prevents empty/corrupt files)
   - Maximum size: 50MB (configurable)
   - Prevents both tiny and oversized uploads

3. **Duration Validation**
   - Minimum duration: 3 seconds
   - Maximum duration: 60 seconds
   - Ensures meaningful video content

4. **Security Validation**
   - Filename length limits (255 characters max)
   - Forbidden character detection (`<>:"|?*` and control chars)
   - Path traversal prevention (`../`, `\`, absolute paths)
   - Suspicious metadata detection

5. **Technical Specification Validation**
   - Video resolution limits (320x240 to 1920x1080)
   - Codec validation (H.264, VP8, VP9 for video; AAC, Opus, Vorbis for audio)
   - Bitrate limits (100 kbps to 10 Mbps)

#### Enhanced MediaUploadService

**Location**: `backend/services/media_upload_service.py`

**Improvements**:
- Integration with comprehensive validation service
- Enhanced error reporting with error codes
- Fallback validation if advanced service fails
- Duration parameter support in validation

#### API Endpoint Enhancements

**Location**: `backend/api/media_endpoints.py`

**New Features**:
- Duration validation in `/validate` endpoint
- MIME type parameter support
- Enhanced error reporting
- Validation timestamp tracking

### Client-Side Validation

#### Enhanced VideoUploadService

**Location**: `mobile/src/services/uploadService.ts`

**Key Features**:
- Pre-upload client-side validation
- Server validation integration
- Comprehensive error handling with error codes
- Security-focused filename validation

**Validation Checks**:

1. **File Format Validation**
   - Extension whitelist: `.mp4`, `.mov`, `.webm`
   - Dangerous extension detection
   - Case-insensitive validation

2. **File Size Validation**
   - Minimum: 100KB
   - Maximum: 50MB
   - User-friendly error messages with size conversion

3. **Duration Validation**
   - Minimum: 3 seconds
   - Maximum: 60 seconds
   - Precise boundary checking

4. **Security Validation**
   - Filename length limits
   - Dangerous character detection
   - Path traversal prevention
   - Empty filename detection

5. **Server Integration**
   - Pre-upload server validation
   - Graceful fallback if server unavailable
   - Error code propagation

## Configuration

### Server Configuration

**File**: `backend/config.py`

```python
# File size limits
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MIN_FILE_SIZE = 100 * 1024        # 100KB

# Duration limits
MIN_VIDEO_DURATION = 3.0   # seconds
MAX_VIDEO_DURATION = 60.0  # seconds

# Supported formats
ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/webm", "video/quicktime", "video/mov"
}

# Security limits
MAX_FILENAME_LENGTH = 255
FORBIDDEN_FILENAME_CHARS = {'<', '>', ':', '"', '|', '?', '*', '\0'}
```

### Client Configuration

**File**: `mobile/src/services/uploadService.ts`

```typescript
// File size limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_FILE_SIZE = 100 * 1024;       // 100KB

// Duration limits
const MIN_DURATION = 3;  // 3 seconds
const MAX_DURATION = 60; // 60 seconds

// Allowed extensions
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
```

## Error Codes

### Client Error Codes

- `MISSING_FILENAME`: Filename is empty or missing
- `FILENAME_TOO_LONG`: Filename exceeds 255 characters
- `INVALID_FILENAME_CHARS`: Filename contains forbidden characters
- `INVALID_EXTENSION`: Invalid or dangerous file extension
- `FILE_TOO_LARGE`: File exceeds maximum size limit
- `FILE_TOO_SMALL`: File below minimum size limit
- `DURATION_TOO_SHORT`: Video duration below minimum
- `DURATION_TOO_LONG`: Video duration exceeds maximum

### Server Error Codes

- `VALIDATION_FAILED`: General validation failure
- `INVALID_EXTENSION`: Invalid file extension
- `INVALID_MIME_TYPE`: Unsupported MIME type
- `FILE_TOO_LARGE`: File size exceeds limit
- `FILE_TOO_SMALL`: File size below minimum
- `SERVER_VALIDATION_FAILED`: Server-side validation error

## API Endpoints

### POST /api/v1/media/validate

Validates video file before upload.

**Parameters**:
- `filename` (required): Video filename
- `file_size` (required): File size in bytes
- `duration_seconds` (optional): Video duration
- `mime_type` (optional): MIME type (auto-detected if not provided)

**Response**:
```json
{
  "valid": true,
  "mime_type": "video/mp4",
  "file_extension": ".mp4",
  "validation_details": {
    "filename": "video.mp4",
    "file_size": 5242880,
    "duration": 15.0
  },
  "validation_timestamp": "2024-01-01T12:00:00Z",
  "user_id": "user123"
}
```

**Error Response**:
```json
{
  "valid": false,
  "error": "File too large (50MB). Max size: 50MB",
  "error_code": "FILE_TOO_LARGE",
  "details": {
    "file_size": 52428800,
    "max_size": 52428800
  }
}
```

## Testing

### Server Tests

**File**: `backend/tests/test_strict_validation.py`

**Coverage**:
- Filename security validation
- File size boundary testing
- Duration validation
- MIME type validation
- Metadata validation
- Video specification validation
- End-to-end validation flow

### Client Tests

**File**: `mobile/src/services/__tests__/uploadServiceValidation.test.ts`

**Coverage**:
- File extension validation
- File size validation
- Duration validation
- Filename security
- MIME type detection
- Integration scenarios
- Boundary condition testing

### Test Execution

**Server**:
```bash
cd backend
python test_validation_runner.py
```

**Client**:
```bash
cd mobile
npm test src/services/__tests__/uploadServiceValidation.test.ts
```

## Security Considerations

### Implemented Protections

1. **Path Traversal Prevention**
   - Blocks `../`, `\`, and absolute paths
   - Validates filename components

2. **Executable File Detection**
   - Blocks dangerous extensions (.exe, .bat, .cmd, etc.)
   - Whitelist-based approach for allowed formats

3. **Content Validation**
   - MIME type verification
   - File signature validation (planned)
   - Metadata sanitization

4. **Resource Protection**
   - File size limits prevent DoS attacks
   - Duration limits prevent excessive processing
   - Rate limiting on validation endpoints

### Future Enhancements

1. **File Signature Validation**
   - Magic number verification
   - Content-based format detection

2. **Advanced Metadata Analysis**
   - EXIF data sanitization
   - Embedded content scanning

3. **Content Scanning**
   - Malware detection integration
   - Content moderation hooks

## Performance Considerations

### Optimization Strategies

1. **Client-Side First**
   - Validate on client before server request
   - Reduce server load and network traffic

2. **Efficient Validation**
   - Early exit on first failure
   - Cached validation results

3. **Async Processing**
   - Non-blocking validation operations
   - Background validation for large files

### Monitoring

- Validation success/failure rates
- Common validation errors
- Performance metrics
- Security incident tracking

## Integration Points

### Upload Flow Integration

1. **Pre-Upload Validation**
   - Client validates before compression
   - Server validates before processing

2. **Upload Session Creation**
   - Validation results stored with session
   - Failed validation prevents session creation

3. **Challenge Creation**
   - Validation results checked during challenge creation
   - Invalid media prevents challenge publishing

### Error Handling

1. **User-Friendly Messages**
   - Clear error descriptions
   - Actionable guidance for fixes

2. **Developer Information**
   - Detailed error codes
   - Validation context in logs

3. **Graceful Degradation**
   - Fallback validation if advanced features fail
   - Progressive enhancement approach

## Conclusion

The strict validation system provides comprehensive protection against invalid, malicious, and inappropriate file uploads while maintaining a smooth user experience. The dual client/server validation approach ensures both performance and security, with extensive testing coverage and clear error reporting.

The implementation successfully addresses the requirement to "Enforce strict server/client validation (file format, size, duration) before acceptance" with a robust, secure, and user-friendly solution.