"""
Automated validation service for core gameplay flow
Validates challenge creation, media requirements, and game mechanics
"""
import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import mimetypes

from models import (
    Challenge, Statement, ChallengeStatus, StatementType,
    CreateChallengeRequest, UploadSession, UploadStatus
)

logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass

class ValidationResult:
    """Result of a validation check"""
    def __init__(self, is_valid: bool, message: str, details: Optional[Dict[str, Any]] = None):
        self.is_valid = is_valid
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class GameplayValidationService:
    """Service for validating core gameplay flow requirements"""
    
    # Video requirements based on Requirement 1
    MIN_VIDEO_DURATION = 3.0  # seconds
    MAX_VIDEO_DURATION = 60.0  # seconds
    REQUIRED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    # Challenge requirements
    REQUIRED_STATEMENTS_COUNT = 3
    REQUIRED_TRUTH_COUNT = 2
    REQUIRED_LIE_COUNT = 1
    
    def __init__(self):
        self.validation_history: List[ValidationResult] = []
    
    async def validate_challenge_creation(
        self, 
        request: CreateChallengeRequest,
        upload_service
    ) -> ValidationResult:
        """
        Validate challenge creation request according to Requirement 1
        - Must have exactly 3 video statements
        - All statements must have valid video recordings
        - One statement must be designated as lie
        """
        try:
            # Validate statement count
            if len(request.statements) != self.REQUIRED_STATEMENTS_COUNT:
                return ValidationResult(
                    False,
                    f"Challenge must have exactly {self.REQUIRED_STATEMENTS_COUNT} statements, got {len(request.statements)}",
                    {"expected_count": self.REQUIRED_STATEMENTS_COUNT, "actual_count": len(request.statements)}
                )
            
            # Validate lie statement index
            if request.lie_statement_index < 0 or request.lie_statement_index >= len(request.statements):
                return ValidationResult(
                    False,
                    f"Lie statement index must be between 0 and {len(request.statements)-1}",
                    {"lie_index": request.lie_statement_index, "valid_range": f"0-{len(request.statements)-1}"}
                )
            
            # Validate each statement has required media
            media_validation_results = []
            for i, statement_data in enumerate(request.statements):
                media_result = await self._validate_statement_media(statement_data, upload_service, i)
                media_validation_results.append(media_result)
                
                if not media_result.is_valid:
                    return ValidationResult(
                        False,
                        f"Statement {i} media validation failed: {media_result.message}",
                        {"statement_index": i, "media_error": media_result.details}
                    )
            
            # Validate title if provided
            if request.title and len(request.title.strip()) == 0:
                return ValidationResult(
                    False,
                    "Challenge title cannot be empty if provided",
                    {"title": request.title}
                )
            
            # Validate tags
            if len(request.tags) > 10:
                return ValidationResult(
                    False,
                    "Challenge cannot have more than 10 tags",
                    {"tag_count": len(request.tags), "max_tags": 10}
                )
            
            result = ValidationResult(
                True,
                "Challenge creation request is valid",
                {
                    "statement_count": len(request.statements),
                    "lie_index": request.lie_statement_index,
                    "media_validations": [r.details for r in media_validation_results]
                }
            )
            
            self.validation_history.append(result)
            return result
            
        except Exception as e:
            logger.error(f"Error during challenge validation: {e}")
            return ValidationResult(
                False,
                f"Validation error: {str(e)}",
                {"error_type": type(e).__name__}
            )
    
    async def _validate_statement_media(
        self, 
        statement_data: Dict[str, Any], 
        upload_service,
        statement_index: int
    ) -> ValidationResult:
        """Validate media for a single statement"""
        try:
            # Check media_file_id is provided
            media_file_id = statement_data.get('media_file_id')
            if not media_file_id:
                return ValidationResult(
                    False,
                    "Statement must have media_file_id",
                    {"statement_index": statement_index}
                )
            
            # Check upload session exists and is completed
            upload_session = await upload_service.get_upload_status(media_file_id)
            if not upload_session:
                return ValidationResult(
                    False,
                    f"Upload session {media_file_id} not found",
                    {"media_file_id": media_file_id, "statement_index": statement_index}
                )
            
            if upload_session.status != UploadStatus.COMPLETED:
                return ValidationResult(
                    False,
                    f"Upload session {media_file_id} is not completed (status: {upload_session.status})",
                    {"media_file_id": media_file_id, "status": upload_session.status, "statement_index": statement_index}
                )
            
            # Validate video requirements (Requirement 1: video with audio required)
            media_validation = self._validate_video_requirements(upload_session, statement_data)
            if not media_validation.is_valid:
                return media_validation
            
            return ValidationResult(
                True,
                f"Statement {statement_index} media is valid",
                {
                    "media_file_id": media_file_id,
                    "file_size": upload_session.file_size,
                    "mime_type": upload_session.mime_type,
                    "duration": statement_data.get('duration_seconds', 0)
                }
            )
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Error validating statement media: {str(e)}",
                {"statement_index": statement_index, "error": str(e)}
            )
    
    def _validate_video_requirements(
        self, 
        upload_session: UploadSession, 
        statement_data: Dict[str, Any]
    ) -> ValidationResult:
        """Validate video meets requirements from Requirement 1"""
        
        # Check MIME type is video
        if not upload_session.mime_type.startswith('video/'):
            return ValidationResult(
                False,
                f"Statement must be video, got {upload_session.mime_type}",
                {"mime_type": upload_session.mime_type, "required": "video/*"}
            )
        
        # Check supported video format
        if upload_session.mime_type not in self.REQUIRED_VIDEO_TYPES:
            return ValidationResult(
                False,
                f"Unsupported video format: {upload_session.mime_type}",
                {"mime_type": upload_session.mime_type, "supported": self.REQUIRED_VIDEO_TYPES}
            )
        
        # Check file size
        if upload_session.file_size > self.MAX_FILE_SIZE:
            return ValidationResult(
                False,
                f"Video file too large: {upload_session.file_size} bytes (max: {self.MAX_FILE_SIZE})",
                {"file_size": upload_session.file_size, "max_size": self.MAX_FILE_SIZE}
            )
        
        # Check duration if provided
        duration = statement_data.get('duration_seconds', 0)
        if duration > 0:
            if duration < self.MIN_VIDEO_DURATION:
                return ValidationResult(
                    False,
                    f"Video too short: {duration}s (min: {self.MIN_VIDEO_DURATION}s)",
                    {"duration": duration, "min_duration": self.MIN_VIDEO_DURATION}
                )
            
            if duration > self.MAX_VIDEO_DURATION:
                return ValidationResult(
                    False,
                    f"Video too long: {duration}s (max: {self.MAX_VIDEO_DURATION}s)",
                    {"duration": duration, "max_duration": self.MAX_VIDEO_DURATION}
                )
        
        return ValidationResult(
            True,
            "Video requirements satisfied",
            {
                "mime_type": upload_session.mime_type,
                "file_size": upload_session.file_size,
                "duration": duration
            }
        )
    
    async def validate_challenge_structure(self, challenge: Challenge) -> ValidationResult:
        """Validate challenge has correct structure (2 truths, 1 lie)"""
        try:
            truth_count = 0
            lie_count = 0
            lie_statement_found = False
            
            for statement in challenge.statements:
                if statement.statement_type == StatementType.TRUTH:
                    truth_count += 1
                elif statement.statement_type == StatementType.LIE:
                    lie_count += 1
                    if statement.statement_id == challenge.lie_statement_id:
                        lie_statement_found = True
            
            # Validate counts
            if truth_count != self.REQUIRED_TRUTH_COUNT:
                return ValidationResult(
                    False,
                    f"Challenge must have exactly {self.REQUIRED_TRUTH_COUNT} truth statements, got {truth_count}",
                    {"truth_count": truth_count, "required": self.REQUIRED_TRUTH_COUNT}
                )
            
            if lie_count != self.REQUIRED_LIE_COUNT:
                return ValidationResult(
                    False,
                    f"Challenge must have exactly {self.REQUIRED_LIE_COUNT} lie statement, got {lie_count}",
                    {"lie_count": lie_count, "required": self.REQUIRED_LIE_COUNT}
                )
            
            # Validate lie statement ID matches
            if not lie_statement_found:
                return ValidationResult(
                    False,
                    "Challenge lie_statement_id does not match any lie statement",
                    {"lie_statement_id": challenge.lie_statement_id}
                )
            
            return ValidationResult(
                True,
                "Challenge structure is valid",
                {"truth_count": truth_count, "lie_count": lie_count}
            )
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Error validating challenge structure: {str(e)}",
                {"error": str(e)}
            )
    
    async def validate_gameplay_difficulty(self, challenge: Challenge) -> ValidationResult:
        """
        Validate challenge meets difficulty requirements (Requirement 3)
        Analyzes video duration, complexity indicators
        """
        try:
            total_duration = sum(stmt.duration_seconds for stmt in challenge.statements)
            avg_duration = total_duration / len(challenge.statements)
            
            # Basic difficulty assessment based on video characteristics
            difficulty_indicators = {
                "total_duration": total_duration,
                "average_duration": avg_duration,
                "statement_count": len(challenge.statements)
            }
            
            # Determine difficulty level
            if avg_duration < 10:
                estimated_difficulty = "easy"
            elif avg_duration < 30:
                estimated_difficulty = "medium"
            else:
                estimated_difficulty = "hard"
            
            # Validate minimum engagement requirements
            if total_duration < 10:  # Less than 10 seconds total is too short
                return ValidationResult(
                    False,
                    "Challenge total duration too short for meaningful gameplay",
                    {"total_duration": total_duration, "min_required": 10}
                )
            
            return ValidationResult(
                True,
                f"Challenge difficulty validated as {estimated_difficulty}",
                {
                    "estimated_difficulty": estimated_difficulty,
                    "indicators": difficulty_indicators
                }
            )
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Error validating gameplay difficulty: {str(e)}",
                {"error": str(e)}
            )
    
    async def validate_complete_challenge(
        self, 
        challenge: Challenge,
        upload_service
    ) -> ValidationResult:
        """Run complete validation suite on a challenge"""
        try:
            validations = []
            
            # Structure validation
            structure_result = await self.validate_challenge_structure(challenge)
            validations.append(("structure", structure_result))
            
            # Difficulty validation
            difficulty_result = await self.validate_gameplay_difficulty(challenge)
            validations.append(("difficulty", difficulty_result))
            
            # Media validation for each statement
            for i, statement in enumerate(challenge.statements):
                # Create mock statement data for media validation
                statement_data = {
                    "media_file_id": statement.media_file_id,
                    "duration_seconds": statement.duration_seconds
                }
                media_result = await self._validate_statement_media(statement_data, upload_service, i)
                validations.append((f"media_{i}", media_result))
            
            # Check if all validations passed
            failed_validations = [(name, result) for name, result in validations if not result.is_valid]
            
            if failed_validations:
                return ValidationResult(
                    False,
                    f"Challenge validation failed: {len(failed_validations)} checks failed",
                    {
                        "failed_checks": [{"name": name, "message": result.message} for name, result in failed_validations],
                        "all_results": {name: result.details for name, result in validations}
                    }
                )
            
            return ValidationResult(
                True,
                "Challenge passed all validation checks",
                {
                    "validation_count": len(validations),
                    "results": {name: result.details for name, result in validations}
                }
            )
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Error during complete challenge validation: {str(e)}",
                {"error": str(e)}
            )
    
    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics"""
        total_validations = len(self.validation_history)
        if total_validations == 0:
            return {
                "total_validations": 0, 
                "successful_validations": 0,
                "success_rate": 0.0,
                "recent_24h": 0,
                "last_validation": None
            }
        
        successful = sum(1 for v in self.validation_history if v.is_valid)
        success_rate = successful / total_validations
        
        recent_validations = [
            v for v in self.validation_history 
            if v.timestamp > datetime.utcnow() - timedelta(hours=24)
        ]
        
        return {
            "total_validations": total_validations,
            "successful_validations": successful,
            "success_rate": success_rate,
            "recent_24h": len(recent_validations),
            "last_validation": self.validation_history[-1].timestamp if self.validation_history else None
        }
    
    def clear_validation_history(self):
        """Clear validation history (for testing)"""
        self.validation_history.clear()

class ChallengeIntegrityValidator:
    """Validator for challenge data integrity and consistency"""
    
    async def validate_challenge_consistency(self, challenge: Challenge) -> ValidationResult:
        """Validate internal consistency of challenge data"""
        try:
            issues = []
            
            # Check timestamps
            if challenge.updated_at < challenge.created_at:
                issues.append("updated_at is before created_at")
            
            if challenge.published_at and challenge.published_at < challenge.created_at:
                issues.append("published_at is before created_at")
            
            # Check status consistency
            if challenge.status == ChallengeStatus.PUBLISHED and not challenge.published_at:
                issues.append("published challenge missing published_at timestamp")
            
            if challenge.status != ChallengeStatus.PUBLISHED and challenge.published_at:
                issues.append("non-published challenge has published_at timestamp")
            
            # Check statistics consistency
            if challenge.correct_guess_count > challenge.guess_count:
                issues.append("correct_guess_count exceeds total guess_count")
            
            if challenge.view_count < 0 or challenge.guess_count < 0:
                issues.append("negative view or guess counts")
            
            # Check statement IDs are unique
            statement_ids = [stmt.statement_id for stmt in challenge.statements]
            if len(set(statement_ids)) != len(statement_ids):
                issues.append("duplicate statement IDs found")
            
            if issues:
                return ValidationResult(
                    False,
                    f"Challenge consistency issues: {', '.join(issues)}",
                    {"issues": issues}
                )
            
            return ValidationResult(
                True,
                "Challenge data is consistent",
                {"checks_passed": ["timestamps", "status", "statistics", "statement_ids"]}
            )
            
        except Exception as e:
            return ValidationResult(
                False,
                f"Error validating challenge consistency: {str(e)}",
                {"error": str(e)}
            )

# Global validation service instance
gameplay_validator = GameplayValidationService()
integrity_validator = ChallengeIntegrityValidator()