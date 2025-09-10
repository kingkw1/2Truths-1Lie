<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Cloud Storage Integration Guide

## Overview

This guide explains how to set up and use cloud storage integration for the media upload system. The system supports AWS S3 as the primary cloud storage provider with automatic fallback to local storage.

## Features

- **AWS S3 Integration**: Secure, scalable cloud storage for media files
- **Automatic Fallback**: Falls back to local storage if cloud storage fails
- **Signed URLs**: Secure, time-limited access to media files
- **Multipart Upload**: Efficient upload of large files (>100MB)
- **Migration Tools**: Migrate existing local files to cloud storage
- **CORS Support**: Automatic CORS configuration for web access
- **CDN Support**: Optional CloudFront or other CDN integration

## Configuration

### Environment Variables

Create a `.env` file in the backend directory with the following settings:

```bash
# Cloud Storage Configuration
USE_CLOUD_STORAGE=true
CLOUD_STORAGE_PROVIDER=s3

# AWS S3 Configuration
AWS_S3_BUCKET_NAME=your-media-bucket-name
AWS_S3_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key-id  # Optional if using IAM roles
# AWS_SECRET_ACCESS_KEY=your-secret-key  # Optional if using IAM roles

# CDN Configuration (Optional)
# CDN_BASE_URL=https://your-cloudfront-domain.com
SIGNED_URL_EXPIRY=3600
```

### AWS Setup

#### Option 1: IAM Roles (Recommended for EC2/ECS)

If running on AWS infrastructure, use IAM roles for authentication:

1. Create an IAM role with S3 permissions
2. Attach the role to your EC2 instance or ECS task
3. Leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty

#### Option 2: Access Keys

For local development or non-AWS environments:

1. Create an IAM user with programmatic access
2. Attach the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:GetBucketCors",
                "s3:PutBucketCors"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

3. Set the access keys in your `.env` file

### S3 Bucket Setup

The system will automatically:
- Create the bucket if it doesn't exist
- Configure CORS for web access
- Set appropriate cache headers

Manual bucket creation (optional):
```bash
aws s3 mb s3://your-media-bucket-name --region us-east-1
```

## Usage

### Upload Flow

1. **Initiate Upload**: Client calls `/api/v1/media/upload/initiate`
2. **Upload Chunks**: Client uploads file chunks to `/api/v1/media/upload/{session_id}/chunk/{chunk_number}`
3. **Complete Upload**: Client calls `/api/v1/media/upload/{session_id}/complete`
4. **Cloud Storage**: File is automatically uploaded to S3 and local copy is deleted
5. **Response**: Client receives streaming URL for the uploaded media

### Streaming

- **Cloud Storage**: Returns redirect to signed S3 URL for direct streaming
- **Local Fallback**: Streams directly from local storage if cloud unavailable
- **Range Support**: Supports HTTP range requests for video seeking

### API Endpoints

All existing media endpoints work transparently with cloud storage:

- `POST /api/v1/media/upload/initiate` - Initiate upload
- `POST /api/v1/media/upload/{session_id}/chunk/{chunk_number}` - Upload chunk
- `POST /api/v1/media/upload/{session_id}/complete` - Complete upload
- `GET /api/v1/media/stream/{media_id}` - Stream media (redirects to S3 for cloud storage)
- `GET /api/v1/media/info/{media_id}` - Get media information
- `DELETE /api/v1/media/delete/{media_id}` - Delete media

## Migration

### Migrate Existing Files

Use the migration service to move existing local files to cloud storage:

```bash
# Dry run to see what would be migrated
python -m services.migration_service --dry-run --user-id default

# Migrate all files
python -m services.migration_service --user-id default

# Migrate and delete local files after successful upload
python -m services.migration_service --user-id default --delete-local

# Verify migration for specific media
python -m services.migration_service --verify media-id-here --user-id default
```

### Migration Options

- `--user-id`: User ID to associate with migrated files (default: "unknown")
- `--dry-run`: Preview migration without actually uploading
- `--batch-size`: Number of files to process concurrently (default: 10)
- `--delete-local`: Delete local files after successful migration
- `--verify`: Verify migration for a specific media ID

## File Organization

Cloud storage files are organized as:
```
media/
├── {user_id}/
│   ├── {media_id}/
│   │   └── {original_filename}
```

Example:
```
media/
├── user123/
│   ├── abc-def-123/
│   │   └── challenge_video.mp4
│   └── xyz-789-456/
│       └── response_video.webm
```

## CDN Integration

### CloudFront Setup

1. Create a CloudFront distribution
2. Set S3 bucket as origin
3. Configure caching behaviors
4. Set `CDN_BASE_URL` in environment variables

Example CloudFront configuration:
- **Origin**: Your S3 bucket
- **Cache Behavior**: Cache based on headers
- **TTL**: 1 year for media files
- **Compress**: Enable for better performance

## Security

### Access Control

- All uploads require authentication
- Signed URLs expire after configured time (default: 1 hour)
- CORS configured for web access only
- Files are organized by user ID for access control

### Best Practices

1. **Use IAM roles** instead of access keys when possible
2. **Enable S3 bucket versioning** for data protection
3. **Set up S3 lifecycle policies** to manage storage costs
4. **Monitor S3 access logs** for security auditing
5. **Use CloudFront** for better performance and DDoS protection

## Monitoring

### Metrics to Monitor

- Upload success/failure rates
- Cloud storage vs local storage usage
- Signed URL generation frequency
- S3 API call costs
- CDN cache hit rates

### Logging

The system logs:
- Cloud storage initialization
- Upload successes/failures
- Fallback to local storage
- Migration progress
- File deletions

## Troubleshooting

### Common Issues

#### 1. Bucket Access Denied
```
Error: S3 bucket access error: Access Denied
```
**Solution**: Check IAM permissions and bucket policy

#### 2. Region Mismatch
```
Error: The bucket is in this region: us-west-2. Please use this region.
```
**Solution**: Update `AWS_S3_REGION` in configuration

#### 3. Credentials Not Found
```
Error: Unable to locate credentials
```
**Solution**: Set up IAM role or access keys properly

#### 4. Bucket Already Exists
```
Error: Bucket already exists and is owned by another account
```
**Solution**: Choose a different bucket name (must be globally unique)

### Fallback Behavior

The system automatically falls back to local storage when:
- Cloud storage initialization fails
- Upload to cloud storage fails
- Cloud storage service is unavailable

Files uploaded during fallback periods can be migrated later using the migration service.

## Performance Optimization

### Upload Performance

- Uses multipart upload for files >100MB
- Concurrent chunk uploads
- Automatic retry on failure
- Background upload support

### Streaming Performance

- Direct S3 streaming via signed URLs
- CDN integration for global distribution
- HTTP range request support
- Appropriate cache headers

### Cost Optimization

- Lifecycle policies for old files
- Intelligent tiering for infrequent access
- CloudFront for reduced S3 requests
- Compression for smaller files

## Development

### Local Development

For local development without AWS:
1. Set `USE_CLOUD_STORAGE=false`
2. System will use local storage only
3. All APIs work the same way

### Testing

Run integration tests:
```bash
python test_cloud_integration_simple.py
```

### Adding New Providers

To add support for other cloud providers:

1. Implement `CloudStorageService` interface
2. Add provider to `create_cloud_storage_service` factory
3. Update configuration settings
4. Add tests for new provider

## Support

For issues or questions:
1. Check logs for error details
2. Verify AWS credentials and permissions
3. Test with local storage first
4. Use migration tools for data recovery