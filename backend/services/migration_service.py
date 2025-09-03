"""
Migration Service - Migrate local media files to cloud storage
"""
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import mimetypes

from services.cloud_storage_service import create_cloud_storage_service, CloudStorageError
from config import settings

logger = logging.getLogger(__name__)

class MediaMigrationService:
    """Service for migrating local media files to cloud storage"""
    
    def __init__(self):
        self.local_media_path = settings.UPLOAD_DIR / "media"
        self.cloud_storage = None
        
        if settings.USE_CLOUD_STORAGE:
            try:
                self.cloud_storage = create_cloud_storage_service(
                    provider=settings.CLOUD_STORAGE_PROVIDER,
                    bucket_name=settings.AWS_S3_BUCKET_NAME,
                    region_name=settings.AWS_S3_REGION,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    endpoint_url=settings.AWS_S3_ENDPOINT_URL
                )
                logger.info("Cloud storage initialized for migration")
            except Exception as e:
                logger.error(f"Failed to initialize cloud storage for migration: {e}")
                raise
    
    async def discover_local_media_files(self) -> List[Dict[str, Any]]:
        """Discover all local media files that need migration"""
        if not self.local_media_path.exists():
            logger.warning(f"Local media path does not exist: {self.local_media_path}")
            return []
        
        media_files = []
        
        for file_path in self.local_media_path.iterdir():
            if file_path.is_file():
                try:
                    # Extract media ID from filename (format: {media_id}_{original_filename})
                    filename_parts = file_path.name.split('_', 1)
                    if len(filename_parts) >= 2:
                        media_id = filename_parts[0]
                        original_filename = filename_parts[1]
                    else:
                        # Fallback for files without media ID prefix
                        media_id = file_path.stem
                        original_filename = file_path.name
                    
                    stat = file_path.stat()
                    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
                    
                    media_files.append({
                        "media_id": media_id,
                        "local_path": file_path,
                        "original_filename": original_filename,
                        "file_size": stat.st_size,
                        "mime_type": mime_type,
                        "created_at": datetime.fromtimestamp(stat.st_ctime),
                        "modified_at": datetime.fromtimestamp(stat.st_mtime)
                    })
                    
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
                    continue
        
        logger.info(f"Discovered {len(media_files)} local media files for migration")
        return media_files
    
    async def migrate_file_to_cloud(
        self,
        media_info: Dict[str, Any],
        user_id: str = "unknown",
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Migrate a single file to cloud storage"""
        
        if not self.cloud_storage:
            raise RuntimeError("Cloud storage not initialized")
        
        media_id = media_info["media_id"]
        local_path = media_info["local_path"]
        original_filename = media_info["original_filename"]
        
        # Generate cloud storage key
        cloud_key = f"media/{user_id}/{media_id}/{original_filename}"
        
        try:
            # Check if file already exists in cloud
            if await self.cloud_storage.file_exists(cloud_key):
                logger.info(f"File already exists in cloud storage: {cloud_key}")
                return {
                    "media_id": media_id,
                    "status": "already_exists",
                    "cloud_key": cloud_key,
                    "local_path": str(local_path)
                }
            
            if dry_run:
                logger.info(f"DRY RUN: Would migrate {local_path} to {cloud_key}")
                return {
                    "media_id": media_id,
                    "status": "dry_run",
                    "cloud_key": cloud_key,
                    "local_path": str(local_path)
                }
            
            # Prepare metadata
            metadata = {
                "media_id": media_id,
                "original_filename": original_filename,
                "migrated_at": datetime.utcnow().isoformat(),
                "migration_source": "local_storage",
                "file_size": str(media_info["file_size"]),
                "created_at": media_info["created_at"].isoformat(),
                "modified_at": media_info["modified_at"].isoformat()
            }
            
            # Upload to cloud storage
            with open(local_path, 'rb') as file_stream:
                cloud_url = await self.cloud_storage.upload_file_stream(
                    file_stream=file_stream,
                    key=cloud_key,
                    content_type=media_info["mime_type"],
                    file_size=media_info["file_size"],
                    metadata=metadata
                )
            
            logger.info(f"Successfully migrated {media_id} to cloud storage: {cloud_key}")
            
            return {
                "media_id": media_id,
                "status": "migrated",
                "cloud_key": cloud_key,
                "cloud_url": cloud_url,
                "local_path": str(local_path),
                "file_size": media_info["file_size"]
            }
            
        except CloudStorageError as e:
            logger.error(f"Failed to migrate {media_id} to cloud storage: {e}")
            return {
                "media_id": media_id,
                "status": "failed",
                "error": str(e),
                "local_path": str(local_path)
            }
        except Exception as e:
            logger.error(f"Unexpected error migrating {media_id}: {e}")
            return {
                "media_id": media_id,
                "status": "error",
                "error": str(e),
                "local_path": str(local_path)
            }
    
    async def migrate_all_files(
        self,
        user_id: str = "unknown",
        dry_run: bool = False,
        batch_size: int = 10,
        delete_local_after_migration: bool = False
    ) -> Dict[str, Any]:
        """Migrate all local media files to cloud storage"""
        
        logger.info(f"Starting migration of all local media files (dry_run={dry_run})")
        
        # Discover files
        media_files = await self.discover_local_media_files()
        
        if not media_files:
            logger.info("No local media files found for migration")
            return {
                "total_files": 0,
                "migrated": 0,
                "failed": 0,
                "already_exists": 0,
                "results": []
            }
        
        # Process files in batches
        results = []
        migrated_count = 0
        failed_count = 0
        already_exists_count = 0
        
        for i in range(0, len(media_files), batch_size):
            batch = media_files[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}/{(len(media_files) + batch_size - 1)//batch_size}")
            
            # Process batch concurrently
            batch_tasks = [
                self.migrate_file_to_cloud(media_info, user_id, dry_run)
                for media_info in batch
            ]
            
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Migration task failed: {result}")
                    failed_count += 1
                    results.append({
                        "status": "error",
                        "error": str(result)
                    })
                else:
                    results.append(result)
                    
                    if result["status"] == "migrated":
                        migrated_count += 1
                        
                        # Delete local file if requested and migration successful
                        if delete_local_after_migration and not dry_run:
                            try:
                                Path(result["local_path"]).unlink()
                                logger.info(f"Deleted local file: {result['local_path']}")
                            except Exception as e:
                                logger.error(f"Failed to delete local file {result['local_path']}: {e}")
                                
                    elif result["status"] == "failed" or result["status"] == "error":
                        failed_count += 1
                    elif result["status"] == "already_exists":
                        already_exists_count += 1
            
            # Small delay between batches to avoid overwhelming the system
            if i + batch_size < len(media_files):
                await asyncio.sleep(1)
        
        summary = {
            "total_files": len(media_files),
            "migrated": migrated_count,
            "failed": failed_count,
            "already_exists": already_exists_count,
            "results": results
        }
        
        logger.info(f"Migration completed: {summary}")
        return summary
    
    async def verify_migration(self, media_id: str, user_id: str = "unknown") -> Dict[str, Any]:
        """Verify that a migrated file exists in cloud storage"""
        
        if not self.cloud_storage:
            raise RuntimeError("Cloud storage not initialized")
        
        # Try common filename patterns
        potential_keys = [
            f"media/{user_id}/{media_id}/video.mp4",
            f"media/{user_id}/{media_id}/video.webm",
            f"media/{user_id}/{media_id}/video.mov"
        ]
        
        for key in potential_keys:
            if await self.cloud_storage.file_exists(key):
                metadata = await self.cloud_storage.get_file_metadata(key)
                return {
                    "media_id": media_id,
                    "exists": True,
                    "cloud_key": key,
                    "metadata": metadata
                }
        
        return {
            "media_id": media_id,
            "exists": False,
            "checked_keys": potential_keys
        }
    
    async def migrate_challenge_urls(
        self,
        challenge_service,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Migrate challenge data model to use persistent server URLs"""
        
        logger.info(f"Starting challenge URL migration (dry_run={dry_run})")
        
        # Get all challenges that need URL migration
        challenges = await challenge_service.get_all_challenges()
        
        migrated_count = 0
        failed_count = 0
        results = []
        
        for challenge in challenges:
            try:
                updated_statements = []
                challenge_updated = False
                
                for statement in challenge.statements:
                    # Check if statement needs URL migration
                    needs_migration = (
                        statement.media_url.startswith('blob:') or
                        statement.media_url.startswith('/api/v1/files/') or
                        not hasattr(statement, 'streaming_url') or
                        statement.streaming_url is None or
                        not hasattr(statement, 'storage_type') or
                        (hasattr(statement, 'storage_type') and statement.storage_type == "local" and 
                         statement.media_url.startswith(('blob:', '/api/v1/files/')))
                    )
                    
                    if needs_migration:
                        if dry_run:
                            logger.info(f"DRY RUN: Would migrate statement {statement.statement_id} URL")
                            updated_statements.append(statement)
                            challenge_updated = True
                            continue
                        
                        # Generate new persistent URLs based on media_file_id
                        media_file_id = statement.media_file_id
                        
                        # Try to get media info from upload service
                        try:
                            from services.media_upload_service import MediaUploadService
                            media_service = MediaUploadService()
                            
                            # Get media info to determine storage type and URLs
                            media_info = await media_service.get_media_info(
                                media_file_id, 
                                challenge.creator_id
                            )
                            
                            if media_info:
                                # Update statement with persistent URLs
                                updated_statement = statement.model_copy()
                                
                                if media_info.get('storage_type') == 'cloud':
                                    # Use cloud storage URLs
                                    cloud_key = media_info.get('cloud_key')
                                    if cloud_key and self.cloud_storage:
                                        streaming_url = await self.cloud_storage.get_file_url(cloud_key)
                                        updated_statement.streaming_url = streaming_url
                                        updated_statement.cloud_storage_key = cloud_key
                                        updated_statement.storage_type = 'cloud'
                                        updated_statement.media_url = streaming_url
                                    else:
                                        # Fallback to local streaming URL
                                        updated_statement.streaming_url = f"/api/v1/media/stream/{media_file_id}"
                                        updated_statement.media_url = f"/api/v1/media/stream/{media_file_id}"
                                        updated_statement.storage_type = 'local'
                                else:
                                    # Use local streaming URLs
                                    updated_statement.streaming_url = f"/api/v1/media/stream/{media_file_id}"
                                    updated_statement.media_url = f"/api/v1/media/stream/{media_file_id}"
                                    updated_statement.storage_type = 'local'
                                
                                updated_statements.append(updated_statement)
                                challenge_updated = True
                                
                                logger.info(f"Migrated statement {statement.statement_id} to persistent URL")
                            else:
                                # Media not found, keep original statement
                                logger.warning(f"Media info not found for {media_file_id}, keeping original URL")
                                updated_statements.append(statement)
                                
                        except Exception as e:
                            logger.error(f"Failed to get media info for {media_file_id}: {e}")
                            # Keep original statement on error
                            updated_statements.append(statement)
                    else:
                        # Statement already has persistent URLs
                        updated_statements.append(statement)
                
                if challenge_updated and not dry_run:
                    # Update challenge with new statement URLs
                    updated_challenge = challenge.model_copy()
                    updated_challenge.statements = updated_statements
                    
                    # Save updated challenge
                    await challenge_service.update_challenge(challenge.challenge_id, updated_challenge)
                    migrated_count += 1
                    
                    results.append({
                        "challenge_id": challenge.challenge_id,
                        "status": "migrated",
                        "statements_updated": len([s for s in updated_statements if s != challenge.statements[updated_statements.index(s)]])
                    })
                else:
                    results.append({
                        "challenge_id": challenge.challenge_id,
                        "status": "no_migration_needed" if not challenge_updated else "dry_run"
                    })
                    
            except Exception as e:
                logger.error(f"Failed to migrate challenge {challenge.challenge_id}: {e}")
                failed_count += 1
                results.append({
                    "challenge_id": challenge.challenge_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        summary = {
            "total_challenges": len(challenges),
            "migrated": migrated_count,
            "failed": failed_count,
            "results": results
        }
        
        logger.info(f"Challenge URL migration completed: {summary}")
        return summary

# CLI utility for running migrations
async def main():
    """CLI utility for running media migrations"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate local media files to cloud storage")
    parser.add_argument("--user-id", default="unknown", help="User ID for migration")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry run without actual migration")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for processing")
    parser.add_argument("--delete-local", action="store_true", help="Delete local files after successful migration")
    parser.add_argument("--verify", help="Verify migration for specific media ID")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    migration_service = MediaMigrationService()
    
    if args.verify:
        result = await migration_service.verify_migration(args.verify, args.user_id)
        print(f"Verification result: {result}")
    else:
        result = await migration_service.migrate_all_files(
            user_id=args.user_id,
            dry_run=args.dry_run,
            batch_size=args.batch_size,
            delete_local_after_migration=args.delete_local
        )
        print(f"Migration completed: {result}")

if __name__ == "__main__":
    asyncio.run(main())