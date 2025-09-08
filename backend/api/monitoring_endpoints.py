"""
Monitoring API endpoints for media processing
Provides health checks, metrics, and alerts for monitoring systems
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime

from services.auth_service import get_current_user
from services.monitoring_service import media_monitor, AlertLevel
from services.health_check_service import health_check_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/monitoring", tags=["monitoring"])

@router.get("/health")
async def get_system_health():
    """Get current system health status - public endpoint for load balancers"""
    try:
        health_data = await health_check_service.run_all_checks(use_cache=True)
        
        # Return appropriate HTTP status based on health
        if health_data["overall_status"] == "critical":
            raise HTTPException(status_code=503, detail=health_data)
        elif health_data["overall_status"] == "warning":
            # Still return 200 but with warning status
            pass
        
        return health_data
    except Exception as e:
        logger.error(f"Error getting system health: {str(e)}")
        raise HTTPException(status_code=500, detail="Health check failed")

@router.get("/health/detailed")
async def get_detailed_health(current_user: str = Depends(get_current_user)):
    """Get detailed system health with authentication required"""
    try:
        # Force fresh health check for detailed view
        health_data = await health_check_service.run_all_checks(use_cache=False)
        
        # Add additional monitoring details for authenticated users
        processing_stats = media_monitor.get_processing_stats(hours=24)
        recent_alerts = media_monitor.get_alerts(limit=10)
        system_health = media_monitor.get_system_health()
        
        return {
            **health_data,
            "processing_stats_24h": processing_stats,
            "recent_alerts": recent_alerts,
            "monitoring_system_health": system_health
        }
    except Exception as e:
        logger.error(f"Error getting detailed health: {str(e)}")
        raise HTTPException(status_code=500, detail="Detailed health check failed")

@router.get("/stats")
async def get_processing_stats(
    hours: int = Query(24, ge=1, le=168, description="Hours of history to include (1-168)"),
    current_user: str = Depends(get_current_user)
):
    """Get processing statistics for the specified time period"""
    try:
        stats = media_monitor.get_processing_stats(hours=hours)
        return {
            "time_period_hours": hours,
            "generated_at": datetime.utcnow().isoformat(),
            **stats
        }
    except Exception as e:
        logger.error(f"Error getting processing stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get processing statistics")

@router.get("/alerts")
async def get_alerts(
    level: Optional[str] = Query(None, description="Filter by alert level (info, warning, error, critical)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of alerts to return"),
    current_user: str = Depends(get_current_user)
):
    """Get recent alerts, optionally filtered by level"""
    try:
        # Validate alert level if provided
        alert_level = None
        if level:
            try:
                alert_level = AlertLevel(level.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid alert level. Must be one of: {[l.value for l in AlertLevel]}"
                )
        
        alerts = media_monitor.get_alerts(level=alert_level, limit=limit)
        
        return {
            "alerts": alerts,
            "total_returned": len(alerts),
            "filter_level": level,
            "generated_at": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get alerts")

@router.get("/metrics/system")
async def get_system_metrics(
    hours: int = Query(24, ge=1, le=168, description="Hours of history to include"),
    current_user: str = Depends(get_current_user)
):
    """Get system resource metrics over time"""
    try:
        # Get system metrics from the monitor
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Filter system metrics by time period
        system_metrics = [
            {
                "timestamp": m.timestamp.isoformat(),
                "cpu_usage_percent": m.cpu_usage_percent,
                "memory_usage_percent": m.memory_usage_percent,
                "disk_usage_percent": m.disk_usage_percent,
                "active_sessions": m.active_sessions,
                "temp_dir_size_mb": m.temp_dir_size_mb
            }
            for m in media_monitor.system_metrics
            if m.timestamp >= cutoff_time
        ]
        
        return {
            "time_period_hours": hours,
            "metrics_count": len(system_metrics),
            "metrics": system_metrics,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get system metrics")

@router.get("/sessions/active")
async def get_active_sessions(current_user: str = Depends(get_current_user)):
    """Get currently active processing sessions"""
    try:
        active_sessions = []
        
        for key, metrics in media_monitor.active_sessions.items():
            duration = (datetime.utcnow() - metrics.start_time).total_seconds()
            
            active_sessions.append({
                "session_id": metrics.session_id,
                "user_id": metrics.user_id,
                "stage": metrics.stage.value,
                "start_time": metrics.start_time.isoformat(),
                "duration_seconds": duration,
                "duration_minutes": duration / 60,
                "memory_usage_mb": metrics.memory_usage_mb,
                "cpu_usage_percent": metrics.cpu_usage_percent
            })
        
        # Sort by duration (longest running first)
        active_sessions.sort(key=lambda s: s["duration_seconds"], reverse=True)
        
        return {
            "active_sessions": active_sessions,
            "total_active": len(active_sessions),
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting active sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get active sessions")

@router.post("/test/alert")
async def create_test_alert(
    level: str = Query("info", description="Alert level to test"),
    current_user: str = Depends(get_current_user)
):
    """Create a test alert for monitoring system validation"""
    try:
        # Validate alert level
        try:
            alert_level = AlertLevel(level.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid alert level. Must be one of: {[l.value for l in AlertLevel]}"
            )
        
        # Create test alert
        await media_monitor._create_alert(
            level=alert_level,
            title=f"Test Alert - {alert_level.value.title()}",
            message=f"This is a test {alert_level.value} alert created by user {current_user}",
            user_id=current_user,
            metadata={
                "test": True,
                "created_by": current_user,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        return {
            "message": f"Test {alert_level.value} alert created successfully",
            "level": alert_level.value,
            "created_by": current_user
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating test alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create test alert")

@router.get("/logs/recent")
async def get_recent_logs(
    lines: int = Query(100, ge=10, le=1000, description="Number of recent log lines to return"),
    level: Optional[str] = Query(None, description="Filter by log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"),
    current_user: str = Depends(get_current_user)
):
    """Get recent log entries from the media processing log file"""
    try:
        from pathlib import Path
        from config import settings
        
        log_file = settings.TEMP_DIR / "media_processing.log"
        
        if not log_file.exists():
            return {
                "logs": [],
                "message": "Log file not found",
                "log_file_path": str(log_file)
            }
        
        # Read recent log lines
        with open(log_file, 'r') as f:
            all_lines = f.readlines()
        
        # Get the last N lines
        recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        # Filter by level if specified
        if level:
            level_upper = level.upper()
            recent_lines = [
                line for line in recent_lines 
                if level_upper in line
            ]
        
        return {
            "logs": [line.strip() for line in recent_lines],
            "total_lines": len(recent_lines),
            "filter_level": level,
            "log_file_path": str(log_file),
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting recent logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get recent logs")

# Admin endpoints for monitoring management
@router.delete("/alerts")
async def clear_alerts(current_user: str = Depends(get_current_user)):
    """Clear all alerts (admin function)"""
    try:
        # Note: In production, you'd want to check if user is admin
        original_count = len(media_monitor.alerts)
        media_monitor.alerts.clear()
        
        logger.info(f"Alerts cleared by user {current_user} (cleared {original_count} alerts)")
        
        return {
            "message": f"Cleared {original_count} alerts",
            "cleared_by": current_user,
            "cleared_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error clearing alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear alerts")

@router.post("/cleanup")
async def cleanup_monitoring_data(current_user: str = Depends(get_current_user)):
    """Clean up old monitoring data (admin function)"""
    try:
        # Note: In production, you'd want to check if user is admin
        
        # Clean up old metrics (keep last 24 hours)
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=24)
        
        original_processing_count = len(media_monitor.processing_metrics)
        original_system_count = len(media_monitor.system_metrics)
        original_alerts_count = len(media_monitor.alerts)
        
        # Keep recent data
        media_monitor.processing_metrics = [
            m for m in media_monitor.processing_metrics 
            if m.start_time >= cutoff_time
        ]
        
        media_monitor.system_metrics = [
            m for m in media_monitor.system_metrics 
            if m.timestamp >= cutoff_time
        ]
        
        # Keep last 100 alerts
        media_monitor.alerts = media_monitor.alerts[-100:] if len(media_monitor.alerts) > 100 else media_monitor.alerts
        
        cleaned_processing = original_processing_count - len(media_monitor.processing_metrics)
        cleaned_system = original_system_count - len(media_monitor.system_metrics)
        cleaned_alerts = original_alerts_count - len(media_monitor.alerts)
        
        logger.info(f"Monitoring data cleanup by user {current_user}")
        
        return {
            "message": "Monitoring data cleanup completed",
            "cleaned_processing_metrics": cleaned_processing,
            "cleaned_system_metrics": cleaned_system,
            "cleaned_alerts": cleaned_alerts,
            "cleaned_by": current_user,
            "cleaned_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error cleaning up monitoring data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cleanup monitoring data")