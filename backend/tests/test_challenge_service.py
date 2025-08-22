"""
Tests for challenge service
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, AsyncMock

from services.challenge_service import ChallengeService, ChallengeServiceError
from models import (
    CreateChallengeRequest, SubmitGuessRequest, 
    ChallengeStatus, StatementType, UploadSession, UploadStatus
)

@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing"""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path)

@pytest.fixture
def challenge_service(temp_dir, monkeypatch):
    """Create a challenge service with temporary storage"""
    monkeypatch.setattr("config.settings.TEMP_DIR", temp_dir)
    service = ChallengeService()
    return service

@pytest.fixture
def mock_upload_service():
    """Mock upload service"""
    service = Mock()
    service.get_upload_status = AsyncMock()
    return service

@pytest.fixture
def sample_upload_session():
    """Sample completed upload session"""
    return UploadSession(
        session_id="test-session-1",
        user_id="test-user",
        filename="test-video.mp4",
        file_size=1000000,
        chunk_size=1024,
        total_chunks=1000,
        mime_type="video/mp4",
        status=UploadStatus.COMPLETED,
        uploaded_chunks=list(range(1000))
    )

@pytest.fixture
def sample_challenge_request():
    """Sample challenge creation request"""
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

class TestChallengeService:
    """Test cases for ChallengeService"""
    
    @pytest.mark.asyncio
    async def test_create_challenge_success(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test successful challenge creation"""
        # Mock upload service to return completed sessions
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        
        # Create challenge
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        
        # Verify challenge properties
        assert challenge.creator_id == "test-user"
        assert challenge.title == "Test Challenge"
        assert len(challenge.statements) == 3
        assert challenge.status == ChallengeStatus.DRAFT
        assert challenge.tags == ["test", "demo"]
        
        # Verify statements
        lie_statement = None
        truth_count = 0
        for statement in challenge.statements:
            if statement.statement_type == StatementType.LIE:
                lie_statement = statement
            else:
                truth_count += 1
        
        assert lie_statement is not None
        assert truth_count == 2
        assert challenge.lie_statement_id == lie_statement.statement_id
    
    @pytest.mark.asyncio
    async def test_create_challenge_invalid_statement_count(
        self, challenge_service, mock_upload_service
    ):
        """Test challenge creation with invalid statement count"""
        request = CreateChallengeRequest(
            statements=[{"media_file_id": "session-1", "duration_seconds": 10.0}],
            lie_statement_index=0
        )
        
        with pytest.raises(ChallengeServiceError, match="must have exactly 3 statements"):
            await challenge_service.create_challenge(
                creator_id="test-user",
                request=request,
                upload_service=mock_upload_service
            )
    
    @pytest.mark.asyncio
    async def test_create_challenge_invalid_lie_index(
        self, challenge_service, mock_upload_service
    ):
        """Test challenge creation with invalid lie statement index"""
        request = CreateChallengeRequest(
            statements=[
                {"media_file_id": "session-1", "duration_seconds": 10.0},
                {"media_file_id": "session-2", "duration_seconds": 12.0},
                {"media_file_id": "session-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=5  # Invalid index
        )
        
        with pytest.raises(ChallengeServiceError, match="Lie statement index must be"):
            await challenge_service.create_challenge(
                creator_id="test-user",
                request=request,
                upload_service=mock_upload_service
            )
    
    @pytest.mark.asyncio
    async def test_create_challenge_missing_upload_session(
        self, challenge_service, mock_upload_service, sample_challenge_request
    ):
        """Test challenge creation with missing upload session"""
        # Mock upload service to return None (session not found)
        mock_upload_service.get_upload_status.return_value = None
        
        with pytest.raises(ChallengeServiceError, match="Upload session .* not found"):
            await challenge_service.create_challenge(
                creator_id="test-user",
                request=sample_challenge_request,
                upload_service=mock_upload_service
            )
    
    @pytest.mark.asyncio
    async def test_publish_challenge_success(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test successful challenge publishing"""
        # Create a draft challenge first
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        
        # Publish the challenge
        published_challenge = await challenge_service.publish_challenge(
            challenge.challenge_id, "test-user"
        )
        
        assert published_challenge.status == ChallengeStatus.PUBLISHED
        assert published_challenge.published_at is not None
    
    @pytest.mark.asyncio
    async def test_publish_challenge_access_denied(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test challenge publishing with wrong user"""
        # Create a draft challenge
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        
        # Try to publish with different user
        with pytest.raises(ChallengeServiceError, match="Access denied"):
            await challenge_service.publish_challenge(
                challenge.challenge_id, "other-user"
            )
    
    @pytest.mark.asyncio
    async def test_submit_guess_correct(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test submitting a correct guess"""
        # Create and publish a challenge
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        
        # Submit correct guess
        guess_request = SubmitGuessRequest(
            challenge_id=challenge.challenge_id,
            guessed_lie_statement_id=challenge.lie_statement_id,
            response_time_seconds=15.0
        )
        
        guess, points = await challenge_service.submit_guess("guesser-user", guess_request)
        
        assert guess.is_correct is True
        assert points > 0
        assert guess.user_id == "guesser-user"
        assert guess.challenge_id == challenge.challenge_id
    
    @pytest.mark.asyncio
    async def test_submit_guess_incorrect(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test submitting an incorrect guess"""
        # Create and publish a challenge
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        
        # Find a truth statement to guess incorrectly
        wrong_statement_id = None
        for statement in challenge.statements:
            if statement.statement_id != challenge.lie_statement_id:
                wrong_statement_id = statement.statement_id
                break
        
        # Submit incorrect guess
        guess_request = SubmitGuessRequest(
            challenge_id=challenge.challenge_id,
            guessed_lie_statement_id=wrong_statement_id,
            response_time_seconds=25.0
        )
        
        guess, points = await challenge_service.submit_guess("guesser-user", guess_request)
        
        assert guess.is_correct is False
        assert points == 0
    
    @pytest.mark.asyncio
    async def test_submit_duplicate_guess(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test submitting duplicate guess from same user"""
        # Create and publish a challenge
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        
        # Submit first guess
        guess_request = SubmitGuessRequest(
            challenge_id=challenge.challenge_id,
            guessed_lie_statement_id=challenge.lie_statement_id
        )
        await challenge_service.submit_guess("guesser-user", guess_request)
        
        # Try to submit second guess from same user
        with pytest.raises(ChallengeServiceError, match="already guessed"):
            await challenge_service.submit_guess("guesser-user", guess_request)
    
    @pytest.mark.asyncio
    async def test_list_challenges_pagination(
        self, challenge_service, mock_upload_service, sample_upload_session
    ):
        """Test challenge listing with pagination"""
        # Create multiple challenges
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        
        for i in range(5):
            request = CreateChallengeRequest(
                title=f"Challenge {i}",
                statements=[
                    {"media_file_id": f"session-{i}-1", "duration_seconds": 10.0},
                    {"media_file_id": f"session-{i}-2", "duration_seconds": 12.0},
                    {"media_file_id": f"session-{i}-3", "duration_seconds": 8.0}
                ],
                lie_statement_index=0
            )
            challenge = await challenge_service.create_challenge(
                creator_id="test-user",
                request=request,
                upload_service=mock_upload_service
            )
            await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        
        # Test pagination
        challenges, total_count = await challenge_service.list_challenges(page=1, page_size=3)
        
        assert len(challenges) == 3
        assert total_count == 5
        
        # Test second page
        challenges_page2, _ = await challenge_service.list_challenges(page=2, page_size=3)
        assert len(challenges_page2) == 2
    
    @pytest.mark.asyncio
    async def test_get_challenge_increments_view_count(
        self, challenge_service, mock_upload_service, sample_upload_session, sample_challenge_request
    ):
        """Test that getting a challenge increments view count"""
        # Create and publish a challenge
        mock_upload_service.get_upload_status.return_value = sample_upload_session
        challenge = await challenge_service.create_challenge(
            creator_id="test-user",
            request=sample_challenge_request,
            upload_service=mock_upload_service
        )
        await challenge_service.publish_challenge(challenge.challenge_id, "test-user")
        
        initial_views = challenge.view_count
        
        # Get the challenge
        retrieved_challenge = await challenge_service.get_challenge(challenge.challenge_id)
        
        assert retrieved_challenge.view_count == initial_views + 1

if __name__ == "__main__":
    pytest.main([__file__])