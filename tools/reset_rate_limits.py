#!/usr/bin/env python3
"""
Rate Limit Reset Utility

This script resets rate limits for users who have been blocked by the rate limiting system.
Use this for development/testing purposes to clear rate limit restrictions.

Usage:
    # Reset rate limits for a specific user
    python reset_rate_limits.py --user-id "3"
    
    # Reset rate limits for all users
    python reset_rate_limits.py --all
    
    # Show current rate limit status for all users
    python reset_rate_limits.py --status
    
    # Clear all rate limit data (nuclear option)
    python reset_rate_limits.py --clear-all

Requirements:
    - Run this script from the project root directory
    - Backend should be stopped before running (to avoid conflicts)
"""

import argparse
import json
import sys
import time
from pathlib import Path
from datetime import datetime

def get_rate_limits_file():
    """Get the path to the rate limits file"""
    # Try to find the rate limits file in common locations
    possible_paths = [
        Path("backend/temp/rate_limits.json"),
        Path("temp/rate_limits.json"),
        Path("../temp/rate_limits.json"),
    ]
    
    for path in possible_paths:
        if path.exists():
            return path
            
    # Default to backend/temp location
    return Path("backend/temp/rate_limits.json")

def load_rate_limits(file_path):
    """Load current rate limit data"""
    try:
        if file_path.exists():
            with open(file_path, 'r') as f:
                return json.load(f)
        else:
            print(f"Rate limits file not found at {file_path}")
            return {}
    except Exception as e:
        print(f"Error loading rate limits: {e}")
        return {}

def save_rate_limits(file_path, data):
    """Save rate limit data back to file"""
    try:
        # Ensure directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"✅ Rate limits updated in {file_path}")
        return True
    except Exception as e:
        print(f"❌ Error saving rate limits: {e}")
        return False

def show_status(rate_limits):
    """Show current rate limit status for all users"""
    if not rate_limits:
        print("📊 No rate limit data found - all users have clean slate!")
        return
        
    print("📊 Current Rate Limit Status:")
    print("=" * 50)
    
    current_time = time.time()
    window_hours = 1  # Default window from rate limiter
    cutoff_time = current_time - (window_hours * 3600)
    
    for user_id, timestamps in rate_limits.items():
        # Filter to recent requests (within window)
        recent_requests = [ts for ts in timestamps if ts > cutoff_time]
        
        print(f"User ID: {user_id}")
        print(f"  Total requests in last {window_hours} hour(s): {len(recent_requests)}")
        
        if recent_requests:
            oldest_recent = min(recent_requests)
            newest_recent = max(recent_requests)
            
            oldest_time = datetime.fromtimestamp(oldest_recent)
            newest_time = datetime.fromtimestamp(newest_recent)
            
            print(f"  First request: {oldest_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  Last request:  {newest_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Calculate when they can make requests again (if blocked)
            if len(recent_requests) >= 5:  # Default limit
                reset_time = oldest_recent + (window_hours * 3600)
                wait_seconds = max(0, reset_time - current_time)
                
                if wait_seconds > 0:
                    print(f"  🚫 BLOCKED - Can make requests again in {int(wait_seconds // 60)}m {int(wait_seconds % 60)}s")
                else:
                    print(f"  ✅ Can make requests now")
            else:
                print(f"  ✅ Within limits ({len(recent_requests)}/5)")
        else:
            print(f"  ✅ No recent requests")
        print()

def reset_user_limits(rate_limits, user_id):
    """Reset rate limits for a specific user"""
    if user_id in rate_limits:
        del rate_limits[user_id]
        print(f"✅ Reset rate limits for user {user_id}")
        return True
    else:
        print(f"ℹ️  User {user_id} has no rate limit data (already clean)")
        return False

def reset_all_limits(rate_limits):
    """Reset rate limits for all users"""
    if rate_limits:
        user_count = len(rate_limits)
        rate_limits.clear()
        print(f"✅ Reset rate limits for {user_count} users")
        return True
    else:
        print("ℹ️  No rate limit data to clear")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Reset rate limits for 2Truths-1Lie backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--user-id", help="Reset rate limits for specific user ID")
    group.add_argument("--all", action="store_true", help="Reset rate limits for all users")
    group.add_argument("--status", action="store_true", help="Show current rate limit status")
    group.add_argument("--clear-all", action="store_true", help="Clear all rate limit data completely")
    
    args = parser.parse_args()
    
    # Find and load rate limits file
    rate_limits_file = get_rate_limits_file()
    rate_limits = load_rate_limits(rate_limits_file)
    
    print(f"📁 Using rate limits file: {rate_limits_file}")
    print()
    
    if args.status:
        show_status(rate_limits)
        
    elif args.user_id:
        if reset_user_limits(rate_limits, args.user_id):
            save_rate_limits(rate_limits_file, rate_limits)
        
    elif args.all:
        if reset_all_limits(rate_limits):
            save_rate_limits(rate_limits_file, rate_limits)
            
    elif args.clear_all:
        if rate_limits_file.exists():
            rate_limits_file.unlink()
            print(f"✅ Deleted rate limits file completely")
        else:
            print("ℹ️  Rate limits file doesn't exist")
    
    print("\n🎯 Rate limit reset complete!")
    print("💡 You can now restart the backend and try submitting challenges again.")

if __name__ == "__main__":
    main()