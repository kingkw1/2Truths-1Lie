#!/usr/bin/env python3
"""
AWS S3 Challenge Dump and Delete Script
Direct access to AWS S3 to find and remove challenges
"""

import boto3
import json
import os
from datetime import datetime
from botocore.exceptions import ClientError, NoCredentialsError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Target challenges to delete
TARGET_CHALLENGES = [
    "efe833cb-5e3d-4fe1-9560-b899ead62f7e",
    "d62031be-2a64-479c-9f5e-f93b273c3d18"
]

# AWS Configuration from .env
BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', '2truths1lie-media-uploads')
AWS_REGION = os.getenv('AWS_S3_REGION', 'us-east-1')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')

def get_s3_client():
    """Get S3 client with credentials from .env"""
    try:
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            print("❌ AWS credentials not found in .env file!")
            print("Make sure these are set in your .env file:")
            print("  AWS_ACCESS_KEY_ID=your_key")
            print("  AWS_SECRET_ACCESS_KEY=your_secret")
            return None
            
        s3_client = boto3.client(
            's3',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        
        # Test the connection
        s3_client.head_bucket(Bucket=BUCKET_NAME)
        print(f"✅ Connected to S3 bucket: {BUCKET_NAME}")
        print(f"📍 Region: {AWS_REGION}")
        print(f"🔑 Using credentials from .env file")
        return s3_client
        
    except NoCredentialsError:
        print("❌ AWS credentials not found!")
        print("Set these environment variables:")
        print("  export AWS_ACCESS_KEY_ID=your_key")
        print("  export AWS_SECRET_ACCESS_KEY=your_secret")
        return None
    except ClientError as e:
        print(f"❌ AWS connection error: {e}")
        return None

def dump_all_s3_objects(s3_client):
    """Dump all objects in the S3 bucket"""
    print(f"🗂️  Dumping all objects from {BUCKET_NAME}...")
    
    all_objects = []
    paginator = s3_client.get_paginator('list_objects_v2')
    
    try:
        for page in paginator.paginate(Bucket=BUCKET_NAME):
            if 'Contents' in page:
                for obj in page['Contents']:
                    all_objects.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'etag': obj.get('ETag', '').strip('"')
                    })
        
        print(f"📊 Found {len(all_objects)} total objects in S3")
        
        # Save dump to file
        dump_file = f"s3_dump_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(dump_file, 'w') as f:
            json.dump(all_objects, f, indent=2)
        print(f"💾 Saved dump to: {dump_file}")
        
        return all_objects
        
    except Exception as e:
        print(f"❌ Failed to dump S3 objects: {e}")
        return []

def find_challenge_objects(all_objects, challenge_ids):
    """Find all S3 objects related to specific challenges"""
    challenge_objects = {}
    
    for challenge_id in challenge_ids:
        challenge_objects[challenge_id] = []
        
        for obj in all_objects:
            if challenge_id in obj['key']:
                challenge_objects[challenge_id].append(obj)
    
    return challenge_objects

def delete_challenge_objects(s3_client, challenge_objects):
    """Delete all objects for the specified challenges"""
    total_deleted = 0
    
    for challenge_id, objects in challenge_objects.items():
        if not objects:
            print(f"ℹ️  No S3 objects found for challenge: {challenge_id}")
            continue
            
        print(f"🗑️  Deleting {len(objects)} objects for challenge: {challenge_id}")
        
        # Prepare objects for batch delete
        objects_to_delete = [{'Key': obj['key']} for obj in objects]
        
        try:
            # Delete in batches of 1000 (S3 limit)
            for i in range(0, len(objects_to_delete), 1000):
                batch = objects_to_delete[i:i+1000]
                
                response = s3_client.delete_objects(
                    Bucket=BUCKET_NAME,
                    Delete={'Objects': batch}
                )
                
                deleted_count = len(response.get('Deleted', []))
                total_deleted += deleted_count
                
                print(f"  ✅ Deleted {deleted_count} objects")
                
                # Report any errors
                if 'Errors' in response:
                    for error in response['Errors']:
                        print(f"  ❌ Error deleting {error['Key']}: {error['Message']}")
                        
        except Exception as e:
            print(f"❌ Failed to delete objects for {challenge_id}: {e}")
    
    return total_deleted

def search_for_challenges_in_dump(all_objects, search_terms):
    """Search for challenges using various search terms"""
    print(f"🔍 Searching for challenges with terms: {search_terms}")
    
    found_objects = []
    for obj in all_objects:
        key_lower = obj['key'].lower()
        for term in search_terms:
            if term.lower() in key_lower:
                found_objects.append(obj)
                break
    
    print(f"📋 Found {len(found_objects)} objects matching search terms:")
    for obj in found_objects[:10]:  # Show first 10
        print(f"  - {obj['key']} ({obj['size']} bytes)")
    
    if len(found_objects) > 10:
        print(f"  ... and {len(found_objects) - 10} more")
    
    return found_objects

def main():
    print("🚀 AWS S3 Challenge Dump and Delete Tool")
    print("=" * 50)
    
    # Get S3 client
    s3_client = get_s3_client()
    if not s3_client:
        return 1
    
    # Step 1: Dump all S3 objects
    print("\n📂 Step 1: Dumping all S3 objects...")
    all_objects = dump_all_s3_objects(s3_client)
    if not all_objects:
        return 1
    
    # Step 2: Search for flagged challenges
    print("\n🎯 Step 2: Finding target challenges...")
    challenge_objects = find_challenge_objects(all_objects, TARGET_CHALLENGES)
    
    for challenge_id, objects in challenge_objects.items():
        print(f"  Challenge {challenge_id}: {len(objects)} objects")
        for obj in objects[:3]:  # Show first 3
            print(f"    - {obj['key']}")
        if len(objects) > 3:
            print(f"    ... and {len(objects) - 3} more")
    
    # Step 3: Also search by keywords that might be in flagged content
    print("\n🔍 Step 3: Searching for potentially flagged content...")
    search_terms = ["personal", "info", "private", "report", "flag"]
    search_results = search_for_challenges_in_dump(all_objects, search_terms)
    
    # Step 4: Ask for confirmation before deletion
    total_objects_to_delete = sum(len(objects) for objects in challenge_objects.values())
    
    if total_objects_to_delete == 0:
        print("\n⚠️  No objects found for target challenges!")
        print("This might mean:")
        print("  1. Challenges are stored differently than expected")
        print("  2. Challenge IDs are not in S3 object keys")
        print("  3. Challenges are in a different AWS service")
        
        print(f"\n📋 Total objects in bucket: {len(all_objects)}")
        print("Consider checking the dump file for challenge data patterns")
        return 0
    
    print(f"\n⚠️  Ready to delete {total_objects_to_delete} objects for {len(TARGET_CHALLENGES)} challenges")
    print("This action cannot be undone!")
    
    confirm = input("Type 'DELETE' to confirm deletion: ")
    if confirm != 'DELETE':
        print("❌ Deletion cancelled")
        return 0
    
    # Step 5: Delete the objects
    print("\n🗑️  Step 5: Deleting challenge objects...")
    deleted_count = delete_challenge_objects(s3_client, challenge_objects)
    
    print(f"\n✅ Deletion complete!")
    print(f"   Objects deleted: {deleted_count}")
    print(f"   Challenges processed: {len(TARGET_CHALLENGES)}")
    
    return 0

if __name__ == "__main__":
    exit(main())