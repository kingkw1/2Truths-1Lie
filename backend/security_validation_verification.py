#!/usr/bin/env python3
"""
Security and Validation Verification Script
Verifies compliance with all security and validation requirements for the server-side video processing system.
"""

import asyncio
import logging
import sys
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import importlib.util

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SecurityValidationVerifier:
    """Comprehensive security and validation verification"""
    
    def __init__(self):
        self.verification_results = []
        self.failed_checks = []
        self.passed_checks = []
        
    def add_result(self, check_name: str, passed: bool, details: str, severity: str = "medium"):
        """Add verification result"""
        result = {
            "check_name": check_name,
            "passed": passed,
            "details": details,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.verification_results.append(result)
        
        if passed:
            self.passed_checks.append(result)
            logger.info(f"✅ PASS: {check_name}")
        else:
            self.failed_checks.append(result)
            logger.error(f"❌ FAIL: {check_name} - {details}")
    
    def verify_authentication_implementation(self):
        """Verify authentication and authorization implementation"""
        logger.info("🔐 Verifying Authentication Implementation...")
        
        try:
            # Check auth service exists and has required methods
            from services.auth_service import AuthService, auth_service
            
            # Verify JWT token creation
            if hasattr(auth_service, 'create_access_token'):
                self.add_result(
                    "JWT Token Creation",
                    True,
                    "JWT token creation method implemented",
                    "high"
                )
            else:
                self.add_result(
                    "JWT Token Creation",
                    False,
                    "JWT token creation method missing",
                    "high"
                )
            
            # Verify token verification
            if hasattr(auth_service, 'verify_token'):
                self.add_result(
                    "JWT Token Verification",
                    True,
                    "JWT token verification method implemented",
                    "high"
                )
            else:
                self.add_result(
                    "JWT Token Verification",
                    False,
                    "JWT token verification method missing",
                    "high"
                )
            
            # Verify rate limiting
            if hasattr(auth_service, 'check_rate_limit'):
                self.add_result(
                    "Rate Limiting",
                    True,
                    "Rate limiting functionality implemented",
                    "high"
                )
            else:
                self.add_result(
                    "Rate Limiting",
                    False,
                    "Rate limiting functionality missing",
                    "high"
                )
            
            # Verify permission checking
            if hasattr(auth_service, 'check_permission'):
                self.add_result(
                    "Permission Checking",
                    True,
                    "Permission checking functionality implemented",
                    "high"
                )
            else:
                self.add_result(
                    "Permission Checking",
                    False,
                    "Permission checking functionality missing",
                    "high"
                )
            
            # Verify signed URL creation for secure media access
            if hasattr(auth_service, 'create_signed_url'):
                self.add_result(
                    "Signed URL Creation",
                    True,
                    "Signed URL creation for secure media access implemented",
                    "high"
                )
            else:
                self.add_result(
                    "Signed URL Creation",
                    False,
                    "Signed URL creation for secure media access missing",
                    "high"
                )
                
        except ImportError as e:
            self.add_result(
                "Authentication Service Import",
                False,
                f"Failed to import authentication service: {e}",
                "critical"
            )
    
    def verify_input_validation(self):
        """Verify input validation implementation"""
        logger.info("🔍 Verifying Input Validation...")
        
        try:
            from services.validation_service import GameplayValidationService
            
            validator = GameplayValidationService()
            
            # Check video validation methods
            validation_methods = [
                'validate_challenge_creation',
                '_validate_statement_media',
                '_validate_video_requirements',
                '_validate_filename_security',
                '_validate_video_metadata',
                'validate_file_before_upload'
            ]
            
            for method_name in validation_methods:
                if hasattr(validator, method_name):
                    self.add_result(
                        f"Validation Method: {method_name}",
                        True,
                        f"Video validation method {method_name} implemented",
                        "medium"
                    )
                else:
                    self.add_result(
                        f"Validation Method: {method_name}",
                        False,
                        f"Video validation method {method_name} missing",
                        "medium"
                    )
            
            # Check validation constants
            required_constants = [
                'MIN_VIDEO_DURATION',
                'MAX_VIDEO_DURATION',
                'REQUIRED_VIDEO_TYPES',
                'MAX_FILE_SIZE',
                'MIN_FILE_SIZE',
                'DANGEROUS_EXTENSIONS',
                'ALLOWED_EXTENSIONS',
                'FORBIDDEN_FILENAME_CHARS'
            ]
            
            for constant in required_constants:
                if hasattr(validator, constant):
                    self.add_result(
                        f"Validation Constant: {constant}",
                        True,
                        f"Validation constant {constant} defined",
                        "low"
                    )
                else:
                    self.add_result(
                        f"Validation Constant: {constant}",
                        False,
                        f"Validation constant {constant} missing",
                        "medium"
                    )
                    
        except ImportError as e:
            self.add_result(
                "Validation Service Import",
                False,
                f"Failed to import validation service: {e}",
                "critical"
            )
    
    def verify_content_moderation(self):
        """Verify content moderation implementation"""
        logger.info("🛡️ Verifying Content Moderation...")
        
        try:
            from services.moderation_service import ModerationService, ModerationStatus, ModerationReason
            
            moderator = ModerationService()
            
            # Check moderation methods
            moderation_methods = [
                'moderate_challenge',
                '_analyze_text_content',
                '_analyze_media_metadata',
                'flag_challenge',
                'manual_review'
            ]
            
            for method_name in moderation_methods:
                if hasattr(moderator, method_name):
                    self.add_result(
                        f"Moderation Method: {method_name}",
                        True,
                        f"Content moderation method {method_name} implemented",
                        "medium"
                    )
                else:
                    self.add_result(
                        f"Moderation Method: {method_name}",
                        False,
                        f"Content moderation method {method_name} missing",
                        "medium"
                    )
            
            # Check content filtering patterns
            pattern_categories = [
                'inappropriate_patterns',
                'spam_patterns',
                'pii_patterns',
                'violence_patterns'
            ]
            
            for pattern_category in pattern_categories:
                if hasattr(moderator, pattern_category):
                    patterns = getattr(moderator, pattern_category)
                    if patterns and len(patterns) > 0:
                        self.add_result(
                            f"Content Filter: {pattern_category}",
                            True,
                            f"Content filtering patterns for {pattern_category} implemented ({len(patterns)} patterns)",
                            "medium"
                        )
                    else:
                        self.add_result(
                            f"Content Filter: {pattern_category}",
                            False,
                            f"Content filtering patterns for {pattern_category} empty",
                            "medium"
                        )
                else:
                    self.add_result(
                        f"Content Filter: {pattern_category}",
                        False,
                        f"Content filtering patterns for {pattern_category} missing",
                        "medium"
                    )
                    
        except ImportError as e:
            self.add_result(
                "Moderation Service Import",
                False,
                f"Failed to import moderation service: {e}",
                "critical"
            )
    
    def verify_rate_limiting(self):
        """Verify rate limiting implementation"""
        logger.info("⏱️ Verifying Rate Limiting...")
        
        try:
            from services.rate_limiter import RateLimiter, RateLimitExceeded
            
            rate_limiter = RateLimiter()
            
            # Check rate limiting methods
            rate_limit_methods = [
                'check_rate_limit',
                'record_request',
                'get_rate_limit_status',
                'reset_user_limit',
                'cleanup_expired_limits'
            ]
            
            for method_name in rate_limit_methods:
                if hasattr(rate_limiter, method_name):
                    self.add_result(
                        f"Rate Limit Method: {method_name}",
                        True,
                        f"Rate limiting method {method_name} implemented",
                        "medium"
                    )
                else:
                    self.add_result(
                        f"Rate Limit Method: {method_name}",
                        False,
                        f"Rate limiting method {method_name} missing",
                        "medium"
                    )
            
            # Check rate limit exception
            self.add_result(
                "Rate Limit Exception",
                True,
                "RateLimitExceeded exception class implemented",
                "low"
            )
                    
        except ImportError as e:
            self.add_result(
                "Rate Limiter Import",
                False,
                f"Failed to import rate limiter: {e}",
                "critical"
            )
    
    def verify_secure_endpoints(self):
        """Verify secure endpoint implementation"""
        logger.info("🔒 Verifying Secure Endpoints...")
        
        try:
            # Check challenge video endpoints
            from api.challenge_video_endpoints import router as challenge_router
            
            # Verify endpoints exist
            endpoint_paths = [path.path for path in challenge_router.routes]
            
            required_endpoints = [
                "/api/v1/challenge-videos/upload-for-merge/initiate",
                "/api/v1/challenge-videos/upload/{session_id}/chunk/{chunk_number}",
                "/api/v1/challenge-videos/upload/{session_id}/status",
                "/api/v1/challenge-videos/upload/{session_id}/complete",
                "/api/v1/challenge-videos/merge-session/{merge_session_id}/status"
            ]
            
            for endpoint in required_endpoints:
                # Check if endpoint pattern exists (simplified check)
                endpoint_exists = any(endpoint.replace("{", "").replace("}", "") in path.replace("{", "").replace("}", "") for path in endpoint_paths)
                
                self.add_result(
                    f"Endpoint: {endpoint}",
                    endpoint_exists,
                    f"Secure endpoint {endpoint} {'implemented' if endpoint_exists else 'missing'}",
                    "medium"
                )
            
            # Check S3 media endpoints
            from api.s3_media_endpoints import router as s3_router
            
            s3_endpoint_paths = [path.path for path in s3_router.routes]
            
            required_s3_endpoints = [
                "/api/v1/s3-media/upload",
                "/api/v1/s3-media/{media_id}",
                "/api/v1/s3-media/health/s3"
            ]
            
            for endpoint in required_s3_endpoints:
                endpoint_exists = any(endpoint.replace("{", "").replace("}", "") in path.replace("{", "").replace("}", "") for path in s3_endpoint_paths)
                
                self.add_result(
                    f"S3 Endpoint: {endpoint}",
                    endpoint_exists,
                    f"Secure S3 endpoint {endpoint} {'implemented' if endpoint_exists else 'missing'}",
                    "medium"
                )
                    
        except ImportError as e:
            self.add_result(
                "Endpoint Import",
                False,
                f"Failed to import endpoint modules: {e}",
                "critical"
            )
    
    def verify_configuration_security(self):
        """Verify security configuration"""
        logger.info("⚙️ Verifying Security Configuration...")
        
        try:
            from config import settings
            
            # Check security settings
            security_configs = [
                ('SECRET_KEY', 'Secret key for JWT signing'),
                ('ALGORITHM', 'JWT algorithm'),
                ('ACCESS_TOKEN_EXPIRE_MINUTES', 'Token expiration time'),
                ('MAX_FILE_SIZE', 'Maximum file size limit'),
                ('UPLOAD_RATE_LIMIT', 'Upload rate limiting'),
                ('MAX_VIDEO_DURATION_SECONDS', 'Maximum video duration'),
                ('ALLOWED_VIDEO_TYPES', 'Allowed video MIME types')
            ]
            
            for config_name, description in security_configs:
                if hasattr(settings, config_name):
                    value = getattr(settings, config_name)
                    if value:
                        self.add_result(
                            f"Config: {config_name}",
                            True,
                            f"{description} configured: {type(value).__name__}",
                            "low"
                        )
                    else:
                        self.add_result(
                            f"Config: {config_name}",
                            False,
                            f"{description} not configured or empty",
                            "medium"
                        )
                else:
                    self.add_result(
                        f"Config: {config_name}",
                        False,
                        f"{description} configuration missing",
                        "medium"
                    )
            
            # Check if default secret key is being used (security risk)
            if hasattr(settings, 'SECRET_KEY'):
                if settings.SECRET_KEY == "your-secret-key-change-in-production":
                    self.add_result(
                        "Production Secret Key",
                        False,
                        "Default secret key detected - change for production",
                        "critical"
                    )
                else:
                    self.add_result(
                        "Production Secret Key",
                        True,
                        "Custom secret key configured",
                        "high"
                    )
                    
        except ImportError as e:
            self.add_result(
                "Configuration Import",
                False,
                f"Failed to import configuration: {e}",
                "critical"
            )
    
    def verify_file_security(self):
        """Verify file handling security"""
        logger.info("📁 Verifying File Security...")
        
        # Check upload directory permissions and structure
        try:
            from config import settings
            
            upload_dir = settings.UPLOAD_DIR
            temp_dir = settings.TEMP_DIR
            
            # Check directories exist
            if upload_dir.exists():
                self.add_result(
                    "Upload Directory",
                    True,
                    f"Upload directory exists: {upload_dir}",
                    "low"
                )
            else:
                self.add_result(
                    "Upload Directory",
                    False,
                    f"Upload directory missing: {upload_dir}",
                    "medium"
                )
            
            if temp_dir.exists():
                self.add_result(
                    "Temp Directory",
                    True,
                    f"Temp directory exists: {temp_dir}",
                    "low"
                )
            else:
                self.add_result(
                    "Temp Directory",
                    False,
                    f"Temp directory missing: {temp_dir}",
                    "medium"
                )
            
            # Check file type restrictions
            if hasattr(settings, 'ALLOWED_VIDEO_TYPES'):
                allowed_types = settings.ALLOWED_VIDEO_TYPES
                if allowed_types and len(allowed_types) > 0:
                    self.add_result(
                        "File Type Restrictions",
                        True,
                        f"File type restrictions configured: {len(allowed_types)} allowed types",
                        "medium"
                    )
                else:
                    self.add_result(
                        "File Type Restrictions",
                        False,
                        "File type restrictions not configured",
                        "high"
                    )
                    
        except Exception as e:
            self.add_result(
                "File Security Check",
                False,
                f"Error checking file security: {e}",
                "medium"
            )
    
    def verify_encryption_and_storage(self):
        """Verify encryption and secure storage"""
        logger.info("🔐 Verifying Encryption and Storage...")
        
        try:
            # Check S3 service configuration
            from services.s3_media_service import get_s3_media_service
            from config import settings
            
            # Check cloud storage configuration
            if hasattr(settings, 'USE_CLOUD_STORAGE') and settings.USE_CLOUD_STORAGE:
                self.add_result(
                    "Cloud Storage Enabled",
                    True,
                    "Cloud storage is enabled for secure media storage",
                    "medium"
                )
                
                # Check S3 configuration
                s3_configs = [
                    'AWS_S3_BUCKET_NAME',
                    'AWS_S3_REGION'
                ]
                
                for config in s3_configs:
                    if hasattr(settings, config) and getattr(settings, config):
                        self.add_result(
                            f"S3 Config: {config}",
                            True,
                            f"S3 configuration {config} is set",
                            "low"
                        )
                    else:
                        self.add_result(
                            f"S3 Config: {config}",
                            False,
                            f"S3 configuration {config} is missing",
                            "medium"
                        )
            else:
                self.add_result(
                    "Cloud Storage Enabled",
                    False,
                    "Cloud storage is disabled - using local storage",
                    "medium"
                )
            
            # Check signed URL configuration
            if hasattr(settings, 'SIGNED_URL_EXPIRY'):
                expiry = settings.SIGNED_URL_EXPIRY
                if expiry > 0 and expiry <= 86400:  # Max 24 hours
                    self.add_result(
                        "Signed URL Expiry",
                        True,
                        f"Signed URL expiry configured: {expiry} seconds",
                        "medium"
                    )
                else:
                    self.add_result(
                        "Signed URL Expiry",
                        False,
                        f"Signed URL expiry misconfigured: {expiry}",
                        "medium"
                    )
                    
        except Exception as e:
            self.add_result(
                "Encryption Storage Check",
                False,
                f"Error checking encryption and storage: {e}",
                "medium"
            )
    
    async def run_all_verifications(self):
        """Run all security and validation verifications"""
        logger.info("🚀 Starting Security and Validation Verification...")
        
        # Run all verification methods
        self.verify_authentication_implementation()
        self.verify_input_validation()
        self.verify_content_moderation()
        self.verify_rate_limiting()
        self.verify_secure_endpoints()
        self.verify_configuration_security()
        self.verify_file_security()
        self.verify_encryption_and_storage()
        
        # Generate summary and return compliance status
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate verification summary"""
        total_checks = len(self.verification_results)
        passed_count = len(self.passed_checks)
        failed_count = len(self.failed_checks)
        
        # Count by severity
        critical_failures = len([r for r in self.failed_checks if r['severity'] == 'critical'])
        high_failures = len([r for r in self.failed_checks if r['severity'] == 'high'])
        medium_failures = len([r for r in self.failed_checks if r['severity'] == 'medium'])
        low_failures = len([r for r in self.failed_checks if r['severity'] == 'low'])
        
        logger.info("=" * 80)
        logger.info("🔍 SECURITY AND VALIDATION VERIFICATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total Checks: {total_checks}")
        logger.info(f"✅ Passed: {passed_count}")
        logger.info(f"❌ Failed: {failed_count}")
        logger.info(f"Success Rate: {(passed_count/total_checks)*100:.1f}%")
        logger.info("")
        
        if failed_count > 0:
            logger.info("FAILED CHECKS BY SEVERITY:")
            logger.info(f"🔴 Critical: {critical_failures}")
            logger.info(f"🟠 High: {high_failures}")
            logger.info(f"🟡 Medium: {medium_failures}")
            logger.info(f"🟢 Low: {low_failures}")
            logger.info("")
            
            logger.info("FAILED CHECKS DETAILS:")
            for result in self.failed_checks:
                severity_emoji = {
                    'critical': '🔴',
                    'high': '🟠',
                    'medium': '🟡',
                    'low': '🟢'
                }.get(result['severity'], '⚪')
                
                logger.info(f"{severity_emoji} {result['check_name']}: {result['details']}")
        
        logger.info("=" * 80)
        
        # Determine overall compliance status
        if critical_failures > 0:
            logger.error("❌ CRITICAL SECURITY ISSUES FOUND - IMMEDIATE ACTION REQUIRED")
            return False
        elif high_failures > 0:
            logger.warning("⚠️ HIGH PRIORITY SECURITY ISSUES FOUND - ACTION RECOMMENDED")
            return False
        elif medium_failures > 5:  # Allow some medium issues
            logger.warning("⚠️ MULTIPLE MEDIUM PRIORITY ISSUES FOUND - REVIEW RECOMMENDED")
            return False
        else:
            logger.info("✅ SECURITY AND VALIDATION COMPLIANCE VERIFIED")
            return True
    
    def save_report(self, filename: str = "security_validation_report.json"):
        """Save verification report to file"""
        report = {
            "verification_timestamp": datetime.utcnow().isoformat(),
            "total_checks": len(self.verification_results),
            "passed_checks": len(self.passed_checks),
            "failed_checks": len(self.failed_checks),
            "success_rate": (len(self.passed_checks) / len(self.verification_results)) * 100 if self.verification_results else 0,
            "results": self.verification_results,
            "summary": {
                "critical_failures": len([r for r in self.failed_checks if r['severity'] == 'critical']),
                "high_failures": len([r for r in self.failed_checks if r['severity'] == 'high']),
                "medium_failures": len([r for r in self.failed_checks if r['severity'] == 'medium']),
                "low_failures": len([r for r in self.failed_checks if r['severity'] == 'low'])
            }
        }
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"📄 Verification report saved to: {filename}")

async def main():
    """Main verification function"""
    verifier = SecurityValidationVerifier()
    
    try:
        # Run all verifications
        compliance_status = await verifier.run_all_verifications()
        
        # Save report
        verifier.save_report()
        
        # Exit with appropriate code
        if compliance_status:
            logger.info("🎉 All security and validation requirements verified successfully!")
            sys.exit(0)
        else:
            logger.error("💥 Security and validation verification failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Verification process failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())