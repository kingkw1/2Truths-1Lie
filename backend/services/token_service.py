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
        """Get current token balance for a user"""
        try:
            result = self.db._execute_select(
                "SELECT balance, last_updated FROM token_balances WHERE user_id = ?",
                (user_id,),
                fetch_one=True
            )
            
            if result:
                return TokenBalanceResponse(
                    balance=result['balance'],
                    last_updated=result['last_updated']
                )
            else:
                # Initialize user with 0 balance if not exists
                self._initialize_user_balance(user_id)
                return TokenBalanceResponse(
                    balance=0,
                    last_updated=datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"Failed to get balance for user {user_id}: {e}")
            raise
    
    def spend_tokens(self, user_id: str, spend_request: TokenSpendRequest) -> TokenSpendResponse:
        """Spend tokens with validation and transaction logging"""
        try:
            # Get current balance
            balance_response = self.get_user_balance(user_id)
            current_balance = balance_response.balance
            
            # Validate sufficient balance
            if current_balance < spend_request.amount:
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
            self.db._execute_upsert(
                "token_balances",
                {"user_id": user_id, "balance": 0},
                ["user_id"],  # conflict columns
                []  # don't update anything if exists
            )
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
        """Execute a token transaction atomically using unified query system"""
        try:
            metadata_json = json.dumps(metadata or {})
            
            # Start atomic transaction
            with self.db.get_connection() as conn:
                cursor = self.db.get_cursor(conn)
                
                # Update balance using unified UPSERT
                balance_data = {
                    "user_id": user_id,
                    "balance": balance_after,
                    "last_updated": datetime.utcnow()
                }
                
                # Use unified UPSERT for balance update (PostgreSQL and SQLite compatible)
                self.db._execute_upsert(
                    "token_balances", 
                    balance_data,
                    ["user_id"],  # conflict columns
                    ["balance", "last_updated"]  # update columns
                )
                
                # Insert transaction record using unified INSERT
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
                    "created_at": datetime.utcnow()
                }
                
                self.db._execute_insert("token_transactions", transaction_data)
                
                conn.commit()
                logger.debug(f"Token transaction executed atomically: {transaction_id}")
                
        except Exception as e:
            logger.error(f"Failed to execute token transaction: {e}")
            raise