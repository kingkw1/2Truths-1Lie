"""
Content moderation service for filtering inappropriate material
"""
import json
import uuid
import re
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from enum import Enum

from models import ChallengeStatus
from config import settings

logger = logging.getLogger(__name__)

class ModerationStatus(str, Enum):
    """Moderation status for content"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FLAGGED = "flagged"

class ModerationReason(str, Enum):
    """Reasons for content rejection or flagging"""
    INAPPROPRIATE_LANGUAGE = "inappropriate_language"
    SPAM = "spam"
    PERSONAL_INFO = "personal_info"
    VIOLENCE = "violence"
    HATE_SPEECH = "hate_speech"
    ADULT_CONTENT = "adult_content"
    COPYRIGHT = "copyright"
    MISLEADING = "misleading"
    LOW_QUALITY = "low_quality"

class ModerationResult:
    """Result of content moderation"""
    def __init__(
        self,
        status: ModerationStatus,
        confidence: float,
        reasons: List[ModerationReason] = None,
        details: Dict[str, Any] = None
    ):
        self.status = status
        self.confidence = confidence  # 0-1 scale
        self.reasons = reasons or []
        self.details = details or {}
        self.timestamp = datetime.utcnow()

class ModerationService:
    """Service for content moderation and filtering"""
    
    def __init__(self):
        self.moderation_data: Dict[str, Dict] = {}
        self.moderation_file = settings.TEMP_DIR / "moderation.json"
        self._load_data()
        
        # Initialize content filters
        self._init_content_filters()
    
    def _load_data(self):
        """Load moderation data from disk"""
        try:
            if self.moderation_file.exists():
                with open(self.moderation_file, 'r') as f:
                    self.moderation_data = json.load(f)
        except Exception as e:
            logger.error(f"Error loading moderation data: {e}")
            self.moderation_data = {}
    
    async def _save_data(self):
        """Save moderation data to disk"""
        try:
            with open(self.moderation_file, 'w') as f:
                json.dump(self.moderation_data, f, default=str, indent=2)
        except Exception as e:
            logger.error(f"Error saving moderation data: {e}")
    
    def _init_content_filters(self):
        """Initialize content filtering rules"""
        # Inappropriate language patterns
        self.inappropriate_patterns = [
            r'\b(?:fuck|fucking|shit|damn|hell|bitch|asshole|bastard)\b',
            r'\b(?:nigger|faggot|retard|cunt)\b',
            r'\b(?:kill\s+yourself|kys)\b',
        ]
        
        # Spam patterns
        self.spam_patterns = [
            r'(?:click|visit|check\s+out).*(?:link|website|url)',
            r'(?:buy|purchase|order)\s+now',
            r'(?:free|win|earn)\s+(?:money|cash|prizes)',
            r'(?:www\.|http|\.com|\.net|\.org)',
            r'(?:subscribe|follow|like)\s+(?:me|us|my|our)',
        ]
        
        # Personal information patterns
        self.pii_patterns = [
            r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
            r'\b\d{3}-\d{3}-\d{4}\b',  # Phone number
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
            r'\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b',  # Credit card
        ]
        
        # Violence/threat patterns
        self.violence_patterns = [
            r'\b(?:kill|murder|shoot|stab|hurt|harm|attack)\b.*\b(?:you|him|her|them)\b',
            r'\b(?:bomb|explosion|terrorist|violence)\b',
            r'\b(?:die|death|dead)\b.*\b(?:threat|wish|hope)\b',
        ]
        
        # Compile patterns for efficiency
        self.compiled_patterns = {
            ModerationReason.INAPPROPRIATE_LANGUAGE: [re.compile(p, re.IGNORECASE) for p in self.inappropriate_patterns],
            ModerationReason.SPAM: [re.compile(p, re.IGNORECASE) for p in self.spam_patterns],
            ModerationReason.PERSONAL_INFO: [re.compile(p, re.IGNORECASE) for p in self.pii_patterns],
            ModerationReason.VIOLENCE: [re.compile(p, re.IGNORECASE) for p in self.violence_patterns],
        }
    
    def _analyze_text_content(self, text: str) -> ModerationResult:
        """Analyze text content for inappropriate material"""
        if not text or not text.strip():
            return ModerationResult(ModerationStatus.APPROVED, 1.0)
        
        detected_issues = []
        confidence_scores = []
        
        # Check each category of inappropriate content
        for reason, patterns in self.compiled_patterns.items():
            matches = 0
            for pattern in patterns:
                if pattern.search(text):
                    matches += 1
            
            if matches > 0:
                detected_issues.append(reason)
                # Higher match count = lower confidence in content safety
                confidence = max(0.1, 1.0 - (matches * 0.3))
                confidence_scores.append(confidence)
        
        # Determine overall status
        if not detected_issues:
            return ModerationResult(ModerationStatus.APPROVED, 1.0)
        
        # Calculate overall confidence (lowest individual score)
        overall_confidence = min(confidence_scores) if confidence_scores else 1.0
        
        # Determine status based on severity
        severe_issues = [
            ModerationReason.INAPPROPRIATE_LANGUAGE,
            ModerationReason.VIOLENCE,
            ModerationReason.HATE_SPEECH,
            ModerationReason.PERSONAL_INFO
        ]
        
        has_severe_issues = any(issue in severe_issues for issue in detected_issues)
        
        if has_severe_issues or overall_confidence < 0.3:
            status = ModerationStatus.REJECTED
        elif overall_confidence < 0.7:
            status = ModerationStatus.FLAGGED
        else:
            status = ModerationStatus.APPROVED
        
        return ModerationResult(
            status=status,
            confidence=overall_confidence,
            reasons=detected_issues,
            details={
                "text_length": len(text),
                "word_count": len(text.split()),
                "detected_patterns": len(detected_issues)
            }
        )
    
    def _analyze_media_metadata(self, media_data: Dict[str, Any]) -> ModerationResult:
        """Analyze media metadata for potential issues"""
        # Basic metadata analysis
        duration = media_data.get('duration_seconds', 0)
        file_size = media_data.get('file_size', 0)
        mime_type = media_data.get('mime_type', '')
        
        issues = []
        confidence = 1.0
        
        # Check for suspicious duration (too short might be spam, too long might be inappropriate)
        if duration < 1:
            issues.append(ModerationReason.LOW_QUALITY)
            confidence = min(confidence, 0.5)
        elif duration > 300:  # 5 minutes
            issues.append(ModerationReason.LOW_QUALITY)
            confidence = min(confidence, 0.7)
        
        # Check file size (unusually large files might be problematic)
        if file_size > 50_000_000:  # 50MB
            issues.append(ModerationReason.LOW_QUALITY)
            confidence = min(confidence, 0.6)
        
        # Check MIME type
        allowed_types = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mp3', 'audio/wav', 'audio/webm']
        if mime_type and mime_type not in allowed_types:
            issues.append(ModerationReason.LOW_QUALITY)
            confidence = min(confidence, 0.4)
        
        # Determine status
        if confidence < 0.3:
            status = ModerationStatus.REJECTED
        elif confidence < 0.7 or issues:
            status = ModerationStatus.FLAGGED
        else:
            status = ModerationStatus.APPROVED
        
        return ModerationResult(
            status=status,
            confidence=confidence,
            reasons=issues,
            details={
                "duration": duration,
                "file_size": file_size,
                "mime_type": mime_type
            }
        )
    
    async def moderate_challenge(self, challenge_data: Dict[str, Any]) -> ModerationResult:
        """Moderate a complete challenge including all statements and media"""
        challenge_id = challenge_data.get('challenge_id')
        
        # Analyze title if present
        title_result = None
        if challenge_data.get('title'):
            title_result = self._analyze_text_content(challenge_data['title'])
        
        # Analyze each statement's media
        statement_results = []
        for i, statement in enumerate(challenge_data.get('statements', [])):
            # For video-only challenges, we analyze media metadata
            media_result = self._analyze_media_metadata({
                'duration_seconds': statement.get('duration_seconds', 0),
                'file_size': statement.get('file_size', 0),
                'mime_type': statement.get('mime_type', '')
            })
            statement_results.append(media_result)
        
        # Combine all results
        all_results = [r for r in [title_result] + statement_results if r is not None]
        
        if not all_results:
            return ModerationResult(ModerationStatus.APPROVED, 1.0)
        
        # Determine overall status (most restrictive wins)
        statuses = [r.status for r in all_results]
        overall_confidence = min(r.confidence for r in all_results)
        all_reasons = []
        for r in all_results:
            all_reasons.extend(r.reasons)
        
        # Remove duplicates while preserving order
        unique_reasons = []
        for reason in all_reasons:
            if reason not in unique_reasons:
                unique_reasons.append(reason)
        
        if ModerationStatus.REJECTED in statuses:
            overall_status = ModerationStatus.REJECTED
        elif ModerationStatus.FLAGGED in statuses:
            overall_status = ModerationStatus.FLAGGED
        else:
            overall_status = ModerationStatus.APPROVED
        
        # Store moderation result
        moderation_result = ModerationResult(
            status=overall_status,
            confidence=overall_confidence,
            reasons=unique_reasons,
            details={
                "challenge_id": challenge_id,
                "statement_count": len(statement_results),
                "has_title": bool(challenge_data.get('title')),
                "individual_results": len(all_results)
            }
        )
        
        # Save moderation data
        self.moderation_data[challenge_id] = {
            "status": moderation_result.status.value,
            "confidence": moderation_result.confidence,
            "reasons": [r.value for r in moderation_result.reasons],
            "details": moderation_result.details,
            "timestamp": moderation_result.timestamp.isoformat(),
            "moderator_type": "automated"
        }
        
        await self._save_data()
        
        logger.info(f"Challenge {challenge_id} moderated: {overall_status.value} (confidence: {overall_confidence:.2f})")
        return moderation_result
    
    async def get_moderation_status(self, challenge_id: str) -> Optional[Dict[str, Any]]:
        """Get moderation status for a challenge"""
        return self.moderation_data.get(challenge_id)
    
    async def flag_challenge(self, challenge_id: str, user_id: str, reason: str) -> bool:
        """Flag a challenge for manual review"""
        try:
            flag_id = str(uuid.uuid4())
            
            # Get existing moderation data or create new
            if challenge_id not in self.moderation_data:
                self.moderation_data[challenge_id] = {
                    "status": ModerationStatus.PENDING.value,
                    "confidence": 0.5,
                    "reasons": [],
                    "details": {},
                    "timestamp": datetime.utcnow().isoformat(),
                    "moderator_type": "automated"
                }
            
            # Add flag data
            if "flags" not in self.moderation_data[challenge_id]:
                self.moderation_data[challenge_id]["flags"] = []
            
            self.moderation_data[challenge_id]["flags"].append({
                "flag_id": flag_id,
                "user_id": user_id,
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Update status to flagged if not already rejected
            if self.moderation_data[challenge_id]["status"] != ModerationStatus.REJECTED.value:
                self.moderation_data[challenge_id]["status"] = ModerationStatus.FLAGGED.value
            
            await self._save_data()
            
            logger.info(f"Challenge {challenge_id} flagged by user {user_id}: {reason}")
            return True
            
        except Exception as e:
            logger.error(f"Error flagging challenge {challenge_id}: {e}")
            return False
    
    async def manual_review(
        self, 
        challenge_id: str, 
        moderator_id: str, 
        decision: ModerationStatus, 
        reason: Optional[str] = None
    ) -> bool:
        """Manually review and update moderation status"""
        try:
            if challenge_id not in self.moderation_data:
                return False
            
            self.moderation_data[challenge_id].update({
                "status": decision.value,
                "moderator_id": moderator_id,
                "manual_review_reason": reason,
                "manual_review_timestamp": datetime.utcnow().isoformat(),
                "moderator_type": "manual"
            })
            
            await self._save_data()
            
            logger.info(f"Challenge {challenge_id} manually reviewed by {moderator_id}: {decision.value}")
            return True
            
        except Exception as e:
            logger.error(f"Error in manual review for challenge {challenge_id}: {e}")
            return False
    
    def get_moderation_stats(self) -> Dict[str, Any]:
        """Get moderation statistics"""
        if not self.moderation_data:
            return {
                "total_moderated": 0,
                "approved": 0,
                "rejected": 0,
                "flagged": 0,
                "pending": 0
            }
        
        stats = {
            "total_moderated": len(self.moderation_data),
            "approved": 0,
            "rejected": 0,
            "flagged": 0,
            "pending": 0
        }
        
        for data in self.moderation_data.values():
            status = data.get("status", "pending")
            if status in stats:
                stats[status] += 1
        
        return stats