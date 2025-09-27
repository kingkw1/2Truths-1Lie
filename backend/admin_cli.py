#!/usr/bin/env python3
"""
Remote Admin CLI Tool for 2Truths-1Lie Challenge Management
Use this tool to manage challenges on your Railway production environment remotely
"""
import asyncio
import httpx
import json
import sys
from typing import Optional, List, Dict, Any
import argparse
from datetime import datetime

class AdminCLI:
    def __init__(self, base_url: str = "https://2truths-1lie-production.up.railway.app"):
        self.base_url = base_url
        self.auth_token = None
        self.headers = {}
    
    async def authenticate(self, email: str = None, password: str = None) -> bool:
        """Authenticate with the admin API"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                if email and password:
                    # Try login with credentials
                    response = await client.post(f"{self.base_url}/api/v1/auth/login", json={
                        "email": email,
                        "password": password
                    })
                else:
                    # Try guest authentication (limited permissions)
                    response = await client.post(f"{self.base_url}/api/v1/auth/guest")
                
                if response.status_code == 200:
                    data = response.json()
                    self.auth_token = data.get('access_token')
                    if self.auth_token:
                        self.headers = {"Authorization": f"Bearer {self.auth_token}"}
                        print("✅ Successfully authenticated")
                        return True
                
                print(f"❌ Authentication failed: {response.status_code}")
                return False
                
            except Exception as e:
                print(f"❌ Authentication error: {e}")
                return False
    
    async def search_challenges(self, search_term: str) -> List[Dict[str, Any]]:
        """Search for challenges by ID, creator, or title"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/admin/challenges/search/{search_term}",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('challenges', [])
                else:
                    print(f"❌ Search failed: {response.status_code} - {response.text}")
                    return []
                    
            except Exception as e:
                print(f"❌ Search error: {e}")
                return []
    
    async def delete_challenge(self, challenge_id: str, force: bool = False) -> bool:
        """Delete a specific challenge"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                params = {"force": force} if force else {}
                response = await client.delete(
                    f"{self.base_url}/api/v1/admin/challenges/{challenge_id}",
                    headers=self.headers,
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ Challenge deleted successfully:")
                    print(f"   Challenge ID: {data['challenge_id']}")
                    print(f"   Media files deleted: {data['media_files_deleted']}")
                    print(f"   Database records deleted: {data['database_records_deleted']}")
                    if data['media_deletion_errors']:
                        print(f"   ⚠️  Media deletion errors: {data['media_deletion_errors']}")
                    return True
                else:
                    print(f"❌ Deletion failed: {response.status_code} - {response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Deletion error: {e}")
                return False
    
    async def list_reported_challenges(self) -> List[Dict[str, Any]]:
        """List all reported challenges"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/admin/moderation/reports",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get('reported_challenges', [])
                else:
                    print(f"❌ Failed to get reports: {response.status_code} - {response.text}")
                    return []
                    
            except Exception as e:
                print(f"❌ Error getting reports: {e}")
                return []
    
    async def get_moderation_stats(self) -> Dict[str, Any]:
        """Get moderation statistics"""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/api/v1/admin/moderation/stats",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"❌ Failed to get stats: {response.status_code}")
                    return {}
                    
            except Exception as e:
                print(f"❌ Error getting stats: {e}")
                return {}

    async def set_premium_status(self, email: str, status: bool) -> bool:
        """Set a user's premium status."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/admin/users/set-premium-status",
                    headers=self.headers,
                    json={"email": email, "is_premium": status}
                )
                if response.status_code == 200:
                    print(f"✅ Successfully set premium status for {email} to {status}")
                    return True
                else:
                    print(f"❌ Failed to set premium status: {response.status_code} - {response.text}")
                    return False
            except Exception as e:
                print(f"❌ Error setting premium status: {e}")
                return False

async def main():
    parser = argparse.ArgumentParser(description="2Truths-1Lie Admin CLI Tool")
    parser.add_argument("--url", default="https://2truths-1lie-production.up.railway.app", 
                       help="Base URL of the API")
    parser.add_argument("--email", help="Admin email for authentication")
    parser.add_argument("--password", help="Admin password for authentication")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Search command
    search_parser = subparsers.add_parser("search", help="Search for challenges")
    search_parser.add_argument("term", help="Search term (challenge ID, creator, title)")
    
    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete a challenge")
    delete_parser.add_argument("challenge_id", help="Challenge ID to delete")
    delete_parser.add_argument("--force", action="store_true", 
                              help="Force deletion of published challenges")
    
    # Reports command
    subparsers.add_parser("reports", help="List reported challenges")
    
    # Stats command
    subparsers.add_parser("stats", help="Show moderation statistics")

    # Set Premium command
    premium_parser = subparsers.add_parser("set-premium", help="Set a user's premium status")
    premium_parser.add_argument("email", help="User's email address")
    premium_parser.add_argument("status", help="Premium status (true or false)")
    
    # Interactive mode
    subparsers.add_parser("interactive", help="Interactive mode")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize admin CLI
    admin = AdminCLI(args.url)
    
    # Authenticate
    print(f"🔐 Authenticating with {args.url}...")
    if not await admin.authenticate(args.email, args.password):
        print("❌ Authentication failed. Exiting.")
        return
    
    # Execute command
    if args.command == "search":
        print(f"🔍 Searching for: {args.term}")
        challenges = await admin.search_challenges(args.term)
        if challenges:
            print(f"📋 Found {len(challenges)} challenges:")
            for i, challenge in enumerate(challenges, 1):
                print(f"  {i}. {challenge['challenge_id']}")
                print(f"     Status: {challenge['status']}")
                print(f"     Creator: {challenge['creator_id']}")
                print(f"     Created: {challenge['created_at']}")
                if challenge.get('title'):
                    print(f"     Title: {challenge['title']}")
                print()
        else:
            print("❌ No challenges found")
    
    elif args.command == "delete":
        print(f"🗑️  Deleting challenge: {args.challenge_id}")
        if args.force:
            print("⚠️  Force mode enabled - will delete published challenges")
        
        confirm = input(f"Are you sure you want to delete {args.challenge_id}? (type 'DELETE' to confirm): ")
        if confirm == "DELETE":
            success = await admin.delete_challenge(args.challenge_id, args.force)
            if not success:
                print("❌ Deletion failed")
        else:
            print("❌ Deletion cancelled")
    
    elif args.command == "reports":
        print("📊 Getting reported challenges...")
        reports = await admin.list_reported_challenges()
        if reports:
            print(f"📋 Found {len(reports)} reported challenges:")
            for report in reports:
                print(f"  Challenge: {report['challenge_id']}")
                print(f"  Reports: {report['report_count']}")
                print(f"  Reasons: {', '.join(report['reasons'])}")
                print(f"  First reported: {report['first_report_at']}")
                print()
        else:
            print("✅ No reported challenges")
    
    elif args.command == "stats":
        print("📊 Getting moderation statistics...")
        stats = await admin.get_moderation_stats()
        if stats:
            print("📈 Moderation Statistics:")
            print(json.dumps(stats, indent=2))
        else:
            print("❌ No statistics available")

    elif args.command == "set-premium":
        print(f"👑 Setting premium status for {args.email} to {args.status}...")
        status_bool = args.status.lower() == 'true'
        success = await admin.set_premium_status(args.email, status_bool)
        if not success:
            print("❌ Failed to set premium status.")
    
    elif args.command == "interactive":
        print("🎮 Interactive Mode - Type 'help' for commands, 'quit' to exit")
        while True:
            try:
                command = input("> ").strip().lower()
                
                if command == "quit" or command == "exit":
                    break
                elif command == "help":
                    print("Available commands:")
                    print("  search <term>     - Search for challenges")
                    print("  delete <id>       - Delete a challenge")
                    print("  reports           - List reported challenges")
                    print("  stats            - Show statistics")
                    print("  quit             - Exit interactive mode")
                elif command.startswith("search "):
                    term = command[7:]
                    challenges = await admin.search_challenges(term)
                    if challenges:
                        for challenge in challenges:
                            print(f"  {challenge['challenge_id']} - {challenge['status']}")
                elif command.startswith("delete "):
                    challenge_id = command[7:]
                    confirm = input(f"Delete {challenge_id}? (y/N): ")
                    if confirm.lower() == 'y':
                        await admin.delete_challenge(challenge_id)
                elif command == "reports":
                    reports = await admin.list_reported_challenges()
                    for report in reports:
                        print(f"  {report['challenge_id']} ({report['report_count']} reports)")
                elif command == "stats":
                    stats = await admin.get_moderation_stats()
                    print(json.dumps(stats, indent=2))
                else:
                    print("Unknown command. Type 'help' for available commands.")
                    
            except KeyboardInterrupt:
                break
        
        print("👋 Goodbye!")

if __name__ == "__main__":
    asyncio.run(main())