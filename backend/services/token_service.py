"""
Token Service - Secure backend token management
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
    
    async def get_user_balance(self, user_id: str) -> TokenBalanceResponse:
        """Get current token balance for a user"""
        try:
            if self.db.db_type == 'postgres':
                query = """
                    SELECT balance, last_updated 
                    FROM token_balances 
                    WHERE user_id = %s
                """
                result = await self.db.execute_query(query, (user_id,))
            else:  # SQLite
                query = """
                    SELECT balance, last_updated 
                    FROM token_balances 
                    WHERE user_id = ?
                """
                result = await self.db.execute_query(query, (user_id,))
            
            if result:
                balance, last_updated = result[0]
                return TokenBalanceResponse(
                    balance=balance,
                    last_updated=last_updated
                )
            else:
                # Initialize user with 0 balance if not exists
                await self._initialize_user_balance(user_id)
                return TokenBalanceResponse(
                    balance=0,
                    last_updated=datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"Failed to get balance for user {user_id}: {e}")
            raise
    
    async def spend_tokens(self, user_id: str, spend_request: TokenSpendRequest) -> TokenSpendResponse:
        """Spend tokens with validation and transaction logging"""
        try:
            # Get current balance
            balance_response = await self.get_user_balance(user_id)
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
            await self._execute_token_transaction(
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
            return TokenSpendResponse(
                success=False,
                transaction_id=None,
                new_balance=current_balance if 'current_balance' in locals() else 0,
                message=f"Failed to spend tokens: {str(e)}"
            )
    
    async def add_tokens_from_purchase(self, purchase_event: TokenPurchaseEvent) -> bool:
        """Add tokens from a verified RevenueCat purchase"""
        try:
            # Get current balance
            balance_response = await self.get_user_balance(purchase_event.user_id)
            current_balance = balance_response.balance
            new_balance = current_balance + purchase_event.tokens_purchased
            
            transaction_id = str(uuid.uuid4())
            
            # Create purchase metadata
            metadata = {
                "product_id": purchase_event.product_id,
                "revenuecat_transaction_id": purchase_event.transaction_id,
                "purchase_price": purchase_event.purchase_price,
                "purchase_currency": purchase_event.purchase_currency
            }
            
            # Execute transaction
            await self._execute_token_transaction(
                user_id=purchase_event.user_id,
                transaction_id=transaction_id,
                transaction_type=TokenTransactionType.PURCHASE,
                amount=purchase_event.tokens_purchased,
                balance_before=current_balance,
                balance_after=new_balance,
                description=f"Token purchase: {purchase_event.product_id}",
                metadata=metadata,
                revenuecat_transaction_id=purchase_event.transaction_id,
                revenuecat_product_id=purchase_event.product_id
            )
            
            logger.info(f"Added {purchase_event.tokens_purchased} tokens to user {purchase_event.user_id} from purchase {purchase_event.transaction_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add tokens from purchase: {e}")
            return False
    
    async def get_transaction_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get transaction history for a user"""
        try:
            if self.db.db_type == 'postgres':
                query = """
                    SELECT transaction_id, transaction_type, amount, balance_before, 
                           balance_after, description, metadata, created_at
                    FROM token_transactions 
                    WHERE user_id = %s 
                    ORDER BY created_at DESC 
                    LIMIT %s
                """
                results = await self.db.execute_query(query, (user_id, limit))
            else:  # SQLite
                query = """
                    SELECT transaction_id, transaction_type, amount, balance_before, 
                           balance_after, description, metadata, created_at
                    FROM token_transactions 
                    WHERE user_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT ?
                """
                results = await self.db.execute_query(query, (user_id, limit))
            
            transactions = []
            for row in results:
                transaction = {
                    "transaction_id": row[0],
                    "transaction_type": row[1],
                    "amount": row[2],
                    "balance_before": row[3],
                    "balance_after": row[4],
                    "description": row[5],
                    "metadata": json.loads(row[6]) if row[6] else {},
                    "created_at": row[7]
                }
                transactions.append(transaction)
            
            return transactions
            
        except Exception as e:
            logger.error(f"Failed to get transaction history for user {user_id}: {e}")
            return []
    
    async def _initialize_user_balance(self, user_id: str) -> None:
        """Initialize a user's token balance to 0"""
        try:
            if self.db.db_type == 'postgres':
                query = """
                    INSERT INTO token_balances (user_id, balance, last_updated, created_at)
                    VALUES (%s, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id) DO NOTHING
                """
                await self.db.execute_query(query, (user_id,))
            else:  # SQLite
                query = """
                    INSERT OR IGNORE INTO token_balances (user_id, balance, last_updated, created_at)
                    VALUES (?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
                await self.db.execute_query(query, (user_id,))
                
        except Exception as e:
            logger.error(f"Failed to initialize balance for user {user_id}: {e}")
            raise
    
    async def _execute_token_transaction(
        self, 
        user_id: str, 
        transaction_id: str, 
        transaction_type: TokenTransactionType,
        amount: int,
        balance_before: int,
        balance_after: int,
        description: str,
        metadata: Dict[str, Any],
        revenuecat_transaction_id: Optional[str] = None,
        revenuecat_product_id: Optional[str] = None
    ) -> None:
        """Execute a token transaction atomically"""
        try:
            metadata_json = json.dumps(metadata)
            
            if self.db.db_type == 'postgres':
                # Start transaction
                async with self.db.get_connection() as conn:
                    async with conn.transaction():
                        # Insert transaction record
                        await conn.execute("""
                            INSERT INTO token_transactions 
                            (transaction_id, user_id, transaction_type, amount, 
                             balance_before, balance_after, description, metadata,
                             revenuecat_transaction_id, revenuecat_product_id, created_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                        """, transaction_id, user_id, transaction_type.value, amount,
                            balance_before, balance_after, description, metadata_json,
                            revenuecat_transaction_id, revenuecat_product_id)
                        
                        # Update balance
                        await conn.execute("""
                            INSERT INTO token_balances (user_id, balance, last_updated)
                            VALUES ($1, $2, CURRENT_TIMESTAMP)
                            ON CONFLICT (user_id) 
                            DO UPDATE SET balance = $2, last_updated = CURRENT_TIMESTAMP
                        """, user_id, balance_after)
            else:  # SQLite
                # SQLite transaction
                async with self.db.get_connection() as conn:
                    await conn.execute("BEGIN TRANSACTION")
                    try:
                        # Insert transaction record
                        await conn.execute("""
                            INSERT INTO token_transactions 
                            (transaction_id, user_id, transaction_type, amount, 
                             balance_before, balance_after, description, metadata,
                             revenuecat_transaction_id, revenuecat_product_id, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """, (transaction_id, user_id, transaction_type.value, amount,
                              balance_before, balance_after, description, metadata_json,
                              revenuecat_transaction_id, revenuecat_product_id))
                        
                        # Update balance
                        await conn.execute("""
                            INSERT OR REPLACE INTO token_balances (user_id, balance, last_updated)
                            VALUES (?, ?, CURRENT_TIMESTAMP)
                        """, (user_id, balance_after))
                        
                        await conn.execute("COMMIT")
                    except Exception:
                        await conn.execute("ROLLBACK")
                        raise
                        
        except Exception as e:
            logger.error(f"Failed to execute token transaction: {e}")
            raise