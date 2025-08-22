#!/usr/bin/env python3
"""
Simple validation test runner for automated validation services
Tests core gameplay flow requirements without external dependencies
"""
import sys
import os
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.validation_service import (
    GameplayValidationService, ChallengeIntegrityValidator,
    ValidationResult
)
from models import (
    Challenge, Statement, ChallengeStatus, StatementType,
    CreateChallengeRequest, UploadSession, UploadStatus
)

class ValidationTestRunner:
    """Test runner for validation services"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def assert_true(self, condition, message):
        """Assert that condition is true"""
        if condition:
            self.passed += 1
            print(f"✅ {message}")
        else:
            self.failed += 1
            error_msg = f"❌ {message}"
            print(error_msg)
            self.errors.append(error_msg)
    
    def assert_false(self, condition, message):
        """Assert that condition is false"""
        self.assert_true(not condition, message)
    
    def assert_equal(self, actual, expected, message):
        """Assert that actual equals expected"""
        if actual == expected:
            self.passed += 1
            print(f"✅ {message}")
        else:
            self.failed += 1
            error_msg = f"❌ {message} (expected: {expected}, got: {actual})"
            print(error_msg)
            self.errors.append(error_msg)
    
    def assert_in(self, substring, text, message):
        """Assert that substring is in text"""
        if substring in text:
            self.passed += 1
            print(f"✅ {message}")
        else:
            self.failed += 1
            error_msg = f"❌ {message} ('{substring}' not found in '{text}')"
            print(error_msg)
            self.errors.append(error_msg)
    
    def print_summary(self):
        """Print test summary"""
        total = self.passed + self.failed
        print(f"\n{'='*50}")
        print("VALIDATION TEST SUMMARY")
        print('='*50)
        print(f"Total tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        
        if self.failed == 0:
            print("🎉 All validation tests passed!")
            return True
        else:
            print(f"❌ {self.failed} tests failed:")
            for error in self.errors:
                print(f"  {error}")
            return False

async def test_basic_validation_service():
    """Test basic validation service functionality"""
    print("\n🧪 Testing Basic Validation Service...")
    runner = ValidationTestRunner()
    
    # Test service instantiation
    validator = GameplayValidationService()
    runner.assert_true(validator is not None, "Validation service instantiated")
    
    # Test validation stats
    stats = validator.get_validation_stats()
    runner.assert_equal(stats["total_validations"], 0, "Initial validation count is 0")
    runner.assert_equal(stats["success_rate"], 0.0, "Initial success rate is 0.0")
    
    return runner

async def test_video_requirements_validation():
    """Test video requirements validation"""
    print("\n🧪 Testing Video Requirements Validation...")
    runner = ValidationTestRunner()
    
    validator = GameplayValidationService()
    
    # Test valid video session
    valid_video_session = UploadSession(
        session_id="test-video",
        user_id="test-user",
        filename="video.mp4",
        file_size=5_000_000,  # 5MB
        chunk_size=1024,
        total_chunks=5000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(5000))
    )
    
    statement_data = {"duration_seconds": 10.0}
    result = validator._validate_video_requirements(valid_video_session, statement_data)
    runner.assert_true(result.is_valid, "Valid video session passes validation")
    
    # Test invalid audio session
    audio_session = UploadSession(
        session_id="test-audio",
        user_id="test-user",
        filename="audio.mp3",
        file_size=1_000_000,
        chunk_size=1024,
        total_chunks=1000,
        mime_type="audio/mp3",  # Invalid - not video
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(1000))
    )
    
    result = validator._validate_video_requirements(audio_session, statement_data)
    runner.assert_false(result.is_valid, "Audio session fails validation")
    runner.assert_in("must be video", result.message, "Audio validation error message correct")
    
    # Test unsupported video format
    unsupported_session = UploadSession(
        session_id="test-unsupported",
        user_id="test-user",
        filename="video.avi",
        file_size=5_000_000,
        chunk_size=1024,
        total_chunks=5000,
        mime_type="video/avi",  # Unsupported format
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(5000))
    )
    
    result = validator._validate_video_requirements(unsupported_session, statement_data)
    runner.assert_false(result.is_valid, "Unsupported video format fails validation")
    runner.assert_in("Unsupported video format", result.message, "Unsupported format error message correct")
    
    # Test video too short
    short_statement = {"duration_seconds": 1.0}
    result = validator._validate_video_requirements(valid_video_session, short_statement)
    runner.assert_false(result.is_valid, "Too short video fails validation")
    runner.assert_in("too short", result.message, "Short video error message correct")
    
    # Test video too long
    long_statement = {"duration_seconds": 120.0}
    result = validator._validate_video_requirements(valid_video_session, long_statement)
    runner.assert_false(result.is_valid, "Too long video fails validation")
    runner.assert_in("too long", result.message, "Long video error message correct")
    
    return runner

async def test_challenge_creation_validation():
    """Test challenge creation validation"""
    print("\n🧪 Testing Challenge Creation Validation...")
    runner = ValidationTestRunner()
    
    validator = GameplayValidationService()
    
    # Mock upload service
    mock_upload_service = Mock()
    mock_upload_service.get_upload_status = AsyncMock()
    
    valid_session = UploadSession(
        session_id="test-session",
        user_id="test-user",
        filename="video.mp4",
        file_size=5_000_000,
        chunk_size=1024,
        total_chunks=5000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(5000))
    )
    mock_upload_service.get_upload_status.return_value = valid_session
    
    # Test valid challenge request
    valid_request = CreateChallengeRequest(
        title="Test Challenge",
        statements=[
            {"media_file_id": "session-1", "duration_seconds": 10.0},
            {"media_file_id": "session-2", "duration_seconds": 12.0},
            {"media_file_id": "session-3", "duration_seconds": 8.0}
        ],
        lie_statement_index=1,
        tags=["test"]
    )
    
    result = await validator.validate_challenge_creation(valid_request, mock_upload_service)
    runner.assert_true(result.is_valid, "Valid challenge request passes validation")
    runner.assert_equal(result.details["statement_count"], 3, "Statement count correct in validation result")
    runner.assert_equal(result.details["lie_index"], 1, "Lie index correct in validation result")
    
    # Test invalid statement count
    invalid_count_request = CreateChallengeRequest(
        statements=[
            {"media_file_id": "session-1", "duration_seconds": 10.0},
            {"media_file_id": "session-2", "duration_seconds": 12.0}
        ],  # Only 2 statements
        lie_statement_index=1
    )
    
    result = await validator.validate_challenge_creation(invalid_count_request, mock_upload_service)
    runner.assert_false(result.is_valid, "Invalid statement count fails validation")
    runner.assert_in("exactly 3 statements", result.message, "Statement count error message correct")
    
    # Test invalid lie index
    invalid_lie_request = CreateChallengeRequest(
        statements=[
            {"media_file_id": "session-1", "duration_seconds": 10.0},
            {"media_file_id": "session-2", "duration_seconds": 12.0},
            {"media_file_id": "session-3", "duration_seconds": 8.0}
        ],
        lie_statement_index=5  # Invalid index
    )
    
    result = await validator.validate_challenge_creation(invalid_lie_request, mock_upload_service)
    runner.assert_false(result.is_valid, "Invalid lie index fails validation")
    runner.assert_in("Lie statement index must be between", result.message, "Lie index error message correct")
    
    # Test missing media file ID
    missing_media_request = CreateChallengeRequest(
        statements=[
            {"duration_seconds": 10.0},  # Missing media_file_id
            {"media_file_id": "session-2", "duration_seconds": 12.0},
            {"media_file_id": "session-3", "duration_seconds": 8.0}
        ],
        lie_statement_index=1
    )
    
    result = await validator.validate_challenge_creation(missing_media_request, mock_upload_service)
    runner.assert_false(result.is_valid, "Missing media file ID fails validation")
    runner.assert_in("media_file_id", result.message.lower(), "Missing media error message correct")
    
    return runner

async def test_challenge_structure_validation():
    """Test challenge structure validation"""
    print("\n🧪 Testing Challenge Structure Validation...")
    runner = ValidationTestRunner()
    
    validator = GameplayValidationService()
    
    # Create valid challenge
    valid_statements = [
        Statement(
            statement_id="stmt-1",
            statement_type=StatementType.TRUTH,
            media_url="/video1.mp4",
            media_file_id="file-1",
            duration_seconds=10.0
        ),
        Statement(
            statement_id="stmt-2",
            statement_type=StatementType.LIE,
            media_url="/video2.mp4",
            media_file_id="file-2",
            duration_seconds=12.0
        ),
        Statement(
            statement_id="stmt-3",
            statement_type=StatementType.TRUTH,
            media_url="/video3.mp4",
            media_file_id="file-3",
            duration_seconds=8.0
        )
    ]
    
    valid_challenge = Challenge(
        challenge_id="test-challenge",
        creator_id="test-user",
        title="Test Challenge",
        statements=valid_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.DRAFT
    )
    
    result = await validator.validate_challenge_structure(valid_challenge)
    runner.assert_true(result.is_valid, "Valid challenge structure passes validation")
    runner.assert_equal(result.details["truth_count"], 2, "Truth count correct")
    runner.assert_equal(result.details["lie_count"], 1, "Lie count correct")
    
    # Test invalid structure - wrong truth count
    invalid_statements = valid_statements.copy()
    invalid_statements[0].statement_type = StatementType.LIE  # Make 2 lies, 1 truth
    
    invalid_challenge = Challenge(
        challenge_id="invalid-challenge",
        creator_id="test-user",
        title="Invalid Challenge",
        statements=invalid_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.DRAFT
    )
    
    result = await validator.validate_challenge_structure(invalid_challenge)
    runner.assert_false(result.is_valid, "Invalid challenge structure fails validation")
    runner.assert_in("exactly 2 truth statements", result.message, "Truth count error message correct")
    
    return runner

async def test_difficulty_validation():
    """Test difficulty validation"""
    print("\n🧪 Testing Difficulty Validation...")
    runner = ValidationTestRunner()
    
    validator = GameplayValidationService()
    
    # Test easy difficulty
    easy_statements = [
        Statement(
            statement_id="stmt-1",
            statement_type=StatementType.TRUTH,
            media_url="/video1.mp4",
            media_file_id="file-1",
            duration_seconds=5.0  # Short = easy
        ),
        Statement(
            statement_id="stmt-2",
            statement_type=StatementType.LIE,
            media_url="/video2.mp4",
            media_file_id="file-2",
            duration_seconds=6.0
        ),
        Statement(
            statement_id="stmt-3",
            statement_type=StatementType.TRUTH,
            media_url="/video3.mp4",
            media_file_id="file-3",
            duration_seconds=7.0
        )
    ]
    
    easy_challenge = Challenge(
        challenge_id="easy-challenge",
        creator_id="test-user",
        title="Easy Challenge",
        statements=easy_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.PUBLISHED
    )
    
    result = await validator.validate_gameplay_difficulty(easy_challenge)
    runner.assert_true(result.is_valid, "Easy challenge passes difficulty validation")
    runner.assert_equal(result.details["estimated_difficulty"], "easy", "Easy difficulty correctly identified")
    
    # Test challenge too short for meaningful gameplay
    too_short_statements = [
        Statement(
            statement_id="stmt-1",
            statement_type=StatementType.TRUTH,
            media_url="/video1.mp4",
            media_file_id="file-1",
            duration_seconds=2.0  # Very short
        ),
        Statement(
            statement_id="stmt-2",
            statement_type=StatementType.LIE,
            media_url="/video2.mp4",
            media_file_id="file-2",
            duration_seconds=2.0
        ),
        Statement(
            statement_id="stmt-3",
            statement_type=StatementType.TRUTH,
            media_url="/video3.mp4",
            media_file_id="file-3",
            duration_seconds=2.0
        )
    ]
    
    too_short_challenge = Challenge(
        challenge_id="short-challenge",
        creator_id="test-user",
        title="Too Short Challenge",
        statements=too_short_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.PUBLISHED
    )
    
    result = await validator.validate_gameplay_difficulty(too_short_challenge)
    runner.assert_false(result.is_valid, "Too short challenge fails difficulty validation")
    runner.assert_in("too short for meaningful gameplay", result.message, "Short challenge error message correct")
    
    return runner

async def test_integrity_validation():
    """Test challenge integrity validation"""
    print("\n🧪 Testing Challenge Integrity Validation...")
    runner = ValidationTestRunner()
    
    integrity_validator = ChallengeIntegrityValidator()
    
    # Create valid challenge
    now = datetime.utcnow()
    valid_statements = [
        Statement(
            statement_id="stmt-1",
            statement_type=StatementType.TRUTH,
            media_url="/video1.mp4",
            media_file_id="file-1",
            duration_seconds=10.0
        ),
        Statement(
            statement_id="stmt-2",
            statement_type=StatementType.LIE,
            media_url="/video2.mp4",
            media_file_id="file-2",
            duration_seconds=12.0
        ),
        Statement(
            statement_id="stmt-3",
            statement_type=StatementType.TRUTH,
            media_url="/video3.mp4",
            media_file_id="file-3",
            duration_seconds=8.0
        )
    ]
    
    valid_challenge = Challenge(
        challenge_id="integrity-test",
        creator_id="test-user",
        title="Integrity Test",
        statements=valid_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.PUBLISHED,
        created_at=now - timedelta(hours=1),
        updated_at=now,
        published_at=now,
        view_count=10,
        guess_count=5,
        correct_guess_count=3
    )
    
    result = await integrity_validator.validate_challenge_consistency(valid_challenge)
    runner.assert_true(result.is_valid, "Valid challenge passes integrity validation")
    runner.assert_in("timestamps", result.details["checks_passed"], "Timestamp checks passed")
    
    # Test challenge with timestamp issues
    invalid_challenge = Challenge(
        challenge_id="invalid-integrity",
        creator_id="test-user",
        title="Invalid Integrity",
        statements=valid_statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.PUBLISHED,
        created_at=now,
        updated_at=now - timedelta(hours=1),  # Updated before created
        published_at=now,
        view_count=10,
        guess_count=5,
        correct_guess_count=3
    )
    
    result = await integrity_validator.validate_challenge_consistency(invalid_challenge)
    runner.assert_false(result.is_valid, "Invalid challenge fails integrity validation")
    runner.assert_in("updated_at is before created_at", result.details["issues"], "Timestamp issue detected")
    
    return runner

async def main():
    """Run all validation tests"""
    print("🚀 Starting Automated Validation Service Tests")
    print("="*60)
    
    test_functions = [
        test_basic_validation_service,
        test_video_requirements_validation,
        test_challenge_creation_validation,
        test_challenge_structure_validation,
        test_difficulty_validation,
        test_integrity_validation
    ]
    
    all_runners = []
    
    for test_func in test_functions:
        try:
            runner = await test_func()
            all_runners.append(runner)
        except Exception as e:
            print(f"❌ Test function {test_func.__name__} failed with error: {e}")
            import traceback
            traceback.print_exc()
    
    # Print overall summary
    total_passed = sum(r.passed for r in all_runners)
    total_failed = sum(r.failed for r in all_runners)
    total_tests = total_passed + total_failed
    
    print(f"\n{'='*60}")
    print("OVERALL VALIDATION TEST SUMMARY")
    print('='*60)
    print(f"Total test functions: {len(test_functions)}")
    print(f"Total individual tests: {total_tests}")
    print(f"Total passed: {total_passed}")
    print(f"Total failed: {total_failed}")
    
    if total_failed == 0:
        print("\n🎉 ALL VALIDATION TESTS PASSED!")
        print("✅ Automated validation services are working correctly")
        print("✅ Requirements 1 and 3 validation implemented successfully")
        return True
    else:
        print(f"\n❌ {total_failed} tests failed")
        print("Please review the errors above")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)