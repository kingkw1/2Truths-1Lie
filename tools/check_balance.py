#!/usr/bin/env python3
import requests
import urllib.parse

def check_balance(email="fake.kevin@gmail.com"):
    user_email = urllib.parse.quote(email)
    url = f'https://2truths-1lie-production.up.railway.app/api/v1/tokens/debug-balance/{user_email}'
    
    print(f'🔍 Checking balance for {email}...')
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f'💰 Current Balance: {data["current_balance"]} tokens')
            print(f'⏰ Last Updated: {data["last_updated"]}')
            print(f'📝 Recent Transactions: {len(data["recent_transactions"])}')
            for tx in data["recent_transactions"]:
                print(f'   • {tx["type"]}: {tx["amount"]} tokens → Balance: {tx["balance_after"]}')
        else:
            print(f'❌ Status: {response.status_code}')
            print(f'📝 Response: {response.text}')
    except Exception as e:
        print(f'�� Error: {e}')

if __name__ == "__main__":
    check_balance()
