import pytest
from unittest.mock import Mock, AsyncMock
from services.challenge_service import ChallengeService, ChallengeNotFoundError, ChallengeAccessDeniedError
from models import CreateChallengeRequest, UploadSession, UploadStatus

# Mock the database service to simulate database interactions
@pytest.fixture
def mock_db_service():
    db = Mock()
    db.delete_challenge = Mock(return_value=True)
    return db

# Fixture to provide a ChallengeService instance with a mocked database
@pytest.fixture
def challenge_service_with_mocks(monkeypatch, mock_db_service):
    # Mock get_db_service where it is defined
    monkeypatch.setattr(
        "services.database_service.get_db_service", lambda: mock_db_service
    )

    # Initialize the service, which will now use the mock DB
    service = ChallengeService()
    # Clear any data loaded during init to ensure a clean slate for tests
    service.challenges = {}
    return service

# Mock for the upload service
@pytest.fixture
def mock_upload_service():
    service = Mock()
    service.get_upload_status = AsyncMock(return_value=UploadSession(
        session_id="test-session",
        status=UploadStatus.COMPLETED,
        filename="test.mp4",
        file_size=102400,
        chunk_size=10240,
        total_chunks=10,
        uploaded_chunks=list(range(10)),
        user_id="creator-user",
        mime_type="video/mp4"
    ))
    return service

# A sample request to create a challenge
@pytest.fixture
def sample_challenge_request():
    return CreateChallengeRequest(
        title="Test Challenge to Delete",
        statements=[
            {"media_file_id": "session-1", "duration_seconds": 10.0},
            {"media_file_id": "session-2", "duration_seconds": 10.0},
            {"media_file_id": "session-3", "duration_seconds": 10.0},
        ],
        lie_statement_index=1,
    )

@pytest.mark.asyncio
async def test_delete_challenge_success(
    challenge_service_with_mocks, mock_upload_service, sample_challenge_request, mock_db_service
):
    """Test that a user can successfully delete their own challenge."""
    service = challenge_service_with_mocks
    creator_id = "creator-user"

    # Create a challenge to be deleted
    challenge = await service.create_challenge(
        creator_id=creator_id,
        request=sample_challenge_request,
        upload_service=mock_upload_service,
    )
    challenge_id = challenge.challenge_id

    # Ensure challenge is in cache before deletion
    assert challenge_id in service.challenges

    # Perform the deletion
    deleted = await service.delete_challenge(challenge_id, creator_id)

    # Assertions
    assert deleted is True
    # Verify it's removed from the in-memory cache
    assert challenge_id not in service.challenges
    # Verify that the database deletion was called
    mock_db_service.delete_challenge.assert_called_once_with(challenge_id)

@pytest.mark.asyncio
async def test_delete_challenge_access_denied(
    challenge_service_with_mocks, mock_upload_service, sample_challenge_request, mock_db_service
):
    """Test that a user cannot delete a challenge they did not create."""
    service = challenge_service_with_mocks
    creator_id = "creator-user"
    attacker_id = "attacker-user"

    # Create a challenge
    challenge = await service.create_challenge(
        creator_id=creator_id,
        request=sample_challenge_request,
        upload_service=mock_upload_service,
    )
    challenge_id = challenge.challenge_id

    # Attempt to delete with the wrong user
    with pytest.raises(ChallengeAccessDeniedError):
        await service.delete_challenge(challenge_id, attacker_id)

    # Verify challenge was not deleted from cache
    assert challenge_id in service.challenges
    # Verify DB delete was not called
    mock_db_service.delete_challenge.assert_not_called()

@pytest.mark.asyncio
async def test_delete_challenge_not_found(challenge_service_with_mocks, mock_db_service):
    """Test that deleting a non-existent challenge raises ChallengeNotFoundError."""
    service = challenge_service_with_mocks
    non_existent_id = "non-existent-challenge-id"

    with pytest.raises(ChallengeNotFoundError):
        await service.delete_challenge(non_existent_id, "any-user")

    # Verify DB delete was not called
    mock_db_service.delete_challenge.assert_not_called()

@pytest.mark.asyncio
async def test_delete_challenge_db_fails(
    challenge_service_with_mocks, mock_upload_service, sample_challenge_request, mock_db_service
):
    """Test that if DB deletion fails, the challenge is not removed from the cache."""
    service = challenge_service_with_mocks
    creator_id = "creator-user"

    # Configure the mock DB to simulate a failure
    mock_db_service.delete_challenge.return_value = False

    challenge = await service.create_challenge(
        creator_id=creator_id,
        request=sample_challenge_request,
        upload_service=mock_upload_service,
    )
    challenge_id = challenge.challenge_id

    # The service raises ChallengeNotFoundError if the DB returns false,
    # simulating a cache/DB inconsistency.
    with pytest.raises(ChallengeNotFoundError):
        await service.delete_challenge(challenge_id, creator_id)

    # In this scenario, the updated logic removes it from cache anyway for consistency
    assert challenge_id not in service.challenges

    # Verify DB delete was called
    mock_db_service.delete_challenge.assert_called_once_with(challenge_id)