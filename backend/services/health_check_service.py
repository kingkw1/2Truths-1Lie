"""
Health Check Service for Media Processing System
Provides comprehensive health checks for all system components
"""
import logging
import asyncio
import subprocess
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

from config import settings
from services.monitoring_service import media_monitor

logger = logging.getLogger(__name__)

class HealthStatus(Enum):
    """Health check status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

@dataclass
class HealthCheckResult:
    """Result of a health check"""
    component: str
    status: HealthStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    response_time_ms: Optional[float] = None

class HealthCheckService:
    """Comprehensive health check service"""
    
    def __init__(self):
        self.last_check_time = None
        self.cached_results = {}
        self.cache_duration = timedelta(minutes=1)  # Cache results for 1 minute
    
    async def run_all_checks(self, use_cache: bool = True) -> Dict[str, Any]:
        """Run all health checks and return comprehensive status"""
        
        # Check if we can use cached results
        if (use_cache and self.last_check_time and 
            datetime.utcnow() - self.last_check_time < self.cache_duration):
            return self.cached_results
        
        start_time = datetime.utcnow()
        
        # Run all health checks concurrently
        check_tasks = [
            self._check_system_resources(),
            self._check_ffmpeg(),
            self._check_storage_access(),
            self._check_temp_directory(),
            self._check_processing_pipeline(),
            self._check_monitoring_system(),
            self._check_log_files()
        ]
        
        try:
            results = await asyncio.gather(*check_tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f"Error running health checks: {str(e)}")
            return self._create_error_response(str(e))
        
        # Process results
        health_checks = []
        overall_status = HealthStatus.HEALTHY
        
        for result in results:
            if isinstance(result, Exception):
                health_checks.append(HealthCheckResult(
                    component="unknown",
                    status=HealthStatus.CRITICAL,
                    message=f"Health check failed: {str(result)}",
                    timestamp=datetime.utcnow()
                ))
                overall_status = HealthStatus.CRITICAL
            else:
                health_checks.append(result)
                
                # Update overall status
                if result.status == HealthStatus.CRITICAL:
                    overall_status = HealthStatus.CRITICAL
                elif result.status == HealthStatus.WARNING and overall_status != HealthStatus.CRITICAL:
                    overall_status = HealthStatus.WARNING
        
        # Calculate total check time
        total_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Build response
        response = {
            "overall_status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "total_check_time_ms": total_time_ms,
            "checks": [
                {
                    "component": check.component,
                    "status": check.status.value,
                    "message": check.message,
                    "details": check.details or {},
                    "response_time_ms": check.response_time_ms
                }
                for check in health_checks
            ],
            "summary": {
                "total_checks": len(health_checks),
                "healthy": len([c for c in health_checks if c.status == HealthStatus.HEALTHY]),
                "warning": len([c for c in health_checks if c.status == HealthStatus.WARNING]),
                "critical": len([c for c in health_checks if c.status == HealthStatus.CRITICAL])
            }
        }
        
        # Cache results
        self.cached_results = response
        self.last_check_time = datetime.utcnow()
        
        return response
    
    async def _check_system_resources(self) -> HealthCheckResult:
        """Check system resource usage"""
        start_time = datetime.utcnow()
        
        try:
            # Get system metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk_usage = psutil.disk_usage(str(settings.TEMP_DIR))
            
            # Determine status based on thresholds
            status = HealthStatus.HEALTHY
            issues = []
            
            if cpu_percent > 90:
                status = HealthStatus.CRITICAL
                issues.append(f"CPU usage critical: {cpu_percent:.1f}%")
            elif cpu_percent > 80:
                status = HealthStatus.WARNING
                issues.append(f"CPU usage high: {cpu_percent:.1f}%")
            
            if memory.percent > 95:
                status = HealthStatus.CRITICAL
                issues.append(f"Memory usage critical: {memory.percent:.1f}%")
            elif memory.percent > 85:
                status = HealthStatus.WARNING
                issues.append(f"Memory usage high: {memory.percent:.1f}%")
            
            disk_percent = (disk_usage.used / disk_usage.total) * 100
            if disk_percent > 95:
                status = HealthStatus.CRITICAL
                issues.append(f"Disk usage critical: {disk_percent:.1f}%")
            elif disk_percent > 90:
                status = HealthStatus.WARNING
                issues.append(f"Disk usage high: {disk_percent:.1f}%")
            
            message = "System resources healthy" if not issues else "; ".join(issues)
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return HealthCheckResult(
                component="system_resources",
                status=status,
                message=message,
                details={
                    "cpu_usage_percent": cpu_percent,
                    "memory_usage_percent": memory.percent,
                    "memory_available_gb": memory.available / (1024**3),
                    "disk_usage_percent": disk_percent,
                    "disk_free_gb": disk_usage.free / (1024**3)
                },
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="system_resources",
                status=HealthStatus.CRITICAL,
                message=f"Failed to check system resources: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_ffmpeg(self) -> HealthCheckResult:
        """Check FFmpeg availability and functionality"""
        start_time = datetime.utcnow()
        
        try:
            # Check FFmpeg version
            result = await asyncio.create_subprocess_exec(
                "ffmpeg", "-version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=10)
            
            if result.returncode == 0:
                version_info = stdout.decode().split('\n')[0]
                
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return HealthCheckResult(
                    component="ffmpeg",
                    status=HealthStatus.HEALTHY,
                    message="FFmpeg is available and functional",
                    details={
                        "version": version_info,
                        "available": True
                    },
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
            else:
                error_msg = stderr.decode() if stderr else "Unknown error"
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return HealthCheckResult(
                    component="ffmpeg",
                    status=HealthStatus.CRITICAL,
                    message=f"FFmpeg check failed: {error_msg}",
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
                
        except asyncio.TimeoutError:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="ffmpeg",
                status=HealthStatus.CRITICAL,
                message="FFmpeg check timed out",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
        except FileNotFoundError:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="ffmpeg",
                status=HealthStatus.CRITICAL,
                message="FFmpeg not found - please install FFmpeg",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="ffmpeg",
                status=HealthStatus.CRITICAL,
                message=f"FFmpeg check error: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_storage_access(self) -> HealthCheckResult:
        """Check cloud storage access if enabled"""
        start_time = datetime.utcnow()
        
        try:
            if not settings.USE_CLOUD_STORAGE:
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                return HealthCheckResult(
                    component="cloud_storage",
                    status=HealthStatus.HEALTHY,
                    message="Cloud storage disabled - using local storage",
                    details={"enabled": False},
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
            
            # Try to create cloud storage service
            from services.cloud_storage_service import create_cloud_storage_service
            
            cloud_storage = create_cloud_storage_service(
                provider=settings.CLOUD_STORAGE_PROVIDER,
                bucket_name=settings.AWS_S3_BUCKET_NAME,
                region_name=settings.AWS_S3_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                endpoint_url=settings.AWS_S3_ENDPOINT_URL
            )
            
            # Test basic connectivity (list operation with limit)
            try:
                # This is a lightweight operation to test connectivity
                await asyncio.wait_for(
                    asyncio.to_thread(lambda: list(cloud_storage.client.list_objects_v2(
                        Bucket=settings.AWS_S3_BUCKET_NAME, MaxKeys=1
                    ))),
                    timeout=5
                )
                
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return HealthCheckResult(
                    component="cloud_storage",
                    status=HealthStatus.HEALTHY,
                    message="Cloud storage accessible",
                    details={
                        "enabled": True,
                        "provider": settings.CLOUD_STORAGE_PROVIDER,
                        "bucket": settings.AWS_S3_BUCKET_NAME,
                        "region": settings.AWS_S3_REGION
                    },
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
                
            except Exception as storage_error:
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                return HealthCheckResult(
                    component="cloud_storage",
                    status=HealthStatus.CRITICAL,
                    message=f"Cloud storage connectivity failed: {str(storage_error)}",
                    details={"enabled": True, "error": str(storage_error)},
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
                
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="cloud_storage",
                status=HealthStatus.CRITICAL,
                message=f"Cloud storage check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_temp_directory(self) -> HealthCheckResult:
        """Check temporary directory access and cleanup"""
        start_time = datetime.utcnow()
        
        try:
            # Check if temp directory exists and is writable
            if not settings.TEMP_DIR.exists():
                settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
            
            # Test write access
            test_file = settings.TEMP_DIR / f"health_check_{datetime.utcnow().timestamp()}.tmp"
            test_file.write_text("health check test")
            test_file.unlink()  # Clean up
            
            # Check temp directory size
            total_size = sum(f.stat().st_size for f in settings.TEMP_DIR.rglob('*') if f.is_file())
            size_mb = total_size / (1024 * 1024)
            
            # Count old files (older than 24 hours)
            cutoff_time = datetime.utcnow().timestamp() - (24 * 3600)
            old_files = [
                f for f in settings.TEMP_DIR.rglob('*') 
                if f.is_file() and f.stat().st_mtime < cutoff_time
            ]
            
            status = HealthStatus.HEALTHY
            issues = []
            
            if size_mb > 1000:  # 1GB
                status = HealthStatus.WARNING
                issues.append(f"Temp directory large: {size_mb:.1f}MB")
            
            if len(old_files) > 100:
                status = HealthStatus.WARNING
                issues.append(f"Many old temp files: {len(old_files)}")
            
            message = "Temp directory healthy" if not issues else "; ".join(issues)
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return HealthCheckResult(
                component="temp_directory",
                status=status,
                message=message,
                details={
                    "path": str(settings.TEMP_DIR),
                    "size_mb": size_mb,
                    "old_files_count": len(old_files),
                    "writable": True
                },
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="temp_directory",
                status=HealthStatus.CRITICAL,
                message=f"Temp directory check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_processing_pipeline(self) -> HealthCheckResult:
        """Check video processing pipeline health"""
        start_time = datetime.utcnow()
        
        try:
            # Get recent processing statistics
            stats = media_monitor.get_processing_stats(hours=1)
            
            status = HealthStatus.HEALTHY
            issues = []
            
            # Check error rate
            if stats["error_rate"] > 0.2:  # 20% error rate
                status = HealthStatus.CRITICAL
                issues.append(f"High error rate: {stats['error_rate']:.1%}")
            elif stats["error_rate"] > 0.1:  # 10% error rate
                status = HealthStatus.WARNING
                issues.append(f"Elevated error rate: {stats['error_rate']:.1%}")
            
            # Check for stuck sessions
            active_sessions = len(media_monitor.active_sessions)
            if active_sessions > 10:
                status = HealthStatus.WARNING
                issues.append(f"Many active sessions: {active_sessions}")
            
            # Check average processing time
            if stats["average_duration"] > 300:  # 5 minutes
                status = HealthStatus.WARNING
                issues.append(f"Slow processing: {stats['average_duration']:.1f}s avg")
            
            message = "Processing pipeline healthy" if not issues else "; ".join(issues)
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return HealthCheckResult(
                component="processing_pipeline",
                status=status,
                message=message,
                details={
                    "recent_operations": stats["total_operations"],
                    "success_rate": stats["success_rate"],
                    "error_rate": stats["error_rate"],
                    "average_duration_seconds": stats["average_duration"],
                    "active_sessions": active_sessions
                },
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="processing_pipeline",
                status=HealthStatus.CRITICAL,
                message=f"Processing pipeline check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_monitoring_system(self) -> HealthCheckResult:
        """Check monitoring system health"""
        start_time = datetime.utcnow()
        
        try:
            # Check if monitoring is collecting data
            recent_alerts = media_monitor.get_alerts(limit=10)
            system_metrics_count = len(media_monitor.system_metrics)
            processing_metrics_count = len(media_monitor.processing_metrics)
            
            status = HealthStatus.HEALTHY
            issues = []
            
            # Check for critical alerts in last hour
            recent_critical = [
                alert for alert in recent_alerts 
                if alert.get("level") == "critical" and 
                (datetime.utcnow() - datetime.fromisoformat(alert["timestamp"].replace("Z", "+00:00"))).total_seconds() < 3600
            ]
            
            if recent_critical:
                status = HealthStatus.WARNING
                issues.append(f"Recent critical alerts: {len(recent_critical)}")
            
            message = "Monitoring system healthy" if not issues else "; ".join(issues)
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return HealthCheckResult(
                component="monitoring_system",
                status=status,
                message=message,
                details={
                    "recent_alerts": len(recent_alerts),
                    "recent_critical_alerts": len(recent_critical),
                    "system_metrics_count": system_metrics_count,
                    "processing_metrics_count": processing_metrics_count,
                    "active_sessions": len(media_monitor.active_sessions)
                },
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="monitoring_system",
                status=HealthStatus.CRITICAL,
                message=f"Monitoring system check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    async def _check_log_files(self) -> HealthCheckResult:
        """Check log file accessibility and size"""
        start_time = datetime.utcnow()
        
        try:
            log_dir = settings.TEMP_DIR / "logs"
            
            if not log_dir.exists():
                response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                return HealthCheckResult(
                    component="log_files",
                    status=HealthStatus.WARNING,
                    message="Log directory does not exist",
                    timestamp=datetime.utcnow(),
                    response_time_ms=response_time
                )
            
            # Check log files
            log_files = {
                "application.log": log_dir / "application.log",
                "media_processing.log": log_dir / "media_processing.log",
                "errors.log": log_dir / "errors.log",
                "performance.log": log_dir / "performance.log"
            }
            
            file_info = {}
            total_size_mb = 0
            issues = []
            
            for name, path in log_files.items():
                if path.exists():
                    size_mb = path.stat().st_size / (1024 * 1024)
                    total_size_mb += size_mb
                    file_info[name] = {
                        "exists": True,
                        "size_mb": size_mb,
                        "modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat()
                    }
                    
                    if size_mb > 100:  # 100MB per file
                        issues.append(f"{name} is large: {size_mb:.1f}MB")
                else:
                    file_info[name] = {"exists": False}
            
            status = HealthStatus.HEALTHY
            if total_size_mb > 500:  # 500MB total
                status = HealthStatus.WARNING
                issues.append(f"Total log size large: {total_size_mb:.1f}MB")
            
            message = "Log files healthy" if not issues else "; ".join(issues)
            
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            return HealthCheckResult(
                component="log_files",
                status=status,
                message=message,
                details={
                    "log_directory": str(log_dir),
                    "total_size_mb": total_size_mb,
                    "files": file_info
                },
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
            
        except Exception as e:
            response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            return HealthCheckResult(
                component="log_files",
                status=HealthStatus.CRITICAL,
                message=f"Log files check failed: {str(e)}",
                timestamp=datetime.utcnow(),
                response_time_ms=response_time
            )
    
    def _create_error_response(self, error_message: str) -> Dict[str, Any]:
        """Create error response when health checks fail completely"""
        return {
            "overall_status": HealthStatus.CRITICAL.value,
            "timestamp": datetime.utcnow().isoformat(),
            "error": error_message,
            "checks": [],
            "summary": {
                "total_checks": 0,
                "healthy": 0,
                "warning": 0,
                "critical": 1
            }
        }

# Global health check service instance
health_check_service = HealthCheckService()