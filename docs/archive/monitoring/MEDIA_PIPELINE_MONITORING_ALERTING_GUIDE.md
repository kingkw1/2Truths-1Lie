<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Media Pipeline Monitoring and Alerting Guide

## Overview

This document provides comprehensive guidance for monitoring and alerting processes for the media processing pipeline in the 2Truths-1Lie application. The monitoring system tracks video processing operations, system health, and provides real-time alerting for issues that require attention.

## Architecture

### Core Components

1. **Monitoring Service** (`services/monitoring_service.py`)
   - Tracks processing metrics for each stage of video processing
   - Monitors system resources (CPU, memory, disk)
   - Generates alerts based on configurable thresholds
   - Provides background monitoring for system health

2. **Health Check Service** (`services/health_check_service.py`)
   - Performs comprehensive health checks across all system components
   - Validates FFmpeg availability and functionality
   - Checks cloud storage connectivity
   - Monitors temporary directory health

3. **Logging System** (`logging_config.py`)
   - Structured JSON logging for all media processing operations
   - Separate log files for different types of events
   - Automatic log rotation to prevent disk space issues

4. **Monitoring API** (`api/monitoring_endpoints.py`)
   - REST endpoints for accessing monitoring data
   - Health check endpoints for load balancers
   - Administrative functions for alert management

## Processing Stage Monitoring

### Tracked Stages

The system monitors the following video processing stages:

1. **UPLOAD** - Initial video file upload and validation
2. **ANALYSIS** - Video metadata extraction and analysis
3. **PREPARATION** - Video normalization and format preparation
4. **MERGING** - Video concatenation and segment calculation
5. **COMPRESSION** - Video compression with quality settings
6. **STORAGE_UPLOAD** - Upload to cloud storage
7. **CLEANUP** - Temporary file cleanup

### Metrics Collected

For each processing stage, the following metrics are collected:

- **Timing**: Start time, end time, duration
- **Success/Failure**: Processing outcome and error details
- **Resource Usage**: Memory and CPU usage during processing
- **File Information**: File sizes, video count, metadata
- **User Context**: User ID and session information

### Usage Example

```python
from services.monitoring_service import media_monitor, ProcessingStage

# Start monitoring a processing stage
await media_monitor.start_processing(
    session_id="video_session_123",
    user_id="user_456",
    stage=ProcessingStage.MERGING,
    metadata={"video_count": 3, "total_size_mb": 45.2}
)

# Complete the processing stage
await media_monitor.complete_processing(
    session_id="video_session_123",
    stage=ProcessingStage.MERGING,
    success=True,
    file_size_bytes=15728640,  # Final merged video size
    video_count=3
)
```

## Alert System

### Alert Levels

The system uses four alert levels with increasing severity:

1. **INFO** - Informational messages and normal operations
2. **WARNING** - Issues that need attention but don't affect functionality
3. **ERROR** - Processing failures and recoverable errors
4. **CRITICAL** - System-wide issues affecting service availability

### Alert Types

#### Processing Alerts
- **Processing Failures**: Failed video processing operations
- **Performance Issues**: Processing times exceeding thresholds
- **Stuck Sessions**: Long-running processing sessions (>30 minutes)

#### System Alerts
- **Resource Alerts**: High CPU (>80%), memory (>80%), or disk usage (>90%)
- **FFmpeg Issues**: FFmpeg unavailability or functionality problems
- **Storage Issues**: Cloud storage connectivity problems
- **Log File Issues**: Log file size or accessibility problems

#### Threshold Configuration

Default alert thresholds (configurable in `monitoring_service.py`):

```python
# Error rate threshold (10%)
self.error_rate_threshold = 0.1

# Processing time threshold (5 minutes)
self.processing_time_threshold = 300

# Memory usage threshold (80%)
self.memory_threshold = 80

# Disk usage threshold (90%)
self.disk_threshold = 90
```

### Alert Metadata

Each alert includes comprehensive metadata:

```json
{
  "id": "alert_1640995200_123",
  "level": "error",
  "title": "Processing Failed: merging",
  "message": "Session video_session_123 failed at merging: FFmpeg process failed",
  "timestamp": "2023-12-31T23:59:59Z",
  "session_id": "video_session_123",
  "user_id": "user_456",
  "stage": "merging",
  "metadata": {
    "error_code": "FFMPEG_FAILED",
    "duration_seconds": 45.2,
    "memory_usage_mb": 512.3
  }
}
```

## Health Monitoring

### System Health Checks

The health check system performs comprehensive validation of all system components:

#### 1. System Resources
- **CPU Usage**: Monitors current CPU utilization
- **Memory Usage**: Tracks available memory and usage percentage
- **Disk Usage**: Monitors disk space for temporary directory
- **Thresholds**: Warning at 80%, Critical at 95%

#### 2. FFmpeg Availability
- **Version Check**: Validates FFmpeg installation and version
- **Functionality Test**: Ensures FFmpeg can be executed
- **Timeout Handling**: 10-second timeout for FFmpeg checks

#### 3. Cloud Storage Connectivity
- **Connection Test**: Validates cloud storage access
- **Bucket Access**: Tests read/write permissions
- **Regional Connectivity**: Verifies connection to specified region

#### 4. Temporary Directory Health
- **Write Access**: Tests file creation and deletion
- **Size Monitoring**: Tracks temporary directory size
- **Old File Detection**: Identifies files older than 24 hours

#### 5. Processing Pipeline Health
- **Error Rate Analysis**: Monitors recent processing error rates
- **Performance Metrics**: Tracks average processing times
- **Active Session Monitoring**: Identifies stuck or long-running sessions

#### 6. Log File Health
- **File Accessibility**: Ensures log files can be read/written
- **Size Monitoring**: Tracks log file sizes and rotation
- **Directory Structure**: Validates log directory structure

### Health Check API

```bash
# Basic health check (public, for load balancers)
curl http://localhost:8000/api/v1/monitoring/health

# Detailed health check (authenticated)
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/health/detailed
```

Response format:
```json
{
  "overall_status": "healthy",
  "timestamp": "2023-12-31T23:59:59Z",
  "total_check_time_ms": 245.7,
  "checks": [
    {
      "component": "system_resources",
      "status": "healthy",
      "message": "System resources healthy",
      "details": {
        "cpu_usage_percent": 15.2,
        "memory_usage_percent": 45.8,
        "disk_usage_percent": 23.1
      },
      "response_time_ms": 12.3
    }
  ],
  "summary": {
    "total_checks": 7,
    "healthy": 6,
    "warning": 1,
    "critical": 0
  }
}
```

## Logging System

### Log Files

The system maintains separate log files for different types of events:

#### 1. Application Log (`application.log`)
- **Content**: General application events and operations
- **Format**: Structured JSON logging
- **Rotation**: 50MB max size, 5 backup files
- **Level**: INFO and above

#### 2. Media Processing Log (`media_processing.log`)
- **Content**: Media processing specific events
- **Format**: Structured JSON with processing context
- **Rotation**: 100MB max size, 10 backup files
- **Level**: DEBUG and above (for media processing modules)

#### 3. Error Log (`errors.log`)
- **Content**: Error and critical events only
- **Format**: Structured JSON with full error context
- **Rotation**: 20MB max size, 5 backup files
- **Level**: ERROR and above

#### 4. Performance Log (`performance.log`)
- **Content**: Performance warnings and slow operations
- **Format**: Structured JSON with timing information
- **Rotation**: 20MB max size, 3 backup files
- **Level**: WARNING and above (performance-specific)

### Log Structure

All logs use structured JSON format for easy parsing and analysis:

```json
{
  "timestamp": "2023-12-31T23:59:59.123Z",
  "level": "INFO",
  "logger": "services.video_merge_service",
  "message": "Video merge completed successfully",
  "module": "video_merge_service",
  "function": "merge_videos",
  "line": 245,
  "process_id": 12345,
  "thread_id": 67890,
  "extra": {
    "session_id": "video_session_123",
    "user_id": "user_456",
    "stage": "merging",
    "duration_seconds": 23.4,
    "file_size_bytes": 15728640,
    "video_count": 3
  }
}
```

### Log Analysis

#### Viewing Recent Logs
```bash
# View recent media processing logs
tail -f temp/logs/media_processing.log | jq '.'

# Filter by log level
grep '"level":"ERROR"' temp/logs/application.log | jq '.'

# View performance issues
tail -f temp/logs/performance.log | jq '.'
```

#### Log Queries
```bash
# Find all processing failures for a specific user
grep '"user_id":"user_456"' temp/logs/media_processing.log | \
grep '"level":"ERROR"' | jq '.'

# Find slow processing operations
grep '"duration_seconds"' temp/logs/performance.log | \
jq 'select(.extra.duration_seconds > 60)'

# Monitor real-time processing events
tail -f temp/logs/media_processing.log | \
grep '"event_type":"processing"' | jq '.'
```

## Monitoring API Endpoints

### Authentication

All monitoring endpoints (except basic health check) require authentication:

```bash
# Get authentication token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/stats
```

### Available Endpoints

#### 1. Health Check
```bash
# Basic health (public)
GET /api/v1/monitoring/health

# Detailed health (authenticated)
GET /api/v1/monitoring/health/detailed
```

#### 2. Processing Statistics
```bash
# Get processing stats for last 24 hours
GET /api/v1/monitoring/stats?hours=24

# Get stats for last week
GET /api/v1/monitoring/stats?hours=168
```

Response includes:
- Total operations and success/failure counts
- Success and error rates
- Average processing duration
- Stage-by-stage breakdown
- Error code breakdown

#### 3. Alert Management
```bash
# Get all recent alerts
GET /api/v1/monitoring/alerts?limit=50

# Filter by alert level
GET /api/v1/monitoring/alerts?level=error&limit=25

# Get critical alerts only
GET /api/v1/monitoring/alerts?level=critical
```

#### 4. System Metrics
```bash
# Get system metrics for last 24 hours
GET /api/v1/monitoring/metrics/system?hours=24
```

Returns time-series data for:
- CPU usage percentage
- Memory usage percentage
- Disk usage percentage
- Active processing sessions
- Temporary directory size

#### 5. Active Sessions
```bash
# Get currently active processing sessions
GET /api/v1/monitoring/sessions/active
```

Shows:
- Session ID and user information
- Current processing stage
- Duration and resource usage
- Start time and elapsed time

#### 6. Recent Logs
```bash
# Get recent log entries
GET /api/v1/monitoring/logs/recent?lines=100

# Filter by log level
GET /api/v1/monitoring/logs/recent?lines=50&level=ERROR
```

#### 7. Administrative Functions
```bash
# Create test alert
POST /api/v1/monitoring/test/alert?level=warning

# Clear all alerts (admin)
DELETE /api/v1/monitoring/alerts

# Cleanup old monitoring data (admin)
POST /api/v1/monitoring/cleanup
```

## Operational Procedures

### Daily Monitoring Tasks

#### 1. System Health Review
```bash
# Check overall system health
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/health/detailed

# Review processing statistics
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/stats?hours=24
```

#### 2. Alert Review
```bash
# Check for critical alerts
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/alerts?level=critical

# Review error alerts
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/alerts?level=error&limit=20
```

#### 3. Performance Analysis
```bash
# Check for slow operations
tail -100 temp/logs/performance.log | jq '.'

# Review system resource usage
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/metrics/system?hours=24
```

### Weekly Maintenance Tasks

#### 1. Log File Management
```bash
# Check log file sizes
ls -lh temp/logs/

# Archive old logs if needed
tar -czf logs_backup_$(date +%Y%m%d).tar.gz temp/logs/*.log.1 temp/logs/*.log.2

# Clean up old archived logs
find temp/logs/ -name "*.log.*" -mtime +30 -delete
```

#### 2. Monitoring Data Cleanup
```bash
# Clean up old monitoring data
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/cleanup
```

#### 3. Performance Review
```bash
# Generate weekly processing report
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/stats?hours=168 > weekly_report.json

# Analyze error patterns
grep '"level":"ERROR"' temp/logs/media_processing.log | \
jq -r '.extra.error_code' | sort | uniq -c | sort -nr
```

### Incident Response Procedures

#### 1. Critical System Issues

When system health shows "critical" status:

1. **Immediate Assessment**
   ```bash
   # Check detailed health status
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/v1/monitoring/health/detailed
   
   # Check recent critical alerts
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/v1/monitoring/alerts?level=critical&limit=10
   ```

2. **Resource Issues**
   - High CPU: Check for runaway processes, consider scaling
   - High Memory: Review active sessions, restart if necessary
   - High Disk: Clean temporary files, check log rotation

3. **Service Issues**
   - FFmpeg Problems: Verify installation, check PATH
   - Storage Issues: Verify credentials, check network connectivity
   - Processing Failures: Review error logs, check input validation

#### 2. High Error Rates

When processing error rate exceeds 10%:

1. **Error Analysis**
   ```bash
   # Get recent error breakdown
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/v1/monitoring/stats?hours=1
   
   # Review error logs
   grep '"level":"ERROR"' temp/logs/media_processing.log | tail -20 | jq '.'
   ```

2. **Common Error Patterns**
   - FFMPEG_FAILED: Check FFmpeg installation and video formats
   - STORAGE_UPLOAD_FAILED: Verify cloud storage credentials
   - VALIDATION_FAILED: Review input validation rules
   - TIMEOUT_ERROR: Check processing timeouts and system resources

#### 3. Performance Degradation

When average processing time exceeds thresholds:

1. **Performance Analysis**
   ```bash
   # Check active sessions
   curl -H "Authorization: Bearer <token>" \
        http://localhost:8000/api/v1/monitoring/sessions/active
   
   # Review performance logs
   tail -50 temp/logs/performance.log | jq '.'
   ```

2. **Optimization Actions**
   - Review system resources and scaling
   - Check for stuck or long-running sessions
   - Analyze processing stage bottlenecks
   - Consider adjusting processing parameters

### Alerting Integration

#### External Monitoring Systems

For production deployments, integrate with external monitoring:

1. **Log Aggregation**
   - Ship logs to ELK Stack, Splunk, or similar
   - Set up log-based alerts and dashboards
   - Configure log retention policies

2. **Metrics Collection**
   - Export metrics to Prometheus, DataDog, or CloudWatch
   - Create custom dashboards for operations teams
   - Set up automated alerting rules

3. **Notification Systems**
   - Route critical alerts to PagerDuty, OpsGenie
   - Send notifications to Slack, Teams, or email
   - Configure escalation policies

#### Sample Integration Scripts

```bash
# Example: Send critical alerts to Slack
#!/bin/bash
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Get critical alerts
ALERTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
         "http://localhost:8000/api/v1/monitoring/alerts?level=critical&limit=5")

if [ $(echo "$ALERTS" | jq '.alerts | length') -gt 0 ]; then
    MESSAGE="🚨 Critical alerts detected in media processing pipeline"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\", \"attachments\":[{\"text\":\"$(echo $ALERTS | jq -c .)\"}]}" \
         $WEBHOOK_URL
fi
```

## Configuration Management

### Environment Variables

Key configuration options for monitoring:

```bash
# Monitoring thresholds
MONITORING_ERROR_RATE_THRESHOLD=0.1
MONITORING_PROCESSING_TIME_THRESHOLD=300
MONITORING_MEMORY_THRESHOLD=80
MONITORING_DISK_THRESHOLD=90

# Log configuration
LOG_LEVEL=INFO
LOG_ROTATION_SIZE=50MB
LOG_BACKUP_COUNT=5

# Health check configuration
HEALTH_CHECK_CACHE_DURATION=60
HEALTH_CHECK_TIMEOUT=10

# Alert configuration
ALERT_RETENTION_COUNT=500
METRICS_RETENTION_HOURS=24
```

### Customization

#### Adjusting Thresholds

Modify thresholds in `services/monitoring_service.py`:

```python
class MediaProcessingMonitor:
    def __init__(self):
        # Customize these values based on your environment
        self.error_rate_threshold = float(os.getenv('MONITORING_ERROR_RATE_THRESHOLD', '0.1'))
        self.processing_time_threshold = int(os.getenv('MONITORING_PROCESSING_TIME_THRESHOLD', '300'))
        self.memory_threshold = int(os.getenv('MONITORING_MEMORY_THRESHOLD', '80'))
        self.disk_threshold = int(os.getenv('MONITORING_DISK_THRESHOLD', '90'))
```

#### Custom Alert Types

Add custom alert types by extending the monitoring service:

```python
async def create_custom_alert(self, alert_type: str, **context):
    """Create custom alert type"""
    await self._create_alert(
        level=AlertLevel.WARNING,
        title=f"Custom Alert: {alert_type}",
        message=f"Custom alert triggered: {alert_type}",
        metadata={
            "alert_type": alert_type,
            "custom_context": context
        }
    )
```

## Security Considerations

### Access Control

1. **Authentication Required**: All monitoring endpoints (except basic health) require authentication
2. **Role-Based Access**: Consider implementing role-based access for administrative functions
3. **API Rate Limiting**: Implement rate limiting for monitoring endpoints
4. **Audit Logging**: Log all monitoring API access and administrative actions

### Data Protection

1. **Sensitive Information**: Ensure logs don't contain sensitive user data
2. **Log Encryption**: Consider encrypting log files at rest
3. **Access Logs**: Monitor access to monitoring endpoints
4. **Data Retention**: Implement appropriate data retention policies

### Network Security

1. **Internal Access**: Restrict monitoring endpoints to internal networks
2. **TLS Encryption**: Use HTTPS for all monitoring API access
3. **Firewall Rules**: Configure appropriate firewall rules for monitoring ports
4. **VPN Access**: Require VPN access for external monitoring

## Troubleshooting Guide

### Common Issues

#### 1. Monitoring Service Not Starting
```bash
# Check service logs
grep "monitoring_service" temp/logs/application.log | tail -20

# Verify dependencies
python -c "import psutil, asyncio; print('Dependencies OK')"

# Check background task status
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/health/detailed
```

#### 2. Missing Metrics Data
```bash
# Check if monitoring is collecting data
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/stats?hours=1

# Verify background monitoring
ps aux | grep python | grep monitoring

# Check for errors in logs
grep "monitoring" temp/logs/errors.log
```

#### 3. Alert System Not Working
```bash
# Test alert creation
curl -X POST -H "Authorization: Bearer <token>" \
     "http://localhost:8000/api/v1/monitoring/test/alert?level=info"

# Check alert storage
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/alerts?limit=5

# Verify alert thresholds
grep "threshold" backend/services/monitoring_service.py
```

#### 4. Health Checks Failing
```bash
# Run individual health checks
python -c "
from services.health_check_service import health_check_service
import asyncio
result = asyncio.run(health_check_service._check_system_resources())
print(result)
"

# Check FFmpeg availability
ffmpeg -version

# Test cloud storage connectivity
python -c "
from services.cloud_storage_service import create_cloud_storage_service
from config import settings
# Test connection
"
```

### Performance Optimization

#### 1. Reduce Monitoring Overhead
- Adjust background monitoring frequency (default: 5 minutes)
- Limit metrics retention (default: 24 hours)
- Optimize health check caching (default: 1 minute)

#### 2. Log Management
- Implement log compression for archived files
- Use external log aggregation for high-volume environments
- Adjust log levels for production (INFO instead of DEBUG)

#### 3. Alert Optimization
- Fine-tune alert thresholds based on actual usage patterns
- Implement alert suppression for known issues
- Use alert correlation to reduce noise

## Best Practices

### Monitoring Strategy

1. **Proactive Monitoring**: Monitor trends and patterns, not just failures
2. **Comprehensive Coverage**: Monitor all stages of the processing pipeline
3. **Contextual Alerts**: Include relevant context in all alerts
4. **Regular Review**: Regularly review and adjust monitoring thresholds

### Alert Management

1. **Alert Fatigue Prevention**: Avoid too many low-priority alerts
2. **Clear Escalation**: Define clear escalation procedures for different alert levels
3. **Documentation**: Document common alert scenarios and responses
4. **Testing**: Regularly test alert mechanisms and response procedures

### Operational Excellence

1. **Regular Maintenance**: Perform regular maintenance tasks
2. **Capacity Planning**: Monitor trends for capacity planning
3. **Performance Baselines**: Establish performance baselines and track deviations
4. **Continuous Improvement**: Continuously improve monitoring based on operational experience

This comprehensive monitoring and alerting guide provides the foundation for maintaining a healthy and reliable media processing pipeline. Regular review and updates of these procedures will ensure continued effectiveness as the system evolves.