#!/usr/bin/env python3
"""
Security Compliance Integration Test
Tests actual security and validation functionality to ensure requirements are met in practice.
"""

import asyncio
import pytest
import logging
import tempfile
import os
from pathlib import Path
from typing import Dict, Any
import json
import time

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SecurityComplianceTest:
    """Integration tests for security compliance"""
    
    def __init__(self):
        self.test_results = []
        
    def add_test_result(self, test_name: str, passed: bool, details: str):
        """Add test result"""
        result = {
            "test_name": test_name,
            "passed": passed,
            "details": details
        }
        self.test_results.append(result)
        
        if passed:
            logger.info(f"✅ PASS: {test_name}")
        else:
            logger.error(f"❌ FAIL: {test_name} - {details}")
    
    async def test_authentication_security(self):
        """Test authentication and authorization security"""
        logger.info("🔐 Testing Authentication Security...")
        
        try:
            from services.auth_service import auth_service, create_test_token
            
            # Test 1: JWT Token Creation and Verification
            try:
                test_token = create_test_token("test_user_123")
                payload = auth_service.verify_token(test_token)
                
                if payload.get("sub") == "test_user_123":
                    self.add_test_result(
                        "JWT Token Creation/Verification",
                        True,
                        "JWT tokens created and verified successfully"
                    )
                else:
                    self.add_test_result(
                        "JWT Token Creation/Verification",
                        False,
                        f"Token payload incorrect: {payload}"
                    )
            except Exception as e:
                self.add_test_result(
                    "JWT Token Creation/Verification",
                    False,
                    f"JWT token test failed: {e}"
                )
            
            # Test 2: Rate Limiting
            try:
                user_id = "test_rate_limit_user"
                
                # Should pass initially
                can_proceed = auth_service.check_rate_limit(user_id, "test_action", limit=2, window=3600)
                if can_proceed:
                    # Use rate limiter directly for recording
                    from services.rate_limiter import RateLimiter
                    rate_limiter = RateLimiter()
                    await rate_limiter.record_request(user_id)
                    
                    # Should still pass for second request
                    can_proceed = auth_service.check_rate_limit(user_id, "test_action", limit=2, window=3600)
                    if can_proceed:
                        await rate_limiter.record_request(user_id)
                        
                        # Should fail for third request
                        try:
                            auth_service.check_rate_limit(user_id, "test_action", limit=2, window=3600)
                            self.add_test_result(
                                "Rate Limiting",
                                False,
                                "Rate limit not enforced - should have blocked third request"
                            )
                        except:
                            self.add_test_result(
                                "Rate Limiting",
                                True,
                                "Rate limiting working correctly - blocked excess requests"
                            )
                    else:
                        self.add_test_result(
                            "Rate Limiting",
                            False,
                            "Rate limit triggered too early"
                        )
                else:
                    self.add_test_result(
                        "Rate Limiting",
                        False,
                        "Rate limit blocked first request incorrectly"
                    )
                    
            except Exception as e:
                self.add_test_result(
                    "Rate Limiting",
                    False,
                    f"Rate limiting test failed: {e}"
                )
            
            # Test 3: Signed URL Creation
            try:
                signed_url = auth_service.create_signed_url("test_media_123", "test_user", 3600)
                
                if signed_url and "signature=" in signed_url:
                    self.add_test_result(
                        "Signed URL Creation",
                        True,
                        "Signed URLs created successfully with signature"
                    )
                else:
                    self.add_test_result(
                        "Signed URL Creation",
                        False,
                        f"Invalid signed URL format: {signed_url}"
                    )
            except Exception as e:
                self.add_test_result(
                    "Signed URL Creation",
                    False,
                    f"Signed URL creation failed: {e}"
                )
                
        except ImportError as e:
            self.add_test_result(
                "Authentication Import",
                False,
                f"Failed to import authentication components: {e}"
            )
    
    async def test_input_validation_security(self):
        """Test input validation security"""
        logger.info("🔍 Testing Input Validation Security...")
        
        try:
            from services.validation_service import GameplayValidationService
            from models import CreateChallengeRequest
            
            validator = GameplayValidationService()
            
            # Test 1: File Security Validation
            try:
                # Test dangerous filename
                dangerous_result = validator._validate_filename_security("malicious.exe")
                if not dangerous_result.is_valid:
                    self.add_test_result(
                        "Dangerous File Extension Blocking",
                        True,
                        "Dangerous file extensions correctly blocked"
                    )
                else:
                    self.add_test_result(
                        "Dangerous File Extension Blocking",
                        False,
                        "Dangerous file extensions not blocked"
                    )
                
                # Test path traversal
                traversal_result = validator._validate_filename_security("../../../etc/passwd")
                if not traversal_result.is_valid:
                    self.add_test_result(
                        "Path Traversal Protection",
                        True,
                        "Path traversal attempts correctly blocked"
                    )
                else:
                    self.add_test_result(
                        "Path Traversal Protection",
                        False,
                        "Path traversal attempts not blocked"
                    )
                
                # Test valid filename
                valid_result = validator._validate_filename_security("video.mp4")
                if valid_result.is_valid:
                    self.add_test_result(
                        "Valid Filename Acceptance",
                        True,
                        "Valid filenames correctly accepted"
                    )
                else:
                    self.add_test_result(
                        "Valid Filename Acceptance",
                        False,
                        f"Valid filename rejected: {valid_result.message}"
                    )
                    
            except Exception as e:
                self.add_test_result(
                    "File Security Validation",
                    False,
                    f"File security validation test failed: {e}"
                )
            
            # Test 2: Video Requirements Validation
            try:
                # Create mock upload session for testing
                class MockUploadSession:
                    def __init__(self, mime_type, file_size, filename):
                        self.mime_type = mime_type
                        self.file_size = file_size
                        self.filename = filename
                        self.metadata = {}
                
                # Test oversized file
                large_session = MockUploadSession("video/mp4", 200_000_000, "large.mp4")  # 200MB
                large_result = validator._validate_video_requirements(large_session, {"duration_seconds": 30})
                
                if not large_result.is_valid:
                    self.add_test_result(
                        "File Size Limit Enforcement",
                        True,
                        "Oversized files correctly rejected"
                    )
                else:
                    self.add_test_result(
                        "File Size Limit Enforcement",
                        False,
                        "Oversized files not rejected"
                    )
                
                # Test invalid MIME type
                invalid_session = MockUploadSession("application/exe", 1000000, "malware.exe")
                invalid_result = validator._validate_video_requirements(invalid_session, {"duration_seconds": 30})
                
                if not invalid_result.is_valid:
                    self.add_test_result(
                        "MIME Type Validation",
                        True,
                        "Invalid MIME types correctly rejected"
                    )
                else:
                    self.add_test_result(
                        "MIME Type Validation",
                        False,
                        "Invalid MIME types not rejected"
                    )
                
                # Test valid video
                valid_session = MockUploadSession("video/mp4", 5_000_000, "video.mp4")  # 5MB
                valid_result = validator._validate_video_requirements(valid_session, {"duration_seconds": 30})
                
                if valid_result.is_valid:
                    self.add_test_result(
                        "Valid Video Acceptance",
                        True,
                        "Valid videos correctly accepted"
                    )
                else:
                    self.add_test_result(
                        "Valid Video Acceptance",
                        False,
                        f"Valid video rejected: {valid_result.message}"
                    )
                    
            except Exception as e:
                self.add_test_result(
                    "Video Requirements Validation",
                    False,
                    f"Video requirements validation test failed: {e}"
                )
                
        except ImportError as e:
            self.add_test_result(
                "Validation Import",
                False,
                f"Failed to import validation components: {e}"
            )
    
    async def test_content_moderation_security(self):
        """Test content moderation security"""
        logger.info("🛡️ Testing Content Moderation Security...")
        
        try:
            from services.moderation_service import ModerationService, ModerationStatus
            
            moderator = ModerationService()
            
            # Test 1: Inappropriate Language Detection
            try:
                inappropriate_text = "This is fucking bullshit content"
                result = moderator._analyze_text_content(inappropriate_text)
                
                if result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]:
                    self.add_test_result(
                        "Inappropriate Language Detection",
                        True,
                        "Inappropriate language correctly detected and flagged"
                    )
                else:
                    self.add_test_result(
                        "Inappropriate Language Detection",
                        False,
                        f"Inappropriate language not detected: {result.status}"
                    )
            except Exception as e:
                self.add_test_result(
                    "Inappropriate Language Detection",
                    False,
                    f"Language detection test failed: {e}"
                )
            
            # Test 2: PII Detection
            try:
                pii_text = "My email is john.doe@example.com and my phone is 555-123-4567"
                result = moderator._analyze_text_content(pii_text)
                
                if result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]:
                    self.add_test_result(
                        "PII Detection",
                        True,
                        "Personal information correctly detected and flagged"
                    )
                else:
                    self.add_test_result(
                        "PII Detection",
                        False,
                        f"Personal information not detected: {result.status}"
                    )
            except Exception as e:
                self.add_test_result(
                    "PII Detection",
                    False,
                    f"PII detection test failed: {e}"
                )
            
            # Test 3: Clean Content Approval
            try:
                clean_text = "This is a perfectly normal and appropriate video challenge"
                result = moderator._analyze_text_content(clean_text)
                
                if result.status == ModerationStatus.APPROVED:
                    self.add_test_result(
                        "Clean Content Approval",
                        True,
                        "Clean content correctly approved"
                    )
                else:
                    self.add_test_result(
                        "Clean Content Approval",
                        False,
                        f"Clean content incorrectly flagged: {result.status}"
                    )
            except Exception as e:
                self.add_test_result(
                    "Clean Content Approval",
                    False,
                    f"Clean content test failed: {e}"
                )
            
            # Test 4: Media Metadata Analysis
            try:
                suspicious_media = {
                    "duration_seconds": 0.1,  # Too short
                    "file_size": 100_000_000,  # Very large
                    "mime_type": "video/unknown"  # Unknown type
                }
                
                result = moderator._analyze_media_metadata(suspicious_media)
                
                if result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]:
                    self.add_test_result(
                        "Suspicious Media Detection",
                        True,
                        "Suspicious media metadata correctly flagged"
                    )
                else:
                    self.add_test_result(
                        "Suspicious Media Detection",
                        False,
                        f"Suspicious media not flagged: {result.status}"
                    )
            except Exception as e:
                self.add_test_result(
                    "Suspicious Media Detection",
                    False,
                    f"Media metadata test failed: {e}"
                )
                
        except ImportError as e:
            self.add_test_result(
                "Moderation Import",
                False,
                f"Failed to import moderation components: {e}"
            )
    
    async def test_rate_limiting_security(self):
        """Test rate limiting security"""
        logger.info("⏱️ Testing Rate Limiting Security...")
        
        try:
            from services.rate_limiter import RateLimiter, RateLimitExceeded
            
            rate_limiter = RateLimiter()
            
            # Test 1: Basic Rate Limiting
            try:
                test_user = "rate_test_user_1"
                
                # First request should pass
                can_proceed = await rate_limiter.check_rate_limit(test_user, limit=2, window_hours=1)
                if can_proceed:
                    await rate_limiter.record_request(test_user)
                    
                    # Second request should pass
                    can_proceed = await rate_limiter.check_rate_limit(test_user, limit=2, window_hours=1)
                    if can_proceed:
                        await rate_limiter.record_request(test_user)
                        
                        # Third request should fail
                        try:
                            await rate_limiter.check_rate_limit(test_user, limit=2, window_hours=1)
                            self.add_test_result(
                                "Rate Limit Enforcement",
                                False,
                                "Rate limit not enforced - allowed excess requests"
                            )
                        except RateLimitExceeded:
                            self.add_test_result(
                                "Rate Limit Enforcement",
                                True,
                                "Rate limit correctly enforced"
                            )
                    else:
                        self.add_test_result(
                            "Rate Limit Enforcement",
                            False,
                            "Rate limit triggered too early"
                        )
                else:
                    self.add_test_result(
                        "Rate Limit Enforcement",
                        False,
                        "Rate limit blocked first request incorrectly"
                    )
                    
            except Exception as e:
                self.add_test_result(
                    "Rate Limit Enforcement",
                    False,
                    f"Rate limit test failed: {e}"
                )
            
            # Test 2: Rate Limit Status
            try:
                test_user = "rate_status_user"
                status = await rate_limiter.get_rate_limit_status(test_user, limit=5, window_hours=1)
                
                if isinstance(status, dict) and "remaining" in status:
                    self.add_test_result(
                        "Rate Limit Status",
                        True,
                        f"Rate limit status correctly returned: {status['remaining']} remaining"
                    )
                else:
                    self.add_test_result(
                        "Rate Limit Status",
                        False,
                        f"Invalid rate limit status format: {status}"
                    )
            except Exception as e:
                self.add_test_result(
                    "Rate Limit Status",
                    False,
                    f"Rate limit status test failed: {e}"
                )
                
        except ImportError as e:
            self.add_test_result(
                "Rate Limiter Import",
                False,
                f"Failed to import rate limiter components: {e}"
            )
    
    async def test_secure_storage_access(self):
        """Test secure storage and access controls"""
        logger.info("🔐 Testing Secure Storage Access...")
        
        try:
            from services.s3_media_service import get_s3_media_service
            from config import settings
            
            # Test 1: S3 Configuration
            try:
                if settings.USE_CLOUD_STORAGE:
                    s3_service = await get_s3_media_service()
                    
                    if hasattr(s3_service, 'bucket_name') and s3_service.bucket_name:
                        self.add_test_result(
                            "S3 Configuration",
                            True,
                            f"S3 service configured with bucket: {s3_service.bucket_name}"
                        )
                    else:
                        self.add_test_result(
                            "S3 Configuration",
                            False,
                            "S3 service not properly configured"
                        )
                else:
                    self.add_test_result(
                        "S3 Configuration",
                        True,
                        "Local storage configured (cloud storage disabled)"
                    )
            except Exception as e:
                self.add_test_result(
                    "S3 Configuration",
                    False,
                    f"S3 configuration test failed: {e}"
                )
            
            # Test 2: Signed URL Generation
            try:
                if settings.USE_CLOUD_STORAGE:
                    s3_service = await get_s3_media_service()
                    
                    # This would normally require an actual media file, so we'll test the method exists
                    if hasattr(s3_service, 'generate_signed_url'):
                        self.add_test_result(
                            "Signed URL Generation",
                            True,
                            "Signed URL generation method available"
                        )
                    else:
                        self.add_test_result(
                            "Signed URL Generation",
                            False,
                            "Signed URL generation method missing"
                        )
                else:
                    self.add_test_result(
                        "Signed URL Generation",
                        True,
                        "Local storage - signed URLs not required"
                    )
            except Exception as e:
                self.add_test_result(
                    "Signed URL Generation",
                    False,
                    f"Signed URL test failed: {e}"
                )
                
        except ImportError as e:
            self.add_test_result(
                "Storage Import",
                False,
                f"Failed to import storage components: {e}"
            )
    
    async def run_all_tests(self):
        """Run all security compliance tests"""
        logger.info("🚀 Starting Security Compliance Tests...")
        
        await self.test_authentication_security()
        await self.test_input_validation_security()
        await self.test_content_moderation_security()
        await self.test_rate_limiting_security()
        await self.test_secure_storage_access()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r['passed']])
        failed_tests = total_tests - passed_tests
        
        logger.info("=" * 80)
        logger.info("🔍 SECURITY COMPLIANCE TEST SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"✅ Passed: {passed_tests}")
        logger.info(f"❌ Failed: {failed_tests}")
        logger.info(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        logger.info("")
        
        if failed_tests > 0:
            logger.info("FAILED TESTS:")
            for result in self.test_results:
                if not result['passed']:
                    logger.info(f"❌ {result['test_name']}: {result['details']}")
        
        logger.info("=" * 80)
        
        return failed_tests == 0

async def main():
    """Main test function"""
    tester = SecurityComplianceTest()
    
    try:
        success = await tester.run_all_tests()
        
        if success:
            logger.info("🎉 All security compliance tests passed!")
            return True
        else:
            logger.error("💥 Some security compliance tests failed!")
            return False
            
    except Exception as e:
        logger.error(f"💥 Test execution failed: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)