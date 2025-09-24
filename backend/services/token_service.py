"""
Token Service - Secure backend token management (Fixed for synchronous database)
"""
import logging
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from .database_service import DatabaseService

# Import token models (adjust path based on your project structure)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from token_models.token_models import (
    TokenBalance, TokenTransaction, TokenTransactionType,
    TokenSpendRequest, TokenSpendResponse, TokenBalanceResponse,
    TokenPurchaseEvent
)

logger = logging.getLogger(__name__)

class TokenService:
    """Service for managing user token balances and transactions"""
    
    def __init__(self, db_service: DatabaseService):
        self.db = db_service
    
    def get_user_balance(self, user_id: str) -> TokenBalanceResponse:
        """
        Get current token balance for a user
        
        Args:
            user_id: User ID to get balance for
            
        Returns:
            TokenBalanceResponse with current balance and last updated time
            
        Raises:
            Exception: For database or service errors
        """
        try:
            result = self.db._execute_select(
                "SELECT balance, last_updated FROM token_balances WHERE user_id = ?",
                (user_id,),
                fetch_one=True
            )
            
            if result:
                logger.debug(f"Retrieved balance for user {user_id}: {result['balance']}")
                return TokenBalanceResponse(
                    balance=result['balance'],
                    last_updated=result['last_updated'].isoformat() if result['last_updated'] else ""
                )
            else:
                # Initialize user with 0 balance if not exists
                logger.info(f"Initializing new user balance for user {user_id}")
                self._initialize_user_balance(user_id)
                from datetime import datetime
                return TokenBalanceResponse(
                    balance=0,
                    last_updated=datetime.utcnow().isoformat()
                )
                
        except Exception as e:
            logger.error(f"Failed to get balance for user {user_id}: {e}")
            raise
    
    def spend_tokens(self, user_id: str, spend_request: TokenSpendRequest) -> TokenSpendResponse:
        """
        Spend tokens with validation and transaction logging
        
        Args:
            user_id: User ID to spend tokens for
            spend_request: Token spend request details
            
        Returns:
            TokenSpendResponse with transaction result
            
        Raises:
            Exception: For database or service errors
        """
        try:
            # Get current balance
            balance_response = self.get_user_balance(user_id)
            current_balance = balance_response.balance
            
            # Validate sufficient balance
            if current_balance < spend_request.amount:
                logger.warning(f"Insufficient tokens for user {user_id}: has {current_balance}, needs {spend_request.amount}")
                return TokenSpendResponse(
                    success=False,
                    transaction_id=None,
                    new_balance=current_balance,
                    message=f"Insufficient tokens. Current: {current_balance}, Required: {spend_request.amount}"
                )
            
            # Calculate new balance
            new_balance = current_balance - spend_request.amount
            transaction_id = str(uuid.uuid4())
            
            # Execute transaction
            self._execute_token_transaction(
                user_id=user_id,
                transaction_id=transaction_id,
                transaction_type=TokenTransactionType.SPEND,
                amount=-spend_request.amount,  # Negative for spending
                balance_before=current_balance,
                balance_after=new_balance,
                description=spend_request.description,
                metadata=spend_request.metadata
            )
            
            logger.info(f"User {user_id} spent {spend_request.amount} tokens. New balance: {new_balance}")
            
            return TokenSpendResponse(
                success=True,
                transaction_id=transaction_id,
                new_balance=new_balance,
                message=f"Successfully spent {spend_request.amount} tokens"
            )
            
        except Exception as e:
            logger.error(f"Failed to spend tokens for user {user_id}: {e}")
            raise

    def add_tokens_from_purchase(self, purchase_event: TokenPurchaseEvent) -> bool:
        """Add tokens from a verified purchase event"""
        try:
            # Get current balance
            balance_response = self.get_user_balance(purchase_event.user_id)
            current_balance = balance_response.balance
            new_balance = current_balance + purchase_event.tokens_purchased
            
            transaction_id = str(uuid.uuid4())
            
            # Execute transaction
            self._execute_token_transaction(
                user_id=purchase_event.user_id,
                transaction_id=transaction_id,
                transaction_type=TokenTransactionType.PURCHASE,
                amount=purchase_event.tokens_purchased,
                balance_before=current_balance,
                balance_after=new_balance,
                description=f"Token purchase: {purchase_event.product_id}",
                metadata={
                    "product_id": purchase_event.product_id,
                    "revenuecat_transaction_id": purchase_event.transaction_id,
                    "purchase_price": purchase_event.purchase_price,
                    "purchase_currency": purchase_event.purchase_currency
                },
                revenuecat_transaction_id=purchase_event.transaction_id,
                revenuecat_product_id=purchase_event.product_id
            )
            
            logger.info(f"Added {purchase_event.tokens_purchased} tokens to user {purchase_event.user_id} from purchase {purchase_event.transaction_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add tokens from purchase for user {purchase_event.user_id}: {e}")
            return False

    def add_tokens_for_testing(self, user_id: str, amount: int, description: str = "Test token addition") -> bool:
        """
        Add tokens for testing purposes
        
        Args:
            user_id: User ID to add tokens to
            amount: Number of tokens to add
            description: Description for the transaction
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get current balance
            balance_response = self.get_user_balance(user_id)
            current_balance = balance_response.balance
            new_balance = current_balance + amount
            
            transaction_id = str(uuid.uuid4())
            
            # Execute transaction
            self._execute_token_transaction(
                user_id=user_id,
                transaction_id=transaction_id,
                transaction_type=TokenTransactionType.PURCHASE,
                amount=amount,
                balance_before=current_balance,
                balance_after=new_balance,
                description=description,
                metadata={"test": True, "method": "add_tokens_for_testing"}
            )
            
            logger.info(f"Added {amount} tokens to user {user_id} for testing")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add tokens for testing to user {user_id}: {e}")
            return False

    def get_transaction_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get transaction history for a user"""
        try:
            results = self.db._execute_select("""
                SELECT transaction_id, transaction_type, amount, balance_before, 
                       balance_after, description, metadata, created_at
                FROM token_transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            """, (user_id, limit), fetch_one=False)
            
            return results or []
            
        except Exception as e:
            logger.error(f"Failed to get transaction history for user {user_id}: {e}")
            raise

    def _initialize_user_balance(self, user_id: str) -> None:
        """Initialize a new user with 0 token balance"""
        try:
            # Use unified UPSERT to handle both PostgreSQL and SQLite
            # Skip update on conflict - just insert if not exists
            try:
                self.db._execute_insert(
                    "INSERT INTO token_balances (user_id, balance) VALUES (?, ?)",
                    (user_id, 0)
                )
            except Exception:
                # User already exists, ignore
                pass
            logger.info(f"Initialized token balance for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize balance for user {user_id}: {e}")
            raise

    def _execute_token_transaction(
        self,
        user_id: str,
        transaction_id: str,
        transaction_type: TokenTransactionType,
        amount: int,
        balance_before: int,
        balance_after: int,
        description: str,
        metadata: Optional[Dict[str, Any]] = None,
        revenuecat_transaction_id: Optional[str] = None,
        revenuecat_product_id: Optional[str] = None
    ) -> None:
        """
        Execute a token transaction atomically with proper validation and error handling
        
        Ensures atomicity by using database transactions and prevents token loss/duplication.
        Validates balance consistency before applying changes.
        """
        operation = "execute_token_transaction"
        
        try:
            # Validate inputs
            if balance_after < 0:
                raise ValueError(f"Transaction would result in negative balance: {balance_after}")
            
            if amount == 0:
                raise ValueError("Transaction amount cannot be zero")
            
            # Prepare transaction data
            metadata_json = json.dumps(metadata or {})
            current_time = datetime.utcnow()
            
            # Execute within database transaction for atomicity
            logger.debug(f"Starting atomic token transaction {transaction_id} for user {user_id}")
            
            # Use database transaction to ensure atomicity
            with self.db.transaction():
                # Verify current balance matches expected balance_before (prevents race conditions)
                current_balance_data = self.db._execute_select(
                    "SELECT balance FROM token_balances WHERE user_id = ?",
                    (user_id,),
                    fetch_one=True
                )
                
                if current_balance_data and current_balance_data['balance'] != balance_before:
                    raise ValueError(
                        f"Balance mismatch detected for user {user_id}: "
                        f"expected {balance_before}, found {current_balance_data['balance']}. "
                        f"Possible concurrent transaction - operation aborted for safety."
                    )
                
                # Update balance using atomic UPSERT (handles both new users and existing users)
                balance_data = {
                    "user_id": user_id,
                    "balance": balance_after,
                    "last_updated": current_time
                }
                
                balance_rows = self.db._execute_upsert(
                    "token_balances", 
                    balance_data,
                    ["user_id"],  # conflict columns
                    ["balance", "last_updated"]  # update columns
                )
                
                # Insert transaction record for audit trail
                transaction_data = {
                    "transaction_id": transaction_id,
                    "user_id": user_id,
                    "transaction_type": transaction_type.value,
                    "amount": amount,
                    "balance_before": balance_before,
                    "balance_after": balance_after,
                    "description": description,
                    "metadata": metadata_json,
                    "revenuecat_transaction_id": revenuecat_transaction_id,
                    "revenuecat_product_id": revenuecat_product_id,
                    "created_at": current_time
                }
                
                transaction_rows = self.db._execute_insert("token_transactions", transaction_data)
                
                # Transaction will be automatically committed by context manager
                
            logger.info(f"Token transaction completed successfully: {transaction_id}")
            logger.debug(f"User {user_id}: {amount} tokens, balance {balance_before} -> {balance_after}")
            
        except Exception as e:
            # Enhanced error logging for debugging
            logger.error(f"Token transaction failed for user {user_id}: {e}")
            logger.error(f"Transaction context: ID={transaction_id}, type={getattr(transaction_type, 'value', transaction_type)}, "
                        f"amount={amount}, balance_before={balance_before}, balance_after={balance_after}")
            
            # Re-raise with enhanced error context
            raise RuntimeError(f"Token transaction failed: {e}") from e