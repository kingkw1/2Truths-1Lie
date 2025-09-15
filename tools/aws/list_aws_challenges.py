#!/usr/bin/env python3
"""
Script to list all challenges available on AWS S3 for the challenge browser
"""
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from config import settings
import json
from datetime import datetime

def format_file_size(size_bytes):
    """Convert bytes to human readable format"""
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"

def list_s3_challenges():
    """List all challenges stored in S3 bucket"""
    try:
        # Initialize S3 client
        s3_client = boto3.client(
            's3',
            region_name=settings.AWS_S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )
        
        print(f"🔍 Scanning S3 bucket: {settings.AWS_S3_BUCKET_NAME}")
        print(f"📍 Region: {settings.AWS_S3_REGION}")
        print("=" * 80)
        
        # List all objects in the bucket
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(Bucket=settings.AWS_S3_BUCKET_NAME)
        
        challenges = []
        total_size = 0
        
        for page in page_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    size = obj['Size']
                    last_modified = obj['LastModified']
                    
                    # Parse challenge information from key
                    # Expected format: media/{user_id}/{media_id}/{filename}
                    key_parts = key.split('/')
                    
                    challenge_info = {
                        'key': key,
                        'size': size,
                        'size_formatted': format_file_size(size),
                        'last_modified': last_modified.strftime('%Y-%m-%d %H:%M:%S UTC'),
                        'filename': key_parts[-1] if key_parts else key
                    }
                    
                    if len(key_parts) >= 3 and key_parts[0] == 'media':
                        challenge_info.update({
                            'user_id': key_parts[1],
                            'media_id': key_parts[2],
                            'type': 'challenge_video'
                        })
                    else:
                        challenge_info['type'] = 'other'
                    
                    challenges.append(challenge_info)
                    total_size += size
        
        # Sort by last modified (newest first)
        challenges.sort(key=lambda x: x['last_modified'], reverse=True)
        
        # Display results
        print(f"📊 Total files found: {len(challenges)}")
        print(f"💾 Total storage used: {format_file_size(total_size)}")
        print()
        
        if challenges:
            print("🎮 CHALLENGE VIDEOS:")
            print("-" * 80)
            video_count = 0
            
            for challenge in challenges:
                if challenge['type'] == 'challenge_video':
                    video_count += 1
                    print(f"#{video_count}")
                    print(f"  📁 Key: {challenge['key']}")
                    print(f"  👤 User ID: {challenge['user_id']}")
                    print(f"  🎬 Media ID: {challenge['media_id']}")
                    print(f"  📄 Filename: {challenge['filename']}")
                    print(f"  📏 Size: {challenge['size_formatted']}")
                    print(f"  📅 Uploaded: {challenge['last_modified']}")
                    print()
            
            if video_count == 0:
                print("❌ No challenge videos found in expected format")
            
            # Show other files if any
            other_files = [c for c in challenges if c['type'] == 'other']
            if other_files:
                print("📁 OTHER FILES:")
                print("-" * 80)
                for i, file_info in enumerate(other_files, 1):
                    print(f"#{i}")
                    print(f"  📁 Key: {file_info['key']}")
                    print(f"  📄 Filename: {file_info['filename']}")
                    print(f"  📏 Size: {file_info['size_formatted']}")
                    print(f"  📅 Modified: {file_info['last_modified']}")
                    print()
        else:
            print("❌ No files found in S3 bucket")
            print("   This could mean:")
            print("   - No challenges have been uploaded yet")
            print("   - Bucket is empty")
            print("   - Bucket name or credentials are incorrect")
        
        return challenges
        
    except NoCredentialsError:
        print("❌ AWS credentials not found or invalid")
        print(f"   Configured Access Key ID: {settings.AWS_ACCESS_KEY_ID[:10] if settings.AWS_ACCESS_KEY_ID else 'None'}...")
        return []
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchBucket':
            print(f"❌ S3 bucket '{settings.AWS_S3_BUCKET_NAME}' does not exist")
        elif error_code == 'AccessDenied':
            print(f"❌ Access denied to S3 bucket '{settings.AWS_S3_BUCKET_NAME}'")
        else:
            print(f"❌ AWS S3 Error ({error_code}): {e.response['Error']['Message']}")
        return []
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return []

def main():
    print("🚀 2Truths-1Lie Challenge Browser - AWS S3 Challenge Listing")
    print(f"⏰ Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Show configuration
    print("⚙️  CONFIGURATION:")
    print(f"   Bucket: {settings.AWS_S3_BUCKET_NAME}")
    print(f"   Region: {settings.AWS_S3_REGION}")
    print(f"   Cloud Storage Enabled: {settings.USE_CLOUD_STORAGE}")
    print(f"   Access Key: {settings.AWS_ACCESS_KEY_ID[:10] if settings.AWS_ACCESS_KEY_ID else 'None'}...")
    print()
    
    # List challenges
    challenges = list_s3_challenges()
    
    # Summary for challenge browser
    if challenges:
        video_challenges = [c for c in challenges if c['type'] == 'challenge_video']
        print("=" * 80)
        print("📋 CHALLENGE BROWSER SUMMARY:")
        print(f"   Available Challenges: {len(video_challenges)}")
        print(f"   Total Storage: {format_file_size(sum(c['size'] for c in challenges))}")
        
        if video_challenges:
            latest = max(video_challenges, key=lambda x: x['last_modified'])
            print(f"   Latest Upload: {latest['last_modified']}")
            print(f"   Most Recent: {latest['filename']}")

if __name__ == "__main__":
    main()