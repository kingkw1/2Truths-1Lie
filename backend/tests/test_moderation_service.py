"""
Tests for content moderation service
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

from services.moderation_service import ModerationService, ModerationStatus, ModerationReason


class TestModerationService:
    """Test cases for ModerationService"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data"""
        temp_dir = Path(tempfile.mkdtemp())
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def moderation_service(self, temp_dir, monkeypatch):
        """Create ModerationService instance with temporary storage"""
        # Mock settings.TEMP_DIR
        class MockSettings:
            TEMP_DIR = temp_dir
        
        monkeypatch.setattr('services.moderation_service.settings', MockSettings())
        return ModerationService()
    
    def test_analyze_clean_text(self, moderation_service):
        """Test analysis of clean, appropriate text"""
        result = moderation_service._analyze_text_content("This is a nice, clean statement about my day.")
        
        assert result.status == ModerationStatus.APPROVED
        assert result.confidence == 1.0
        assert len(result.reasons) == 0
    
    def test_analyze_inappropriate_language(self, moderation_service):
        """Test detection of inappropriate language"""
        result = moderation_service._analyze_text_content("This is fucking terrible shit.")
        
        assert result.status == ModerationStatus.REJECTED
        assert result.confidence < 0.3
        assert ModerationReason.INAPPROPRIATE_LANGUAGE in result.reasons
    
    def test_analyze_spam_content(self, moderation_service):
        """Test detection of spam patterns"""
        result = moderation_service._analyze_text_content("Click this link to win free money now!")
        
        assert result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]
        assert ModerationReason.SPAM in result.reasons
    
    def test_analyze_personal_info(self, moderation_service):
        """Test detection of personal information"""
        result = moderation_service._analyze_text_content("My SSN is 123-45-6789 and email is test@example.com")
        
        assert result.status == ModerationStatus.REJECTED
        assert ModerationReason.PERSONAL_INFO in result.reasons
    
    def test_analyze_violence(self, moderation_service):
        """Test detection of violent content"""
        result = moderation_service._analyze_text_content("I want to kill you and hurt everyone.")
        
        assert result.status == ModerationStatus.REJECTED
        assert ModerationReason.VIOLENCE in result.reasons
    
    def test_analyze_empty_text(self, moderation_service):
        """Test analysis of empty or whitespace-only text"""
        result = moderation_service._analyze_text_content("")
        assert result.status == ModerationStatus.APPROVED
        
        result = moderation_service._analyze_text_content("   ")
        assert result.status == ModerationStatus.APPROVED
    
    def test_analyze_media_metadata_normal(self, moderation_service):
        """Test analysis of normal media metadata"""
        media_data = {
            'duration_seconds': 30,
            'file_size': 5_000_000,  # 5MB
            'mime_type': 'video/mp4'
        }
        
        result = moderation_service._analyze_media_metadata(media_data)
        
        assert result.status == ModerationStatus.APPROVED
        assert result.confidence == 1.0
    
    def test_analyze_media_metadata_too_short(self, moderation_service):
        """Test analysis of too short media"""
        media_data = {
            'duration_seconds': 0.5,
            'file_size': 1_000_000,
            'mime_type': 'video/mp4'
        }
        
        result = moderation_service._analyze_media_metadata(media_data)
        
        assert result.status in [ModerationStatus.FLAGGED, ModerationStatus.REJECTED]
        assert ModerationReason.LOW_QUALITY in result.reasons
    
    def test_analyze_media_metadata_too_large(self, moderation_service):
        """Test analysis of too large media files"""
        media_data = {
            'duration_seconds': 30,
            'file_size': 60_000_000,  # 60MB
            'mime_type': 'video/mp4'
        }
        
        result = moderation_service._analyze_media_metadata(media_data)
        
        assert result.status in [ModerationStatus.FLAGGED, ModerationStatus.REJECTED]
        assert ModerationReason.LOW_QUALITY in result.reasons
    
    def test_analyze_media_metadata_invalid_type(self, moderation_service):
        """Test analysis of invalid MIME type"""
        media_data = {
            'duration_seconds': 30,
            'file_size': 5_000_000,
            'mime_type': 'application/exe'
        }
        
        result = moderation_service._analyze_media_metadata(media_data)
        
        assert result.status == ModerationStatus.REJECTED
        assert ModerationReason.LOW_QUALITY in result.reasons
    
    @pytest.mark.asyncio
    async def test_moderate_challenge_clean(self, moderation_service):
        """Test moderation of clean challenge"""
        challenge_data = {
            'challenge_id': 'test-challenge-1',
            'title': 'My Fun Challenge',
            'statements': [
                {'duration_seconds': 30, 'file_size': 5_000_000, 'mime_type': 'video/mp4'},
                {'duration_seconds': 25, 'file_size': 4_500_000, 'mime_type': 'video/mp4'},
                {'duration_seconds': 35, 'file_size': 5_500_000, 'mime_type': 'video/mp4'}
            ]
        }
        
        result = await moderation_service.moderate_challenge(challenge_data)
        
        assert result.status == ModerationStatus.APPROVED
        assert result.confidence > 0.8
        
        # Check that moderation data was saved
        saved_data = await moderation_service.get_moderation_status('test-challenge-1')
        assert saved_data is not None
        assert saved_data['status'] == 'approved'
    
    @pytest.mark.asyncio
    async def test_moderate_challenge_inappropriate_title(self, moderation_service):
        """Test moderation of challenge with inappropriate title"""
        challenge_data = {
            'challenge_id': 'test-challenge-2',
            'title': 'This fucking sucks',
            'statements': [
                {'duration_seconds': 30, 'file_size': 5_000_000, 'mime_type': 'video/mp4'},
                {'duration_seconds': 25, 'file_size': 4_500_000, 'mime_type': 'video/mp4'},
                {'duration_seconds': 35, 'file_size': 5_500_000, 'mime_type': 'video/mp4'}
            ]
        }
        
        result = await moderation_service.moderate_challenge(challenge_data)
        
        assert result.status == ModerationStatus.REJECTED
        assert ModerationReason.INAPPROPRIATE_LANGUAGE in result.reasons
    
    @pytest.mark.asyncio
    async def test_moderate_challenge_problematic_media(self, moderation_service):
        """Test moderation of challenge with problematic media"""
        challenge_data = {
            'challenge_id': 'test-challenge-3',
            'title': 'Normal Title',
            'statements': [
                {'duration_seconds': 0.5, 'file_size': 100_000, 'mime_type': 'video/mp4'},  # Too short
                {'duration_seconds': 25, 'file_size': 4_500_000, 'mime_type': 'video/mp4'},
                {'duration_seconds': 35, 'file_size': 70_000_000, 'mime_type': 'video/mp4'}  # Too large
            ]
        }
        
        result = await moderation_service.moderate_challenge(challenge_data)
        
        assert result.status in [ModerationStatus.FLAGGED, ModerationStatus.REJECTED]
        assert ModerationReason.LOW_QUALITY in result.reasons
    
    @pytest.mark.asyncio
    async def test_flag_challenge(self, moderation_service):
        """Test flagging a challenge"""
        challenge_id = 'test-challenge-flag'
        user_id = 'user123'
        reason = 'Inappropriate content'
        
        success = await moderation_service.flag_challenge(challenge_id, user_id, reason)
        
        assert success is True
        
        # Check that flag was recorded
        moderation_data = await moderation_service.get_moderation_status(challenge_id)
        assert moderation_data is not None
        assert moderation_data['status'] == 'flagged'
        assert 'flags' in moderation_data
        assert len(moderation_data['flags']) == 1
        assert moderation_data['flags'][0]['user_id'] == user_id
        assert moderation_data['flags'][0]['reason'] == reason
    
    @pytest.mark.asyncio
    async def test_manual_review_approve(self, moderation_service):
        """Test manual review with approval"""
        challenge_id = 'test-challenge-review'
        moderator_id = 'mod123'
        
        # First create some moderation data
        await moderation_service.flag_challenge(challenge_id, 'user123', 'Test flag')
        
        # Then manually review
        success = await moderation_service.manual_review(
            challenge_id, moderator_id, ModerationStatus.APPROVED, "Content is actually fine"
        )
        
        assert success is True
        
        # Check updated status
        moderation_data = await moderation_service.get_moderation_status(challenge_id)
        assert moderation_data['status'] == 'approved'
        assert moderation_data['moderator_id'] == moderator_id
        assert moderation_data['manual_review_reason'] == "Content is actually fine"
    
    @pytest.mark.asyncio
    async def test_manual_review_reject(self, moderation_service):
        """Test manual review with rejection"""
        challenge_id = 'test-challenge-reject'
        moderator_id = 'mod123'
        
        # First create some moderation data
        await moderation_service.flag_challenge(challenge_id, 'user123', 'Test flag')
        
        # Then manually review
        success = await moderation_service.manual_review(
            challenge_id, moderator_id, ModerationStatus.REJECTED, "Violates community guidelines"
        )
        
        assert success is True
        
        # Check updated status
        moderation_data = await moderation_service.get_moderation_status(challenge_id)
        assert moderation_data['status'] == 'rejected'
        assert moderation_data['moderator_id'] == moderator_id
        assert moderation_data['manual_review_reason'] == "Violates community guidelines"
    
    def test_get_moderation_stats_empty(self, moderation_service):
        """Test getting moderation stats when no data exists"""
        stats = moderation_service.get_moderation_stats()
        
        expected_stats = {
            "total_moderated": 0,
            "approved": 0,
            "rejected": 0,
            "flagged": 0,
            "pending": 0
        }
        
        assert stats == expected_stats
    
    @pytest.mark.asyncio
    async def test_get_moderation_stats_with_data(self, moderation_service):
        """Test getting moderation stats with actual data"""
        # Create some test moderation data
        await moderation_service.moderate_challenge({
            'challenge_id': 'approved-1',
            'title': 'Good challenge',
            'statements': [{'duration_seconds': 30, 'file_size': 5_000_000, 'mime_type': 'video/mp4'}]
        })
        
        await moderation_service.flag_challenge('flagged-1', 'user1', 'Test flag')
        
        await moderation_service.moderate_challenge({
            'challenge_id': 'rejected-1',
            'title': 'This fucking sucks',
            'statements': [{'duration_seconds': 30, 'file_size': 5_000_000, 'mime_type': 'video/mp4'}]
        })
        
        stats = moderation_service.get_moderation_stats()
        
        assert stats['total_moderated'] == 3
        assert stats['approved'] == 1
        assert stats['rejected'] == 1
        assert stats['flagged'] == 1
    
    @pytest.mark.asyncio
    async def test_persistence(self, moderation_service):
        """Test that moderation data persists across service restarts"""
        challenge_id = 'persistence-test'
        
        # Create moderation data
        await moderation_service.moderate_challenge({
            'challenge_id': challenge_id,
            'title': 'Test Challenge',
            'statements': [{'duration_seconds': 30, 'file_size': 5_000_000, 'mime_type': 'video/mp4'}]
        })
        
        # Create new service instance (simulating restart)
        new_service = ModerationService()
        
        # Check that data was loaded
        moderation_data = await new_service.get_moderation_status(challenge_id)
        assert moderation_data is not None
        assert moderation_data['status'] == 'approved'


if __name__ == "__main__":
    pytest.main([__file__])