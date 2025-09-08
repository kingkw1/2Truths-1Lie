"""
Centralized logging configuration for media processing
Provides structured logging with different handlers for different log levels
"""
import logging
import logging.handlers
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from config import settings

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        
        # Base log data
        log_data = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process_id": record.process,
            "thread_id": record.thread
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from the record
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                'thread', 'threadName', 'processName', 'process', 'getMessage',
                'exc_info', 'exc_text', 'stack_info', 'message'
            }:
                extra_fields[key] = value
        
        if extra_fields:
            log_data["extra"] = extra_fields
        
        return json.dumps(log_data, default=str)

class MediaProcessingFilter(logging.Filter):
    """Filter for media processing related logs"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter logs related to media processing"""
        
        # Always include logs from media processing modules
        media_modules = [
            'services.video_merge_service',
            'services.monitoring_service',
            'services.upload_service',
            'services.cloud_storage_service',
            'api.challenge_video_endpoints',
            'api.monitoring_endpoints'
        ]
        
        if record.name in media_modules:
            return True
        
        # Include logs with media processing context
        if hasattr(record, 'session_id') or hasattr(record, 'merge_session_id'):
            return True
        
        # Include ERROR and CRITICAL logs from all modules
        if record.levelno >= logging.ERROR:
            return True
        
        return False

def setup_logging():
    """Setup comprehensive logging configuration"""
    
    # Create logs directory
    log_dir = settings.TEMP_DIR / "logs"
    log_dir.mkdir(exist_ok=True)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # General application log file (rotating)
    app_log_file = log_dir / "application.log"
    app_handler = logging.handlers.RotatingFileHandler(
        app_log_file,
        maxBytes=50 * 1024 * 1024,  # 50MB
        backupCount=5
    )
    app_handler.setLevel(logging.INFO)
    app_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(app_handler)
    
    # Media processing specific log file
    media_log_file = log_dir / "media_processing.log"
    media_handler = logging.handlers.RotatingFileHandler(
        media_log_file,
        maxBytes=100 * 1024 * 1024,  # 100MB
        backupCount=10
    )
    media_handler.setLevel(logging.DEBUG)
    media_handler.setFormatter(JSONFormatter())
    media_handler.addFilter(MediaProcessingFilter())
    root_logger.addHandler(media_handler)
    
    # Error log file (errors and critical only)
    error_log_file = log_dir / "errors.log"
    error_handler = logging.handlers.RotatingFileHandler(
        error_log_file,
        maxBytes=20 * 1024 * 1024,  # 20MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(error_handler)
    
    # Performance log file (for slow operations)
    perf_log_file = log_dir / "performance.log"
    perf_handler = logging.handlers.RotatingFileHandler(
        perf_log_file,
        maxBytes=20 * 1024 * 1024,  # 20MB
        backupCount=3
    )
    perf_handler.setLevel(logging.WARNING)
    perf_formatter = JSONFormatter()
    perf_handler.setFormatter(perf_formatter)
    
    # Create performance logger
    perf_logger = logging.getLogger('performance')
    perf_logger.addHandler(perf_handler)
    perf_logger.setLevel(logging.WARNING)
    perf_logger.propagate = False  # Don't propagate to root logger
    
    # Set specific logger levels
    logging.getLogger('services.video_merge_service').setLevel(logging.DEBUG)
    logging.getLogger('services.monitoring_service').setLevel(logging.DEBUG)
    logging.getLogger('services.upload_service').setLevel(logging.INFO)
    logging.getLogger('api.challenge_video_endpoints').setLevel(logging.INFO)
    logging.getLogger('api.monitoring_endpoints').setLevel(logging.INFO)
    
    # Suppress noisy third-party loggers
    logging.getLogger('boto3').setLevel(logging.WARNING)
    logging.getLogger('botocore').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)
    
    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configuration initialized",
        extra={
            "log_directory": str(log_dir),
            "handlers": [
                "console", "application_file", "media_processing_file", 
                "error_file", "performance_file"
            ]
        }
    )

def get_performance_logger():
    """Get the performance logger for tracking slow operations"""
    return logging.getLogger('performance')

def log_performance_warning(
    operation: str,
    duration_seconds: float,
    threshold_seconds: float,
    **context
):
    """Log a performance warning for slow operations"""
    
    perf_logger = get_performance_logger()
    perf_logger.warning(
        f"Slow operation detected: {operation}",
        extra={
            "operation": operation,
            "duration_seconds": duration_seconds,
            "threshold_seconds": threshold_seconds,
            "performance_ratio": duration_seconds / threshold_seconds,
            **context
        }
    )

def log_media_processing_event(
    event_type: str,
    session_id: str,
    user_id: str,
    stage: str,
    **context
):
    """Log a media processing event with structured data"""
    
    logger = logging.getLogger('services.video_merge_service')
    logger.info(
        f"Media processing event: {event_type}",
        extra={
            "event_type": event_type,
            "session_id": session_id,
            "user_id": user_id,
            "stage": stage,
            **context
        }
    )

def log_system_alert(
    alert_level: str,
    title: str,
    message: str,
    **context
):
    """Log a system alert"""
    
    logger = logging.getLogger('services.monitoring_service')
    
    # Map alert levels to log levels
    level_mapping = {
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
        'critical': logging.CRITICAL
    }
    
    log_level = level_mapping.get(alert_level.lower(), logging.WARNING)
    
    logger.log(
        log_level,
        f"SYSTEM ALERT [{alert_level.upper()}] {title}: {message}",
        extra={
            "alert_level": alert_level,
            "alert_title": title,
            "alert_message": message,
            **context
        }
    )

# Initialize logging when module is imported
setup_logging()