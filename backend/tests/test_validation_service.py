"""
Tests for automated validation services
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock

from services.validation_service import (
    GameplayValidationService, ChallengeIntegrityValidator,
    ValidationResult, ValidationError
)
from models import (
    Challenge, Statement, ChallengeStatus, StatementType,
    CreateChallengeRequest, UploadSession, UploadStatus
)

@pytest.fixture
def validation_service():
    """Create validation service instance"""
    return GameplayValidationService()

@pytest.fixture
def integrity_validator():
    """Create integrity validator instance"""
    return ChallengeIntegrityValidator()

@pytest.fixture
def mock_upload_service():
    """Mock upload service"""
    service = Mock()
    service.get_upload_status = AsyncMock()
    return service

@pytest.fixture
def valid_upload_session():
    """Valid completed upload session"""
    return UploadSession(
        session_id="test-session-1",
        user_id="test-user",
        filename="test-video.mp4",
        file_size=5_000_000,  # 5MB
        chunk_size=1024,
        total_chunks=5000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(5000))
    )

@pytest.fixture
def valid_challenge_request():
    """Valid challenge creation request"""
    return CreateChallengeRequest(
        title="Test Challenge",
        statements=[
            {"media_file_id": "session-1", "duration_seconds": 10.0},
            {"media_file_id": "session-2", "duration_seconds": 12.0},
            {"media_file_id": "session-3", "duration_seconds": 8.0}
        ],
        lie_statement_index=1,
        tags=["test", "demo"]
    )

@pytest.fixture
def valid_challenge():
    """Valid challenge object"""
    statements = [
        Statement(
            statement_id="stmt-1",
            statement_type=StatementType.TRUTH,
            media_url="/api/v1/files/session-1_video1.mp4",
            media_file_id="session-1",
            duration_seconds=10.0
        ),
        Statement(
            statement_id="stmt-2",
            statement_type=StatementType.LIE,
            media_url="/api/v1/files/session-2_video2.mp4",
            media_file_id="session-2",
            duration_seconds=12.0
        ),
        Statement(
            statement_id="stmt-3",
            statement_type=StatementType.TRUTH,
            media_url="/api/v1/files/session-3_video3.mp4",
            media_file_id="session-3",
            duration_seconds=8.0
        )
    ]
    
    return Challenge(
        challenge_id="challenge-1",
        creator_id="test-user",
        title="Test Challenge",
        statements=statements,
        lie_statement_id="stmt-2",
        status=ChallengeStatus.PUBLISHED,
        created_at=datetime.utcnow() - timedelta(hours=1),
        updated_at=datetime.utcnow(),
        published_at=datetime.utcnow(),
        view_count=10,
        guess_count=5,
        correct_guess_count=3
    )

class TestGameplayValidationService:
    """Test cases for GameplayValidationService"""
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_success(
        self, validation_service, mock_upload_service, valid_upload_session, valid_challenge_request
    ):
        """Test successful challenge creation validation"""
        mock_upload_service.get_upload_status.return_value = valid_upload_session
        
        result = await validation_service.validate_challenge_creation(
            valid_challenge_request, mock_upload_service
        )
        
        assert result.is_valid is True
        assert "valid" in result.message.lower()
        assert result.details["statement_count"] == 3
        assert result.details["lie_index"] == 1
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_wrong_statement_count(
        self, validation_service, mock_upload_service
    ):
        """Test validation fails with wrong statement count"""
        request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "session-1", "duration_seconds": 10.0},
                {"media_file_id": "session-2", "duration_seconds": 12.0}
            ],  # Only 2 statements
            lie_statement_index=0
        )
        
        result = await validation_service.validate_challenge_creation(request, mock_upload_service)
        
        assert result.is_valid is False
        assert "exactly 3 statements" in result.message
        assert result.details["expected_count"] == 3
        assert result.details["actual_count"] == 2
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_invalid_lie_index(
        self, validation_service, mock_upload_service
    ):
        """Test validation fails with invalid lie statement index"""
        request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "session-1", "duration_seconds": 10.0},
                {"media_file_id": "session-2", "duration_seconds": 12.0},
                {"media_file_id": "session-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=5  # Invalid index
        )
        
        result = await validation_service.validate_challenge_creation(request, mock_upload_service)
        
        assert result.is_valid is False
        assert "Lie statement index must be between" in result.message
        assert result.details["lie_index"] == 5
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_missing_media_file_id(
        self, validation_service, mock_upload_service
    ):
        """Test validation fails when media_file_id is missing"""
        request = CreateChallengeRequest(
            statements=[
                {"duration_seconds": 10.0},  # Missing media_file_id
                {"media_file_id": "session-2", "duration_seconds": 12.0},
                {"media_file_id": "session-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1
        )
        
        result = await validation_service.validate_challenge_creation(request, mock_upload_service)
        
        assert result.is_valid is False
        assert "media_file_id" in result.message.lower()
        assert result.details["statement_index"] == 0
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_upload_not_found(
        self, validation_service, mock_upload_service, valid_challenge_request
    ):
        """Test validation fails when upload session not found"""
        mock_upload_service.get_upload_status.return_value = None
        
        result = await validation_service.validate_challenge_creation(
            valid_challenge_request, mock_upload_service
        )
        
        assert result.is_valid is False
        assert "not found" in result.message
        assert "media_file_id" in result.details
    
    @pytest.mark.asyncio
    async def test_validate_challenge_creation_upload_not_completed(
        self, validation_service, mock_upload_service, valid_challenge_request
    ):
        """Test validation fails when upload is not completed"""
        incomplete_session = UploadSession(
            session_id="test-session-1",
            user_id="test-user",
            filename="test-video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.IN_PROGRESS,  # Not completed
            uploaded_chunks=list(range(3000))
        )
        mock_upload_service.get_upload_status.return_value = incomplete_session
        
        result = await validation_service.validate_challenge_creation(
            valid_challenge_request, mock_upload_service
        )
        
        assert result.is_valid is False
        assert "not completed" in result.message
        assert result.details["status"] == UploadStatus.IN_PROGRESS
    
    @pytest.mark.asyncio
    async def test_validate_video_requirements_non_video_mime_type(
        self, validation_service, mock_upload_service
    ):
        """Test validation fails for non-video MIME type"""
        audio_session = UploadSession(
            session_id="test-session-1",
            user_id="test-user",
            filename="test-audio.mp3",
            file_size=1_000_000,
            chunk_size=1024,
            total_chunks=1000,
            mime_type="audio/mp3",  # Not video
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(1000))
        )
        mock_upload_service.get_upload_service.return_value = audio_session
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_requirements(audio_session, statement_data)
        
        assert result.is_valid is False
        assert "must be video" in result.message
        assert result.details["mime_type"] == "audio/mp3"
    
    @pytest.mark.asyncio
    async def test_validate_video_requirements_unsupported_format(
        self, validation_service
    ):
        """Test validation fails for unsupported video format"""
        unsupported_session = UploadSession(
            session_id="test-session-1",
            user_id="test-user",
            filename="test-video.avi",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/avi",  # Unsupported format
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_requirements(unsupported_session, statement_data)
        
        assert result.is_valid is False
        assert "Unsupported video format" in result.message
        assert result.details["mime_type"] == "video/avi"
    
    @pytest.mark.asyncio
    async def test_validate_video_requirements_file_too_large(
        self, validation_service
    ):
        """Test validation fails for oversized file"""
        large_session = UploadSession(
            session_id="test-session-1",
            user_id="test-user",
            filename="large-video.mp4",
            file_size=100_000_000,  # 100MB - too large
            chunk_size=1024,
            total_chunks=100000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(100000))
        )
        
        statement_data = {"duration_seconds": 10.0}
        result = validation_service._validate_video_requirements(large_session, statement_data)
        
        assert result.is_valid is False
        assert "too large" in result.message
        assert result.details["file_size"] == 100_000_000
    
    @pytest.mark.asyncio
    async def test_validate_video_requirements_duration_too_short(
        self, validation_service, valid_upload_session
    ):
        """Test validation fails for video too short"""
        statement_data = {"duration_seconds": 1.0}  # Too short
        result = validation_service._validate_video_requirements(valid_upload_session, statement_data)
        
        assert result.is_valid is False
        assert "too short" in result.message
        assert result.details["duration"] == 1.0
    
    @pytest.mark.asyncio
    async def test_validate_video_requirements_duration_too_long(
        self, validation_service, valid_upload_session
    ):
        """Test validation fails for video too long"""
        statement_data = {"duration_seconds": 120.0}  # Too long
        result = validation_service._validate_video_requirements(valid_upload_session, statement_data)
        
        assert result.is_valid is False
        assert "too long" in result.message
        assert result.details["duration"] == 120.0
    
    @pytest.mark.asyncio
    async def test_validate_challenge_structure_success(
        self, validation_service, valid_challenge
    ):
        """Test successful challenge structure validation"""
        result = await validation_service.validate_challenge_structure(valid_challenge)
        
        assert result.is_valid is True
        assert result.details["truth_count"] == 2
        assert result.details["lie_count"] == 1
    
    @pytest.mark.asyncio
    async def test_validate_challenge_structure_wrong_truth_count(
        self, validation_service, valid_challenge
    ):
        """Test validation fails with wrong truth count"""
        # Change one truth to lie
        valid_challenge.statements[0].statement_type = StatementType.LIE
        
        result = await validation_service.validate_challenge_structure(valid_challenge)
        
        assert result.is_valid is False
        assert "exactly 2 truth statements" in result.message
        assert result.details["truth_count"] == 1
    
    @pytest.mark.asyncio
    async def test_validate_challenge_structure_wrong_lie_count(
        self, validation_service, valid_challenge
    ):
        """Test validation fails with wrong lie count"""
        # Change lie to truth
        valid_challenge.statements[1].statement_type = StatementType.TRUTH
        
        result = await validation_service.validate_challenge_structure(valid_challenge)
        
        assert result.is_valid is False
        assert "exactly 1 lie statement" in result.message
        assert result.details["lie_count"] == 0
    
    @pytest.mark.asyncio
    async def test_validate_challenge_structure_mismatched_lie_id(
        self, validation_service, valid_challenge
    ):
        """Test validation fails when lie_statement_id doesn't match"""
        valid_challenge.lie_statement_id = "wrong-id"
        
        result = await validation_service.validate_challenge_structure(valid_challenge)
        
        assert result.is_valid is False
        assert "does not match any lie statement" in result.message
        assert result.details["lie_statement_id"] == "wrong-id"
    
    @pytest.mark.asyncio
    async def test_validate_gameplay_difficulty_easy(
        self, validation_service, valid_challenge
    ):
        """Test difficulty validation for easy challenge"""
        # Set short durations for easy difficulty
        for stmt in valid_challenge.statements:
            stmt.duration_seconds = 5.0
        
        result = await validation_service.validate_gameplay_difficulty(valid_challenge)
        
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "easy"
        assert result.details["indicators"]["average_duration"] == 5.0
    
    @pytest.mark.asyncio
    async def test_validate_gameplay_difficulty_medium(
        self, validation_service, valid_challenge
    ):
        """Test difficulty validation for medium challenge"""
        # Set medium durations
        for stmt in valid_challenge.statements:
            stmt.duration_seconds = 20.0
        
        result = await validation_service.validate_gameplay_difficulty(valid_challenge)
        
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "medium"
        assert result.details["indicators"]["average_duration"] == 20.0
    
    @pytest.mark.asyncio
    async def test_validate_gameplay_difficulty_hard(
        self, validation_service, valid_challenge
    ):
        """Test difficulty validation for hard challenge"""
        # Set long durations for hard difficulty
        for stmt in valid_challenge.statements:
            stmt.duration_seconds = 45.0
        
        result = await validation_service.validate_gameplay_difficulty(valid_challenge)
        
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "hard"
        assert result.details["indicators"]["average_duration"] == 45.0
    
    @pytest.mark.asyncio
    async def test_validate_gameplay_difficulty_too_short(
        self, validation_service, valid_challenge
    ):
        """Test difficulty validation fails for too short total duration"""
        # Set very short durations
        for stmt in valid_challenge.statements:
            stmt.duration_seconds = 2.0  # Total = 6 seconds
        
        result = await validation_service.validate_gameplay_difficulty(valid_challenge)
        
        assert result.is_valid is False
        assert "too short for meaningful gameplay" in result.message
        assert result.details["total_duration"] == 6.0
    
    @pytest.mark.asyncio
    async def test_validate_complete_challenge_success(
        self, validation_service, mock_upload_service, valid_upload_session, valid_challenge
    ):
        """Test complete challenge validation success"""
        mock_upload_service.get_upload_status.return_value = valid_upload_session
        
        result = await validation_service.validate_complete_challenge(
            valid_challenge, mock_upload_service
        )
        
        assert result.is_valid is True
        assert "passed all validation checks" in result.message
        assert result.details["validation_count"] > 0
    
    @pytest.mark.asyncio
    async def test_validate_complete_challenge_structure_failure(
        self, validation_service, mock_upload_service, valid_upload_session, valid_challenge
    ):
        """Test complete challenge validation fails on structure"""
        mock_upload_service.get_upload_status.return_value = valid_upload_session
        
        # Break structure
        valid_challenge.statements[0].statement_type = StatementType.LIE
        
        result = await validation_service.validate_complete_challenge(
            valid_challenge, mock_upload_service
        )
        
        assert result.is_valid is False
        assert "validation failed" in result.message
        assert len(result.details["failed_checks"]) > 0
    
    def test_get_validation_stats_empty(self, validation_service):
        """Test validation stats with no history"""
        stats = validation_service.get_validation_stats()
        
        assert stats["total_validations"] == 0
        assert stats["success_rate"] == 0.0
        assert stats["last_validation"] is None
    
    def test_get_validation_stats_with_history(self, validation_service):
        """Test validation stats with validation history"""
        # Add some validation results
        validation_service.validation_history.extend([
            ValidationResult(True, "Success 1"),
            ValidationResult(False, "Failure 1"),
            ValidationResult(True, "Success 2"),
            ValidationResult(True, "Success 3")
        ])
        
        stats = validation_service.get_validation_stats()
        
        assert stats["total_validations"] == 4
        assert stats["successful_validations"] == 3
        assert stats["success_rate"] == 0.75
        assert stats["last_validation"] is not None

class TestChallengeIntegrityValidator:
    """Test cases for ChallengeIntegrityValidator"""
    
    @pytest.mark.asyncio
    async def test_validate_challenge_consistency_success(
        self, integrity_validator, valid_challenge
    ):
        """Test successful challenge consistency validation"""
        result = await integrity_validator.validate_challenge_consistency(valid_challenge)
        
        assert result.is_valid is True
        assert "consistent" in result.message.lower()
        assert "timestamps" in result.details["checks_passed"]
    
    @pytest.mark.asyncio
    async def test_validate_challenge_consistency_timestamp_issues(
        self, integrity_validator, valid_challenge
    ):
        """Test validation fails with timestamp inconsistencies"""
        # Make updated_at before created_at
        valid_challenge.updated_at = valid_challenge.created_at - timedelta(hours=1)
        
        result = await integrity_validator.validate_challenge_consistency(valid_challenge)
        
        assert result.is_valid is False
        assert "updated_at is before created_at" in result.details["issues"]
    
    @pytest.mark.asyncio
    async def test_validate_challenge_consistency_status_issues(
        self, integrity_validator, valid_challenge
    ):
        """Test validation fails with status inconsistencies"""
        # Published status but no published_at
        valid_challenge.status = ChallengeStatus.PUBLISHED
        valid_challenge.published_at = None
        
        result = await integrity_validator.validate_challenge_consistency(valid_challenge)
        
        assert result.is_valid is False
        assert "published challenge missing published_at" in result.details["issues"]
    
    @pytest.mark.asyncio
    async def test_validate_challenge_consistency_statistics_issues(
        self, integrity_validator, valid_challenge
    ):
        """Test validation fails with statistics inconsistencies"""
        # More correct guesses than total guesses
        valid_challenge.correct_guess_count = 10
        valid_challenge.guess_count = 5
        
        result = await integrity_validator.validate_challenge_consistency(valid_challenge)
        
        assert result.is_valid is False
        assert "correct_guess_count exceeds total guess_count" in result.details["issues"]
    
    @pytest.mark.asyncio
    async def test_validate_challenge_consistency_duplicate_statement_ids(
        self, integrity_validator, valid_challenge
    ):
        """Test validation fails with duplicate statement IDs"""
        # Make duplicate statement IDs
        valid_challenge.statements[1].statement_id = valid_challenge.statements[0].statement_id
        
        result = await integrity_validator.validate_challenge_consistency(valid_challenge)
        
        assert result.is_valid is False
        assert "duplicate statement IDs" in result.details["issues"]

if __name__ == "__main__":
    pytest.main([__file__])