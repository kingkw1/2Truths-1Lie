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
    REQUIRED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/mov"]
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MIN_FILE_SIZE = 100 * 1024  # 100KB minimum
    
    # Video quality requirements
    MIN_VIDEO_WIDTH = 320  # pixels
    MIN_VIDEO_HEIGHT = 240  # pixels
    MAX_VIDEO_WIDTH = 1920  # pixels
    MAX_VIDEO_HEIGHT = 1080  # pixels
    REQUIRED_VIDEO_CODECS = ["h264", "vp8", "vp9"]
    REQUIRED_AUDIO_CODECS = ["aac", "opus", "vorbis"]
    
    # Challenge requirements
    REQUIRED_STATEMENTS_COUNT = 3
    REQUIRED_TRUTH_COUNT = 2
    REQUIRED_LIE_COUNT = 1
    
    # File validation patterns
    DANGEROUS_EXTENSIONS = {'.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'}
    ALLOWED_EXTENSIONS = {'.mp4', '.webm', '.mov', '.ogg'}
    
    # Content validation
    MAX_FILENAME_LENGTH = 255
    FORBIDDEN_FILENAME_CHARS = {'<', '>', ':', '"', '|', '?', '*', '\0'}
    
    # Rate limiting for validation
    MAX_VALIDATIONS_PER_MINUTE = 60
    MAX_VALIDATIONS_PER_HOUR = 1000
    
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
        
        # Check file size bounds
        if upload_session.file_size > self.MAX_FILE_SIZE:
            return ValidationResult(
                False,
                f"Video file too large: {upload_session.file_size} bytes (max: {self.MAX_FILE_SIZE})",
                {"file_size": upload_session.file_size, "max_size": self.MAX_FILE_SIZE}
            )
        
        if upload_session.file_size < self.MIN_FILE_SIZE:
            return ValidationResult(
                False,
                f"Video file too small: {upload_session.file_size} bytes (min: {self.MIN_FILE_SIZE})",
                {"file_size": upload_session.file_size, "min_size": self.MIN_FILE_SIZE}
            )
        
        # Validate filename security
        filename_validation = self._validate_filename_security(upload_session.filename)
        if not filename_validation.is_valid:
            return filename_validation
        
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
        
        # Validate video metadata if available
        metadata_validation = self._validate_video_metadata(upload_session, statement_data)
        if not metadata_validation.is_valid:
            return metadata_validation
        
        return ValidationResult(
            True,
            "Video requirements satisfied",
            {
                "mime_type": upload_session.mime_type,
                "file_size": upload_session.file_size,
                "duration": duration,
                "filename": upload_session.filename
            }
        )
    
    def _validate_filename_security(self, filename: str) -> ValidationResult:
        """Validate filename for security issues"""
        
        # Check filename length
        if len(filename) > self.MAX_FILENAME_LENGTH:
            return ValidationResult(
                False,
                f"Filename too long: {len(filename)} chars (max: {self.MAX_FILENAME_LENGTH})",
                {"filename_length": len(filename), "max_length": self.MAX_FILENAME_LENGTH}
            )
        
        # Check for forbidden characters
        forbidden_chars = self.FORBIDDEN_FILENAME_CHARS.intersection(set(filename))
        if forbidden_chars:
            return ValidationResult(
                False,
                f"Filename contains forbidden characters: {forbidden_chars}",
                {"forbidden_chars": list(forbidden_chars)}
            )
        
        # Check file extension
        file_ext = Path(filename).suffix.lower()
        if file_ext in self.DANGEROUS_EXTENSIONS:
            return ValidationResult(
                False,
                f"Dangerous file extension: {file_ext}",
                {"extension": file_ext, "dangerous_extensions": list(self.DANGEROUS_EXTENSIONS)}
            )
        
        if file_ext not in self.ALLOWED_EXTENSIONS:
            return ValidationResult(
                False,
                f"Invalid file extension: {file_ext}",
                {"extension": file_ext, "allowed_extensions": list(self.ALLOWED_EXTENSIONS)}
            )
        
        # Check for path traversal attempts
        if '..' in filename or filename.startswith('/') or '\\' in filename:
            return ValidationResult(
                False,
                "Filename contains path traversal patterns",
                {"filename": filename}
            )
        
        return ValidationResult(True, "Filename is secure", {"filename": filename})
    
    def _validate_video_metadata(self, upload_session: UploadSession, statement_data: Dict[str, Any]) -> ValidationResult:
        """Validate video metadata and technical specifications"""
        
        metadata = upload_session.metadata or {}
        
        # Check for required metadata fields
        required_fields = ['duration_seconds']
        missing_fields = [field for field in required_fields if field not in statement_data]
        if missing_fields:
            return ValidationResult(
                False,
                f"Missing required metadata fields: {missing_fields}",
                {"missing_fields": missing_fields}
            )
        
        # Validate video dimensions if available
        width = metadata.get('video_width')
        height = metadata.get('video_height')
        
        if width and height:
            if width < self.MIN_VIDEO_WIDTH or height < self.MIN_VIDEO_HEIGHT:
                return ValidationResult(
                    False,
                    f"Video resolution too low: {width}x{height} (min: {self.MIN_VIDEO_WIDTH}x{self.MIN_VIDEO_HEIGHT})",
                    {"width": width, "height": height, "min_width": self.MIN_VIDEO_WIDTH, "min_height": self.MIN_VIDEO_HEIGHT}
                )
            
            if width > self.MAX_VIDEO_WIDTH or height > self.MAX_VIDEO_HEIGHT:
                return ValidationResult(
                    False,
                    f"Video resolution too high: {width}x{height} (max: {self.MAX_VIDEO_WIDTH}x{self.MAX_VIDEO_HEIGHT})",
                    {"width": width, "height": height, "max_width": self.MAX_VIDEO_WIDTH, "max_height": self.MAX_VIDEO_HEIGHT}
                )
        
        # Validate codecs if available
        video_codec = metadata.get('video_codec', '').lower()
        audio_codec = metadata.get('audio_codec', '').lower()
        
        if video_codec and video_codec not in self.REQUIRED_VIDEO_CODECS:
            return ValidationResult(
                False,
                f"Unsupported video codec: {video_codec}",
                {"video_codec": video_codec, "supported_codecs": self.REQUIRED_VIDEO_CODECS}
            )
        
        if audio_codec and audio_codec not in self.REQUIRED_AUDIO_CODECS:
            return ValidationResult(
                False,
                f"Unsupported audio codec: {audio_codec}",
                {"audio_codec": audio_codec, "supported_codecs": self.REQUIRED_AUDIO_CODECS}
            )
        
        # Check bitrate if available
        bitrate = metadata.get('bitrate')
        if bitrate:
            min_bitrate = 100_000  # 100 kbps
            max_bitrate = 10_000_000  # 10 Mbps
            
            if bitrate < min_bitrate:
                return ValidationResult(
                    False,
                    f"Video bitrate too low: {bitrate} bps (min: {min_bitrate})",
                    {"bitrate": bitrate, "min_bitrate": min_bitrate}
                )
            
            if bitrate > max_bitrate:
                return ValidationResult(
                    False,
                    f"Video bitrate too high: {bitrate} bps (max: {max_bitrate})",
                    {"bitrate": bitrate, "max_bitrate": max_bitrate}
                )
        
        return ValidationResult(True, "Video metadata is valid", {"metadata": metadata})
    
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
    
    async def validate_file_before_upload(
        self, 
        filename: str, 
        file_size: int, 
        mime_type: str,
        duration_seconds: Optional[float] = None,
        additional_metadata: Optional[Dict[str, Any]] = None
    ) -> ValidationResult:
        """Comprehensive pre-upload file validation"""
        
        try:
            # Basic filename security validation
            filename_validation = self._validate_filename_security(filename)
            if not filename_validation.is_valid:
                return filename_validation
            
            # MIME type validation
            if not mime_type.startswith('video/'):
                return ValidationResult(
                    False,
                    f"Only video files are allowed, got {mime_type}",
                    {"mime_type": mime_type, "required": "video/*"}
                )
            
            if mime_type not in self.REQUIRED_VIDEO_TYPES:
                return ValidationResult(
                    False,
                    f"Unsupported video format: {mime_type}",
                    {"mime_type": mime_type, "supported": self.REQUIRED_VIDEO_TYPES}
                )
            
            # File size validation
            if file_size > self.MAX_FILE_SIZE:
                return ValidationResult(
                    False,
                    f"File too large: {file_size} bytes (max: {self.MAX_FILE_SIZE})",
                    {"file_size": file_size, "max_size": self.MAX_FILE_SIZE}
                )
            
            if file_size < self.MIN_FILE_SIZE:
                return ValidationResult(
                    False,
                    f"File too small: {file_size} bytes (min: {self.MIN_FILE_SIZE})",
                    {"file_size": file_size, "min_size": self.MIN_FILE_SIZE}
                )
            
            # Duration validation if provided
            if duration_seconds is not None:
                if duration_seconds < self.MIN_VIDEO_DURATION:
                    return ValidationResult(
                        False,
                        f"Video too short: {duration_seconds}s (min: {self.MIN_VIDEO_DURATION}s)",
                        {"duration": duration_seconds, "min_duration": self.MIN_VIDEO_DURATION}
                    )
                
                if duration_seconds > self.MAX_VIDEO_DURATION:
                    return ValidationResult(
                        False,
                        f"Video too long: {duration_seconds}s (max: {self.MAX_VIDEO_DURATION}s)",
                        {"duration": duration_seconds, "max_duration": self.MAX_VIDEO_DURATION}
                    )
            
            # Additional metadata validation
            if additional_metadata:
                metadata_validation = self._validate_additional_metadata(additional_metadata)
                if not metadata_validation.is_valid:
                    return metadata_validation
            
            return ValidationResult(
                True,
                "File validation passed",
                {
                    "filename": filename,
                    "file_size": file_size,
                    "mime_type": mime_type,
                    "duration": duration_seconds,
                    "metadata": additional_metadata or {}
                }
            )
            
        except Exception as e:
            logger.error(f"Error during file validation: {e}")
            return ValidationResult(
                False,
                f"Validation error: {str(e)}",
                {"error_type": type(e).__name__}
            )
    
    def _validate_additional_metadata(self, metadata: Dict[str, Any]) -> ValidationResult:
        """Validate additional metadata fields"""
        
        # Check for suspicious metadata
        suspicious_keys = {'script', 'executable', 'command', 'shell'}
        found_suspicious = [key for key in metadata.keys() if any(sus in key.lower() for sus in suspicious_keys)]
        
        if found_suspicious:
            return ValidationResult(
                False,
                f"Suspicious metadata keys found: {found_suspicious}",
                {"suspicious_keys": found_suspicious}
            )
        
        # Validate specific metadata fields
        if 'user_agent' in metadata:
            user_agent = metadata['user_agent']
            if len(user_agent) > 500:  # Reasonable user agent length
                return ValidationResult(
                    False,
                    f"User agent too long: {len(user_agent)} chars",
                    {"user_agent_length": len(user_agent)}
                )
        
        # Check for metadata size limits
        metadata_str = str(metadata)
        if len(metadata_str) > 10000:  # 10KB metadata limit
            return ValidationResult(
                False,
                f"Metadata too large: {len(metadata_str)} chars",
                {"metadata_size": len(metadata_str)}
            )
        
        return ValidationResult(True, "Metadata validation passed", {"metadata": metadata})

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