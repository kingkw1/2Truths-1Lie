"""
Challenge service for managing game challenges and guesses
"""
import json
import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging

from models import (
    Challenge, Statement, GuessSubmission, ChallengeStatus, StatementType,
    CreateChallengeRequest, SubmitGuessRequest
)
from config import settings
from services.moderation_service import ModerationService, ModerationStatus
from services.rate_limiter import RateLimiter, RateLimitExceeded
from services.validation_service import gameplay_validator, integrity_validator

logger = logging.getLogger(__name__)

class ChallengeServiceError(Exception):
    """Custom exception for challenge service errors"""
    pass

class ChallengeService:
    """Service for managing challenges and guesses"""
    
    def __init__(self):
        self.challenges: Dict[str, Challenge] = {}
        self.guesses: Dict[str, GuessSubmission] = {}
        self.challenges_file = settings.TEMP_DIR / "challenges.json"
        self.guesses_file = settings.TEMP_DIR / "guesses.json"
        self.moderation_service = ModerationService()
        self.rate_limiter = RateLimiter()
        self._load_data()
    
    def _convert_segment_times_to_milliseconds(self, challenge: Challenge) -> Challenge:
        """Convert segment times from seconds to milliseconds for frontend compatibility"""
        if not challenge.merged_video_metadata or not challenge.merged_video_metadata.get("segments"):
            return challenge
        
        segments = challenge.merged_video_metadata.get("segments", [])
        converted_segments = []
        
        for segment in segments:
            if isinstance(segment, dict):
                converted_segment = segment.copy()
                # Convert times from seconds to milliseconds if they appear to be in seconds
                # Check both camelCase and snake_case field names
                for time_field in ["start_time", "startTime"]:
                    if time_field in converted_segment and converted_segment[time_field] is not None and converted_segment[time_field] < 1000:
                        converted_segment[time_field] = int(converted_segment[time_field] * 1000)
                for time_field in ["end_time", "endTime"]:
                    if time_field in converted_segment and converted_segment[time_field] is not None and converted_segment[time_field] < 1000:
                        converted_segment[time_field] = int(converted_segment[time_field] * 1000)
                for time_field in ["duration"]:
                    if time_field in converted_segment and converted_segment[time_field] is not None and converted_segment[time_field] < 1000:
                        converted_segment[time_field] = int(converted_segment[time_field] * 1000)
                converted_segments.append(converted_segment)
            else:
                converted_segments.append(segment)
        
        # Create a copy of the challenge with converted segments
        challenge_dict = challenge.model_dump()
        challenge_dict["merged_video_metadata"]["segments"] = converted_segments
        return Challenge(**challenge_dict)

    def _load_data(self):
        self.guesses: Dict[str, GuessSubmission] = {}
        self.challenges_file = settings.TEMP_DIR / "challenges.json"
        self.guesses_file = settings.TEMP_DIR / "guesses.json"
        self.moderation_service = ModerationService()
        self.rate_limiter = RateLimiter()
        self._load_data()
    
    def _load_data(self):
        """Load challenges and guesses from disk"""
        try:
            # Load challenges
            if self.challenges_file.exists():
                with open(self.challenges_file, 'r') as f:
                    data = json.load(f)
                    for challenge_data in data.values():
                        challenge = Challenge(**challenge_data)
                        self.challenges[challenge.challenge_id] = challenge
            
            # Load guesses
            if self.guesses_file.exists():
                with open(self.guesses_file, 'r') as f:
                    data = json.load(f)
                    for guess_data in data.values():
                        guess = GuessSubmission(**guess_data)
                        self.guesses[guess.guess_id] = guess
                        
        except Exception as e:
            logger.error(f"Error loading challenge data: {e}")
            self.challenges = {}
            self.guesses = {}
    
    async def _save_challenges(self):
        """Save challenges to disk"""
        try:
            data = {
                challenge_id: challenge.model_dump() 
                for challenge_id, challenge in self.challenges.items()
            }
            with open(self.challenges_file, 'w') as f:
                json.dump(data, f, default=str, indent=2)
        except Exception as e:
            logger.error(f"Error saving challenges: {e}")
    
    async def _save_guesses(self):
        """Save guesses to disk"""
        try:
            data = {
                guess_id: guess.model_dump() 
                for guess_id, guess in self.guesses.items()
            }
            with open(self.guesses_file, 'w') as f:
                json.dump(data, f, default=str, indent=2)
        except Exception as e:
            logger.error(f"Error saving guesses: {e}")
    
    async def create_challenge(
        self, 
        creator_id: str, 
        request: CreateChallengeRequest,
        upload_service
    ) -> Challenge:
        """Create a new challenge"""
        
        # Check rate limit before creating challenge
        try:
            await self.rate_limiter.check_rate_limit(creator_id)
        except RateLimitExceeded as e:
            raise ChallengeServiceError(str(e))
        
        # Validate challenge creation request
        validation_result = await gameplay_validator.validate_challenge_creation(request, upload_service)
        if not validation_result.is_valid:
            raise ChallengeServiceError(f"Challenge validation failed: {validation_result.message}")
        
        # Validate that we have exactly 3 statements
        if len(request.statements) != 3:
            raise ChallengeServiceError("Challenge must have exactly 3 statements")
        
        # Validate lie statement index
        if request.lie_statement_index < 0 or request.lie_statement_index >= 3:
            raise ChallengeServiceError("Lie statement index must be 0, 1, or 2")
        
        # Validate merged video metadata if provided
        if request.is_merged_video:
            # Check if we have server-side merged video data
            if request.merged_video_url and request.merged_video_metadata:
                # Server-side merged video - validate metadata
                segment_indices = {segment.statement_index for segment in request.merged_video_metadata.segments}
                expected_indices = {0, 1, 2}
                if segment_indices != expected_indices:
                    raise ChallengeServiceError(f"Merged video must have segments for indices 0, 1, 2. Got: {segment_indices}")
            elif not request.merged_video_metadata and not request.legacy_merged_metadata:
                # Client-side merged video - require metadata
                raise ChallengeServiceError("Merged video metadata is required when is_merged_video is True")
            
            if request.merged_video_metadata:
                # Validate that we have segment metadata for all 3 statements
                segment_indices = {segment.statement_index for segment in request.merged_video_metadata.segments}
                expected_indices = {0, 1, 2}
                if segment_indices != expected_indices:
                    raise ChallengeServiceError(f"Merged video must have segments for indices 0, 1, 2. Got: {segment_indices}")
        
        # Generate challenge ID
        challenge_id = str(uuid.uuid4())
        
        # Create statements from uploaded media
        statements = []
        lie_statement_id = None
        
        # Check if this is a server-side merged video
        if request.is_merged_video and request.merged_video_url and request.merged_video_metadata:
            # Server-side merged video - create statements that reference the merged video
            for i, stmt_data in enumerate(request.statements):
                statement_id = str(uuid.uuid4())
                
                # Determine if this is the lie
                statement_type = StatementType.LIE if i == request.lie_statement_index else StatementType.TRUTH
                if statement_type == StatementType.LIE:
                    lie_statement_id = statement_id
                
                # Find the segment metadata for this statement index
                segment_metadata = None
                for segment in request.merged_video_metadata.segments:
                    if segment.statement_index == i:
                        segment_metadata = segment
                        break
                
                if not segment_metadata:
                    raise ChallengeServiceError(f"Missing segment metadata for statement {i}")
                
                # Create statement with merged video URL and segment metadata
                statement = Statement(
                    statement_id=statement_id,
                    statement_type=statement_type,
                    media_url=request.merged_video_url,
                    media_file_id=request.merged_video_file_id or f"merged_{request.merge_session_id}",
                    streaming_url=request.merged_video_url,
                    cloud_storage_key=None,  # Will be set by the merge service
                    storage_type="cloud" if request.merged_video_url.startswith("http") else "local",
                    duration_seconds=segment_metadata.duration,
                    # Legacy segment metadata for backward compatibility
                    segment_start_time=segment_metadata.start_time,
                    segment_end_time=segment_metadata.end_time,
                    segment_duration=segment_metadata.duration,
                    # Enhanced segment metadata
                    segment_metadata=segment_metadata,
                    created_at=datetime.utcnow()
                )
                statements.append(statement)
        else:
            # Client-side upload or legacy merged video - process individual files
            for i, stmt_data in enumerate(request.statements):
                statement_id = str(uuid.uuid4())
                
                # Determine if this is the lie
                statement_type = StatementType.LIE if i == request.lie_statement_index else StatementType.TRUTH
                if statement_type == StatementType.LIE:
                    lie_statement_id = statement_id
                
                # Get media info from upload service
                media_file_id = stmt_data.get('media_file_id')
                if not media_file_id:
                    raise ChallengeServiceError(f"Missing media_file_id for statement {i}")
                
                # Verify the upload session exists and is completed
                upload_session = await upload_service.get_upload_status(media_file_id)
                if not upload_session:
                    raise ChallengeServiceError(f"Upload session {media_file_id} not found")
                
                if upload_session.status != "completed":
                    raise ChallengeServiceError(f"Upload session {media_file_id} is not completed")
                
                # Get media info from media upload service to get persistent URLs
                from services.media_upload_service import MediaUploadService
                media_service = MediaUploadService()
                
                # Complete the upload to get persistent URLs
                try:
                    completion_result = await media_service.complete_video_upload(
                        session_id=media_file_id,
                        user_id=creator_id
                    )
                    
                    # Use the persistent streaming URL
                    media_url = completion_result.get('streaming_url', f"/api/v1/media/stream/{completion_result['media_id']}")
                    streaming_url = completion_result.get('streaming_url')
                    cloud_storage_key = completion_result.get('cloud_key')
                    storage_type = completion_result.get('storage_type', 'local')
                    
                except Exception as e:
                    logger.warning(f"Failed to complete media upload for {media_file_id}: {e}")
                    # Fallback to legacy URL format
                    media_url = f"/api/v1/files/{media_file_id}_{upload_session.filename}"
                    streaming_url = None
                    cloud_storage_key = None
                    storage_type = "local"
                
                # Create segment metadata if this is a merged video
                segment_metadata = None
                if request.is_merged_video and request.merged_video_metadata:
                    # Find the segment metadata for this statement index
                    for segment in request.merged_video_metadata.segments:
                        if segment.statement_index == i:
                            segment_metadata = segment
                            break
                
                # Create statement with persistent URLs and segment metadata
                statement = Statement(
                    statement_id=statement_id,
                    statement_type=statement_type,
                    media_url=media_url,
                    media_file_id=media_file_id,
                    streaming_url=streaming_url,
                    cloud_storage_key=cloud_storage_key,
                    storage_type=storage_type,
                    duration_seconds=stmt_data.get('duration_seconds', 0.0),
                    # Legacy segment metadata for backward compatibility
                    segment_start_time=stmt_data.get('segment_start_time'),
                    segment_end_time=stmt_data.get('segment_end_time'),
                    segment_duration=stmt_data.get('segment_duration'),
                    # Enhanced segment metadata
                    segment_metadata=segment_metadata,
                    created_at=datetime.utcnow()
                )
                statements.append(statement)
        
        # Create challenge with merged video metadata
        challenge = Challenge(
            challenge_id=challenge_id,
            creator_id=creator_id,
            title=request.title,
            statements=statements,
            lie_statement_id=lie_statement_id,
            status=ChallengeStatus.PUBLISHED,  # Auto-publish for mobile game
            tags=request.tags,
            is_merged_video=request.is_merged_video,
            merged_video_metadata=request.merged_video_metadata,
            legacy_merged_metadata=request.legacy_merged_metadata,
            # Server-side merged video fields
            merged_video_url=request.merged_video_url,
            merged_video_file_id=request.merged_video_file_id,
            merge_session_id=request.merge_session_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            published_at=datetime.utcnow()  # Set publish time for auto-published challenges
        )
        
        # Validate complete challenge structure
        structure_validation = await gameplay_validator.validate_challenge_structure(challenge)
        if not structure_validation.is_valid:
            raise ChallengeServiceError(f"Challenge structure validation failed: {structure_validation.message}")
        
        # Validate challenge integrity
        integrity_validation = await integrity_validator.validate_challenge_consistency(challenge)
        if not integrity_validation.is_valid:
            raise ChallengeServiceError(f"Challenge integrity validation failed: {integrity_validation.message}")
        
        # Store challenge
        self.challenges[challenge_id] = challenge
        await self._save_challenges()
        
        # Record the request for rate limiting
        await self.rate_limiter.record_request(creator_id)
        
        logger.info(f"Challenge {challenge_id} created by user {creator_id} (validation passed)")
        return challenge
    
    async def publish_challenge(self, challenge_id: str, creator_id: str) -> Challenge:
        """Publish a draft challenge after moderation"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            raise ChallengeServiceError("Challenge not found")
        
        if challenge.creator_id != creator_id:
            raise ChallengeServiceError("Access denied")
        
        if challenge.status != ChallengeStatus.DRAFT:
            raise ChallengeServiceError("Only draft challenges can be published")
        
        # Run complete validation before publishing
        complete_validation = await gameplay_validator.validate_complete_challenge(challenge, self)
        if not complete_validation.is_valid:
            raise ChallengeServiceError(f"Challenge failed pre-publication validation: {complete_validation.message}")
        
        # Prepare challenge data for moderation
        challenge_data = {
            "challenge_id": challenge_id,
            "title": challenge.title,
            "statements": [
                {
                    "duration_seconds": stmt.duration_seconds,
                    "mime_type": "video/mp4",  # Default for video challenges
                    "file_size": 0  # Would be populated from upload service in real implementation
                }
                for stmt in challenge.statements
            ]
        }
        
        # Run content moderation
        moderation_result = await self.moderation_service.moderate_challenge(challenge_data)
        
        # Update challenge status based on moderation result
        if moderation_result.status == ModerationStatus.APPROVED:
            challenge.status = ChallengeStatus.PUBLISHED
            challenge.published_at = datetime.utcnow()
        elif moderation_result.status == ModerationStatus.REJECTED:
            challenge.status = ChallengeStatus.REJECTED
        else:  # FLAGGED or PENDING
            challenge.status = ChallengeStatus.PENDING_MODERATION
        
        challenge.updated_at = datetime.utcnow()
        await self._save_challenges()
        
        logger.info(f"Challenge {challenge_id} moderation completed: {challenge.status.value}")
        return challenge
    
    async def get_challenge(self, challenge_id: str) -> Optional[Challenge]:
        """Get a challenge by ID"""
        challenge = self.challenges.get(challenge_id)
        if challenge and challenge.status == ChallengeStatus.PUBLISHED:
            # Increment view count
            challenge.view_count += 1
            challenge.updated_at = datetime.utcnow()
            await self._save_challenges()
            # Convert segment times to milliseconds for frontend compatibility
            return self._convert_segment_times_to_milliseconds(challenge)
        elif challenge:
            # Convert segment times to milliseconds for frontend compatibility
            return self._convert_segment_times_to_milliseconds(challenge)
        return challenge
    
    async def get_challenge_segment_metadata(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        """Get segment metadata for a challenge for playback purposes"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            return None
        
        if not challenge.is_merged_video:
            return None
        
        # Return structured segment metadata if available
        if challenge.merged_video_metadata:
            return {
                "is_merged_video": True,
                "total_duration": challenge.merged_video_metadata.total_duration,
                "segments": [
                    {
                        "statement_id": statement.statement_id,
                        "statement_index": segment.statement_index,
                        "start_time": segment.start_time,
                        "end_time": segment.end_time,
                        "duration": segment.duration,
                        "statement_type": statement.statement_type.value
                    }
                    for statement, segment in zip(challenge.statements, challenge.merged_video_metadata.segments)
                ],
                "video_file_id": challenge.merged_video_metadata.video_file_id,
                "compression_applied": challenge.merged_video_metadata.compression_applied
            }
        
        # Fallback to legacy metadata format
        if challenge.legacy_merged_metadata:
            return {
                "is_merged_video": True,
                "legacy_format": True,
                "metadata": challenge.legacy_merged_metadata
            }
        
        # Fallback to statement-level segment metadata
        segments = []
        for i, statement in enumerate(challenge.statements):
            if statement.segment_metadata:
                segments.append({
                    "statement_id": statement.statement_id,
                    "statement_index": i,
                    "start_time": statement.segment_metadata.start_time,
                    "end_time": statement.segment_metadata.end_time,
                    "duration": statement.segment_metadata.duration,
                    "statement_type": statement.statement_type.value
                })
            elif statement.segment_start_time is not None and statement.segment_end_time is not None:
                # Legacy format
                segments.append({
                    "statement_id": statement.statement_id,
                    "statement_index": i,
                    "start_time": statement.segment_start_time,
                    "end_time": statement.segment_end_time,
                    "duration": statement.segment_duration or (statement.segment_end_time - statement.segment_start_time),
                    "statement_type": statement.statement_type.value
                })
        
        if segments:
            return {
                "is_merged_video": True,
                "segments": segments,
                "legacy_format": True
            }
        
        return None
    
    async def list_challenges(
        self, 
        page: int = 1, 
        page_size: int = 20,
        creator_id: Optional[str] = None,
        status: Optional[ChallengeStatus] = None,
        tags: Optional[List[str]] = None
    ) -> Tuple[List[Challenge], int]:
        """List challenges with pagination and filtering"""
        
        # Filter challenges
        filtered_challenges = []
        for challenge in self.challenges.values():
            # Filter by creator
            if creator_id and challenge.creator_id != creator_id:
                continue
            
            # Filter by status (default to published for public listing)
            if status:
                if challenge.status != status:
                    continue
            elif not creator_id:  # Public listing - only show published
                if challenge.status != ChallengeStatus.PUBLISHED:
                    continue
            
            # Filter by tags
            if tags:
                if not any(tag in challenge.tags for tag in tags):
                    continue
            
            filtered_challenges.append(challenge)
        
        # Sort by creation date (newest first)
        filtered_challenges.sort(key=lambda x: x.created_at, reverse=True)
        
        # Paginate
        total_count = len(filtered_challenges)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_challenges = filtered_challenges[start_idx:end_idx]
        
        return page_challenges, total_count
    
    async def submit_guess(
        self, 
        user_id: str, 
        request: SubmitGuessRequest
    ) -> Tuple[GuessSubmission, int]:
        """Submit a guess for a challenge"""
        
        # Get challenge
        challenge = self.challenges.get(request.challenge_id)
        if not challenge:
            raise ChallengeServiceError("Challenge not found")
        
        if challenge.status != ChallengeStatus.PUBLISHED:
            raise ChallengeServiceError("Challenge is not available for guessing")
        
        # Check if user already guessed on this challenge
        existing_guess = None
        for guess in self.guesses.values():
            if guess.challenge_id == request.challenge_id and guess.user_id == user_id:
                existing_guess = guess
                break
        
        if existing_guess:
            raise ChallengeServiceError("User has already guessed on this challenge")
        
        # Validate guessed statement exists
        guessed_statement = None
        for statement in challenge.statements:
            if statement.statement_id == request.guessed_lie_statement_id:
                guessed_statement = statement
                break
        
        if not guessed_statement:
            raise ChallengeServiceError("Invalid statement ID")
        
        # Check if guess is correct
        is_correct = request.guessed_lie_statement_id == challenge.lie_statement_id
        
        # Calculate points (simple scoring system)
        points_earned = 0
        if is_correct:
            base_points = 100
            # Bonus for quick response (if provided)
            if request.response_time_seconds and request.response_time_seconds < 30:
                time_bonus = max(0, int((30 - request.response_time_seconds) * 2))
                points_earned = base_points + time_bonus
            else:
                points_earned = base_points
        
        # Create guess submission
        guess_id = str(uuid.uuid4())
        guess = GuessSubmission(
            guess_id=guess_id,
            challenge_id=request.challenge_id,
            user_id=user_id,
            guessed_lie_statement_id=request.guessed_lie_statement_id,
            is_correct=is_correct,
            submitted_at=datetime.utcnow(),
            response_time_seconds=request.response_time_seconds
        )
        
        # Update challenge statistics
        challenge.guess_count += 1
        if is_correct:
            challenge.correct_guess_count += 1
        challenge.updated_at = datetime.utcnow()
        
        # Store guess and update challenge
        self.guesses[guess_id] = guess
        await self._save_guesses()
        await self._save_challenges()
        
        logger.info(f"Guess {guess_id} submitted by user {user_id} for challenge {request.challenge_id}, correct: {is_correct}")
        return guess, points_earned
    
    async def get_user_guesses(self, user_id: str) -> List[GuessSubmission]:
        """Get all guesses by a user"""
        user_guesses = [
            guess for guess in self.guesses.values() 
            if guess.user_id == user_id
        ]
        return sorted(user_guesses, key=lambda x: x.submitted_at, reverse=True)
    
    async def get_user_challenges(
        self, 
        user_id: str, 
        page: int = 1, 
        page_size: int = 20
    ) -> List[Challenge]:
        """Get challenges created by a specific user"""
        user_challenges = [
            challenge for challenge in self.challenges.values()
            if challenge.creator_id == user_id
        ]
        
        # Sort by creation date (newest first)
        user_challenges.sort(key=lambda x: x.created_at, reverse=True)
        
        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_challenges = user_challenges[start_idx:end_idx]
        
        return page_challenges
    
    async def get_challenge_guesses(self, challenge_id: str, creator_id: str) -> List[GuessSubmission]:
        """Get all guesses for a challenge (only for challenge creator)"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            raise ChallengeServiceError("Challenge not found")
        
        if challenge.creator_id != creator_id:
            raise ChallengeServiceError("Access denied")
        
        challenge_guesses = [
            guess for guess in self.guesses.values() 
            if guess.challenge_id == challenge_id
        ]
        return sorted(challenge_guesses, key=lambda x: x.submitted_at, reverse=True)
    
    async def delete_challenge(self, challenge_id: str, creator_id: str) -> bool:
        """Delete a challenge (only draft challenges)"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            return False
        
        if challenge.creator_id != creator_id:
            raise ChallengeServiceError("Access denied")
        
        if challenge.status != ChallengeStatus.DRAFT:
            raise ChallengeServiceError("Only draft challenges can be deleted")
        
        # Remove challenge
        del self.challenges[challenge_id]
        await self._save_challenges()
        
        logger.info(f"Challenge {challenge_id} deleted by user {creator_id}")
        return True
    
    async def flag_challenge(self, challenge_id: str, user_id: str, reason: str) -> bool:
        """Flag a challenge for manual review"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            raise ChallengeServiceError("Challenge not found")
        
        # Only published challenges can be flagged
        if challenge.status != ChallengeStatus.PUBLISHED:
            raise ChallengeServiceError("Only published challenges can be flagged")
        
        # Flag the challenge through moderation service
        success = await self.moderation_service.flag_challenge(challenge_id, user_id, reason)
        
        if success:
            # Update challenge status
            challenge.status = ChallengeStatus.FLAGGED
            challenge.updated_at = datetime.utcnow()
            await self._save_challenges()
        
        return success
    
    async def manual_moderation_review(
        self, 
        challenge_id: str, 
        moderator_id: str, 
        decision: str, 
        reason: Optional[str] = None
    ) -> Challenge:
        """Manually review a flagged or pending challenge"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            raise ChallengeServiceError("Challenge not found")
        
        # Validate decision
        valid_decisions = ["approved", "rejected", "flagged"]
        if decision not in valid_decisions:
            raise ChallengeServiceError(f"Invalid decision. Must be one of: {valid_decisions}")
        
        # Map decision to moderation status
        moderation_status_map = {
            "approved": ModerationStatus.APPROVED,
            "rejected": ModerationStatus.REJECTED,
            "flagged": ModerationStatus.FLAGGED
        }
        
        moderation_status = moderation_status_map[decision]
        
        # Update moderation service
        success = await self.moderation_service.manual_review(
            challenge_id, moderator_id, moderation_status, reason
        )
        
        if not success:
            raise ChallengeServiceError("Failed to update moderation status")
        
        # Update challenge status
        if decision == "approved":
            challenge.status = ChallengeStatus.PUBLISHED
            if not challenge.published_at:
                challenge.published_at = datetime.utcnow()
        elif decision == "rejected":
            challenge.status = ChallengeStatus.REJECTED
        else:  # flagged
            challenge.status = ChallengeStatus.FLAGGED
        
        challenge.updated_at = datetime.utcnow()
        await self._save_challenges()
        
        logger.info(f"Challenge {challenge_id} manually reviewed by {moderator_id}: {decision}")
        return challenge
    
    async def get_moderation_status(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        """Get moderation status for a challenge"""
        return await self.moderation_service.get_moderation_status(challenge_id)
    
    async def get_challenges_for_moderation(
        self, 
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Challenge], int]:
        """Get challenges that need moderation review"""
        moderation_statuses = [
            ChallengeStatus.PENDING_MODERATION,
            ChallengeStatus.FLAGGED
        ]
        
        if status:
            if status == "pending":
                moderation_statuses = [ChallengeStatus.PENDING_MODERATION]
            elif status == "flagged":
                moderation_statuses = [ChallengeStatus.FLAGGED]
        
        # Filter challenges by moderation status
        filtered_challenges = [
            challenge for challenge in self.challenges.values()
            if challenge.status in moderation_statuses
        ]
        
        # Sort by creation date (oldest first for review queue)
        filtered_challenges.sort(key=lambda x: x.created_at)
        
        # Paginate
        total_count = len(filtered_challenges)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_challenges = filtered_challenges[start_idx:end_idx]
        
        return page_challenges, total_count
    
    async def get_all_challenges(self) -> List[Challenge]:
        """Get all challenges for migration purposes"""
        return list(self.challenges.values())
    
    async def get_challenge_stats(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        """Get statistics for a challenge"""
        challenge = self.challenges.get(challenge_id)
        if not challenge:
            return None
        
        return {
            "challenge_id": challenge_id,
            "view_count": challenge.view_count,
            "guess_count": challenge.guess_count,
            "correct_guess_count": challenge.correct_guess_count,
            "accuracy_rate": challenge.accuracy_rate,
            "status": challenge.status.value,
            "created_at": challenge.created_at,
            "published_at": challenge.published_at,
            "is_merged_video": challenge.is_merged_video,
            "has_segment_metadata": bool(challenge.merged_video_metadata or challenge.legacy_merged_metadata)
        }
    
    async def update_challenge(self, challenge_id: str, updated_challenge: Challenge) -> Challenge:
        """Update an existing challenge"""
        if challenge_id not in self.challenges:
            raise ChallengeServiceError(f"Challenge {challenge_id} not found")
        
        # Update the challenge
        self.challenges[challenge_id] = updated_challenge
        
        # Save to disk
        await self._save_challenges()
        
        logger.info(f"Updated challenge {challenge_id}")
        return updated_challenge


# Create singleton instance
challenge_service = ChallengeService()