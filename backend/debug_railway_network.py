#!/usr/bin/env python3
"""
Debug Railway network connectivity
"""
import os
import socket
import subprocess

def main():
    print("🔍 Railway Network Debug")
    print("=" * 40)
    
    # Check environment variables
    print("\n📋 Environment Variables:")
    railway_vars = {k: v for k, v in os.environ.items() if 'RAILWAY' in k or 'DATABASE' in k}
    for key, value in sorted(railway_vars.items()):
        if 'DATABASE_URL' in key:
            print(f"  {key}: {value[:60]}...")
        else:
            print(f"  {key}: {value}")
    
    # Test hostname resolution
    print("\n🌐 Hostname Resolution Tests:")
    hostnames_to_test = [
        'postgres.railway.internal',
        'postgres-sql.railway.internal', 
        'postgres-wqzl.railway.internal',
        'localhost',
        '127.0.0.1'
    ]
    
    for hostname in hostnames_to_test:
        try:
            ip = socket.gethostbyname(hostname)
            print(f"  ✅ {hostname} → {ip}")
        except socket.gaierror as e:
            print(f"  ❌ {hostname} → {e}")
    
    # Check if we can ping internal services
    print("\n🔄 Network Connectivity:")
    try:
        # Try to list network interfaces
        result = subprocess.run(['ip', 'addr'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("  📡 Network interfaces available")
        else:
            print("  ❌ Cannot list network interfaces")
    except Exception as e:
        print(f"  ❌ Network check failed: {e}")
    
    # Check Railway internal domain resolution
    print("\n🚂 Railway Internal Domains:")
    railway_domain = os.getenv('RAILWAY_PRIVATE_DOMAIN', '')
    if railway_domain:
        print(f"  📍 Private domain: {railway_domain}")
        try:
            ip = socket.gethostbyname(railway_domain)
            print(f"  ✅ {railway_domain} → {ip}")
        except Exception as e:
            print(f"  ❌ {railway_domain} → {e}")
    else:
        print("  ❌ No RAILWAY_PRIVATE_DOMAIN found")

if __name__ == "__main__":
    main()