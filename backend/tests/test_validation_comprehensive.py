"""
Comprehensive validation tests for core gameplay flow requirements
Tests Requirements 1 and 3 specifically
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock

from services.validation_service import (
    GameplayValidationService, ChallengeIntegrityValidator,
    ValidationResult
)
from services.challenge_service import ChallengeService
from models import (
    Challenge, Statement, ChallengeStatus, StatementType,
    CreateChallengeRequest, UploadSession, UploadStatus,
    SubmitGuessRequest
)

@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing"""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path)

@pytest.fixture
def validation_service():
    """Create validation service instance"""
    return GameplayValidationService()

@pytest.fixture
def challenge_service(temp_dir, monkeypatch):
    """Create challenge service with temporary storage"""
    monkeypatch.setattr("config.settings.TEMP_DIR", temp_dir)
    return ChallengeService()

@pytest.fixture
def mock_upload_service():
    """Mock upload service"""
    service = Mock()
    service.get_upload_status = AsyncMock()
    return service

class TestRequirement1Validation:
    """Test validation for Requirement 1: Intuitive Core Game Loop (MVP Mandatory)"""
    
    @pytest.mark.asyncio
    async def test_requirement_1_video_with_audio_mandatory(
        self, validation_service, mock_upload_service
    ):
        """Test that video with audio is mandatory for all statements"""
        # Valid video session
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        
        # Invalid audio-only session
        audio_session = UploadSession(
            session_id="audio-session",
            user_id="test-user",
            filename="audio.mp3",
            file_size=1_000_000,
            chunk_size=1024,
            total_chunks=1000,
            mime_type="audio/mp3",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(1000))
        )
        
        # Test valid video request
        valid_request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "video-1", "duration_seconds": 10.0},
                {"media_file_id": "video-2", "duration_seconds": 12.0},
                {"media_file_id": "video-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1
        )
        
        mock_upload_service.get_upload_status.return_value = video_session
        result = await validation_service.validate_challenge_creation(valid_request, mock_upload_service)
        assert result.is_valid is True, "Valid video request should pass"
        
        # Test invalid audio request
        invalid_request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "audio-1", "duration_seconds": 10.0},
                {"media_file_id": "audio-2", "duration_seconds": 12.0},
                {"media_file_id": "audio-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1
        )
        
        mock_upload_service.get_upload_status.return_value = audio_session
        result = await validation_service.validate_challenge_creation(invalid_request, mock_upload_service)
        assert result.is_valid is False, "Audio-only request should fail"
        assert "must be video" in result.message
    
    @pytest.mark.asyncio
    async def test_requirement_1_no_text_fallback_options(
        self, validation_service, mock_upload_service
    ):
        """Test that text fallback options are not allowed"""
        # Request with missing media (simulating text fallback attempt)
        text_fallback_request = CreateChallengeRequest(
            statements=[
                {"duration_seconds": 10.0},  # Missing media_file_id
                {"media_file_id": "video-2", "duration_seconds": 12.0},
                {"media_file_id": "video-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1
        )
        
        result = await validation_service.validate_challenge_creation(
            text_fallback_request, mock_upload_service
        )
        assert result.is_valid is False, "Request without media should fail"
        assert "media_file_id" in result.message.lower()
    
    @pytest.mark.asyncio
    async def test_requirement_1_three_statements_mandatory(
        self, validation_service, mock_upload_service
    ):
        """Test that exactly 3 statements are required"""
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        mock_upload_service.get_upload_status.return_value = video_session
        
        # Test with 2 statements
        two_statements = CreateChallengeRequest(
            statements=[
                {"media_file_id": "video-1", "duration_seconds": 10.0},
                {"media_file_id": "video-2", "duration_seconds": 12.0}
            ],
            lie_statement_index=1
        )
        
        result = await validation_service.validate_challenge_creation(two_statements, mock_upload_service)
        assert result.is_valid is False
        assert "exactly 3 statements" in result.message
        
        # Test with 4 statements
        four_statements = CreateChallengeRequest(
            statements=[
                {"media_file_id": "video-1", "duration_seconds": 10.0},
                {"media_file_id": "video-2", "duration_seconds": 12.0},
                {"media_file_id": "video-3", "duration_seconds": 8.0},
                {"media_file_id": "video-4", "duration_seconds": 15.0}
            ],
            lie_statement_index=1
        )
        
        result = await validation_service.validate_challenge_creation(four_statements, mock_upload_service)
        assert result.is_valid is False
        assert "exactly 3 statements" in result.message
    
    @pytest.mark.asyncio
    async def test_requirement_1_lie_selection_validation(
        self, validation_service, mock_upload_service
    ):
        """Test that lie selection is properly validated"""
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        mock_upload_service.get_upload_status.return_value = video_session
        
        # Test valid lie indices
        for lie_index in [0, 1, 2]:
            request = CreateChallengeRequest(
                statements=[
                    {"media_file_id": "video-1", "duration_seconds": 10.0},
                    {"media_file_id": "video-2", "duration_seconds": 12.0},
                    {"media_file_id": "video-3", "duration_seconds": 8.0}
                ],
                lie_statement_index=lie_index
            )
            
            result = await validation_service.validate_challenge_creation(request, mock_upload_service)
            assert result.is_valid is True, f"Lie index {lie_index} should be valid"
        
        # Test invalid lie indices
        for invalid_index in [-1, 3, 10]:
            request = CreateChallengeRequest(
                statements=[
                    {"media_file_id": "video-1", "duration_seconds": 10.0},
                    {"media_file_id": "video-2", "duration_seconds": 12.0},
                    {"media_file_id": "video-3", "duration_seconds": 8.0}
                ],
                lie_statement_index=invalid_index
            )
            
            result = await validation_service.validate_challenge_creation(request, mock_upload_service)
            assert result.is_valid is False, f"Lie index {invalid_index} should be invalid"
    
    @pytest.mark.asyncio
    async def test_requirement_1_video_duration_limits(
        self, validation_service
    ):
        """Test video duration requirements for meaningful gameplay"""
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        
        # Test too short video
        statement_data = {"duration_seconds": 1.0}  # Too short
        result = validation_service._validate_video_requirements(video_session, statement_data)
        assert result.is_valid is False
        assert "too short" in result.message
        
        # Test too long video
        statement_data = {"duration_seconds": 120.0}  # Too long
        result = validation_service._validate_video_requirements(video_session, statement_data)
        assert result.is_valid is False
        assert "too long" in result.message
        
        # Test valid duration
        statement_data = {"duration_seconds": 15.0}  # Valid
        result = validation_service._validate_video_requirements(video_session, statement_data)
        assert result.is_valid is True

class TestRequirement3Validation:
    """Test validation for Requirement 3: Game Difficulty and Engagement"""
    
    @pytest.mark.asyncio
    async def test_requirement_3_difficulty_assessment(
        self, validation_service
    ):
        """Test that difficulty is properly assessed based on video characteristics"""
        # Create challenges with different difficulty levels
        easy_challenge = Challenge(
            challenge_id="easy-1",
            creator_id="test-user",
            title="Easy Challenge",
            statements=[
                Statement(
                    statement_id="stmt-1",
                    statement_type=StatementType.TRUTH,
                    media_url="/video1.mp4",
                    media_file_id="file-1",
                    duration_seconds=5.0  # Short duration = easy
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
            ],
            lie_statement_id="stmt-2",
            status=ChallengeStatus.PUBLISHED
        )
        
        result = await validation_service.validate_gameplay_difficulty(easy_challenge)
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "easy"
        
        # Medium difficulty challenge
        medium_challenge = Challenge(
            challenge_id="medium-1",
            creator_id="test-user",
            title="Medium Challenge",
            statements=[
                Statement(
                    statement_id="stmt-1",
                    statement_type=StatementType.TRUTH,
                    media_url="/video1.mp4",
                    media_file_id="file-1",
                    duration_seconds=20.0  # Medium duration
                ),
                Statement(
                    statement_id="stmt-2",
                    statement_type=StatementType.LIE,
                    media_url="/video2.mp4",
                    media_file_id="file-2",
                    duration_seconds=25.0
                ),
                Statement(
                    statement_id="stmt-3",
                    statement_type=StatementType.TRUTH,
                    media_url="/video3.mp4",
                    media_file_id="file-3",
                    duration_seconds=15.0
                )
            ],
            lie_statement_id="stmt-2",
            status=ChallengeStatus.PUBLISHED
        )
        
        result = await validation_service.validate_gameplay_difficulty(medium_challenge)
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "medium"
        
        # Hard difficulty challenge
        hard_challenge = Challenge(
            challenge_id="hard-1",
            creator_id="test-user",
            title="Hard Challenge",
            statements=[
                Statement(
                    statement_id="stmt-1",
                    statement_type=StatementType.TRUTH,
                    media_url="/video1.mp4",
                    media_file_id="file-1",
                    duration_seconds=45.0  # Long duration = hard
                ),
                Statement(
                    statement_id="stmt-2",
                    statement_type=StatementType.LIE,
                    media_url="/video2.mp4",
                    media_file_id="file-2",
                    duration_seconds=50.0
                ),
                Statement(
                    statement_id="stmt-3",
                    statement_type=StatementType.TRUTH,
                    media_url="/video3.mp4",
                    media_file_id="file-3",
                    duration_seconds=40.0
                )
            ],
            lie_statement_id="stmt-2",
            status=ChallengeStatus.PUBLISHED
        )
        
        result = await validation_service.validate_gameplay_difficulty(hard_challenge)
        assert result.is_valid is True
        assert result.details["estimated_difficulty"] == "hard"
    
    @pytest.mark.asyncio
    async def test_requirement_3_minimum_engagement_duration(
        self, validation_service
    ):
        """Test that challenges meet minimum engagement requirements"""
        # Challenge too short for meaningful gameplay
        too_short_challenge = Challenge(
            challenge_id="short-1",
            creator_id="test-user",
            title="Too Short Challenge",
            statements=[
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
            ],
            lie_statement_id="stmt-2",
            status=ChallengeStatus.PUBLISHED
        )
        
        result = await validation_service.validate_gameplay_difficulty(too_short_challenge)
        assert result.is_valid is False
        assert "too short for meaningful gameplay" in result.message
        assert result.details["total_duration"] < 10
    
    @pytest.mark.asyncio
    async def test_requirement_3_progressive_difficulty_indicators(
        self, validation_service
    ):
        """Test that difficulty indicators support progressive difficulty"""
        challenges = []
        
        # Create challenges with increasing complexity
        for i, avg_duration in enumerate([8, 15, 25, 40]):
            challenge = Challenge(
                challenge_id=f"challenge-{i}",
                creator_id="test-user",
                title=f"Challenge {i}",
                statements=[
                    Statement(
                        statement_id=f"stmt-{i}-1",
                        statement_type=StatementType.TRUTH,
                        media_url=f"/video{i}-1.mp4",
                        media_file_id=f"file-{i}-1",
                        duration_seconds=avg_duration
                    ),
                    Statement(
                        statement_id=f"stmt-{i}-2",
                        statement_type=StatementType.LIE,
                        media_url=f"/video{i}-2.mp4",
                        media_file_id=f"file-{i}-2",
                        duration_seconds=avg_duration
                    ),
                    Statement(
                        statement_id=f"stmt-{i}-3",
                        statement_type=StatementType.TRUTH,
                        media_url=f"/video{i}-3.mp4",
                        media_file_id=f"file-{i}-3",
                        duration_seconds=avg_duration
                    )
                ],
                lie_statement_id=f"stmt-{i}-2",
                status=ChallengeStatus.PUBLISHED
            )
            challenges.append(challenge)
        
        # Validate that difficulty increases
        difficulties = []
        for challenge in challenges:
            result = await validation_service.validate_gameplay_difficulty(challenge)
            assert result.is_valid is True
            difficulties.append(result.details["estimated_difficulty"])
        
        # Should progress from easy to hard
        expected_progression = ["easy", "medium", "medium", "hard"]
        assert difficulties == expected_progression

class TestEndToEndValidation:
    """End-to-end validation tests for complete gameplay flow"""
    
    @pytest.mark.asyncio
    async def test_complete_challenge_lifecycle_validation(
        self, validation_service, challenge_service, mock_upload_service
    ):
        """Test validation throughout complete challenge lifecycle"""
        # Setup valid upload session
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=5_000_000,
            chunk_size=1024,
            total_chunks=5000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(5000))
        )
        mock_upload_service.get_upload_status.return_value = video_session
        
        # 1. Create challenge with validation
        request = CreateChallengeRequest(
            title="Lifecycle Test Challenge",
            statements=[
                {"media_file_id": "video-1", "duration_seconds": 10.0},
                {"media_file_id": "video-2", "duration_seconds": 12.0},
                {"media_file_id": "video-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1,
            tags=["test", "lifecycle"]
        )
        
        # Validate creation request
        creation_validation = await validation_service.validate_challenge_creation(
            request, mock_upload_service
        )
        assert creation_validation.is_valid is True
        
        # 2. Create actual challenge
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=request,
            upload_service=mock_upload_service
        )
        
        # 3. Validate challenge structure
        structure_validation = await validation_service.validate_challenge_structure(challenge)
        assert structure_validation.is_valid is True
        assert structure_validation.details["truth_count"] == 2
        assert structure_validation.details["lie_count"] == 1
        
        # 4. Validate difficulty
        difficulty_validation = await validation_service.validate_gameplay_difficulty(challenge)
        assert difficulty_validation.is_valid is True
        
        # 5. Complete validation
        complete_validation = await validation_service.validate_complete_challenge(
            challenge, mock_upload_service
        )
        assert complete_validation.is_valid is True
        
        # 6. Publish challenge (includes validation)
        published_challenge = await challenge_service.publish_challenge(
            challenge.challenge_id, "test-user"
        )
        assert published_challenge.status == ChallengeStatus.PUBLISHED
    
    @pytest.mark.asyncio
    async def test_validation_prevents_invalid_gameplay(
        self, validation_service, challenge_service, mock_upload_service
    ):
        """Test that validation prevents invalid gameplay scenarios"""
        # Setup invalid scenarios that should be caught by validation
        
        # Scenario 1: Audio-only media (violates Requirement 1)
        audio_session = UploadSession(
            session_id="audio-session",
            user_id="test-user",
            filename="audio.mp3",
            file_size=1_000_000,
            chunk_size=1024,
            total_chunks=1000,
            mime_type="audio/mp3",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(1000))
        )
        
        mock_upload_service.get_upload_status.return_value = audio_session
        
        audio_request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "audio-1", "duration_seconds": 10.0},
                {"media_file_id": "audio-2", "duration_seconds": 12.0},
                {"media_file_id": "audio-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1
        )
        
        with pytest.raises(Exception) as exc_info:
            await challenge_service.create_challenge(
                creator_id="test-user",
                request=audio_request,
                upload_service=mock_upload_service
            )
        assert "must be video" in str(exc_info.value)
        
        # Scenario 2: Too short for meaningful gameplay (violates Requirement 3)
        video_session = UploadSession(
            session_id="video-session",
            user_id="test-user",
            filename="video.mp4",
            file_size=1_000_000,
            chunk_size=1024,
            total_chunks=1000,
            mime_type="video/mp4",
            status=UploadStatus.COMPLETED,
            uploaded_chunks=list(range(1000))
        )
        
        mock_upload_service.get_upload_status.return_value = video_session
        
        short_request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "video-1", "duration_seconds": 2.0},  # Too short
                {"media_file_id": "video-2", "duration_seconds": 2.0},
                {"media_file_id": "video-3", "duration_seconds": 2.0}
            ],
            lie_statement_index=1
        )
        
        # This should pass creation but fail on publishing due to difficulty validation
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=short_request,
            upload_service=mock_upload_service
        )
        
        with pytest.raises(Exception) as exc_info:
            await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        assert "too short for meaningful gameplay" in str(exc_info.value)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])