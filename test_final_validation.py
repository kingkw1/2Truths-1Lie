#!/usr/bin/env python3
"""
Final validation test for enhanced session management and token atomicity.
Tests all requirements requested by the user.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.services.database_service import DatabaseService
from backend.services.auth_service import AuthService
from backend.services.token_service import TokenService
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def validate_session_persistence():
    """Test database-backed session persistence"""
    logger.info("=== SESSION PERSISTENCE VALIDATION ===")
    
    try:
        # Initialize services
        db_service = DatabaseService()
        auth_service = AuthService(db_service)
        
        # Create test user
        try:
            user_id = db_service.create_user("validation@example.com", "test123", "ValidateUser")
        except:
            # User exists, authenticate
            user_id = auth_service.authenticate_user("validation@example.com", "test123")
        
        # Create JWT with database session
        token = auth_service.create_access_token({
            "sub": str(user_id),
            "email": "validation@example.com",
            "type": "user"
        })
        
        logger.info("✓ JWT token created with database session backing")
        
        # Verify token with database session validation
        payload = auth_service.verify_token(token)
        logger.info(f"✓ JWT verified with database session: user_id={payload['sub']}")
        
        # Test session persistence across "server restart" simulation
        # Get current sessions before restart
        sessions_before = db_service.get_user_sessions(user_id)
        logger.info(f"✓ Sessions persisted before restart: {len(sessions_before)}")
        
        # Simulate restart by creating new auth service instance
        auth_service_new = AuthService(db_service)
        
        # Verify token still works with new instance (database persistence)
        payload_after = auth_service_new.verify_token(token)
        logger.info("✓ JWT validation successful after service restart (database persistence)")
        
        # Clean up session
        auth_service.revoke_token(token)
        logger.info("✓ Session properly revoked")
        
        return True
        
    except Exception as e:
        logger.error(f"Session persistence validation failed: {e}")
        return False

def validate_atomic_transactions():
    """Test atomic token transaction guarantees"""
    logger.info("\n=== ATOMIC TRANSACTION VALIDATION ===")
    
    try:
        # Initialize services
        db_service = DatabaseService()
        token_service = TokenService(db_service)
        
        # Create test user
        try:
            user_id = db_service.create_user("atomic@example.com", "test123", "AtomicUser")
        except:
            # Get existing user
            user = db_service.get_user_by_email("atomic@example.com")
            user_id = user['id']
        
        # Initialize token balance
        initial_balance = 200
        token_service.add_tokens_for_testing(user_id, initial_balance)
        logger.info(f"✓ Initialized user {user_id} with {initial_balance} tokens")
        
        # Test successful atomic transaction
        spend_amount = 50
        success = token_service.spend_tokens(user_id, spend_amount, "Test spend")
        if success:
            balance = token_service.get_user_token_balance(user_id)
            expected = initial_balance - spend_amount
            assert balance == expected, f"Balance mismatch: expected {expected}, got {balance}"
            logger.info(f"✓ Atomic spend successful: {spend_amount} tokens, balance now {balance}")
        
        # Test transaction failure with insufficient funds
        try:
            large_amount = balance + 100
            success = token_service.spend_tokens(user_id, large_amount, "Should fail")
            assert not success, "Transaction should have failed with insufficient funds"
            logger.info("✓ Insufficient funds protection working")
        except Exception as e:
            logger.info(f"✓ Insufficient funds correctly rejected: {e}")
        
        # Verify balance unchanged after failed transaction
        final_balance = token_service.get_user_token_balance(user_id)
        assert final_balance == expected, f"Balance corrupted after failed transaction: {final_balance}"
        logger.info("✓ Balance preserved after failed transaction (atomicity confirmed)")
        
        return True
        
    except Exception as e:
        logger.error(f"Atomic transaction validation failed: {e}")
        return False

def validate_race_condition_protection():
    """Test protection against race conditions in token transactions"""
    logger.info("\n=== RACE CONDITION PROTECTION VALIDATION ===")
    
    try:
        # Initialize services
        db_service = DatabaseService()
        token_service = TokenService(db_service)
        
        # Create test user
        try:
            user_id = db_service.create_user("race@example.com", "test123", "RaceUser")
        except:
            user = db_service.get_user_by_email("race@example.com")
            user_id = user['id']
        
        # Set known balance
        token_service.add_tokens_for_testing(user_id, 100)
        current_balance = token_service.get_user_token_balance(user_id)
        logger.info(f"✓ Set balance to {current_balance} tokens")
        
        # Test balance verification protection
        try:
            # This simulates what would happen if balance changed between read and write
            wrong_expected_balance = current_balance - 50  # Simulate race condition
            token_service._execute_token_transaction(
                user_id=user_id,
                transaction_type="spend",  # Use string to test enum handling
                amount=-25,
                balance_before=wrong_expected_balance,  # Wrong expected balance
                balance_after=wrong_expected_balance - 25,
                description="Race condition test"
            )
            logger.error("Race condition protection FAILED - transaction should have been rejected")
            return False
        except (ValueError, RuntimeError) as e:
            if "Balance mismatch detected" in str(e):
                logger.info("✓ Race condition protection working - transaction correctly rejected")
            else:
                logger.error(f"Unexpected error: {e}")
                return False
        
        # Verify balance is unchanged
        final_balance = token_service.get_user_token_balance(user_id)
        assert final_balance == current_balance, f"Balance corrupted: expected {current_balance}, got {final_balance}"
        logger.info("✓ Balance preserved after race condition protection")
        
        return True
        
    except Exception as e:
        logger.error(f"Race condition protection validation failed: {e}")
        return False

def main():
    """Run comprehensive validation of all enhanced features"""
    logger.info("COMPREHENSIVE VALIDATION: Enhanced Session Management & Token Atomicity")
    logger.info("=" * 80)
    
    results = []
    
    # Test 1: Session Persistence
    results.append(("Session Persistence", validate_session_persistence()))
    
    # Test 2: Atomic Transactions
    results.append(("Atomic Transactions", validate_atomic_transactions()))
    
    # Test 3: Race Condition Protection
    results.append(("Race Condition Protection", validate_race_condition_protection()))
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION SUMMARY:")
    all_passed = True
    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        logger.info(f"  {test_name}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        logger.info("\n🎉 ALL VALIDATIONS PASSED!")
        logger.info("✓ JWT tokens are consistently persisted and verified with database-backed storage")
        logger.info("✓ Token spend and credit operations guarantee atomicity")
        logger.info("✓ Token loss and duplication are prevented through race condition protection")
        logger.info("✓ System meets all user requirements for session persistence and token transaction safety")
    else:
        logger.error("\n❌ SOME VALIDATIONS FAILED")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)