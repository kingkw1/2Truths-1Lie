"""
Configuration settings for the backend
"""
import os
from pathlib import Path
from typing import Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Directory settings
    BACKEND_DIR: Path = Path(__file__).parent
    
    # Upload settings
    UPLOAD_DIR: Path = Path("uploads")
    TEMP_DIR: Path = Path("temp").resolve()  # Ensure absolute path
    MAX_FILE_SIZE: int = 100_000_000  # 100MB
    MAX_CHUNK_SIZE: int = 10_485_760  # 10MB
    DEFAULT_CHUNK_SIZE: int = 1_048_576  # 1MB
    UPLOAD_SESSION_TIMEOUT: int = 3600  # 1 hour in seconds
    
    # Security settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240  # 4 hours for video recording sessions
    
    # Token management settings
    REVENUECAT_WEBHOOK_SECRET: Optional[str] = None
    JWT_SECRET: Optional[str] = None
    
    # Database settings
    DATABASE_URL: Optional[str] = None  # Railway PostgreSQL URL
    SQLALCHEMY_DATABASE_URL: Optional[str] = None
    
    @property
    def database_url(self) -> str:
        """Get the appropriate database URL based on environment"""
        if os.getenv("TESTING") == "true":
            # Use a separate test database
            return f"sqlite:///{self.BACKEND_DIR / 'test.db'}"
        if self.DATABASE_URL:
            # Production: Use Railway PostgreSQL
            return self.DATABASE_URL
        else:
            # Development: Use local SQLite
            return f"sqlite:///{self.BACKEND_DIR / 'app.db'}"
    
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
    
    # Video compression settings
    VIDEO_COMPRESSION_PRESET: str = "medium"  # ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
    VIDEO_COMPRESSION_CRF: int = 23  # Constant Rate Factor (0-51, lower = better quality)
    VIDEO_MAX_BITRATE: str = "2M"  # Maximum bitrate (e.g., "2M" for 2 Mbps)
    VIDEO_BUFFER_SIZE: str = "4M"  # Buffer size for rate control
    AUDIO_BITRATE: str = "128k"  # Audio bitrate (e.g., "128k" for 128 kbps)
    AUDIO_CODEC: str = "aac"  # Audio codec
    VIDEO_CODEC: str = "libx264"  # Video codec
    
    # Compression quality presets
    COMPRESSION_QUALITY_PRESETS: dict = {
        "high": {
            "crf": 18,
            "preset": "slow",
            "max_bitrate": "5M",
            "buffer_size": "10M",
            "audio_bitrate": "192k"
        },
        "medium": {
            "crf": 23,
            "preset": "medium", 
            "max_bitrate": "2M",
            "buffer_size": "4M",
            "audio_bitrate": "128k"
        },
        "low": {
            "crf": 28,
            "preset": "fast",
            "max_bitrate": "1M", 
            "buffer_size": "2M",
            "audio_bitrate": "96k"
        }
    }
    
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
    
    model_config = ConfigDict(env_file=".env", extra="allow")

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