"""
Monitoring and Logging Service for Media Processing
Tracks metrics, failures, and provides alerting for video processing operations
"""
import logging
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
from dataclasses import dataclass, asdict
from enum import Enum
import traceback
import psutil
import os

from config import settings

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(settings.TEMP_DIR / "media_processing.log")
    ]
)

logger = logging.getLogger(__name__)

class AlertLevel(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ProcessingStage(Enum):
    """Video processing stages for tracking"""
    UPLOAD = "upload"
    ANALYSIS = "analysis"
    PREPARATION = "preparation"
    MERGING = "merging"
    COMPRESSION = "compression"
    STORAGE_UPLOAD = "storage_upload"
    CLEANUP = "cleanup"

@dataclass
class ProcessingMetrics:
    """Metrics for a processing operation"""
    session_id: str
    user_id: str
    stage: ProcessingStage
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    success: bool = True
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    file_size_bytes: Optional[int] = None
    video_count: Optional[int] = None
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None

@dataclass
class SystemMetrics:
    """System resource metrics"""
    timestamp: datetime
    cpu_usage_percent: float
    memory_usage_percent: float
    disk_usage_percent: float
    active_sessions: int
    temp_dir_size_mb: float

@dataclass
class Alert:
    """Alert for monitoring issues"""
    id: str
    level: AlertLevel
    title: str
    message: str
    timestamp: datetime
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    stage: Optional[ProcessingStage] = None
    metadata: Optional[Dict[str, Any]] = None

class MediaProcessingMonitor:
    """Monitor for media processing operations with metrics and alerting"""
    
    def __init__(self):
        self.processing_metrics: List[ProcessingMetrics] = []
        self.system_metrics: List[SystemMetrics] = []
        self.alerts: List[Alert] = []
        self.active_sessions: Dict[str, ProcessingMetrics] = {}
        self._background_task = None
        
        # Thresholds for alerting
        self.error_rate_threshold = 0.1  # 10% error rate
        self.processing_time_threshold = 300  # 5 minutes
        self.memory_threshold = 80  # 80% memory usage
        self.disk_threshold = 90  # 90% disk usage
        
        # Start background monitoring if event loop is available
        try:
            loop = asyncio.get_running_loop()
            self._background_task = asyncio.create_task(self._background_monitoring())
        except RuntimeError:
            # No event loop running, background task will be started later
            pass
    
    async def start_processing(
        self, 
        session_id: str, 
        user_id: str, 
        stage: ProcessingStage,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ProcessingMetrics:
        """Start tracking a processing operation"""
        
        # Ensure background monitoring is running
        self._ensure_background_monitoring()
        
        metrics = ProcessingMetrics(
            session_id=session_id,
            user_id=user_id,
            stage=stage,
            start_time=datetime.utcnow()
        )
        
        # Capture system metrics at start
        system_info = self._get_system_metrics()
        metrics.memory_usage_mb = system_info.memory_usage_percent
        metrics.cpu_usage_percent = system_info.cpu_usage_percent
        
        self.active_sessions[f"{session_id}_{stage.value}"] = metrics
        
        logger.info(
            f"Started processing stage {stage.value} for session {session_id}",
            extra={
                "session_id": session_id,
                "user_id": user_id,
                "stage": stage.value,
                "metadata": metadata or {}
            }
        )
        
        return metrics
    
    async def complete_processing(
        self, 
        session_id: str, 
        stage: ProcessingStage,
        success: bool = True,
        error_message: Optional[str] = None,
        error_code: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
        video_count: Optional[int] = None
    ):
        """Complete tracking a processing operation"""
        
        key = f"{session_id}_{stage.value}"
        metrics = self.active_sessions.get(key)
        
        if not metrics:
            logger.warning(f"No active session found for {session_id} stage {stage.value}")
            return
        
        # Update metrics
        metrics.end_time = datetime.utcnow()
        metrics.duration_seconds = (metrics.end_time - metrics.start_time).total_seconds()
        metrics.success = success
        metrics.error_message = error_message
        metrics.error_code = error_code
        metrics.file_size_bytes = file_size_bytes
        metrics.video_count = video_count
        
        # Remove from active sessions
        del self.active_sessions[key]
        
        # Add to historical metrics
        self.processing_metrics.append(metrics)
        
        # Log completion
        if success:
            logger.info(
                f"Completed processing stage {stage.value} for session {session_id} "
                f"in {metrics.duration_seconds:.2f}s",
                extra={
                    "session_id": session_id,
                    "stage": stage.value,
                    "duration_seconds": metrics.duration_seconds,
                    "file_size_bytes": file_size_bytes,
                    "video_count": video_count
                }
            )
        else:
            logger.error(
                f"Failed processing stage {stage.value} for session {session_id} "
                f"after {metrics.duration_seconds:.2f}s: {error_message}",
                extra={
                    "session_id": session_id,
                    "stage": stage.value,
                    "duration_seconds": metrics.duration_seconds,
                    "error_code": error_code,
                    "error_message": error_message
                }
            )
            
            # Create alert for failure
            await self._create_alert(
                level=AlertLevel.ERROR,
                title=f"Processing Failed: {stage.value}",
                message=f"Session {session_id} failed at {stage.value}: {error_message}",
                session_id=session_id,
                user_id=metrics.user_id,
                stage=stage,
                metadata={
                    "error_code": error_code,
                    "duration_seconds": metrics.duration_seconds
                }
            )
        
        # Check for performance issues
        await self._check_performance_alerts(metrics)
        
        # Cleanup old metrics (keep last 1000 entries)
        if len(self.processing_metrics) > 1000:
            self.processing_metrics = self.processing_metrics[-1000:]
    
    async def log_processing_error(
        self,
        session_id: str,
        user_id: str,
        stage: ProcessingStage,
        error: Exception,
        context: Optional[Dict[str, Any]] = None
    ):
        """Log a processing error with full context"""
        
        error_details = {
            "session_id": session_id,
            "user_id": user_id,
            "stage": stage.value,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "context": context or {}
        }
        
        logger.error(
            f"Processing error in {stage.value} for session {session_id}: {str(error)}",
            extra=error_details
        )
        
        # Create critical alert for unexpected errors
        await self._create_alert(
            level=AlertLevel.CRITICAL,
            title=f"Unexpected Error: {stage.value}",
            message=f"Unexpected error in session {session_id}: {str(error)}",
            session_id=session_id,
            user_id=user_id,
            stage=stage,
            metadata=error_details
        )
    
    def get_processing_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get processing statistics for the last N hours"""
        
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_metrics = [
            m for m in self.processing_metrics 
            if m.start_time >= cutoff_time
        ]
        
        if not recent_metrics:
            return {
                "total_operations": 0,
                "success_rate": 0.0,
                "error_rate": 0.0,
                "average_duration": 0.0,
                "stage_breakdown": {},
                "error_breakdown": {}
            }
        
        # Calculate statistics
        total_ops = len(recent_metrics)
        successful_ops = len([m for m in recent_metrics if m.success])
        failed_ops = total_ops - successful_ops
        
        success_rate = successful_ops / total_ops if total_ops > 0 else 0.0
        error_rate = failed_ops / total_ops if total_ops > 0 else 0.0
        
        # Average duration by stage
        stage_stats = {}
        for stage in ProcessingStage:
            stage_metrics = [m for m in recent_metrics if m.stage == stage and m.duration_seconds]
            if stage_metrics:
                stage_stats[stage.value] = {
                    "count": len(stage_metrics),
                    "success_count": len([m for m in stage_metrics if m.success]),
                    "average_duration": sum(m.duration_seconds for m in stage_metrics) / len(stage_metrics),
                    "max_duration": max(m.duration_seconds for m in stage_metrics),
                    "min_duration": min(m.duration_seconds for m in stage_metrics)
                }
        
        # Error breakdown
        error_breakdown = {}
        failed_metrics = [m for m in recent_metrics if not m.success and m.error_code]
        for metric in failed_metrics:
            error_code = metric.error_code
            if error_code not in error_breakdown:
                error_breakdown[error_code] = 0
            error_breakdown[error_code] += 1
        
        return {
            "total_operations": total_ops,
            "successful_operations": successful_ops,
            "failed_operations": failed_ops,
            "success_rate": success_rate,
            "error_rate": error_rate,
            "average_duration": sum(m.duration_seconds for m in recent_metrics if m.duration_seconds) / len([m for m in recent_metrics if m.duration_seconds]) if recent_metrics else 0.0,
            "stage_breakdown": stage_stats,
            "error_breakdown": error_breakdown,
            "active_sessions": len(self.active_sessions)
        }
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get current system health status"""
        
        current_metrics = self._get_system_metrics()
        
        # Determine health status
        health_status = "healthy"
        issues = []
        
        if current_metrics.cpu_usage_percent > 80:
            health_status = "warning"
            issues.append(f"High CPU usage: {current_metrics.cpu_usage_percent:.1f}%")
        
        if current_metrics.memory_usage_percent > self.memory_threshold:
            health_status = "critical" if current_metrics.memory_usage_percent > 95 else "warning"
            issues.append(f"High memory usage: {current_metrics.memory_usage_percent:.1f}%")
        
        if current_metrics.disk_usage_percent > self.disk_threshold:
            health_status = "critical"
            issues.append(f"High disk usage: {current_metrics.disk_usage_percent:.1f}%")
        
        # Check recent error rate
        recent_stats = self.get_processing_stats(hours=1)
        if recent_stats["error_rate"] > self.error_rate_threshold:
            health_status = "warning"
            issues.append(f"High error rate: {recent_stats['error_rate']:.1%}")
        
        return {
            "status": health_status,
            "timestamp": current_metrics.timestamp.isoformat(),
            "system_metrics": asdict(current_metrics),
            "issues": issues,
            "recent_stats": recent_stats
        }
    
    def get_alerts(self, level: Optional[AlertLevel] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent alerts, optionally filtered by level"""
        
        alerts = self.alerts
        if level:
            alerts = [a for a in alerts if a.level == level]
        
        # Sort by timestamp (newest first) and limit
        alerts = sorted(alerts, key=lambda a: a.timestamp, reverse=True)[:limit]
        
        return [asdict(alert) for alert in alerts]
    
    async def _create_alert(
        self,
        level: AlertLevel,
        title: str,
        message: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        stage: Optional[ProcessingStage] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Create a new alert"""
        
        alert = Alert(
            id=f"alert_{datetime.utcnow().timestamp()}_{len(self.alerts)}",
            level=level,
            title=title,
            message=message,
            timestamp=datetime.utcnow(),
            session_id=session_id,
            user_id=user_id,
            stage=stage,
            metadata=metadata
        )
        
        self.alerts.append(alert)
        
        # Log alert
        logger.log(
            logging.CRITICAL if level == AlertLevel.CRITICAL else logging.WARNING,
            f"ALERT [{level.value.upper()}] {title}: {message}",
            extra={
                "alert_id": alert.id,
                "alert_level": level.value,
                "session_id": session_id,
                "user_id": user_id,
                "stage": stage.value if stage else None,
                "metadata": metadata
            }
        )
        
        # Keep only last 500 alerts
        if len(self.alerts) > 500:
            self.alerts = self.alerts[-500:]
    
    async def _check_performance_alerts(self, metrics: ProcessingMetrics):
        """Check for performance-related alerts"""
        
        if metrics.duration_seconds and metrics.duration_seconds > self.processing_time_threshold:
            await self._create_alert(
                level=AlertLevel.WARNING,
                title="Slow Processing",
                message=f"Stage {metrics.stage.value} took {metrics.duration_seconds:.1f}s (threshold: {self.processing_time_threshold}s)",
                session_id=metrics.session_id,
                user_id=metrics.user_id,
                stage=metrics.stage,
                metadata={"duration_seconds": metrics.duration_seconds}
            )
    
    def _get_system_metrics(self) -> SystemMetrics:
        """Get current system resource metrics"""
        
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # Disk usage for temp directory
        disk_usage = psutil.disk_usage(str(settings.TEMP_DIR))
        disk_percent = (disk_usage.used / disk_usage.total) * 100
        
        # Temp directory size
        temp_size_bytes = sum(
            f.stat().st_size for f in settings.TEMP_DIR.rglob('*') if f.is_file()
        )
        temp_size_mb = temp_size_bytes / (1024 * 1024)
        
        return SystemMetrics(
            timestamp=datetime.utcnow(),
            cpu_usage_percent=cpu_percent,
            memory_usage_percent=memory_percent,
            disk_usage_percent=disk_percent,
            active_sessions=len(self.active_sessions),
            temp_dir_size_mb=temp_size_mb
        )
    
    def _ensure_background_monitoring(self):
        """Ensure background monitoring task is running"""
        if self._background_task is None or self._background_task.done():
            try:
                loop = asyncio.get_running_loop()
                self._background_task = asyncio.create_task(self._background_monitoring())
            except RuntimeError:
                # No event loop running, skip background monitoring
                pass
    
    async def _background_monitoring(self):
        """Background task for continuous monitoring"""
        
        while True:
            try:
                # Collect system metrics every 5 minutes
                metrics = self._get_system_metrics()
                self.system_metrics.append(metrics)
                
                # Check for system alerts
                if metrics.memory_usage_percent > self.memory_threshold:
                    await self._create_alert(
                        level=AlertLevel.WARNING if metrics.memory_usage_percent < 95 else AlertLevel.CRITICAL,
                        title="High Memory Usage",
                        message=f"System memory usage at {metrics.memory_usage_percent:.1f}%",
                        metadata={"memory_usage_percent": metrics.memory_usage_percent}
                    )
                
                if metrics.disk_usage_percent > self.disk_threshold:
                    await self._create_alert(
                        level=AlertLevel.CRITICAL,
                        title="High Disk Usage",
                        message=f"Disk usage at {metrics.disk_usage_percent:.1f}%",
                        metadata={"disk_usage_percent": metrics.disk_usage_percent}
                    )
                
                # Clean up old system metrics (keep last 24 hours)
                cutoff_time = datetime.utcnow() - timedelta(hours=24)
                self.system_metrics = [
                    m for m in self.system_metrics 
                    if m.timestamp >= cutoff_time
                ]
                
                # Check for stuck sessions (running > 30 minutes)
                current_time = datetime.utcnow()
                for key, session_metrics in list(self.active_sessions.items()):
                    duration = (current_time - session_metrics.start_time).total_seconds()
                    if duration > 1800:  # 30 minutes
                        await self._create_alert(
                            level=AlertLevel.WARNING,
                            title="Long Running Session",
                            message=f"Session {session_metrics.session_id} has been running for {duration/60:.1f} minutes",
                            session_id=session_metrics.session_id,
                            user_id=session_metrics.user_id,
                            stage=session_metrics.stage,
                            metadata={"duration_minutes": duration/60}
                        )
                
                await asyncio.sleep(300)  # 5 minutes
                
            except Exception as e:
                logger.error(f"Error in background monitoring: {str(e)}")
                await asyncio.sleep(60)  # Retry in 1 minute

# Global monitor instance
media_monitor = MediaProcessingMonitor()