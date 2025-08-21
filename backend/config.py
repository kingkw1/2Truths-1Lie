"""
Configuration settings for the backend
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Upload settings
    UPLOAD_DIR: Path = Path("uploads")
    TEMP_DIR: Path = Path("temp")
    MAX_FILE_SIZE: int = 100_000_000  # 100MB
    MAX_CHUNK_SIZE: int = 10_485_760  # 10MB
    DEFAULT_CHUNK_SIZE: int = 1_048_576  # 1MB
    UPLOAD_SESSION_TIMEOUT: int = 3600  # 1 hour in seconds
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File type restrictions
    ALLOWED_VIDEO_TYPES: set = {
        "video/mp4", "video/webm", "video/ogg", "video/avi", "video/mov"
    }
    ALLOWED_AUDIO_TYPES: set = {
        "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/webm"
    }
    ALLOWED_IMAGE_TYPES: set = {
        "image/jpeg", "image/png", "image/gif", "image/webp"
    }
    ALLOWED_TEXT_TYPES: set = {
        "text/plain"  # For testing purposes
    }
    
    # Rate limiting
    UPLOAD_RATE_LIMIT: int = 5  # uploads per hour per user
    
    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create directories if they don't exist
        self.UPLOAD_DIR.mkdir(exist_ok=True)
        self.TEMP_DIR.mkdir(exist_ok=True)
    
    @property
    def allowed_mime_types(self) -> set:
        """Get all allowed MIME types"""
        return self.ALLOWED_VIDEO_TYPES | self.ALLOWED_AUDIO_TYPES | self.ALLOWED_IMAGE_TYPES | self.ALLOWED_TEXT_TYPES

settings = Settings()