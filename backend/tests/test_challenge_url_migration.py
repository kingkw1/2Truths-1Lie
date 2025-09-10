"""
Tests for Challenge URL Migration

Tests the refactoring of challenge data model to store persistent server URLs.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch

from models import Challenge, Statement, StatementType, ChallengeStatus
from services.migration_service import MediaMigrationService
from services.challenge_service import ChallengeService


class TestChallengeUrlMigration:
    """Test challenge URL migration functionality"""
    
    @pytest.fixture
    def mock_challenge_service(self):
        """Mock challenge service for testing"""
        service = Mock(spec=ChallengeService)
        service.get_all_challenges = AsyncMock()
        service.update_challenge = AsyncMock()
        return service
    
    @pytest.fixture
    def mock_media_service(self):
        """Mock media upload service for testing"""
        service = Mock()
        service.get_media_info = AsyncMock()
        return service
    
    @pytest.fixture
    def legacy_challenge(self):
        """Create a challenge with legacy blob URLs"""
        return Challenge(
            challenge_id="test-challenge-1",
            creator_id="user-123",
            title="Test Challenge",
            statements=[
                Statement(
                    statement_id="stmt-1",
                    statement_type=StatementType.TRUTH,
                    media_url="blob:http://localhost:3000/abc123",  # Legacy blob URL
                    media_file_id="upload-session-1",
                    duration_seconds=10.0,
                    created_at=datetime.utcnow()
                ),
                Statement(
                    statement_id="stmt-2", 
                    statement_type=StatementType.TRUTH,
                    media_url="/api/v1/files/upload-session-2_video.mp4",  # Legacy file URL
                    media_file_id="upload-session-2",
                    duration_seconds=12.0,
                    created_at=datetime.utcnow()
                ),
                Statement(
                    statement_id="stmt-3",
                    statement_type=StatementType.LIE,
                    media_url="blob:http://localhost:3000/def456",  # Legacy blob URL
                    media_file_id="upload-session-3",
                    duration_seconds=8.0,
                    created_at=datetime.utcnow()
                )
            ],
            lie_statement_id="stmt-3",
            status=ChallengeStatus.PUBLISHED,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    @pytest.fixture
    def migrated_challenge(self):
        """Create a challenge with persistent server URLs"""
        return Challenge(
            challenge_id="test-challenge-2",
            creator_id="user-456",
            title="Migrated Challenge",
            statements=[
                Statement(
                    statement_id="stmt-4",
                    statement_type=StatementType.TRUTH,
                    media_url="https://cdn.example.com/media/user-456/media-1/video.mp4",
                    media_file_id="media-1",
                    streaming_url="https://cdn.example.com/media/user-456/media-1/video.mp4",
                    cloud_storage_key="media/user-456/media-1/video.mp4",
                    storage_type="cloud",
                    duration_seconds=15.0,
                    created_at=datetime.utcnow()
                ),
                Statement(
                    statement_id="stmt-5",
                    statement_type=StatementType.TRUTH,
                    media_url="/api/v1/media/stream/media-2",
                    media_file_id="media-2",
                    streaming_url="/api/v1/media/stream/media-2",
                    storage_type="local",
                    duration_seconds=11.0,
                    created_at=datetime.utcnow()
                ),
                Statement(
                    statement_id="stmt-6",
                    statement_type=StatementType.LIE,
                    media_url="https://cdn.example.com/media/user-456/media-3/video.mp4",
                    media_file_id="media-3",
                    streaming_url="https://cdn.example.com/media/user-456/media-3/video.mp4",
                    cloud_storage_key="media/user-456/media-3/video.mp4",
                    storage_type="cloud",
                    duration_seconds=9.0,
                    created_at=datetime.utcnow()
                )
            ],
            lie_statement_id="stmt-6",
            status=ChallengeStatus.PUBLISHED,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    @pytest.mark.asyncio
    async def test_statement_model_has_persistent_url_fields(self):
        """Test that Statement model includes new persistent URL fields"""
        
        statement = Statement(
            statement_id="test-stmt",
            statement_type=StatementType.TRUTH,
            media_url="https://cdn.example.com/media/video.mp4",
            media_file_id="media-123",
            streaming_url="https://cdn.example.com/media/video.mp4",
            cloud_storage_key="media/user/media-123/video.mp4",
            storage_type="cloud",
            duration_seconds=10.0,
            created_at=datetime.utcnow()
        )
        
        # Verify all new fields are present
        assert statement.streaming_url == "https://cdn.example.com/media/video.mp4"
        assert statement.cloud_storage_key == "media/user/media-123/video.mp4"
        assert statement.storage_type == "cloud"
        
        # Verify backward compatibility
        assert statement.media_url == "https://cdn.example.com/media/video.mp4"
        assert statement.media_file_id == "media-123"
    
    @pytest.mark.asyncio
    async def test_identify_legacy_challenges(self, legacy_challenge, migrated_challenge):
        """Test identification of challenges that need URL migration"""
        
        migration_service = MediaMigrationService()
        
        # Legacy challenge should need migration
        for statement in legacy_challenge.statements:
            needs_migration = (
                statement.media_url.startswith('blob:') or
                statement.media_url.startswith('/api/v1/files/') or
                not statement.streaming_url or
                not statement.storage_type
            )
            assert needs_migration, f"Statement {statement.statement_id} should need migration"
        
        # Migrated challenge should not need migration
        for statement in migrated_challenge.statements:
            needs_migration = (
                statement.media_url.startswith('blob:') or
                statement.media_url.startswith('/api/v1/files/') or
                not statement.streaming_url or
                not statement.storage_type
            )
            assert not needs_migration, f"Statement {statement.statement_id} should not need migration"
    
    @pytest.mark.asyncio
    async def test_migrate_challenge_urls_dry_run(self, mock_challenge_service, legacy_challenge):
        """Test dry run migration of challenge URLs"""
        
        # Setup mocks
        mock_challenge_service.get_all_challenges.return_value = [legacy_challenge]
        
        migration_service = MediaMigrationService()
        
        # Run dry run migration
        result = await migration_service.migrate_challenge_urls(
            challenge_service=mock_challenge_service,
            dry_run=True
        )
        
        # Verify results
        assert result['total_challenges'] == 1
        assert result['migrated'] == 0  # No actual migration in dry run
        assert result['failed'] == 0
        assert len(result['results']) == 1
        assert result['results'][0]['status'] == 'dry_run'
        
        # Verify no actual updates were made
        mock_challenge_service.update_challenge.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_migrate_challenge_urls_with_cloud_storage(self, mock_challenge_service, legacy_challenge):
        """Test migration with cloud storage URLs"""
        
        # Setup mocks
        mock_challenge_service.get_all_challenges.return_value = [legacy_challenge]
        mock_challenge_service.update_challenge.return_value = legacy_challenge
        
        # Mock cloud storage
        mock_cloud_storage = Mock()
        mock_cloud_storage.get_file_url = AsyncMock(return_value="https://signed-url.example.com/video.mp4")
        
        # Mock media service
        with patch('services.migration_service.MediaUploadService') as mock_media_service_class:
            mock_media_service = Mock()
            mock_media_service.get_media_info = AsyncMock(return_value={
                'storage_type': 'cloud',
                'cloud_key': 'media/user-123/upload-session-1/video.mp4'
            })
            mock_media_service_class.return_value = mock_media_service
            
            migration_service = MediaMigrationService()
            migration_service.cloud_storage = mock_cloud_storage
            
            # Run migration
            result = await migration_service.migrate_challenge_urls(
                challenge_service=mock_challenge_service,
                dry_run=False
            )
            
            # Verify results
            assert result['total_challenges'] == 1
            assert result['migrated'] == 1
            assert result['failed'] == 0
            
            # Verify update was called
            mock_challenge_service.update_challenge.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_migrate_challenge_urls_with_local_storage(self, mock_challenge_service, legacy_challenge):
        """Test migration with local storage URLs"""
        
        # Setup mocks
        mock_challenge_service.get_all_challenges.return_value = [legacy_challenge]
        mock_challenge_service.update_challenge.return_value = legacy_challenge
        
        # Mock media service for local storage
        with patch('services.migration_service.MediaUploadService') as mock_media_service_class:
            mock_media_service = Mock()
            mock_media_service.get_media_info = AsyncMock(return_value={
                'storage_type': 'local'
            })
            mock_media_service_class.return_value = mock_media_service
            
            migration_service = MediaMigrationService()
            
            # Run migration
            result = await migration_service.migrate_challenge_urls(
                challenge_service=mock_challenge_service,
                dry_run=False
            )
            
            # Verify results
            assert result['total_challenges'] == 1
            assert result['migrated'] == 1
            assert result['failed'] == 0
            
            # Verify update was called
            mock_challenge_service.update_challenge.assert_called_once()
            
            # Get the updated challenge
            call_args = mock_challenge_service.update_challenge.call_args
            updated_challenge = call_args[0][1]  # Second argument is the updated challenge
            
            # Verify local streaming URLs were set
            for statement in updated_challenge.statements:
                assert statement.streaming_url.startswith('/api/v1/media/stream/')
                assert statement.storage_type == 'local'
    
    @pytest.mark.asyncio
    async def test_migrate_challenge_urls_handles_errors(self, mock_challenge_service, legacy_challenge):
        """Test migration handles errors gracefully"""
        
        # Setup mocks
        mock_challenge_service.get_all_challenges.return_value = [legacy_challenge]
        
        # Mock media service to raise an error
        with patch('services.migration_service.MediaUploadService') as mock_media_service_class:
            mock_media_service = Mock()
            mock_media_service.get_media_info = AsyncMock(side_effect=Exception("Media service error"))
            mock_media_service_class.return_value = mock_media_service
            
            migration_service = MediaMigrationService()
            
            # Run migration
            result = await migration_service.migrate_challenge_urls(
                challenge_service=mock_challenge_service,
                dry_run=False
            )
            
            # Verify error handling
            assert result['total_challenges'] == 1
            assert result['migrated'] == 0
            assert result['failed'] == 1
            assert result['results'][0]['status'] == 'failed'
            assert 'error' in result['results'][0]
    
    @pytest.mark.asyncio
    async def test_no_migration_needed_for_already_migrated(self, mock_challenge_service, migrated_challenge):
        """Test that already migrated challenges are skipped"""
        
        # Setup mocks
        mock_challenge_service.get_all_challenges.return_value = [migrated_challenge]
        
        migration_service = MediaMigrationService()
        
        # Run migration
        result = await migration_service.migrate_challenge_urls(
            challenge_service=mock_challenge_service,
            dry_run=False
        )
        
        # Verify results
        assert result['total_challenges'] == 1
        assert result['migrated'] == 0
        assert result['failed'] == 0
        assert result['results'][0]['status'] == 'no_migration_needed'
        
        # Verify no update was called
        mock_challenge_service.update_challenge.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__])