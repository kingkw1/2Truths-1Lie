from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class User(BaseModel):
    id: int
    email: str
    name: Optional[str]
    score: int
    is_premium: bool
    created_at: datetime
    is_active: bool
    last_login: Optional[datetime]

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    score: Optional[int] = None