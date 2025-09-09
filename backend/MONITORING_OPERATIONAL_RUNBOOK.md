# Media Pipeline Monitoring - Operational Runbook

## Quick Reference

### Emergency Contacts
- **System Administrator**: [Contact Information]
- **Development Team**: [Contact Information]
- **Infrastructure Team**: [Contact Information]

### Critical Endpoints
- **Health Check**: `GET /api/v1/monitoring/health`
- **Detailed Health**: `GET /api/v1/monitoring/health/detailed`
- **Critical Alerts**: `GET /api/v1/monitoring/alerts?level=critical`

### Log Locations
- **Application Logs**: `temp/logs/application.log`
- **Media Processing**: `temp/logs/media_processing.log`
- **Error Logs**: `temp/logs/errors.log`
- **Performance Logs**: `temp/logs/performance.log`

## Daily Operations Checklist

### Morning Health Check (5 minutes)

1. **System Health Status**
   ```bash
   curl -s http://localhost:8000/api/v1/monitoring/health | jq '.overall_status'
   ```
   - ✅ Expected: `"healthy"` or `"warning"`
   - ❌ Action Required: `"critical"` → Follow Critical System Response

2. **Processing Statistics (Last 24 Hours)**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/v1/monitoring/stats?hours=24 | \
        jq '{error_rate, success_rate, total_operations}'
   ```
   - ✅ Expected: Error rate < 10%, Success rate > 90%
   - ❌ Action Required: Error rate > 10% → Follow High Error Rate Response

3. **Critical Alerts Check**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/v1/monitoring/alerts?level=critical&limit=5 | \
        jq '.alerts | length'
   ```
   - ✅ Expected: 0 critical alerts
   - ❌ Action Required: > 0 critical alerts → Follow Critical Alert Response

4. **Active Sessions Review**
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/v1/monitoring/sessions/active | \
        jq '.total_active'
   ```
   - ✅ Expected: < 5 active sessions
   - ❌ Action Required: > 10 active sessions → Check for stuck processes

### Evening Summary Review (10 minutes)

1. **Daily Processing Summary**
   ```bash
   # Generate daily report
   curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/v1/monitoring/stats?hours=24 > daily_report_$(date +%Y%m%d).json
   
   # Review key metrics
   cat daily_report_$(date +%Y%m%d).json | jq '{
     total_operations,
     success_rate,
     error_rate,
     average_duration,
     stage_breakdown
   }'
   ```

2. **Error Pattern Analysis**
   ```bash
   # Check error patterns
   grep '"level":"ERROR"' temp/logs/media_processing.log | \
   jq -r '.extra.error_code // "UNKNOWN"' | sort | uniq -c | sort -nr
   ```

3. **Resource Usage Trends**
   ```bash
   # Check peak resource usage
   curl -s -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/v1/monitoring/metrics/system?hours=24 | \
        jq '.metrics | map({timestamp, cpu_usage_percent, memory_usage_percent}) | 
            sort_by(.cpu_usage_percent) | reverse | .[0:3]'
   ```

## Incident Response Procedures

### Critical System Response (Priority: P0)

**Trigger**: System health status = "critical" OR multiple critical alerts

**Response Time**: Immediate (< 5 minutes)

#### Step 1: Initial Assessment (2 minutes)
```bash
# Get detailed health status
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/health/detailed > health_status.json

# Check critical alerts
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/alerts?level=critical&limit=10 > critical_alerts.json

# Review recent errors
tail -50 temp/logs/errors.log | jq '.' > recent_errors.json
```

#### Step 2: Identify Root Cause (3 minutes)
```bash
# Check system resources
cat health_status.json | jq '.checks[] | select(.component == "system_resources")'

# Check FFmpeg status
cat health_status.json | jq '.checks[] | select(.component == "ffmpeg")'

# Check storage connectivity
cat health_status.json | jq '.checks[] | select(.component == "cloud_storage")'
```

#### Step 3: Immediate Actions
Based on root cause:

**High Resource Usage (CPU > 90%, Memory > 95%)**
```bash
# Check top processes
top -b -n 1 | head -20

# Check active processing sessions
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/sessions/active

# If necessary, restart service (last resort)
sudo systemctl restart media-processing-service
```

**FFmpeg Issues**
```bash
# Check FFmpeg installation
which ffmpeg
ffmpeg -version

# Check PATH and permissions
echo $PATH
ls -la $(which ffmpeg)

# Reinstall if necessary
sudo apt-get update && sudo apt-get install --reinstall ffmpeg
```

**Storage Connectivity Issues**
```bash
# Check network connectivity
ping s3.amazonaws.com

# Test AWS credentials
aws s3 ls s3://your-bucket-name --region your-region

# Check environment variables
env | grep AWS
```

#### Step 4: Verification and Monitoring
```bash
# Verify system recovery
curl -s http://localhost:8000/api/v1/monitoring/health | jq '.overall_status'

# Monitor for 10 minutes
for i in {1..10}; do
  echo "Check $i/10 at $(date)"
  curl -s http://localhost:8000/api/v1/monitoring/health | jq '.overall_status'
  sleep 60
done
```

### High Error Rate Response (Priority: P1)

**Trigger**: Error rate > 10% over last hour

**Response Time**: < 15 minutes

#### Step 1: Error Analysis (5 minutes)
```bash
# Get error breakdown
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/stats?hours=1 > error_stats.json

# Analyze error patterns
grep '"level":"ERROR"' temp/logs/media_processing.log | tail -20 | \
jq -r '.extra.error_code // "UNKNOWN"' | sort | uniq -c | sort -nr

# Check recent failed sessions
grep '"success":false' temp/logs/media_processing.log | tail -10 | jq '.'
```

#### Step 2: Common Error Responses

**FFMPEG_FAILED Errors**
```bash
# Check FFmpeg functionality
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v libx264 test_output.mp4

# Check input video formats
grep "FFMPEG_FAILED" temp/logs/media_processing.log | tail -5 | \
jq '.extra.input_format // "unknown"' | sort | uniq -c

# Verify FFmpeg codecs
ffmpeg -codecs | grep -E "(h264|aac|mp4)"
```

**STORAGE_UPLOAD_FAILED Errors**
```bash
# Test storage connectivity
aws s3 ls s3://your-bucket-name --region your-region

# Check storage credentials
aws sts get-caller-identity

# Test upload functionality
echo "test" | aws s3 cp - s3://your-bucket-name/test-$(date +%s).txt
```

**VALIDATION_FAILED Errors**
```bash
# Check validation rules
grep "VALIDATION_FAILED" temp/logs/media_processing.log | tail -5 | \
jq '.extra.validation_error // "unknown"'

# Review input file characteristics
grep "file_size_bytes" temp/logs/media_processing.log | tail -10 | \
jq '.extra.file_size_bytes' | sort -n
```

#### Step 3: Mitigation Actions
```bash
# If errors persist, consider temporary measures:

# Increase processing timeouts (if timeout-related)
# Update configuration: PROCESSING_TIMEOUT=600

# Reduce concurrent processing (if resource-related)
# Update configuration: MAX_CONCURRENT_SESSIONS=2

# Enable debug logging for detailed analysis
# Update configuration: LOG_LEVEL=DEBUG
```

### Performance Degradation Response (Priority: P2)

**Trigger**: Average processing time > 5 minutes OR performance alerts

**Response Time**: < 30 minutes

#### Step 1: Performance Analysis (10 minutes)
```bash
# Check processing statistics
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/stats?hours=2 > perf_stats.json

# Analyze stage-by-stage performance
cat perf_stats.json | jq '.stage_breakdown'

# Check performance logs
tail -20 temp/logs/performance.log | jq '.'

# Check system resources during processing
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/metrics/system?hours=2 | \
     jq '.metrics | map(select(.active_sessions > 0))'
```

#### Step 2: Bottleneck Identification
```bash
# Identify slowest stages
cat perf_stats.json | jq '.stage_breakdown | to_entries | 
     map({stage: .key, avg_duration: .value.average_duration}) | 
     sort_by(.avg_duration) | reverse'

# Check for stuck sessions
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/sessions/active | \
     jq '.active_sessions | map(select(.duration_minutes > 10))'

# Analyze resource correlation
grep "duration_seconds" temp/logs/performance.log | \
jq 'select(.extra.duration_seconds > 300) | {duration: .extra.duration_seconds, memory: .extra.memory_usage_mb}'
```

#### Step 3: Optimization Actions
```bash
# Clean up temporary files
find temp/ -name "*.tmp" -mtime +1 -delete
find temp/video_merge/ -name "*.mp4" -mtime +1 -delete

# Check disk I/O performance
iostat -x 1 5

# Monitor memory usage patterns
free -h
cat /proc/meminfo | grep -E "(MemTotal|MemFree|MemAvailable|Cached)"

# Consider scaling actions if needed
# - Increase memory allocation
# - Add processing workers
# - Optimize FFmpeg parameters
```

### Stuck Session Response (Priority: P2)

**Trigger**: Sessions running > 30 minutes OR stuck session alerts

#### Step 1: Session Investigation
```bash
# Get stuck session details
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/sessions/active | \
     jq '.active_sessions | map(select(.duration_minutes > 30))'

# Check session logs
STUCK_SESSION_ID="session_id_here"
grep "$STUCK_SESSION_ID" temp/logs/media_processing.log | tail -10 | jq '.'

# Check system processes
ps aux | grep -E "(ffmpeg|python.*video)" | grep -v grep
```

#### Step 2: Session Recovery
```bash
# For sessions stuck > 1 hour, consider termination
# First, try graceful cleanup through API (if available)

# If no API cleanup, identify and terminate stuck processes
# CAUTION: Only terminate clearly stuck processes
ps aux | grep -E "ffmpeg.*$STUCK_SESSION_ID" | awk '{print $2}' | xargs kill -TERM

# Clean up temporary files for stuck session
find temp/video_merge/ -name "*$STUCK_SESSION_ID*" -delete

# Monitor for session cleanup
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/sessions/active | \
     jq '.active_sessions | map(select(.session_id == "'$STUCK_SESSION_ID'"))'
```

## Weekly Maintenance Procedures

### Log Management (Every Monday, 15 minutes)

```bash
# Check log file sizes
ls -lh temp/logs/

# Archive old rotated logs
cd temp/logs/
tar -czf archived_logs_$(date +%Y%m%d).tar.gz *.log.[1-9]
mv archived_logs_*.tar.gz /backup/logs/

# Clean up old archives (keep 4 weeks)
find /backup/logs/ -name "archived_logs_*.tar.gz" -mtime +28 -delete

# Verify log rotation is working
ls -la *.log*
```

### Performance Review (Every Friday, 30 minutes)

```bash
# Generate weekly performance report
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/stats?hours=168 > weekly_report_$(date +%Y%m%d).json

# Analyze trends
cat weekly_report_$(date +%Y%m%d).json | jq '{
  total_operations,
  success_rate,
  error_rate,
  average_duration,
  peak_active_sessions: (.stage_breakdown | to_entries | map(.value.count) | max)
}'

# Check for performance degradation trends
# Compare with previous week's report
if [ -f "weekly_report_$(date -d '7 days ago' +%Y%m%d).json" ]; then
  echo "Performance comparison with last week:"
  echo "Current week:"
  cat weekly_report_$(date +%Y%m%d).json | jq '{success_rate, error_rate, average_duration}'
  echo "Previous week:"
  cat weekly_report_$(date -d '7 days ago' +%Y%m%d).json | jq '{success_rate, error_rate, average_duration}'
fi
```

### System Cleanup (Every Sunday, 20 minutes)

```bash
# Clean up monitoring data
curl -X POST -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/cleanup

# Clean up temporary files
find temp/video_merge/ -name "*.mp4" -mtime +7 -delete
find temp/video_merge/ -name "*.tmp" -mtime +1 -delete
find temp/ -name "*.log" -size +100M -mtime +7 -delete

# Check disk usage
df -h temp/
du -sh temp/logs/
du -sh temp/video_merge/

# Verify system health after cleanup
curl -s http://localhost:8000/api/v1/monitoring/health | jq '.overall_status'
```

## Monitoring Automation Scripts

### Health Check Script (`health_check.sh`)

```bash
#!/bin/bash
# Automated health check script for cron jobs

TOKEN="your_auth_token_here"
WEBHOOK_URL="your_slack_webhook_url_here"

# Get system health
HEALTH=$(curl -s http://localhost:8000/api/v1/monitoring/health)
STATUS=$(echo "$HEALTH" | jq -r '.overall_status')

# Check for critical status
if [ "$STATUS" = "critical" ]; then
    MESSAGE="🚨 CRITICAL: Media processing system health is critical"
    DETAILS=$(echo "$HEALTH" | jq -c '.checks[] | select(.status == "critical")')
    
    # Send alert
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\", \"attachments\":[{\"text\":\"$DETAILS\"}]}" \
         "$WEBHOOK_URL"
    
    # Log to syslog
    logger -t media-processing "CRITICAL: System health check failed: $DETAILS"
fi

# Check error rate
STATS=$(curl -s -H "Authorization: Bearer $TOKEN" \
             http://localhost:8000/api/v1/monitoring/stats?hours=1)
ERROR_RATE=$(echo "$STATS" | jq -r '.error_rate')

# Alert on high error rate
if (( $(echo "$ERROR_RATE > 0.1" | bc -l) )); then
    MESSAGE="⚠️ WARNING: High error rate detected: $(echo "$ERROR_RATE * 100" | bc)%"
    curl -X POST -H 'Content-type: application/json' \
         --data "{\"text\":\"$MESSAGE\"}" \
         "$WEBHOOK_URL"
fi
```

### Performance Monitor Script (`performance_monitor.sh`)

```bash
#!/bin/bash
# Performance monitoring script

TOKEN="your_auth_token_here"
THRESHOLD_SECONDS=300  # 5 minutes

# Get recent performance data
STATS=$(curl -s -H "Authorization: Bearer $TOKEN" \
             http://localhost:8000/api/v1/monitoring/stats?hours=1)

AVG_DURATION=$(echo "$STATS" | jq -r '.average_duration')

# Check if average duration exceeds threshold
if (( $(echo "$AVG_DURATION > $THRESHOLD_SECONDS" | bc -l) )); then
    echo "$(date): Performance degradation detected - Average duration: ${AVG_DURATION}s" >> /var/log/media-processing-performance.log
    
    # Get detailed stage breakdown
    SLOW_STAGES=$(echo "$STATS" | jq -r '.stage_breakdown | to_entries | 
                  map(select(.value.average_duration > 60)) | 
                  map("\(.key): \(.value.average_duration)s") | join(", ")')
    
    echo "$(date): Slow stages: $SLOW_STAGES" >> /var/log/media-processing-performance.log
fi

# Check for stuck sessions
ACTIVE_SESSIONS=$(curl -s -H "Authorization: Bearer $TOKEN" \
                       http://localhost:8000/api/v1/monitoring/sessions/active)

STUCK_COUNT=$(echo "$ACTIVE_SESSIONS" | jq '[.active_sessions[] | select(.duration_minutes > 30)] | length')

if [ "$STUCK_COUNT" -gt 0 ]; then
    echo "$(date): $STUCK_COUNT stuck sessions detected" >> /var/log/media-processing-performance.log
    echo "$ACTIVE_SESSIONS" | jq '.active_sessions[] | select(.duration_minutes > 30)' >> /var/log/media-processing-performance.log
fi
```

### Cron Job Setup

Add to crontab (`crontab -e`):

```bash
# Health check every 5 minutes
*/5 * * * * /path/to/health_check.sh

# Performance monitoring every 15 minutes
*/15 * * * * /path/to/performance_monitor.sh

# Daily log cleanup at 2 AM
0 2 * * * find /path/to/temp/logs/ -name "*.log.*" -mtime +7 -delete

# Weekly performance report on Fridays at 5 PM
0 17 * * 5 /path/to/generate_weekly_report.sh
```

## Troubleshooting Quick Reference

### Common Commands

```bash
# Quick health check
curl -s http://localhost:8000/api/v1/monitoring/health | jq '.overall_status'

# Get error count
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/alerts?level=error | jq '.alerts | length'

# Check active sessions
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/sessions/active | jq '.total_active'

# View recent errors
tail -20 temp/logs/errors.log | jq '.'

# Check system resources
curl -s -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/monitoring/health/detailed | \
     jq '.checks[] | select(.component == "system_resources")'
```

### Emergency Procedures

#### Service Restart
```bash
# Graceful restart
sudo systemctl restart media-processing-service

# Force restart if needed
sudo systemctl kill media-processing-service
sudo systemctl start media-processing-service

# Verify restart
curl -s http://localhost:8000/api/v1/monitoring/health
```

#### Clear Stuck Processes
```bash
# Find stuck FFmpeg processes
ps aux | grep ffmpeg | grep -v grep

# Kill stuck processes (use with caution)
pkill -f "ffmpeg.*temp/video_merge"

# Clean up temporary files
find temp/video_merge/ -name "*.tmp" -mtime +0.1 -delete
```

#### Emergency Disk Cleanup
```bash
# Clean old logs
find temp/logs/ -name "*.log.*" -mtime +1 -delete

# Clean temporary processing files
find temp/video_merge/ -name "*.mp4" -mtime +0.5 -delete

# Clean old uploads
find uploads/ -name "*.mp4" -mtime +7 -delete
```

This operational runbook provides practical, step-by-step procedures for maintaining the media processing pipeline monitoring system. Regular use of these procedures will ensure system reliability and quick resolution of issues.