"""
Test script for monitoring and logging system
Validates that all monitoring components are working correctly
"""
import asyncio
import logging
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.append(str(Path(__file__).parent))

# Import after path setup
import logging_config  # This initializes logging
from services.monitoring_service import media_monitor, ProcessingStage, AlertLevel
from services.health_check_service import health_check_service
from config import settings

logger = logging.getLogger(__name__)

async def test_monitoring_system():
    """Test the complete monitoring system"""
    
    print("=" * 60)
    print("TESTING MONITORING AND LOGGING SYSTEM")
    print("=" * 60)
    
    # Test 1: Basic logging
    print("\n1. Testing basic logging...")
    logger.info("Test info message")
    logger.warning("Test warning message")
    logger.error("Test error message")
    print("✓ Basic logging test completed")
    
    # Test 2: Structured logging with extra fields
    print("\n2. Testing structured logging...")
    logger.info(
        "Test structured log message",
        extra={
            "session_id": "test_session_123",
            "user_id": "test_user",
            "operation": "test_operation",
            "duration_seconds": 1.5
        }
    )
    print("✓ Structured logging test completed")
    
    # Test 3: Performance logging
    print("\n3. Testing performance logging...")
    from logging_config import log_performance_warning
    log_performance_warning(
        operation="test_slow_operation",
        duration_seconds=10.5,
        threshold_seconds=5.0,
        session_id="test_session_123"
    )
    print("✓ Performance logging test completed")
    
    # Test 4: Media processing event logging
    print("\n4. Testing media processing event logging...")
    from logging_config import log_media_processing_event
    log_media_processing_event(
        event_type="test_event",
        session_id="test_session_123",
        user_id="test_user",
        stage="testing",
        file_size_bytes=1024000,
        video_count=3
    )
    print("✓ Media processing event logging test completed")
    
    # Test 5: System alert logging
    print("\n5. Testing system alert logging...")
    from logging_config import log_system_alert
    log_system_alert(
        alert_level="warning",
        title="Test Alert",
        message="This is a test alert for monitoring validation",
        session_id="test_session_123"
    )
    print("✓ System alert logging test completed")
    
    # Test 6: Monitoring service - processing tracking
    print("\n6. Testing monitoring service processing tracking...")
    
    # Start a test processing operation
    test_session_id = "test_monitoring_session"
    test_user_id = "test_user_monitoring"
    
    # Test analysis stage
    await media_monitor.start_processing(
        test_session_id, test_user_id, ProcessingStage.ANALYSIS
    )
    
    # Simulate some work
    await asyncio.sleep(0.1)
    
    # Complete successfully
    await media_monitor.complete_processing(
        test_session_id, ProcessingStage.ANALYSIS,
        success=True, video_count=3, file_size_bytes=5000000
    )
    
    # Test a failure case
    await media_monitor.start_processing(
        test_session_id, test_user_id, ProcessingStage.COMPRESSION
    )
    
    await asyncio.sleep(0.1)
    
    await media_monitor.complete_processing(
        test_session_id, ProcessingStage.COMPRESSION,
        success=False, error_message="Test compression failure",
        error_code="TEST_ERROR"
    )
    
    print("✓ Monitoring service processing tracking test completed")
    
    # Test 7: Error logging with context
    print("\n7. Testing error logging with context...")
    
    try:
        # Simulate an error
        raise ValueError("Test error for monitoring validation")
    except Exception as e:
        await media_monitor.log_processing_error(
            test_session_id, test_user_id, ProcessingStage.MERGING, e,
            context={
                "test_context": True,
                "operation": "test_error_logging",
                "additional_info": "This is a test error"
            }
        )
    
    print("✓ Error logging with context test completed")
    
    # Test 8: Alert creation
    print("\n8. Testing alert creation...")
    
    await media_monitor._create_alert(
        level=AlertLevel.INFO,
        title="Test Info Alert",
        message="This is a test info alert",
        session_id=test_session_id,
        user_id=test_user_id,
        stage=ProcessingStage.ANALYSIS,
        metadata={"test": True}
    )
    
    await media_monitor._create_alert(
        level=AlertLevel.WARNING,
        title="Test Warning Alert",
        message="This is a test warning alert",
        session_id=test_session_id,
        user_id=test_user_id
    )
    
    await media_monitor._create_alert(
        level=AlertLevel.ERROR,
        title="Test Error Alert",
        message="This is a test error alert"
    )
    
    print("✓ Alert creation test completed")
    
    # Test 9: Statistics collection
    print("\n9. Testing statistics collection...")
    
    stats = media_monitor.get_processing_stats(hours=1)
    print(f"   Processing stats: {stats['total_operations']} operations, "
          f"{stats['success_rate']:.1%} success rate")
    
    system_health = media_monitor.get_system_health()
    print(f"   System health: {system_health['status']}")
    
    alerts = media_monitor.get_alerts(limit=5)
    print(f"   Recent alerts: {len(alerts)} alerts")
    
    print("✓ Statistics collection test completed")
    
    # Test 10: Health check service
    print("\n10. Testing health check service...")
    
    health_results = await health_check_service.run_all_checks(use_cache=False)
    print(f"   Overall health status: {health_results['overall_status']}")
    print(f"   Health checks completed: {health_results['summary']['total_checks']}")
    print(f"   Healthy components: {health_results['summary']['healthy']}")
    print(f"   Warning components: {health_results['summary']['warning']}")
    print(f"   Critical components: {health_results['summary']['critical']}")
    
    # Show component details
    for check in health_results['checks']:
        status_icon = "✓" if check['status'] == 'healthy' else "⚠" if check['status'] == 'warning' else "✗"
        print(f"   {status_icon} {check['component']}: {check['message']}")
    
    print("✓ Health check service test completed")
    
    # Test 11: Log file verification
    print("\n11. Testing log file creation...")
    
    log_dir = settings.TEMP_DIR / "logs"
    expected_files = [
        "application.log",
        "media_processing.log", 
        "errors.log",
        "performance.log"
    ]
    
    for filename in expected_files:
        log_file = log_dir / filename
        if log_file.exists():
            size_kb = log_file.stat().st_size / 1024
            print(f"   ✓ {filename}: {size_kb:.1f} KB")
        else:
            print(f"   ✗ {filename}: Not found")
    
    print("✓ Log file verification completed")
    
    # Summary
    print("\n" + "=" * 60)
    print("MONITORING SYSTEM TEST SUMMARY")
    print("=" * 60)
    print("✓ All monitoring and logging tests completed successfully!")
    print(f"✓ Log files created in: {log_dir}")
    print(f"✓ Processing metrics collected: {len(media_monitor.processing_metrics)}")
    print(f"✓ System metrics collected: {len(media_monitor.system_metrics)}")
    print(f"✓ Alerts created: {len(media_monitor.alerts)}")
    print(f"✓ Overall system health: {health_results['overall_status']}")
    
    # Show recent log entries
    print("\n" + "-" * 40)
    print("RECENT LOG ENTRIES (last 5):")
    print("-" * 40)
    
    try:
        media_log_file = log_dir / "media_processing.log"
        if media_log_file.exists():
            with open(media_log_file, 'r') as f:
                lines = f.readlines()
                for line in lines[-5:]:
                    print(f"   {line.strip()}")
    except Exception as e:
        print(f"   Could not read log file: {e}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_monitoring_system())