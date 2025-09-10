<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Media Processing Monitoring and Logging System

## Overview

This document describes the comprehensive monitoring and logging system implemented for media processing failures and system health in the 2Truths-1Lie backend.

## Components

### 1. Monitoring Service (`services/monitoring_service.py`)

The core monitoring service that tracks media processing operations, system metrics, and generates alerts.

#### Key Features:
- **Processing Metrics**: Tracks each stage of video processing (upload, analysis, preparation, merging, compression, storage upload, cleanup)
- **System Metrics**: Monitors CPU, memory, and disk usage
- **Alert System**: Creates alerts for failures, performance issues, and system resource problems
- **Background Monitoring**: Continuous monitoring of system health and stuck sessions

#### Usage:
```python
from services.monitoring_service import media_monitor, ProcessingStage

# Start tracking a processing stage
await media_monitor.start_processing(
    session_id="video_session_123",
    user_id="user_456", 
    stage=ProcessingStage.ANALYSIS
)

# Complete the processing stage
await media_monitor.complete_processing(
    session_id="video_session_123",
    stage=ProcessingStage.ANALYSIS,
    success=True,
    file_size_bytes=5000000,
    video_count=3
)

# Log an error with full context
await media_monitor.log_processing_error(
    session_id="video_session_123",
    user_id="user_456",
    stage=ProcessingStage.COMPRESSION,
    error=exception_object,
    context={"additional": "context"}
)
```

### 2. Health Check Service (`services/health_check_service.py`)

Comprehensive health checks for all system components.

#### Health Checks:
- **System Resources**: CPU, memory, and disk usage
- **FFmpeg**: Availability and functionality
- **Cloud Storage**: Connectivity and access
- **Temp Directory**: Access and cleanup status
- **Processing Pipeline**: Recent error rates and performance
- **Monitoring System**: Alert status and data collection
- **Log Files**: Accessibility and size monitoring

#### Usage:
```python
from services.health_check_service import health_check_service

# Run all health checks
health_results = await health_check_service.run_all_checks()

# Check overall status
if health_results["overall_status"] == "critical":
    # Handle critical system issues
    pass
```

### 3. Logging Configuration (`logging_config.py`)

Centralized logging configuration with structured JSON logging.

#### Log Files:
- **`application.log`**: General application logs (rotating, 50MB max)
- **`media_processing.log`**: Media processing specific logs (rotating, 100MB max)
- **`errors.log`**: Error and critical logs only (rotating, 20MB max)
- **`performance.log`**: Performance warnings and slow operations (rotating, 20MB max)

#### Features:
- **Structured JSON Logging**: All logs are in JSON format for easy parsing
- **Log Rotation**: Automatic rotation when files reach size limits
- **Filtering**: Media processing filter for relevant logs
- **Performance Tracking**: Dedicated performance logger for slow operations

### 4. Monitoring API Endpoints (`api/monitoring_endpoints.py`)

REST API endpoints for accessing monitoring data.

#### Endpoints:

##### Health Check (Public)
```
GET /api/v1/monitoring/health
```
Returns basic system health status. Returns HTTP 503 if system is critical.

##### Detailed Health Check (Authenticated)
```
GET /api/v1/monitoring/health/detailed
```
Returns comprehensive health information including processing stats and recent alerts.

##### Processing Statistics
```
GET /api/v1/monitoring/stats?hours=24
```
Returns processing statistics for the specified time period.

##### Alerts
```
GET /api/v1/monitoring/alerts?level=error&limit=50
```
Returns recent alerts, optionally filtered by level.

##### System Metrics
```
GET /api/v1/monitoring/metrics/system?hours=24
```
Returns system resource metrics over time.

##### Active Sessions
```
GET /api/v1/monitoring/sessions/active
```
Returns currently active processing sessions.

##### Recent Logs
```
GET /api/v1/monitoring/logs/recent?lines=100&level=ERROR
```
Returns recent log entries from log files.

## Integration with Video Processing

The monitoring system is fully integrated with the video merge service:

### Processing Stage Tracking

Each stage of video processing is automatically tracked:

1. **Analysis**: Video file analysis and metadata extraction
2. **Preparation**: Video normalization and format preparation
3. **Merging**: Video concatenation and segment metadata calculation
4. **Compression**: Video compression with quality settings
5. **Storage Upload**: Upload to cloud storage and cleanup
6. **Cleanup**: Temporary file cleanup

### Error Handling

All errors are automatically logged with full context:
- Exception details and stack traces
- Processing stage and session information
- System metrics at time of failure
- User and session context

### Performance Monitoring

Slow operations are automatically detected and logged:
- Processing time thresholds per stage
- Memory and CPU usage tracking
- Alert generation for performance issues

## Alert System

### Alert Levels

- **INFO**: Informational messages
- **WARNING**: Issues that need attention but don't affect functionality
- **ERROR**: Processing failures and errors
- **CRITICAL**: System-wide issues that affect service availability

### Alert Types

1. **Processing Failures**: Failed video processing operations
2. **Performance Issues**: Slow processing times
3. **Resource Alerts**: High CPU, memory, or disk usage
4. **System Alerts**: FFmpeg issues, storage connectivity problems
5. **Stuck Sessions**: Long-running processing sessions

### Alert Metadata

Each alert includes:
- Timestamp and severity level
- Session and user information (if applicable)
- Processing stage (if applicable)
- Additional context and metadata
- Error codes and messages

## Configuration

### Monitoring Thresholds

Configure monitoring thresholds in the monitoring service:

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

### Log File Configuration

Configure log file settings in `logging_config.py`:

```python
# Log file sizes and rotation
app_handler = logging.handlers.RotatingFileHandler(
    app_log_file,
    maxBytes=50 * 1024 * 1024,  # 50MB
    backupCount=5
)
```

## Deployment Considerations

### Log Storage

- Log files are stored in `{TEMP_DIR}/logs/`
- Automatic rotation prevents disk space issues
- Consider log aggregation for production deployments

### Health Check Integration

- Use `/api/v1/monitoring/health` for load balancer health checks
- Returns HTTP 503 for critical system issues
- Cached results for performance (1-minute cache)

### Alerting Integration

For production deployments, consider integrating with external alerting systems:

1. **Log Aggregation**: Ship logs to ELK stack, Splunk, or similar
2. **Metrics Collection**: Export metrics to Prometheus, DataDog, etc.
3. **Alert Routing**: Route critical alerts to PagerDuty, Slack, etc.

### Performance Impact

The monitoring system is designed for minimal performance impact:
- Background monitoring runs every 5 minutes
- Health checks are cached for 1 minute
- Structured logging with minimal overhead
- Automatic cleanup of old metrics and logs

## Testing

### Test Scripts

1. **`test_monitoring_system.py`**: Tests all monitoring components
2. **`test_monitoring_integration.py`**: Tests integration with video processing

### Running Tests

```bash
# Test monitoring system
python backend/test_monitoring_system.py

# Test monitoring integration
python backend/test_monitoring_integration.py
```

### Test Coverage

Tests cover:
- Basic logging functionality
- Structured logging with extra fields
- Performance logging
- Media processing event logging
- System alert logging
- Processing metrics tracking
- Error handling and context logging
- Alert creation and filtering
- Statistics collection
- Health check functionality
- Log file creation and rotation

## Troubleshooting

### Common Issues

1. **Missing Log Files**: Check `TEMP_DIR` permissions and disk space
2. **High Memory Usage**: Monitor system metrics and adjust thresholds
3. **Stuck Sessions**: Check for long-running processes and resource constraints
4. **FFmpeg Issues**: Verify FFmpeg installation and PATH configuration

### Debug Information

Use the monitoring endpoints to gather debug information:

```bash
# Check system health
curl http://localhost:8000/api/v1/monitoring/health

# Get detailed health information
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/health/detailed

# Check recent alerts
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/alerts?level=error

# View processing statistics
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/v1/monitoring/stats?hours=24
```

### Log Analysis

Log files are in JSON format for easy parsing:

```bash
# View recent errors
tail -f temp/logs/errors.log | jq '.'

# Filter media processing logs
grep "media_processing" temp/logs/application.log | jq '.'

# Check performance issues
tail -f temp/logs/performance.log | jq '.'
```

## Security Considerations

- All monitoring endpoints (except basic health check) require authentication
- Log files may contain sensitive information - secure appropriately
- Health check endpoint is public for load balancer integration
- Consider rate limiting for monitoring endpoints in production

## Future Enhancements

1. **Metrics Export**: Export metrics to external monitoring systems
2. **Custom Dashboards**: Create monitoring dashboards for operations teams
3. **Predictive Alerting**: Machine learning-based anomaly detection
4. **Distributed Tracing**: Add request tracing across service boundaries
5. **Real-time Notifications**: WebSocket-based real-time alert notifications