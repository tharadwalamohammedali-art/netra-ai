"""
NETRA AI — Python FastAPI Implementation
Alternative backend implementation for environments with native Python support.
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os

from .models import (
    UrlScanRequest,
    MessageScanRequest,
    QrScanRequest,
    UserSignupRequest,
    UserLoginRequest,
    ShareMessageRequest,
    AppealRequest
)

app = FastAPI(
    title="NETRA AI API",
    description="AI-powered scam detection, phishing prevention, and fraud protection with Gemma 3:1B and deterministic rules.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "app": "NETRA AI (FastAPI)",
        "model_contract": "Gemma 3:1B",
        "local_gemma_runtime": "llama.cpp on port 8080 (or simulated contract adapter)"
    }

@app.get("/api/info")
def info():
    return {
        "model": "Gemma 3:1B",
        "runtime": "llama.cpp (GGUF format) or Transformers",
        "disclaimer": "URL appearance or small model heuristics cannot guarantee 100% scam prevention."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=3000, reload=True)
