"""
Token Management Models for secure backend token storage
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TokenTransactionType(str, Enum):
    """Types of token transactions"""
    PURCHASE = "purchase"
    SPEND = "spend"
    ADJUSTMENT = "adjustment"
    REFUND = "refund"

class TokenBalance(BaseModel):
    """User's current token balance"""
    user_id: str = Field(..., description="Unique user identifier")
    balance: int = Field(..., ge=0, description="Current token balance")
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class TokenTransaction(BaseModel):
    """Record of a token transaction"""
    model_config = ConfigDict(use_enum_values=True)
    
    transaction_id: str = Field(..., description="Unique transaction identifier")
    user_id: str = Field(..., description="User who performed the transaction")
    transaction_type: TokenTransactionType = Field(..., description="Type of transaction")
    amount: int = Field(..., description="Token amount (positive for credits, negative for debits)")
    balance_before: int = Field(..., ge=0, description="Balance before transaction")
    balance_after: int = Field(..., ge=0, description="Balance after transaction")
    description: str = Field(..., description="Human-readable transaction description")
    metadata: dict = Field(default_factory=dict, description="Additional transaction data")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # RevenueCat integration fields
    revenuecat_transaction_id: Optional[str] = Field(None, description="RevenueCat transaction ID")
    revenuecat_product_id: Optional[str] = Field(None, description="RevenueCat product identifier")

class TokenSpendRequest(BaseModel):
    """Request to spend tokens"""
    amount: int = Field(..., gt=0, description="Number of tokens to spend")
    description: str = Field(..., min_length=1, max_length=255, description="Purpose of spending")
    metadata: dict = Field(default_factory=dict, description="Additional spend context")

class TokenSpendResponse(BaseModel):
    """Response after spending tokens"""
    success: bool = Field(..., description="Whether the spend was successful")
    transaction_id: Optional[str] = Field(None, description="Transaction ID if successful")
    new_balance: int = Field(..., ge=0, description="User's balance after transaction")
    message: str = Field(..., description="Success or error message")

class TokenBalanceResponse(BaseModel):
    """Response containing user's token balance"""
    balance: int = Field(..., ge=0, description="Current token balance")
    last_updated: datetime = Field(..., description="When balance was last modified")

class RevenueCatWebhookEvent(BaseModel):
    """RevenueCat webhook event payload"""
    api_version: str = Field(..., description="RevenueCat API version")
    event: dict = Field(..., description="Event data from RevenueCat")
    
class TokenPurchaseEvent(BaseModel):
    """Processed token purchase from RevenueCat webhook"""
    user_id: str = Field(..., description="User who made the purchase")
    product_id: str = Field(..., description="Product purchased")
    transaction_id: str = Field(..., description="RevenueCat transaction ID")
    tokens_purchased: int = Field(..., gt=0, description="Number of tokens purchased")
    purchase_price: Optional[str] = Field(None, description="Price paid (for logging)")
    purchase_currency: Optional[str] = Field(None, description="Currency used")