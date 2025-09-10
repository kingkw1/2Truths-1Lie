# CDN Integration Guide

## Overview

This guide covers the implementation of Content Delivery Network (CDN) integration with signed URL support for global scalable delivery of media content.

## Features

### 1. Global CDN Delivery
- **CloudFront Integration**: Native AWS CloudFront support for global content delivery
- **Edge Location Optimization**: Automatic routing to optimal edge locations based on user geography
- **Cache Control**: Configurable cache policies for different content types and devices

### 2. Signed URL Security
- **CloudFront Signed URLs**: Secure access control with expiration times
- **IP Restriction**: Optional IP-based access restrictions
- **User Agent Filtering**: Device-specific access controls

### 3. Device Optimization
- **Mobile Optimization**: Reduced cache times and optimized formats for mobile devices
- **Desktop Optimization**: Extended cache times for desktop browsers
- **Adaptive Streaming**: Format recommendations based on client capabilities

### 4. Cache Management
- **Selective Invalidation**: Invalidate specific media files from CDN cache
- **Bulk Operations**: Batch invalidation for multiple files
- **Analytics Integration**: CDN performance metrics and usage statistics

## Configuration

### Environment Variables

```bash
# CDN Configuration
CDN_BASE_URL=https://d123456789.cloudfront.net
CDN_DISTRIBUTION_ID=E123456789ABCD
CDN_PRIVATE_KEY_PATH=/path/to/cloudfront-private-key.pem
CDN_KEY_PAIR_ID=KEYPAIRID123
ENABLE_GLOBAL_CDN=true

# Cache Settings
CDN_CACHE_CONTROL=public, max-age=86400
CDN_SIGNED_URL_EXPIRY=7200

# Edge Locations
CDN_EDGE_LOCATIONS=["us-east-1", "eu-west-1", "ap-southeast-1"]
```

### CloudFront Setup

1. **Create CloudFront Distribution**:
   ```bash
   aws cloudfront create-distribution --distribution-config file://distribution-config.json
   ```

2. **Generate Key Pair**:
   ```bash
   openssl genrsa -out cloudfront-private-key.pem 2048
   openssl rsa -in cloudfront-private-key.pem -pubout -out cloudfront-public-key.pem
   ```

3. **Upload Public Key to CloudFront**:
   ```bash
   aws cloudfront create-public-key --public-key-config file://public-key-config.json
   ```

## API Endpoints

### Generate CDN Signed URL
```http
POST /api/v1/media/cdn/signed-url/{media_id}
Content-Type: application/json

{
  "expires_in": 7200
}
```

**Response**:
```json
{
  "signed_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=...",
  "expires_in": 7200,
  "expires_at": "2024-01-01T12:00:00Z",
  "cloud_key": "media/user123/video456/video.mp4",
  "delivery_type": "cdn_signed",
  "optimization": {
    "cdn_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4",
    "cache_control": "public, max-age=43200",
    "optimizations": ["mobile_cache_optimization", "mobile_user_agent_detected"]
  },
  "supports_range": true,
  "global_delivery": true
}
```

### Get Optimized Streaming URL
```http
GET /api/v1/media/optimized/{media_id}?device_type=mobile&prefer_signed=true
```

**Response**:
```json
{
  "streaming_url": "https://d123456789.cloudfront.net/media/user123/video456/video.mp4?Policy=...",
  "delivery_type": "cdn_signed",
  "optimization": {
    "suggested_formats": ["video/mp4", "video/webm"],
    "cache_control": "public, max-age=43200"
  },
  "global_delivery": true
}
```

### Invalidate CDN Cache
```http
POST /api/v1/media/cdn/invalidate/{media_id}
Authorization: Bearer {admin_token}
```

**Response**:
```json
{
  "message": "CDN cache invalidated for media video456",
  "media_id": "video456",
  "invalidated_at": "2024-01-01T12:00:00Z"
}
```

### CDN Health Check
```http
GET /api/v1/media/cdn/health
```

**Response**:
```json
{
  "cdn_configured": true,
  "cdn_enabled": true,
  "distribution_id": true,
  "private_key_configured": true,
  "key_pair_configured": true,
  "signed_urls_available": true,
  "cloud_storage_enabled": true,
  "overall_status": "healthy",
  "distribution_status": "Deployed",
  "distribution_enabled": true,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Usage Examples

### Client-Side Implementation

```javascript
// Get optimized streaming URL
async function getOptimizedVideo(mediaId) {
  const response = await fetch(`/api/v1/media/optimized/${mediaId}?device_type=mobile`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  
  if (result.global_delivery) {
    console.log('Using CDN delivery:', result.streaming_url);
  } else {
    console.log('Using direct delivery:', result.streaming_url);
  }
  
  return result.streaming_url;
}

// Generate signed URL for sharing
async function generateSignedUrl(mediaId, expiresIn = 7200) {
  const response = await fetch(`/api/v1/media/cdn/signed-url/${mediaId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ expires_in: expiresIn })
  });
  
  return await response.json();
}
```

### Mobile App Integration

```typescript
interface OptimizedStreamingResult {
  streaming_url: string;
  delivery_type: 'cdn_signed' | 'cdn_public' | 'direct';
  global_delivery: boolean;
  optimization?: {
    suggested_formats: string[];
    cache_control: string;
  };
}

class MediaService {
  async getOptimizedStreamingUrl(
    mediaId: string, 
    deviceType: 'mobile' | 'tablet' | 'desktop' = 'mobile'
  ): Promise<OptimizedStreamingResult> {
    const response = await this.apiClient.get(
      `/media/optimized/${mediaId}?device_type=${deviceType}`
    );
    
    return response.data;
  }
  
  async playVideo(mediaId: string) {
    const streamingInfo = await this.getOptimizedStreamingUrl(mediaId);
    
    // Use native video player with optimized URL
    const videoPlayer = new VideoPlayer({
      url: streamingInfo.streaming_url,
      supportedFormats: streamingInfo.optimization?.suggested_formats || ['video/mp4'],
      cachePolicy: streamingInfo.optimization?.cache_control
    });
    
    return videoPlayer.play();
  }
}
```

## Performance Benefits

### 1. Global Delivery
- **Reduced Latency**: Content served from edge locations closest to users
- **Improved Throughput**: CDN edge servers optimized for media delivery
- **Bandwidth Optimization**: Automatic compression and format optimization

### 2. Caching Strategy
- **Mobile Devices**: 12-hour cache for frequent access patterns
- **Desktop Browsers**: 24-hour cache for extended sessions
- **Range Requests**: Efficient video seeking and progressive download

### 3. Security Features
- **Signed URLs**: Time-limited access with cryptographic signatures
- **IP Restrictions**: Optional geographic or network-based access control
- **Secure Headers**: CORS and security headers for cross-origin access

## Monitoring and Analytics

### CDN Statistics
```http
GET /api/v1/media/cdn/stats
Authorization: Bearer {admin_token}
```

**Metrics Available**:
- Request count and bandwidth usage
- Cache hit/miss ratios
- Geographic distribution of requests
- Error rates and response times
- Top content and referrers

### Health Monitoring
- **Distribution Status**: Monitor CloudFront distribution health
- **Certificate Validity**: SSL certificate expiration tracking
- **Edge Location Performance**: Per-region performance metrics

## Troubleshooting

### Common Issues

1. **Signed URLs Not Working**:
   - Verify private key file exists and is readable
   - Check key pair ID matches CloudFront configuration
   - Ensure distribution is deployed and enabled

2. **Cache Not Invalidating**:
   - Verify CloudFront permissions for invalidation
   - Check invalidation patterns match actual file paths
   - Monitor invalidation status in CloudFront console

3. **Performance Issues**:
   - Review cache hit ratios in CloudFront metrics
   - Optimize cache behaviors for different content types
   - Consider price class adjustments for global coverage

### Debug Commands

```bash
# Test CDN health
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/media/cdn/health

# Generate test signed URL
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expires_in": 3600}' \
  http://localhost:8000/api/v1/media/cdn/signed-url/test-media-id

# Check optimized delivery
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/media/optimized/test-media-id?device_type=mobile"
```

## Security Considerations

1. **Private Key Security**: Store CloudFront private keys securely with restricted access
2. **Signed URL Expiration**: Use appropriate expiration times based on content sensitivity
3. **IP Restrictions**: Implement IP-based restrictions for sensitive content
4. **HTTPS Only**: Ensure all CDN URLs use HTTPS for secure delivery
5. **Access Logging**: Enable CloudFront access logs for security monitoring

## Cost Optimization

1. **Price Classes**: Choose appropriate CloudFront price class based on global requirements
2. **Cache Policies**: Optimize cache durations to reduce origin requests
3. **Compression**: Enable automatic compression for bandwidth savings
4. **Regional Restrictions**: Use geographic restrictions to limit unnecessary traffic

This CDN integration provides enterprise-grade global delivery capabilities while maintaining security and performance optimization for all device types.