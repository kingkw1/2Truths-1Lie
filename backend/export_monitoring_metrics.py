#!/usr/bin/env python3
"""
Monitoring Metrics Export Script
Exports media processing metrics to external monitoring systems
"""
import asyncio
import json
import logging
import argparse
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
import requests
import boto3
from dataclasses import dataclass

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent))

from services.monitoring_service import media_monitor
from services.health_check_service import health_check_service
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class MetricExportConfig:
    """Configuration for metric export"""
    export_type: str
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    namespace: Optional[str] = None
    tags: Optional[Dict[str, str]] = None
    enabled: bool = True

class MetricsExporter:
    """Export metrics to various monitoring systems"""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config = self._load_config(config_file)
        self.session = requests.Session()
        
    def _load_config(self, config_file: Optional[str]) -> Dict[str, Any]:
        """Load export configuration"""
        if config_file and Path(config_file).exists():
            with open(config_file, 'r') as f:
                return json.load(f)
        
        # Default configuration
        return {
            "prometheus": {
                "enabled": False,
                "pushgateway_url": "http://localhost:9091",
                "job_name": "media-processing"
            },
            "datadog": {
                "enabled": False,
                "api_key": "",
                "app_key": "",
                "api_url": "https://api.datadoghq.com/api/v1"
            },
            "cloudwatch": {
                "enabled": False,
                "namespace": "MediaProcessing",
                "region": "us-east-1"
            },
            "influxdb": {
                "enabled": False,
                "url": "http://localhost:8086",
                "database": "media_processing",
                "username": "",
                "password": ""
            }
        }
    
    async def export_all_metrics(self) -> Dict[str, bool]:
        """Export metrics to all configured systems"""
        results = {}
        
        # Collect metrics
        metrics_data = await self._collect_metrics()
        
        # Export to each configured system
        if self.config.get("prometheus", {}).get("enabled"):
            results["prometheus"] = await self._export_to_prometheus(metrics_data)
        
        if self.config.get("datadog", {}).get("enabled"):
            results["datadog"] = await self._export_to_datadog(metrics_data)
        
        if self.config.get("cloudwatch", {}).get("enabled"):
            results["cloudwatch"] = await self._export_to_cloudwatch(metrics_data)
        
        if self.config.get("influxdb", {}).get("enabled"):
            results["influxdb"] = await self._export_to_influxdb(metrics_data)
        
        return results
    
    async def _collect_metrics(self) -> Dict[str, Any]:
        """Collect all metrics from monitoring system"""
        logger.info("Collecting metrics from monitoring system")
        
        # Get processing statistics
        processing_stats = media_monitor.get_processing_stats(hours=1)
        
        # Get system health
        health_data = await health_check_service.run_all_checks(use_cache=False)
        
        # Get system metrics
        system_health = media_monitor.get_system_health()
        
        # Get active sessions
        active_sessions = len(media_monitor.active_sessions)
        
        # Get recent alerts
        recent_alerts = media_monitor.get_alerts(limit=100)
        alert_counts = {
            "critical": len([a for a in recent_alerts if a.get("level") == "critical"]),
            "error": len([a for a in recent_alerts if a.get("level") == "error"]),
            "warning": len([a for a in recent_alerts if a.get("level") == "warning"]),
            "info": len([a for a in recent_alerts if a.get("level") == "info"])
        }
        
        timestamp = datetime.utcnow()
        
        return {
            "timestamp": timestamp,
            "processing": {
                "total_operations": processing_stats.get("total_operations", 0),
                "successful_operations": processing_stats.get("successful_operations", 0),
                "failed_operations": processing_stats.get("failed_operations", 0),
                "success_rate": processing_stats.get("success_rate", 0.0),
                "error_rate": processing_stats.get("error_rate", 0.0),
                "average_duration": processing_stats.get("average_duration", 0.0),
                "active_sessions": active_sessions
            },
            "system": {
                "health_status": self._health_status_to_numeric(health_data.get("overall_status", "unknown")),
                "cpu_usage_percent": system_health.get("system_metrics", {}).get("cpu_usage_percent", 0),
                "memory_usage_percent": system_health.get("system_metrics", {}).get("memory_usage_percent", 0),
                "disk_usage_percent": system_health.get("system_metrics", {}).get("disk_usage_percent", 0),
                "temp_dir_size_mb": system_health.get("system_metrics", {}).get("temp_dir_size_mb", 0)
            },
            "alerts": alert_counts,
            "stages": processing_stats.get("stage_breakdown", {}),
            "errors": processing_stats.get("error_breakdown", {})
        }
    
    def _health_status_to_numeric(self, status: str) -> int:
        """Convert health status to numeric value"""
        mapping = {
            "healthy": 2,
            "warning": 1,
            "critical": 0,
            "unknown": -1
        }
        return mapping.get(status.lower(), -1)
    
    async def _export_to_prometheus(self, metrics: Dict[str, Any]) -> bool:
        """Export metrics to Prometheus Pushgateway"""
        try:
            config = self.config["prometheus"]
            pushgateway_url = config["pushgateway_url"]
            job_name = config["job_name"]
            
            # Format metrics for Prometheus
            prometheus_metrics = self._format_prometheus_metrics(metrics)
            
            # Push to Pushgateway
            url = f"{pushgateway_url}/metrics/job/{job_name}"
            response = await asyncio.to_thread(
                self.session.post,
                url,
                data=prometheus_metrics,
                headers={"Content-Type": "text/plain"}
            )
            
            if response.status_code == 200:
                logger.info("Successfully exported metrics to Prometheus")
                return True
            else:
                logger.error(f"Failed to export to Prometheus: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error exporting to Prometheus: {str(e)}")
            return False
    
    def _format_prometheus_metrics(self, metrics: Dict[str, Any]) -> str:
        """Format metrics for Prometheus"""
        lines = []
        timestamp_ms = int(metrics["timestamp"].timestamp() * 1000)
        
        # Processing metrics
        processing = metrics["processing"]
        lines.extend([
            f"media_processing_operations_total {processing['total_operations']} {timestamp_ms}",
            f"media_processing_operations_successful {processing['successful_operations']} {timestamp_ms}",
            f"media_processing_operations_failed {processing['failed_operations']} {timestamp_ms}",
            f"media_processing_success_rate {processing['success_rate']} {timestamp_ms}",
            f"media_processing_error_rate {processing['error_rate']} {timestamp_ms}",
            f"media_processing_duration_average_seconds {processing['average_duration']} {timestamp_ms}",
            f"media_processing_sessions_active {processing['active_sessions']} {timestamp_ms}"
        ])
        
        # System metrics
        system = metrics["system"]
        lines.extend([
            f"media_processing_system_health {system['health_status']} {timestamp_ms}",
            f"media_processing_cpu_usage_percent {system['cpu_usage_percent']} {timestamp_ms}",
            f"media_processing_memory_usage_percent {system['memory_usage_percent']} {timestamp_ms}",
            f"media_processing_disk_usage_percent {system['disk_usage_percent']} {timestamp_ms}",
            f"media_processing_temp_dir_size_mb {system['temp_dir_size_mb']} {timestamp_ms}"
        ])
        
        # Alert metrics
        alerts = metrics["alerts"]
        for level, count in alerts.items():
            lines.append(f"media_processing_alerts{{level=\"{level}\"}} {count} {timestamp_ms}")
        
        # Stage metrics
        stages = metrics["stages"]
        for stage, stage_data in stages.items():
            if isinstance(stage_data, dict):
                lines.extend([
                    f"media_processing_stage_count{{stage=\"{stage}\"}} {stage_data.get('count', 0)} {timestamp_ms}",
                    f"media_processing_stage_duration_average{{stage=\"{stage}\"}} {stage_data.get('average_duration', 0)} {timestamp_ms}",
                    f"media_processing_stage_success_count{{stage=\"{stage}\"}} {stage_data.get('success_count', 0)} {timestamp_ms}"
                ])
        
        return "\n".join(lines) + "\n"
    
    async def _export_to_datadog(self, metrics: Dict[str, Any]) -> bool:
        """Export metrics to Datadog"""
        try:
            config = self.config["datadog"]
            api_key = config["api_key"]
            api_url = config["api_url"]
            
            if not api_key:
                logger.error("Datadog API key not configured")
                return False
            
            # Format metrics for Datadog
            datadog_metrics = self._format_datadog_metrics(metrics)
            
            # Send to Datadog
            url = f"{api_url}/series"
            headers = {
                "Content-Type": "application/json",
                "DD-API-KEY": api_key
            }
            
            response = await asyncio.to_thread(
                self.session.post,
                url,
                json={"series": datadog_metrics},
                headers=headers
            )
            
            if response.status_code == 202:
                logger.info("Successfully exported metrics to Datadog")
                return True
            else:
                logger.error(f"Failed to export to Datadog: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error exporting to Datadog: {str(e)}")
            return False
    
    def _format_datadog_metrics(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format metrics for Datadog"""
        series = []
        timestamp = int(metrics["timestamp"].timestamp())
        
        base_tags = ["service:media-processing", f"environment:{settings.ENVIRONMENT}"]
        
        # Processing metrics
        processing = metrics["processing"]
        series.extend([
            {
                "metric": "media_processing.operations.total",
                "points": [[timestamp, processing["total_operations"]]],
                "tags": base_tags,
                "type": "count"
            },
            {
                "metric": "media_processing.success_rate",
                "points": [[timestamp, processing["success_rate"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.error_rate",
                "points": [[timestamp, processing["error_rate"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.duration.average",
                "points": [[timestamp, processing["average_duration"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.sessions.active",
                "points": [[timestamp, processing["active_sessions"]]],
                "tags": base_tags,
                "type": "gauge"
            }
        ])
        
        # System metrics
        system = metrics["system"]
        series.extend([
            {
                "metric": "media_processing.system.health",
                "points": [[timestamp, system["health_status"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.system.cpu_usage",
                "points": [[timestamp, system["cpu_usage_percent"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.system.memory_usage",
                "points": [[timestamp, system["memory_usage_percent"]]],
                "tags": base_tags,
                "type": "gauge"
            },
            {
                "metric": "media_processing.system.disk_usage",
                "points": [[timestamp, system["disk_usage_percent"]]],
                "tags": base_tags,
                "type": "gauge"
            }
        ])
        
        # Alert metrics
        alerts = metrics["alerts"]
        for level, count in alerts.items():
            series.append({
                "metric": "media_processing.alerts",
                "points": [[timestamp, count]],
                "tags": base_tags + [f"level:{level}"],
                "type": "gauge"
            })
        
        return series
    
    async def _export_to_cloudwatch(self, metrics: Dict[str, Any]) -> bool:
        """Export metrics to AWS CloudWatch"""
        try:
            config = self.config["cloudwatch"]
            namespace = config["namespace"]
            region = config["region"]
            
            # Create CloudWatch client
            cloudwatch = boto3.client('cloudwatch', region_name=region)
            
            # Format metrics for CloudWatch
            metric_data = self._format_cloudwatch_metrics(metrics, namespace)
            
            # Send metrics in batches (CloudWatch limit is 20 metrics per request)
            batch_size = 20
            for i in range(0, len(metric_data), batch_size):
                batch = metric_data[i:i + batch_size]
                
                await asyncio.to_thread(
                    cloudwatch.put_metric_data,
                    Namespace=namespace,
                    MetricData=batch
                )
            
            logger.info(f"Successfully exported {len(metric_data)} metrics to CloudWatch")
            return True
            
        except Exception as e:
            logger.error(f"Error exporting to CloudWatch: {str(e)}")
            return False
    
    def _format_cloudwatch_metrics(self, metrics: Dict[str, Any], namespace: str) -> List[Dict[str, Any]]:
        """Format metrics for CloudWatch"""
        metric_data = []
        timestamp = metrics["timestamp"]
        
        # Processing metrics
        processing = metrics["processing"]
        metric_data.extend([
            {
                "MetricName": "TotalOperations",
                "Value": processing["total_operations"],
                "Unit": "Count",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "SuccessRate",
                "Value": processing["success_rate"] * 100,
                "Unit": "Percent",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "ErrorRate",
                "Value": processing["error_rate"] * 100,
                "Unit": "Percent",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "AverageDuration",
                "Value": processing["average_duration"],
                "Unit": "Seconds",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "ActiveSessions",
                "Value": processing["active_sessions"],
                "Unit": "Count",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            }
        ])
        
        # System metrics
        system = metrics["system"]
        metric_data.extend([
            {
                "MetricName": "SystemHealth",
                "Value": system["health_status"],
                "Unit": "None",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "CPUUsage",
                "Value": system["cpu_usage_percent"],
                "Unit": "Percent",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "MemoryUsage",
                "Value": system["memory_usage_percent"],
                "Unit": "Percent",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            },
            {
                "MetricName": "DiskUsage",
                "Value": system["disk_usage_percent"],
                "Unit": "Percent",
                "Timestamp": timestamp,
                "Dimensions": [{"Name": "Service", "Value": "MediaProcessing"}]
            }
        ])
        
        return metric_data
    
    async def _export_to_influxdb(self, metrics: Dict[str, Any]) -> bool:
        """Export metrics to InfluxDB"""
        try:
            config = self.config["influxdb"]
            url = config["url"]
            database = config["database"]
            username = config.get("username")
            password = config.get("password")
            
            # Format metrics for InfluxDB
            influx_data = self._format_influxdb_metrics(metrics)
            
            # Prepare request
            write_url = f"{url}/write?db={database}"
            auth = (username, password) if username and password else None
            
            response = await asyncio.to_thread(
                self.session.post,
                write_url,
                data=influx_data,
                auth=auth,
                headers={"Content-Type": "text/plain"}
            )
            
            if response.status_code == 204:
                logger.info("Successfully exported metrics to InfluxDB")
                return True
            else:
                logger.error(f"Failed to export to InfluxDB: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error exporting to InfluxDB: {str(e)}")
            return False
    
    def _format_influxdb_metrics(self, metrics: Dict[str, Any]) -> str:
        """Format metrics for InfluxDB line protocol"""
        lines = []
        timestamp_ns = int(metrics["timestamp"].timestamp() * 1_000_000_000)
        
        # Processing metrics
        processing = metrics["processing"]
        lines.extend([
            f"media_processing,type=operations total={processing['total_operations']},successful={processing['successful_operations']},failed={processing['failed_operations']} {timestamp_ns}",
            f"media_processing,type=rates success_rate={processing['success_rate']},error_rate={processing['error_rate']} {timestamp_ns}",
            f"media_processing,type=performance average_duration={processing['average_duration']},active_sessions={processing['active_sessions']} {timestamp_ns}"
        ])
        
        # System metrics
        system = metrics["system"]
        lines.append(
            f"media_processing,type=system health_status={system['health_status']},cpu_usage={system['cpu_usage_percent']},memory_usage={system['memory_usage_percent']},disk_usage={system['disk_usage_percent']},temp_dir_size={system['temp_dir_size_mb']} {timestamp_ns}"
        )
        
        # Alert metrics
        alerts = metrics["alerts"]
        alert_fields = ",".join([f"{level}={count}" for level, count in alerts.items()])
        lines.append(f"media_processing,type=alerts {alert_fields} {timestamp_ns}")
        
        return "\n".join(lines) + "\n"

async def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description="Export media processing metrics")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--export-type", choices=["prometheus", "datadog", "cloudwatch", "influxdb", "all"], 
                       default="all", help="Export type")
    parser.add_argument("--dry-run", action="store_true", help="Collect metrics but don't export")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create exporter
    exporter = MetricsExporter(args.config)
    
    if args.dry_run:
        # Just collect and display metrics
        metrics = await exporter._collect_metrics()
        print(json.dumps(metrics, indent=2, default=str))
        return
    
    # Export metrics
    if args.export_type == "all":
        results = await exporter.export_all_metrics()
    else:
        # Export to specific system
        metrics = await exporter._collect_metrics()
        if args.export_type == "prometheus":
            results = {"prometheus": await exporter._export_to_prometheus(metrics)}
        elif args.export_type == "datadog":
            results = {"datadog": await exporter._export_to_datadog(metrics)}
        elif args.export_type == "cloudwatch":
            results = {"cloudwatch": await exporter._export_to_cloudwatch(metrics)}
        elif args.export_type == "influxdb":
            results = {"influxdb": await exporter._export_to_influxdb(metrics)}
    
    # Print results
    print("Export Results:")
    for system, success in results.items():
        status = "SUCCESS" if success else "FAILED"
        print(f"  {system}: {status}")
    
    # Exit with error code if any exports failed
    if not all(results.values()):
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())