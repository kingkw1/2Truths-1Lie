"""
Cloud Storage Service - Abstract interface for cloud storage providers
"""
import os
import uuid
import asyncio
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, BinaryIO, AsyncGenerator, List
from datetime import datetime, timedelta
from pathlib import Path
import logging

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from botocore.config import Config

logger = logging.getLogger(__name__)

class CloudStorageError(Exception):
    """Base exception for cloud storage operations"""
    pass

class CloudStorageService(ABC):
    """Abstract base class for cloud storage services"""
    
    @abstractmethod
    async def upload_file(
        self,
        file_data: bytes,
        key: str,
        content_type: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload file to cloud storage and return public URL"""
        pass
    
    @abstractmethod
    async def upload_file_stream(
        self,
        file_stream: BinaryIO,
        key: str,
        content_type: str,
        file_size: int,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload file stream to cloud storage"""
        pass
    
    @abstractmethod
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        """Get signed URL for file access"""
        pass
    
    @abstractmethod
    async def delete_file(self, key: str) -> bool:
        """Delete file from cloud storage"""
        pass
    
    @abstractmethod
    async def file_exists(self, key: str) -> bool:
        """Check if file exists in cloud storage"""
        pass
    
    @abstractmethod
    async def get_file_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get file metadata"""
        pass
    
    @abstractmethod
    async def list_files(self, prefix: str = "", max_keys: int = 1000) -> List[Dict[str, Any]]:
        """List files with optional prefix filter"""
        pass

class S3CloudStorageService(CloudStorageService):
    """AWS S3 implementation of cloud storage service"""
    
    def __init__(
        self,
        bucket_name: str,
        region_name: str = "us-east-1",
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None
    ):
        self.bucket_name = bucket_name
        self.region_name = region_name
        
        # Configure S3 client
        config = Config(
            region_name=region_name,
            retries={'max_attempts': 3, 'mode': 'adaptive'},
            max_pool_connections=50
        )
        
        session = boto3.Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region_name
        )
        
        self.s3_client = session.client(
            's3',
            config=config,
            endpoint_url=endpoint_url
        )
        
        # Skip bucket initialization to avoid errors during startup
        # The bucket check will happen when actually needed
        logger.info(f"S3 client initialized for bucket: {self.bucket_name}")
    
    async def _ensure_bucket_exists(self):
        """Ensure S3 bucket exists and is properly configured"""
        try:
            # Check if bucket exists
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.s3_client.head_bucket(Bucket=self.bucket_name)
            )
            logger.info(f"S3 bucket {self.bucket_name} exists")
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                # Bucket doesn't exist, create it
                try:
                    if self.region_name == 'us-east-1':
                        await asyncio.get_event_loop().run_in_executor(
                            None, lambda: self.s3_client.create_bucket(Bucket=self.bucket_name)
                        )
                    else:
                        await asyncio.get_event_loop().run_in_executor(
                            None, lambda: self.s3_client.create_bucket(
                                Bucket=self.bucket_name,
                                CreateBucketConfiguration={'LocationConstraint': self.region_name}
                            )
                        )
                    
                    # Set CORS configuration for web access
                    cors_config = {
                        'CORSRules': [
                            {
                                'AllowedHeaders': ['*'],
                                'AllowedMethods': ['GET', 'HEAD'],
                                'AllowedOrigins': ['*'],
                                'ExposeHeaders': ['Content-Range', 'Content-Length', 'Accept-Ranges'],
                                'MaxAgeSeconds': 3600
                            }
                        ]
                    }
                    
                    await asyncio.get_event_loop().run_in_executor(
                        None, lambda: self.s3_client.put_bucket_cors(
                            Bucket=self.bucket_name,
                            CORSConfiguration=cors_config
                        )
                    )
                    
                    logger.info(f"Created S3 bucket {self.bucket_name}")
                    
                except ClientError as create_error:
                    logger.error(f"Failed to create S3 bucket: {create_error}")
                    raise CloudStorageError(f"Failed to create S3 bucket: {create_error}")
            else:
                logger.error(f"S3 bucket access error: {e}")
                raise CloudStorageError(f"S3 bucket access error: {e}")
    
    async def upload_file(
        self,
        file_data: bytes,
        key: str,
        content_type: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload file data to S3"""
        try:
            extra_args = {
                'ContentType': content_type,
                'CacheControl': 'public, max-age=31536000',  # 1 year cache
                # Note: ACL removed as bucket doesn't support ACLs - files are public via bucket policy
            }
            
            if metadata:
                extra_args['Metadata'] = metadata
            
            # Upload file
            await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=file_data,
                    **extra_args
                )
            )
            
            # Return presigned URL for secure access (expires in 24 hours)
            url = self.generate_presigned_url(key, expiration=86400)
            logger.info(f"Uploaded file to S3: {key}")
            return url
            
        except ClientError as e:
            logger.error(f"S3 upload failed for {key}: {e}")
            raise CloudStorageError(f"S3 upload failed: {e}")
    
    async def upload_file_stream(
        self,
        file_stream: BinaryIO,
        key: str,
        content_type: str,
        file_size: int,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload file stream to S3 using multipart upload for large files"""
        try:
            extra_args = {
                'ContentType': content_type,
                'CacheControl': 'public, max-age=31536000',
                # Note: ACL removed as bucket doesn't support ACLs - files are public via bucket policy
            }
            
            if metadata:
                extra_args['Metadata'] = metadata
            
            # Use multipart upload for files larger than 100MB
            if file_size > 100 * 1024 * 1024:
                await self._multipart_upload(file_stream, key, extra_args)
            else:
                # Simple upload for smaller files
                file_data = file_stream.read()
                await asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=key,
                        Body=file_data,
                        **extra_args
                    )
                )
            
            # Return presigned URL for secure access (expires in 24 hours)
            url = self.generate_presigned_url(key, expiration=86400)
            logger.info(f"Uploaded file stream to S3: {key}")
            return url
            
        except ClientError as e:
            logger.error(f"S3 stream upload failed for {key}: {e}")
            raise CloudStorageError(f"S3 stream upload failed: {e}")
    
    async def _multipart_upload(self, file_stream: BinaryIO, key: str, extra_args: Dict):
        """Perform multipart upload for large files"""
        try:
            # Initiate multipart upload
            response = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.s3_client.create_multipart_upload(
                    Bucket=self.bucket_name,
                    Key=key,
                    **extra_args
                )
            )
            upload_id = response['UploadId']
            
            parts = []
            part_number = 1
            chunk_size = 10 * 1024 * 1024  # 10MB chunks
            
            try:
                while True:
                    chunk = file_stream.read(chunk_size)
                    if not chunk:
                        break
                    
                    # Upload part
                    part_response = await asyncio.get_event_loop().run_in_executor(
                        None, 
                        lambda: self.s3_client.upload_part(
                            Bucket=self.bucket_name,
                            Key=key,
                            PartNumber=part_number,
                            UploadId=upload_id,
                            Body=chunk
                        )
                    )
                    
                    parts.append({
                        'ETag': part_response['ETag'],
                        'PartNumber': part_number
                    })
                    part_number += 1
                
                # Complete multipart upload
                await asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: self.s3_client.complete_multipart_upload(
                        Bucket=self.bucket_name,
                        Key=key,
                        UploadId=upload_id,
                        MultipartUpload={'Parts': parts}
                    )
                )
                
            except Exception as e:
                # Abort multipart upload on error
                await asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: self.s3_client.abort_multipart_upload(
                        Bucket=self.bucket_name,
                        Key=key,
                        UploadId=upload_id
                    )
                )
                raise e
                
        except ClientError as e:
            logger.error(f"S3 multipart upload failed for {key}: {e}")
            raise CloudStorageError(f"S3 multipart upload failed: {e}")
    
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate signed URL for S3 object"""
        try:
            url = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': self.bucket_name,
                        'Key': key
                    },
                    ExpiresIn=expires_in
                )
            )
            return url
            
        except ClientError as e:
            logger.error(f"Failed to generate signed URL for {key}: {e}")
            raise CloudStorageError(f"Failed to generate signed URL: {e}")
    
    async def delete_file(self, key: str) -> bool:
        """Delete file from S3"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.s3_client.delete_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
            )
            logger.info(f"Deleted file from S3: {key}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to delete S3 file {key}: {e}")
            return False
    
    async def file_exists(self, key: str) -> bool:
        """Check if file exists in S3"""
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.s3_client.head_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
            )
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            logger.error(f"Error checking S3 file existence {key}: {e}")
            return False
    
    async def get_file_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get S3 object metadata"""
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self.s3_client.head_object(
                    Bucket=self.bucket_name,
                    Key=key
                )
            )
            
            return {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'etag': response.get('ETag'),
                'metadata': response.get('Metadata', {}),
                'cache_control': response.get('CacheControl'),
                'storage_class': response.get('StorageClass', 'STANDARD')
            }
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return None
            logger.error(f"Error getting S3 metadata for {key}: {e}")
            return None
    
    async def list_files(self, prefix: str = "", max_keys: int = 1000) -> List[Dict[str, Any]]:
        """List files in S3 bucket with optional prefix filter"""
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            
            page_iterator = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            files = []
            for page in page_iterator:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        # Get metadata for each file
                        metadata = await self.get_file_metadata(obj['Key'])
                        
                        files.append({
                            'key': obj['Key'],
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'],
                            'etag': obj['ETag'],
                            'storage_class': obj.get('StorageClass', 'STANDARD'),
                            'content_type': metadata.get('content_type') if metadata else None,
                            'metadata': metadata.get('metadata', {}) if metadata else {}
                        })
            
            logger.info(f"Listed {len(files)} files with prefix '{prefix}'")
            return files
            
        except ClientError as e:
            logger.error(f"Error listing S3 files with prefix '{prefix}': {e}")
            raise CloudStorageError(f"Failed to list files: {e}")
    
    def generate_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """Generate a presigned URL for S3 object access"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            logger.info(f"Generated presigned URL for {key} (expires in {expiration}s)")
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL for {key}: {e}")
            raise CloudStorageError(f"Failed to generate presigned URL: {e}")

# Factory function to create cloud storage service
def create_cloud_storage_service(
    provider: str = "s3",
    **kwargs
) -> CloudStorageService:
    """Factory function to create cloud storage service"""
    
    if provider.lower() == "s3":
        return S3CloudStorageService(**kwargs)
    else:
        raise ValueError(f"Unsupported cloud storage provider: {provider}")