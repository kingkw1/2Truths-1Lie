"""
Configuration settings for the backend
"""
import os
from pathlib import Path
from typing import Optional
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
    
    # Video-specific settings
    MAX_VIDEO_DURATION_SECONDS: int = 300  # 5 minutes max
    MAX_USER_UPLOADS: int = 10  # Max concurrent uploads per user
    
    # Cloud storage settings
    CLOUD_STORAGE_PROVIDER: str = "s3"  # s3, firebase, etc.
    USE_CLOUD_STORAGE: bool = True  # Set to False to use local storage
    
    # AWS S3 settings
    AWS_S3_BUCKET_NAME: str = "twotruthsalie-media"
    AWS_S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[str] = None  # Will use IAM role if not provided
    AWS_SECRET_ACCESS_KEY: Optional[str] = None  # Will use IAM role if not provided
    AWS_S3_ENDPOINT_URL: Optional[str] = None  # For S3-compatible services
    
    # CDN settings (optional)
    CDN_BASE_URL: Optional[str] = None  # CloudFront or other CDN URL
    CDN_DISTRIBUTION_ID: Optional[str] = None  # CloudFront distribution ID for signed URLs
    CDN_PRIVATE_KEY_PATH: Optional[str] = None  # Path to CloudFront private key
    CDN_KEY_PAIR_ID: Optional[str] = None  # CloudFront key pair ID
    SIGNED_URL_EXPIRY: int = 3600  # 1 hour for signed URLs
    CDN_SIGNED_URL_EXPIRY: int = 7200  # 2 hours for CDN signed URLs
    
    # Global delivery settings
    ENABLE_GLOBAL_CDN: bool = False  # Enable global CDN delivery
    CDN_CACHE_CONTROL: str = "public, max-age=86400"  # 24 hours default cache
    CDN_EDGE_LOCATIONS: list = ["us-east-1", "eu-west-1", "ap-southeast-1"]  # Primary edge locations
    
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