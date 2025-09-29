"""
Pydantic models for RevenueCat webhook events.
"""
from pydantic import BaseModel, Field
from typing import Optional, List

class RevenueCatEvent(BaseModel):
    """
    Represents the 'event' part of a RevenueCat webhook.
    """
    id: str
    type: str
    app_user_id: str = Field(..., alias="app_user_id")
    product_id: str = Field(..., alias="product_id")

class RevenueCatWebhook(BaseModel):
    """
    Top-level model for a RevenueCat webhook payload.
    """
    event: RevenueCatEvent
    api_version: str