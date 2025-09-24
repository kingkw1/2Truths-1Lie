#!/usr/bin/env python3
"""
Complete AWS Challenge Scanner and Nuker
Scans all AWS services to find and delete challenge data
"""

import boto3
import json
import os
from datetime import datetime
from botocore.exceptions import ClientError, NoCredentialsError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Target challenges to remove
TARGET_CHALLENGES = [
    "efe833cb-5e3d-4fe1-9560-b899ead62f7e",
    "d62031be-2a64-479c-9f5e-f93b273c3d18"
]

# AWS Configuration from .env
BUCKET_NAME = os.getenv('AWS_S3_BUCKET_NAME', '2truths1lie-media-uploads')
AWS_REGION = os.getenv('AWS_S3_REGION', 'us-east-1')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')

def get_aws_client(service_name):
    """Get AWS client for any service with credentials from .env"""
    try:
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            print("❌ AWS credentials not found in .env file!")
            print("Make sure these are set in your .env file:")
            print("  AWS_ACCESS_KEY_ID=your_key")
            print("  AWS_SECRET_ACCESS_KEY=your_secret")
            return None
            
        client = boto3.client(
            service_name,
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        
        print(f"✅ Connected to AWS {service_name}")
        return client
        
    except Exception as e:
        print(f"❌ Failed to connect to AWS {service_name}: {e}")
        return None

def get_aws_session():
    """Get AWS session with credentials from .env"""
    try:
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            print("❌ AWS credentials not found in .env file!")
            return None
            
        session = boto3.Session(
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        
        # Test connection
        sts = session.client('sts')
        identity = sts.get_caller_identity()
        print(f"✅ Connected as: {identity.get('Arn', 'Unknown')}")
        print(f"🔑 Using credentials from .env file")
        return session
        
    except Exception as e:
        print(f"❌ AWS connection failed: {e}")
        return None

def scan_dynamodb(session):
    """Scan DynamoDB for challenge data"""
    print("\n🗄️  Scanning DynamoDB...")
    
    try:
        dynamodb = session.client('dynamodb')
        
        # List all tables
        tables = dynamodb.list_tables()['TableNames']
        print(f"Found {len(tables)} DynamoDB tables:")
        
        challenge_data = {}
        
        for table_name in tables:
            print(f"  📋 Scanning table: {table_name}")
            
            try:
                # Scan table for challenge IDs
                paginator = dynamodb.get_paginator('scan')
                
                items_found = []
                for page in paginator.paginate(TableName=table_name):
                    for item in page.get('Items', []):
                        # Convert DynamoDB item to readable format
                        item_str = json.dumps(item, default=str)
                        
                        # Check if any target challenges are mentioned
                        for challenge_id in TARGET_CHALLENGES:
                            if challenge_id in item_str:
                                items_found.append(item)
                
                if items_found:
                    challenge_data[table_name] = items_found
                    print(f"    🎯 Found {len(items_found)} items with target challenges")
                else:
                    print(f"    ✅ No target challenges found")
                    
            except Exception as e:
                print(f"    ❌ Error scanning {table_name}: {e}")
        
        return challenge_data
        
    except Exception as e:
        print(f"❌ DynamoDB scan failed: {e}")
        return {}

def scan_rds(session):
    """Check RDS instances"""
    print("\n🗃️  Checking RDS instances...")
    
    try:
        rds = session.client('rds')
        
        # List DB instances
        instances = rds.describe_db_instances()['DBInstances']
        print(f"Found {len(instances)} RDS instances:")
        
        for instance in instances:
            print(f"  📊 Instance: {instance['DBInstanceIdentifier']}")
            print(f"     Engine: {instance['Engine']}")
            print(f"     Status: {instance['DBInstanceStatus']}")
            print(f"     Endpoint: {instance.get('Endpoint', {}).get('Address', 'N/A')}")
        
        if instances:
            print("\n⚠️  Manual database access required to check for challenge data")
            print("Connect to each RDS instance and run SQL queries to find/delete challenges")
        
        return instances
        
    except Exception as e:
        print(f"❌ RDS check failed: {e}")
        return []

def scan_lambda(session):
    """Check Lambda functions for stored data"""
    print("\n⚡ Checking Lambda functions...")
    
    try:
        lambda_client = session.client('lambda')
        
        functions = lambda_client.list_functions()['Functions']
        print(f"Found {len(functions)} Lambda functions:")
        
        for func in functions:
            print(f"  🔧 Function: {func['FunctionName']}")
            
            # Check environment variables for challenge references
            env_vars = func.get('Environment', {}).get('Variables', {})
            for key, value in env_vars.items():
                for challenge_id in TARGET_CHALLENGES:
                    if challenge_id in str(value):
                        print(f"    🎯 Found challenge reference in env var {key}")
        
        return functions
        
    except Exception as e:
        print(f"❌ Lambda check failed: {e}")
        return []

def comprehensive_s3_search(session):
    """More comprehensive S3 search"""
    print("\n🪣 Comprehensive S3 Search...")
    
    try:
        s3 = session.client('s3')
        
        # List all buckets
        buckets = s3.list_buckets()['Buckets']
        print(f"Found {len(buckets)} S3 buckets:")
        
        all_challenge_objects = []
        
        for bucket in buckets:
            bucket_name = bucket['Name']
            print(f"  🪣 Searching bucket: {bucket_name}")
            
            try:
                paginator = s3.get_paginator('list_objects_v2')
                
                for page in paginator.paginate(Bucket=bucket_name):
                    for obj in page.get('Contents', []):
                        # Check if object key contains challenge IDs
                        for challenge_id in TARGET_CHALLENGES:
                            if challenge_id in obj['Key']:
                                all_challenge_objects.append({
                                    'bucket': bucket_name,
                                    'key': obj['Key'],
                                    'size': obj['Size'],
                                    'challenge_id': challenge_id
                                })
                                print(f"    🎯 Found: {obj['Key']}")
                
            except Exception as e:
                print(f"    ❌ Error scanning {bucket_name}: {e}")
        
        return all_challenge_objects
        
    except Exception as e:
        print(f"❌ S3 comprehensive search failed: {e}")
        return []

def delete_all_challenge_data(session, s3_objects, dynamodb_data):
    """Delete all found challenge data"""
    print(f"\n🗑️  DELETION SUMMARY:")
    print(f"S3 objects to delete: {len(s3_objects)}")
    print(f"DynamoDB tables with data: {len(dynamodb_data)}")
    
    if not s3_objects and not dynamodb_data:
        print("❌ No challenge data found to delete!")
        return False
    
    print("\n⚠️  This will permanently delete all found challenge data!")
    confirm = input("Type 'NUKE' to confirm deletion: ")
    
    if confirm != 'NUKE':
        print("❌ Deletion cancelled")
        return False
    
    # Delete S3 objects
    if s3_objects:
        print("\n🗑️  Deleting S3 objects...")
        s3 = session.client('s3')
        
        for obj in s3_objects:
            try:
                s3.delete_object(Bucket=obj['bucket'], Key=obj['key'])
                print(f"  ✅ Deleted: {obj['bucket']}/{obj['key']}")
            except Exception as e:
                print(f"  ❌ Failed to delete {obj['key']}: {e}")
    
    # Delete DynamoDB items
    if dynamodb_data:
        print("\n🗑️  Deleting DynamoDB items...")
        dynamodb = session.client('dynamodb')
        
        for table_name, items in dynamodb_data.items():
            print(f"  📋 Processing table: {table_name}")
            
            # Note: This requires knowing the table's key schema
            print(f"    ⚠️  Found {len(items)} items but need key schema for deletion")
            print(f"    Manual deletion required for table: {table_name}")
    
    return True

def main():
    print("🚀 AWS Complete Service Scanner and Nuker")
    print("=" * 50)
    print(f"🎯 Target challenges: {TARGET_CHALLENGES}")
    
    # Get AWS session
    session = get_aws_session()
    if not session:
        return 1
    
    # Scan all services
    s3_objects = comprehensive_s3_search(session)
    dynamodb_data = scan_dynamodb(session)
    rds_instances = scan_rds(session)
    lambda_functions = scan_lambda(session)
    
    # Summary
    print(f"\n📊 SCAN SUMMARY:")
    print(f"S3 objects found: {len(s3_objects)}")
    print(f"DynamoDB tables with data: {len(dynamodb_data)}")
    print(f"RDS instances: {len(rds_instances)}")
    print(f"Lambda functions: {len(lambda_functions)}")
    
    # Offer deletion
    if s3_objects or dynamodb_data:
        delete_all_challenge_data(session, s3_objects, dynamodb_data)
    else:
        print("\n✅ No challenge data found in AWS services!")
        print("The challenges might be:")
        print("  1. Stored in a different format/location")
        print("  2. Already deleted")
        print("  3. In a service not scanned")
    
    return 0

if __name__ == "__main__":
    exit(main())