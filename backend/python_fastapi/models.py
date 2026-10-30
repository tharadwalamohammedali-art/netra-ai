from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class Gemma3AnalysisResponse(BaseModel):
    risk_score: int = Field(ge=0, le=100)
    severity: str = Field(pattern="^(Low|Medium|High|Critical)$")
    suspected_category: str
    evidence: List[str]
    explanation: str
    recommended_actions: List[str]
    uncertainty: str = Field(pattern="^(Low|Medium|High)$")
    model: str = "Gemma 3:1B"
    engine_status: str

class UrlScanRequest(BaseModel):
    url: str = Field(max_length=2048)

class MessageScanRequest(BaseModel):
    message: str = Field(max_length=50000)

class QrScanRequest(BaseModel):
    payload: str = Field(max_length=50000)

class UserSignupRequest(BaseModel):
    email: str
    password: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class ShareMessageRequest(BaseModel):
    recipientEmail: str
    content: str
    confirmSend: bool = False

class AppealRequest(BaseModel):
    messageId: str
    reason: str
