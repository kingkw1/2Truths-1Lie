"""
S3 Media API Service - Simplified FastAPI endpoints for direct S3 media operations
"""
import os
import uuid
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from botocore.config import Config
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class S3MediaService:
    """Direct S3 media service for upload, streaming, and deletion"""
    
    def __init__(self):
        # Read AWS credentials from environment variables
        self.aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
        self.aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.aws_region = os.getenv('AWS_S3_REGION', 'us-east-1')
        self.bucket_name = os.getenv('AWS_S3_BUCKET_NAME')
        
        if not all([self.aws_access_key_id, self.aws_secret_access_key, self.bucket_name]):
            raise ValueError(
                "Missing required AWS environment variables: "
                "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME"
            )
        
        # Configure S3 client with proper authentication
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region,
                config=Config(
                    retries={'max_attempts': 3, 'mode': 'adaptive'},
                    max_pool_connections=50
                )
            )
            
            # Test credentials by listing bucket
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Successfully connected to S3 bucket: {self.bucket_name}")
            
        except NoCredentialsError:
            raise ValueError("Invalid AWS credentials")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '403':
                raise ValueError("AWS credentials lack permission to access bucket")
            elif error_code == '404':
                raise ValueError(f"S3 bucket '{self.bucket_name}' not found")
            else:
                raise ValueError(f"AWS S3 connection error: {e}")
    
    def validate_video_file(self, content_type: str, file_size: int) -> None:
        """Validate uploaded file meets video requirements"""
        # Check if it's a video MIME type
        if not content_type.startswith('video/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Expected video/* but got {content_type}"
            )
        
        # Check file size (100MB limit)
        max_size = 100 * 1024 * 1024  # 100MB
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File size {file_size} bytes exceeds maximum {max_size} bytes"
            )
    
    async def upload_video_to_s3(self, file_content: bytes, content_type: str) -> str:
        """
        Upload video file directly to S3 and return media ID
        
        Args:
            file_content: Video file bytes
            content_type: MIME type of the file
            
        Returns:
            str: Unique media ID for the uploaded file
        """
        try:
            # Validate file
            self.validate_video_file(content_type, len(file_content))
            
            # Generate unique media ID and S3 key
            media_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().strftime('%Y%m%d')
            s3_key = f"media/videos/{timestamp}/{media_id}"
            
            # Upload to S3 with metadata
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                Metadata={
                    'media_id': media_id,
                    'upload_timestamp': datetime.utcnow().isoformat(),
                    'content_type': content_type
                },
                # Set cache control for efficient streaming
                CacheControl='public, max-age=31536000'  # 1 year
            )
            
            logger.info(f"Successfully uploaded video to S3: {s3_key}")
            return media_id
            
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload video to S3: {e.response['Error']['Message']}"
            )
        except Exception as e:
            logger.error(f"Upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    def get_s3_key_from_media_id(self, media_id: str) -> Optional[str]:
        """Find S3 key for given media ID by searching bucket"""
        try:
            # Search for object with this media_id in metadata
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket_name, Prefix='media/videos/')
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # Check object metadata
                        try:
                            response = self.s3_client.head_object(
                                Bucket=self.bucket_name,
                                Key=obj['Key']
                            )
                            if response.get('Metadata', {}).get('media_id') == media_id:
                                return obj['Key']
                        except ClientError:
                            continue
            
            return None
            
        except ClientError as e:
            logger.error(f"Error searching for media_id {media_id}: {e}")
            return None
    
    async def generate_signed_url(self, media_id: str, expires_in: int = 3600) -> str:
        """
        Generate signed URL for secure video streaming
        
        Args:
            media_id: Unique media identifier
            expires_in: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            str: Pre-signed URL for video streaming
        """
        try:
            # Find S3 key for this media_id
            s3_key = self.get_s3_key_from_media_id(media_id)
            if not s3_key:
                raise HTTPException(status_code=404, detail="Media not found")
            
            # Generate pre-signed URL
            signed_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expires_in
            )
            
            logger.info(f"Generated signed URL for media_id: {media_id}")
            return signed_url
            
        except ClientError as e:
            logger.error(f"Failed to generate signed URL for {media_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate streaming URL: {e.response['Error']['Message']}"
            )
    
    async def delete_video_from_s3(self, media_id: str) -> bool:
        """
        Delete video from S3 bucket
        
        Args:
            media_id: Unique media identifier
            
        Returns:
            bool: True if successfully deleted, False if not found
        """
        try:
            # Find S3 key for this media_id
            s3_key = self.get_s3_key_from_media_id(media_id)
            if not s3_key:
                return False  # Media not found
            
            # Delete object from S3
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            logger.info(f"Successfully deleted video from S3: {s3_key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to delete media_id {media_id}: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete video: {e.response['Error']['Message']}"
            )
    
    async def check_media_exists(self, media_id: str) -> bool:
        """Check if media exists in S3"""
        s3_key = self.get_s3_key_from_media_id(media_id)
        return s3_key is not None

# Global service instance
s3_media_service = None

def get_s3_media_service() -> S3MediaService:
    """Dependency injection for S3 media service"""
    global s3_media_service
    if s3_media_service is None:
        s3_media_service = S3MediaService()
    return s3_media_service
