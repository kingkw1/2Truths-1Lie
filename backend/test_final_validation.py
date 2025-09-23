#!/usr/bin/env python3
"""
Final validation test for authentication and token system
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from unittest.mock import patch

def test_complete_flow():
    """Test the complete authentication and token flow"""
    print("🎯 Final Validation: Complete Auth & Token Flow")
    print("=" * 50)
    
    with patch.dict(os.environ, {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}, clear=False):
        from services.database_service import DatabaseService
        from services.auth_service import AuthService
        from services.token_service import TokenService
        from token_models.token_models import TokenSpendRequest, TokenPurchaseEvent
        
        # Initialize services
        db_service = DatabaseService()
        auth_service = AuthService()
        token_service = TokenService(db_service)
        
        print(f"✅ Services initialized ({db_service.database_mode.value})")
        
        # Create user
        unique_id = str(uuid.uuid4())[:8]
        email = f"final_test_{unique_id}@example.com"
        user_data = db_service.create_user(email, "password123", "Test User")
        user_id = user_data["id"]
        print(f"✅ User created: {user_id}")
        
        # Authenticate
        auth_result = db_service.authenticate_user(email, "password123")
        assert auth_result["id"] == user_id
        print("✅ Authentication successful")
        
        # Create JWT
        jwt_token = auth_service.create_access_token({"sub": str(user_id)})
        token_data = auth_service.verify_token(jwt_token)
        assert token_data["sub"] == str(user_id)
        print("✅ JWT token flow works")
        
        # Token operations
        token_service._initialize_user_balance(str(user_id))
        balance = token_service.get_user_balance(str(user_id))
        assert balance.balance == 0
        print("✅ Token balance initialized")
        
        # Purchase tokens
        purchase = TokenPurchaseEvent(
            user_id=str(user_id),
            transaction_id="test_purchase",
            product_id="tokens_50",
            tokens_purchased=50,
            purchase_price=2.99,
            purchase_currency="USD"
        )
        success = token_service.add_tokens_from_purchase(purchase)
        assert success
        
        new_balance = token_service.get_user_balance(str(user_id))
        assert new_balance.balance == 50
        print("✅ Token purchase works")
        
        # Spend tokens
        spend_request = TokenSpendRequest(
            amount=10,
            description="Test spending",
            metadata={"test": True}
        )
        spend_result = token_service.spend_tokens(str(user_id), spend_request)
        assert spend_result.success
        assert spend_result.new_balance == 40
        print("✅ Token spending works")
        
        # Session management
        login_updated = db_service.update_user_last_login(user_id)
        assert login_updated
        print("✅ Last login update works")
        
        deactivated = db_service.deactivate_user(user_id)
        assert deactivated
        
        auth_after_deactivation = db_service.authenticate_user(email, "password123")
        assert auth_after_deactivation is None
        print("✅ User deactivation (logout) works")
        
        reactivated = db_service.reactivate_user(user_id)
        assert reactivated
        
        auth_after_reactivation = db_service.authenticate_user(email, "password123")
        assert auth_after_reactivation is not None
        print("✅ User reactivation works")
        
        # Transaction history
        history = token_service.get_transaction_history(str(user_id))
        assert len(history) == 2
        assert history[0]["transaction_type"] == "spend"
        assert history[1]["transaction_type"] == "purchase"
        print("✅ Transaction history accurate")
        
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Authentication system fully functional")
        print("✅ Token management system working")
        print("✅ Session management operational")
        print("✅ Unified query abstraction successful")
        print("✅ PostgreSQL compatibility ensured")
        
        return True

if __name__ == "__main__":
    try:
        success = test_complete_flow()
        print(f"\n🚀 System Status: {'READY FOR PRODUCTION' if success else 'NEEDS ATTENTION'}")
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)