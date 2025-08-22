"""
Additional edge case testing for content moderation pipeline
Based on testing guidelines for comprehensive content moderation coverage
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

from services.moderation_service import ModerationService, ModerationStatus, ModerationReason


class TestModerationEdgeCases:
    """Test edge cases and advanced scenarios for content moderation"""
    
    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data"""
        temp_dir = Path(tempfile.mkdtemp())
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def moderation_service(self, temp_dir, monkeypatch):
        """Create ModerationService instance with temporary storage"""
        class MockSettings:
            TEMP_DIR = temp_dir
        
        monkeypatch.setattr('services.moderation_service.settings', MockSettings())
        return ModerationService()

    # Edge Case 1: Malformed Data Testing
    def test_malformed_challenge_data(self, moderation_service):
        """Test handling of malformed challenge data structures"""
        malformed_challenges = [
            {"title": None, "statements": []},  # Missing title
            {"title": "", "statements": None},  # None statements
            {"title": "Test", "statements": [{"invalid": "structure"}]},  # Invalid statement structure
            {"title": "Test", "lie_statement_index": 5, "statements": [{"media_file_id": "1"}]},  # Invalid lie index
        ]
        
        for malformed_data in malformed_challenges:
            try:
                result = moderation_service.moderate_challenge_content(malformed_data)
                # Should either reject malformed data or handle gracefully
                assert result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]
                assert ModerationReason.INVALID_FORMAT in result.reasons or ModerationReason.SPAM in result.reasons
            except Exception as e:
                # If it throws an exception, ensure it's handled gracefully
                assert "validation" in str(e).lower() or "invalid" in str(e).lower()

    # Edge Case 2: Borderline Content Testing
    def test_borderline_inappropriate_content(self, moderation_service):
        """Test content that is borderline inappropriate - should be flagged for review"""
        borderline_content = [
            "This is damn annoying but not really bad",  # Mild profanity
            "I hate this stupid game sometimes",  # Negative sentiment but not offensive
            "My ex was such an idiot, but whatever",  # Personal negativity
            "This challenge is BS but fun",  # Abbreviation profanity
        ]
        
        for content in borderline_content:
            result = moderation_service._analyze_text_content(content)
            # Borderline content should typically be flagged, not auto-rejected
            assert result.status in [ModerationStatus.FLAGGED, ModerationStatus.APPROVED]
            if result.status == ModerationStatus.FLAGGED:
                assert result.confidence < 0.8  # Low confidence indicates need for human review

    # Edge Case 3: Sophisticated Spam Patterns
    def test_sophisticated_spam_detection(self, moderation_service):
        """Test detection of sophisticated spam patterns"""
        sophisticated_spam = [
            "Check out my amazing TikTok account @spammer123",  # Social media promotion
            "I won $1000 yesterday, you can too! Visit mysite.com",  # Money scam
            "🎉🎊 AMAZING DEAL 🎊🎉 Click here for FREE stuff!!!",  # Emoji spam
            "I'm giving away iPhones, just follow and share this",  # Giveaway spam
            "Buy crypto now before it's too late, guaranteed profits",  # Investment spam
        ]
        
        for spam_content in sophisticated_spam:
            result = moderation_service._analyze_text_content(spam_content)
            assert result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]
            assert ModerationReason.SPAM in result.reasons

    # Edge Case 4: Content with Mixed Languages/Unicode
    def test_unicode_and_mixed_language_content(self, moderation_service):
        """Test handling of unicode characters and mixed language content"""
        unicode_content = [
            "这是一个很好的挑战 (This is a good challenge)",  # Chinese with English
            "Это действительно интересно! 😊",  # Russian with emoji
            "¡Hola amigos! This is fun 🎮",  # Spanish/English mix
            "🎵🎶 Music is life 🎶🎵",  # Heavy emoji use
            "ÅÑŚWÉR ÏŃ ÜŃÏÇÖDÉ",  # Special characters
        ]
        
        for content in unicode_content:
            result = moderation_service._analyze_text_content(content)
            # Should handle unicode gracefully without crashing
            assert result.status in [ModerationStatus.APPROVED, ModerationStatus.FLAGGED]
            assert isinstance(result.confidence, (int, float))

    # Edge Case 5: Very Long Content
    def test_extremely_long_content(self, moderation_service):
        """Test handling of extremely long content"""
        # Generate very long content (beyond normal limits)
        long_content = "This is a very long statement. " * 1000  # ~30,000 characters
        
        result = moderation_service._analyze_text_content(long_content)
        # Should either truncate and process, or flag for review
        assert result.status in [ModerationStatus.APPROVED, ModerationStatus.FLAGGED, ModerationStatus.REJECTED]
        if result.status == ModerationStatus.REJECTED:
            assert ModerationReason.INVALID_FORMAT in result.reasons

    # Edge Case 6: Rapid Submission Testing (Rate Limiting Integration)
    def test_rapid_moderation_requests(self, moderation_service):
        """Test moderation service under rapid request scenarios"""
        challenge_ids = [f"rapid-test-{i}" for i in range(10)]
        
        results = []
        for challenge_id in challenge_ids:
            test_content = {"title": f"Test {challenge_id}", "statements": []}
            result = moderation_service.moderate_challenge_content(test_content)
            results.append(result)
        
        # All requests should be processed without errors
        assert len(results) == 10
        for result in results:
            assert isinstance(result.status, ModerationStatus)
            assert isinstance(result.confidence, (int, float))

    # Edge Case 7: Media Metadata Edge Cases
    def test_extreme_media_metadata(self, moderation_service):
        """Test extreme media metadata cases"""
        extreme_cases = [
            {'duration_seconds': 0, 'file_size': 0, 'mime_type': 'video/mp4'},  # Zero duration/size
            {'duration_seconds': 10000, 'file_size': 1000000000, 'mime_type': 'video/mp4'},  # Extremely large
            {'duration_seconds': -5, 'file_size': -1000, 'mime_type': 'invalid/type'},  # Negative values
            {'duration_seconds': float('inf'), 'file_size': float('nan'), 'mime_type': ''},  # Invalid numbers
        ]
        
        for metadata in extreme_cases:
            try:
                result = moderation_service._analyze_media_metadata(metadata)
                # Should handle gracefully or reject
                assert result.status in [ModerationStatus.REJECTED, ModerationStatus.FLAGGED]
            except Exception as e:
                # If exception occurs, should be validation-related
                assert any(word in str(e).lower() for word in ['validation', 'invalid', 'error'])

    # Edge Case 8: Moderation Status Flow Testing
    def test_moderation_status_transitions(self, moderation_service):
        """Test the complete moderation status workflow"""
        challenge_id = "status-flow-test"
        
        # Step 1: Submit for moderation (should start as PENDING or immediate decision)
        test_content = {"title": "Status Flow Test", "statements": []}
        initial_result = moderation_service.moderate_challenge_content(test_content)
        
        # Step 2: If flagged, test manual review process
        if initial_result.status == ModerationStatus.FLAGGED:
            # Simulate moderator approval
            moderation_service.submit_moderation_review(
                challenge_id, "moderator-1", ModerationStatus.APPROVED, "Looks fine after review"
            )
            
            # Verify status updated
            review_data = moderation_service.get_moderation_history(challenge_id)
            assert review_data[-1]['status'] == 'approved'
        
        # Step 3: Test rejection with reason
        moderation_service.submit_moderation_review(
            challenge_id, "moderator-2", ModerationStatus.REJECTED, "Test rejection"
        )
        
        final_data = moderation_service.get_moderation_history(challenge_id)
        assert final_data[-1]['status'] == 'rejected'

    # Edge Case 9: Concurrent Moderation Requests
    def test_concurrent_moderation_handling(self, moderation_service):
        """Test handling of concurrent moderation requests for same content"""
        challenge_id = "concurrent-test"
        
        # Simulate multiple moderators reviewing same content
        moderator_decisions = [
            ("mod-1", ModerationStatus.APPROVED, "Looks good"),
            ("mod-2", ModerationStatus.FLAGGED, "Needs another look"),
            ("mod-3", ModerationStatus.REJECTED, "Not appropriate"),
        ]
        
        for moderator_id, status, reason in moderator_decisions:
            try:
                moderation_service.submit_moderation_review(challenge_id, moderator_id, status, reason)
            except Exception as e:
                # Should handle concurrent reviews gracefully
                assert "concurrent" in str(e).lower() or "conflict" in str(e).lower()
        
        # Should have some form of conflict resolution
        history = moderation_service.get_moderation_history(challenge_id)
        assert len(history) >= 1  # At least one decision should be recorded

    # Edge Case 10: Empty and Null Content
    def test_empty_and_null_content_handling(self, moderation_service):
        """Test handling of empty, null, and whitespace-only content"""
        empty_cases = [
            None,
            "",
            "   ",
            "\n\t\r",
            {"title": "", "statements": []},
            {"title": None, "statements": None},
        ]
        
        for empty_content in empty_cases:
            try:
                if isinstance(empty_content, dict):
                    result = moderation_service.moderate_challenge_content(empty_content)
                else:
                    result = moderation_service._analyze_text_content(empty_content or "")
                
                # Should handle gracefully
                assert result.status in [ModerationStatus.APPROVED, ModerationStatus.REJECTED]
            except Exception as e:
                # If it throws, should be a validation error
                assert any(word in str(e).lower() for word in ['validation', 'required', 'empty'])
