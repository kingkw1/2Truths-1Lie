#!/usr/bin/env python3
"""
Comprehensive Backend Integration Tests for Login/Logout/Token Consumption Flows with PostgreSQL Support
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from unittest.mock import Mock, patch, MagicMock
import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any

# Test both SQLite and PostgreSQL scenarios
class TestAuthenticationIntegration:
    """Test authentication flows with unified query system"""
    
    def setUp(self):
        """Setup test environment"""
        # Use unique email for each test run
        unique_id = str(uuid.uuid4())[:8]
        self.test_email = f"test_{unique_id}@example.com"
        self.test_password = "securepassword123"
        self.test_name = "Test User"
        
    def test_complete_auth_flow_sqlite(self):
        """Test complete auth flow with SQLite"""
        print("🧪 Testing complete authentication flow with SQLite...")
        
        with patch.dict(os.environ, {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}, clear=False):
            from services.database_service import DatabaseService
            from services.auth_service import AuthService
            from services.token_service import TokenService
            
            # Initialize services
            db_service = DatabaseService()
            auth_service = AuthService()
            token_service = TokenService(db_service)
            
            print(f"✅ Services initialized with {db_service.database_mode.value}")
            
            # 1. Create user
            user_data = db_service.create_user(self.test_email, self.test_password, self.test_name)
            assert user_data is not None, "User creation failed"
            user_id = user_data["id"]
            print(f"✅ User created with ID: {user_id}")
            
            # 2. Authenticate user
            auth_result = db_service.authenticate_user(self.test_email, self.test_password)
            assert auth_result is not None, "Authentication failed"
            assert auth_result["email"] == self.test_email
            print("✅ User authentication successful")
            
            # 3. Create JWT token
            jwt_token = auth_service.create_access_token({"sub": str(user_id)})
            assert jwt_token is not None, "JWT token creation failed"
            print("✅ JWT token created")
            
            # 4. Verify JWT token
            token_data = auth_service.verify_token(jwt_token)
            assert token_data["sub"] == str(user_id), "JWT token verification failed"
            print("✅ JWT token verified")
            
            # 5. Initialize token balance
            token_service._initialize_user_balance(str(user_id))
            balance = token_service.get_user_balance(str(user_id))
            assert balance.balance == 0, "Initial balance should be 0"
            print("✅ Token balance initialized")
            
            # 6. Add tokens (simulate purchase)
            from token_models.token_models import TokenPurchaseEvent, TokenTransactionType
            purchase_event = TokenPurchaseEvent(
                user_id=str(user_id),
                transaction_id="test_purchase_123",
                product_id="tokens_100",
                tokens_purchased=100,
                purchase_price=4.99,
                purchase_currency="USD"
            )
            
            success = token_service.add_tokens_from_purchase(purchase_event)
            assert success, "Token purchase failed"
            
            new_balance = token_service.get_user_balance(str(user_id))
            assert new_balance.balance == 100, f"Expected balance 100, got {new_balance.balance}"
            print("✅ Tokens added from purchase")
            
            # 7. Spend tokens
            from token_models.token_models import TokenSpendRequest
            spend_request = TokenSpendRequest(
                amount=25,
                description="Used hint in challenge",
                metadata={"challenge_id": "test_challenge_123"}
            )
            
            spend_result = token_service.spend_tokens(str(user_id), spend_request)
            assert spend_result.success, "Token spending failed"
            assert spend_result.new_balance == 75, f"Expected balance 75, got {spend_result.new_balance}"
            print("✅ Tokens spent successfully")
            
            # 8. Check transaction history
            history = token_service.get_transaction_history(str(user_id))
            assert len(history) == 2, f"Expected 2 transactions, got {len(history)}"
            assert history[0]["transaction_type"] == "spend", "Latest transaction should be spend"
            assert history[1]["transaction_type"] == "purchase", "Earlier transaction should be purchase"
            print("✅ Transaction history correct")
            
            # 9. Update last login
            login_updated = db_service.update_user_last_login(user_id)
            assert login_updated, "Last login update failed"
            print("✅ Last login updated")
            
            # 10. Test user deactivation (logout equivalent)
            deactivated = db_service.deactivate_user(user_id)
            assert deactivated, "User deactivation failed"
            
            # Debug: Check user status after deactivation
            user_after_deactivation = db_service.get_user_by_id(user_id)
            print(f"🔍 User after deactivation: {user_after_deactivation}")
            
            # Should not be able to authenticate deactivated user
            auth_after_deactivation = db_service.authenticate_user(self.test_email, self.test_password)
            print(f"🔍 Auth result after deactivation: {auth_after_deactivation}")
            assert auth_after_deactivation is None, "Deactivated user should not authenticate"
            print("✅ User deactivation (logout) works")
            
            # 11. Reactivate user
            reactivated = db_service.reactivate_user(user_id)
            assert reactivated, "User reactivation failed"
            
            auth_after_reactivation = db_service.authenticate_user(self.test_email, self.test_password)
            assert auth_after_reactivation is not None, "Reactivated user should authenticate"
            print("✅ User reactivation works")
            
            print("🎉 Complete SQLite authentication flow test passed!")
            return True

    def test_complete_auth_flow_postgresql(self):
        """Test complete auth flow with PostgreSQL (mocked)"""
        print("🧪 Testing complete authentication flow with PostgreSQL...")
        
        with patch.dict(os.environ, {'ENVIRONMENT': 'production', 'DATABASE_URL': 'postgresql://test:test@localhost:5432/test'}, clear=False):
            with patch('psycopg2.connect') as mock_connect:
                # Mock PostgreSQL connection
                mock_conn = MagicMock()
                mock_cursor = MagicMock()
                mock_connect.return_value = mock_conn
                mock_conn.cursor.return_value = mock_cursor
                mock_conn.__enter__ = Mock(return_value=mock_conn)
                mock_conn.__exit__ = Mock(return_value=None)
                
                from services.database_service import DatabaseService
                from services.auth_service import AuthService
                from services.token_service import TokenService
                
                # Initialize services
                db_service = DatabaseService()
                auth_service = AuthService()
                token_service = TokenService(db_service)
                
                print(f"✅ Services initialized with {db_service.database_mode.value}")
                assert db_service.is_postgres, "Should be in PostgreSQL mode"
                
                # Mock database responses for user creation
                mock_cursor.fetchone.side_effect = [
                    None,  # No existing user
                    {"id": 1},  # User creation result
                ]
                mock_cursor.fetchall.return_value = []
                
                with patch.object(db_service, '_execute_select') as mock_select, \
                     patch.object(db_service, '_execute_query') as mock_query, \
                     patch.object(db_service, '_execute_insert') as mock_insert, \
                     patch.object(db_service, '_execute_update') as mock_update, \
                     patch.object(db_service, '_execute_upsert') as mock_upsert:
                    
                    # 1. Test user creation with PostgreSQL queries
                    mock_select.return_value = None  # No existing user
                    mock_query.return_value = {"id": 1}  # User creation with RETURNING
                    
                    user_data = db_service.create_user(self.test_email, self.test_password, self.test_name)
                    assert user_data is not None, "User creation failed"
                    user_id = user_data["id"]
                    print(f"✅ User created with ID: {user_id}")
                    
                    # Verify PostgreSQL-specific query was called
                    mock_query.assert_called()
                    call_args = mock_query.call_args[0]
                    assert "RETURNING id" in call_args[0], "PostgreSQL RETURNING clause should be used"
                    
                    # 2. Test authentication
                    mock_select.side_effect = [
                        {
                            "id": 1,
                            "email": self.test_email,
                            "password_hash": "$2b$12$test_hash",
                            "name": self.test_name,
                            "created_at": datetime.utcnow(),
                            "is_active": True,
                            "last_login": None
                        }
                    ]
                    
                    with patch.object(db_service, 'verify_password', return_value=True):
                        auth_result = db_service.authenticate_user(self.test_email, self.test_password)
                        assert auth_result is not None, "Authentication failed"
                        print("✅ PostgreSQL authentication successful")
                    
                    # 3. Test token operations with PostgreSQL
                    mock_select.side_effect = [
                        None,  # No existing balance
                        {"balance": 0, "last_updated": datetime.utcnow()},  # After initialization
                        {"balance": 100, "last_updated": datetime.utcnow()},  # After purchase
                        {"balance": 75, "last_updated": datetime.utcnow()},  # After spending
                    ]
                    
                    # Test token balance initialization
                    token_service._initialize_user_balance(str(user_id))
                    balance = token_service.get_user_balance(str(user_id))
                    assert balance.balance == 0, "Initial balance should be 0"
                    print("✅ PostgreSQL token balance initialized")
                    
                    # Test token purchase with PostgreSQL UPSERT
                    from token_models.token_models import TokenPurchaseEvent
                    purchase_event = TokenPurchaseEvent(
                        user_id=str(user_id),
                        transaction_id="test_purchase_123",
                        product_id="tokens_100",
                        tokens_purchased=100,
                        purchase_price=4.99,
                        purchase_currency="USD"
                    )
                    
                    success = token_service.add_tokens_from_purchase(purchase_event)
                    assert success, "Token purchase failed"
                    print("✅ PostgreSQL token purchase successful")
                    
                    # Verify UPSERT was called (PostgreSQL-specific)
                    mock_upsert.assert_called()
                    upsert_calls = mock_upsert.call_args_list
                    assert any("token_balances" in str(call) for call in upsert_calls), "token_balances UPSERT should be called"
                    
                    # Test token spending
                    from token_models.token_models import TokenSpendRequest
                    spend_request = TokenSpendRequest(
                        amount=25,
                        description="Used hint in challenge",
                        metadata={"challenge_id": "test_challenge_123"}
                    )
                    
                    # Mock successful spending
                    mock_select.return_value = {"balance": 100, "last_updated": datetime.utcnow()}
                    
                    spend_result = token_service.spend_tokens(str(user_id), spend_request)
                    assert spend_result.success, "Token spending failed"
                    print("✅ PostgreSQL token spending successful")
                    
                    # 4. Test session management
                    mock_update.return_value = 1  # Successful update
                    
                    login_updated = db_service.update_user_last_login(user_id)
                    assert login_updated, "Last login update failed"
                    print("✅ PostgreSQL last login update successful")
                    
                    deactivated = db_service.deactivate_user(user_id)
                    assert deactivated, "User deactivation failed"
                    print("✅ PostgreSQL user deactivation successful")
                    
                    # 5. Verify parameter conversion
                    # Check that queries were properly converted from ? to %s for PostgreSQL
                    query_calls = [call[0][0] for call in mock_select.call_args_list if call[0]]
                    for query in query_calls:
                        if "?" in query:
                            # The original query might have ?, but it should be converted
                            converted_query = db_service._prepare_query(query)
                            assert "%s" in converted_query or "?" not in converted_query, f"Query not properly converted: {query}"
                    
                    print("✅ PostgreSQL parameter conversion verified")
                    
            print("🎉 Complete PostgreSQL authentication flow test passed!")
            return True

    def test_error_handling_scenarios(self):
        """Test error handling in authentication and token flows"""
        print("🧪 Testing error handling scenarios...")
        
        with patch.dict(os.environ, {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}, clear=False):
            from services.database_service import DatabaseService
            from services.token_service import TokenService
            import sqlite3
            
            db_service = DatabaseService()
            token_service = TokenService(db_service)
            
            # 1. Test duplicate user creation
            user_data = db_service.create_user(self.test_email, self.test_password, self.test_name)
            assert user_data is not None, "First user creation should succeed"
            
            duplicate_user = db_service.create_user(self.test_email, "different_password", "Different Name")
            assert duplicate_user is None, "Duplicate email should be rejected"
            print("✅ Duplicate user creation properly handled")
            
            # 2. Test authentication with wrong password
            auth_wrong_password = db_service.authenticate_user(self.test_email, "wrong_password")
            assert auth_wrong_password is None, "Wrong password should fail authentication"
            print("✅ Wrong password properly handled")
            
            # 3. Test authentication with non-existent user
            auth_no_user = db_service.authenticate_user("nonexistent@example.com", "password")
            assert auth_no_user is None, "Non-existent user should fail authentication"
            print("✅ Non-existent user properly handled")
            
            # 4. Test token spending with insufficient balance
            user_id = str(user_data["id"])
            token_service._initialize_user_balance(user_id)
            
            from token_models.token_models import TokenSpendRequest
            spend_request = TokenSpendRequest(
                amount=100,  # More than the 0 balance
                description="Attempt to overspend",
                metadata={}
            )
            
            spend_result = token_service.spend_tokens(user_id, spend_request)
            assert not spend_result.success, "Overspending should fail"
            assert "Insufficient tokens" in spend_result.message, "Should provide clear error message"
            print("✅ Insufficient token balance properly handled")
            
            # 5. Test database connection error handling
            with patch.object(db_service, '_get_validated_connection') as mock_conn:
                mock_conn.side_effect = sqlite3.Error("Database connection failed")
                
                try:
                    db_service.get_user_by_email("test@example.com")
                    assert False, "Should have raised an exception"
                except sqlite3.Error as e:
                    assert "Database connection failed" in str(e)
                    print("✅ Database connection errors properly handled")
            
            print("🎉 Error handling scenarios test passed!")
            return True

def run_integration_tests():
    """Run all integration tests"""
    print("🚀 Starting Backend Integration Tests for Auth/Token Flows")
    print("=" * 60)
    
    test_instance = TestAuthenticationIntegration()
    test_instance.setUp()
    
    try:
        # Test SQLite flow
        test_instance.test_complete_auth_flow_sqlite()
        print()
        
        # Test PostgreSQL flow (mocked)
        test_instance.test_complete_auth_flow_postgresql()
        print()
        
        # Test error handling
        test_instance.test_error_handling_scenarios()
        print()
        
        print("🎉 ALL INTEGRATION TESTS PASSED!")
        print("✅ Authentication flows work with unified query system")
        print("✅ Token management works with both SQLite and PostgreSQL")
        print("✅ Session management and logout functionality verified")
        print("✅ Error handling robust across all scenarios")
        
        return True
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_integration_tests()
    sys.exit(0 if success else 1)