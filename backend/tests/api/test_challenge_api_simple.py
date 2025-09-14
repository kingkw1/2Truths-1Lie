#!/usr/bin/env python3
"""
Simple test script for challenge API functionality
"""
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock

from services.challenge_service import ChallengeService
from models import CreateChallengeRequest, SubmitGuessRequest, UploadSession, UploadStatus

async def test_challenge_service():
    """Test the challenge service functionality"""
    print("Testing Challenge Service...")
    
    # Create temporary directory
    temp_dir = Path(tempfile.mkdtemp())
    
    try:
        # Mock settings
        import config
        original_temp_dir = config.settings.TEMP_DIR
        config.settings.TEMP_DIR = temp_dir
        
        # Create service
        service = ChallengeService()
        
        # Mock upload service
        mock_upload_service = Mock()
        mock_upload_service.get_upload_status = AsyncMock()
        
        # Create mock upload session
        upload_session = UploadSession(
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
        mock_upload_service.get_upload_status.return_value = upload_session
        
        # Test 1: Create challenge
        print("  1. Testing challenge creation...")
        request = CreateChallengeRequest(
            title="Test Challenge",
            statements=[
                {"media_file_id": "session-1", "duration_seconds": 10.0},
                {"media_file_id": "session-2", "duration_seconds": 12.0},
                {"media_file_id": "session-3", "duration_seconds": 8.0}
            ],
            lie_statement_index=1,
            tags=["test", "demo"]
        )
        
        challenge = await service.create_challenge(
            creator_id="test-user",
            request=request,
            upload_service=mock_upload_service
        )
        
        assert challenge.creator_id == "test-user"
        assert challenge.title == "Test Challenge"
        assert len(challenge.statements) == 3
        print("     ✓ Challenge created successfully")
        
        # Test 2: Publish challenge
        print("  2. Testing challenge publishing...")
        published_challenge = await service.publish_challenge(
            challenge.challenge_id, "test-user"
        )
        assert published_challenge.status.value == "published"
        print("     ✓ Challenge published successfully")
        
        # Test 3: List challenges
        print("  3. Testing challenge listing...")
        challenges, total_count = await service.list_challenges()
        assert len(challenges) == 1
        assert total_count == 1
        print("     ✓ Challenge listing works")
        
        # Test 4: Submit guess
        print("  4. Testing guess submission...")
        guess_request = SubmitGuessRequest(
            challenge_id=challenge.challenge_id,
            guessed_lie_statement_id=challenge.lie_statement_id,
            response_time_seconds=15.0
        )
        
        guess, points = await service.submit_guess("guesser-user", guess_request)
        assert guess.is_correct is True
        assert points > 0
        print("     ✓ Correct guess submitted successfully")
        
        # Test 5: Submit incorrect guess
        print("  5. Testing incorrect guess...")
        wrong_statement_id = None
        for statement in challenge.statements:
            if statement.statement_id != challenge.lie_statement_id:
                wrong_statement_id = statement.statement_id
                break
        
        wrong_guess_request = SubmitGuessRequest(
            challenge_id=challenge.challenge_id,
            guessed_lie_statement_id=wrong_statement_id,
            response_time_seconds=25.0
        )
        
        wrong_guess, wrong_points = await service.submit_guess("another-user", wrong_guess_request)
        assert wrong_guess.is_correct is False
        assert wrong_points == 0
        print("     ✓ Incorrect guess handled correctly")
        
        print("✅ All challenge service tests passed!")
        
        # Restore original settings
        config.settings.TEMP_DIR = original_temp_dir
        
    finally:
        # Clean up
        shutil.rmtree(temp_dir)

if __name__ == "__main__":
    asyncio.run(test_challenge_service())