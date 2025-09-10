#!/usr/bin/env python3
"""
Clean up test challenges from the challenge service storage
Removes all challenges created by 'test-user-123'
"""

import json
from pathlib import Path

def clean_test_challenges():
    """Remove all test challenges from the challenge service storage"""
    challenges_file = Path("temp/challenges.json")
    guesses_file = Path("temp/guesses.json")
    
    # Clean challenges
    if challenges_file.exists():
        try:
            with open(challenges_file, 'r') as f:
                challenges_data = json.load(f)
            
            # Count test challenges
            test_challenges = {k: v for k, v in challenges_data.items() if v.get('creator_id') == 'test-user-123'}
            print(f"🗑️  Found {len(test_challenges)} test challenges to remove")
            
            if test_challenges:
                # Show what we're removing
                print("📋 Test challenges to be removed:")
                for challenge_id, challenge in test_challenges.items():
                    print(f"   - {challenge_id} (created: {challenge.get('created_at', 'unknown')})")
                
                # Remove test challenges
                clean_challenges = {k: v for k, v in challenges_data.items() if v.get('creator_id') != 'test-user-123'}
                
                # Save clean data
                with open(challenges_file, 'w') as f:
                    json.dump(clean_challenges, f, indent=2)
                
                removed_count = len(test_challenges)
                print(f"✅ Successfully removed {removed_count} test challenges")
            else:
                print("✅ No test challenges found to clean")
                
        except Exception as e:
            print(f"❌ Error cleaning challenges: {e}")
    else:
        print("✅ No challenges file found - already clean")
    
    # Clean related guesses (optional)
    if guesses_file.exists():
        try:
            with open(guesses_file, 'r') as f:
                guesses_data = json.load(f)
            
            # Remove guesses for test challenges
            test_challenge_ids = [k for k, v in challenges_data.items() if v.get('creator_id') == 'test-user-123'] if challenges_file.exists() else []
            
            if test_challenge_ids:
                clean_guesses = {k: v for k, v in guesses_data.items() if v.get('challenge_id') not in test_challenge_ids}
                
                with open(guesses_file, 'w') as f:
                    json.dump(clean_guesses, f, indent=2)
                
                removed_guesses = len(guesses_data) - len(clean_guesses)
                if removed_guesses > 0:
                    print(f"✅ Also removed {removed_guesses} associated test guesses")
                    
        except Exception as e:
            print(f"❌ Error cleaning guesses: {e}")
    
    print("🎯 Storage is now clean and ready for real challenges!")

if __name__ == "__main__":
    print("🧹 Cleaning test challenges from challenge service storage...")
    clean_test_challenges()
