"""
AI Routes for TripNest.
Provides thin API endpoints wrapping Gemini AI backend service.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.services.gemini.gemini_service import generate_response


router = APIRouter(prefix="/api/ai", tags=["AI"])


class AIChatRequest(BaseModel):
    prompt: str = Field(..., description="User prompt text for AI chat")
    trip_context: Optional[str] = Field(None, description="Optional read-only trip summary context")


class AIChatResponse(BaseModel):
    response: str = Field(..., description="AI generated text response")


@router.post("/chat", response_model=AIChatResponse, status_code=status.HTTP_200_OK)
async def ai_chat_endpoint(request: AIChatRequest):
    """
    Thin wrapper endpoint exposing Gemini AI response generation.
    Accepts: {"prompt": "...", "trip_context": "..."}
    Returns: {"response": "..."}
    """
    if not request.prompt or not request.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt text cannot be empty."
        )

    prompt = request.prompt.strip()
    full_prompt = prompt
    if request.trip_context and request.trip_context.strip():
        full_prompt = f"[CURRENT USER TRIP CONTEXT: {request.trip_context.strip()}]\n\nUser Question: {prompt}"

    try:
        generated_text = generate_response(full_prompt)
        return AIChatResponse(response=generated_text)

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        ) from val_err
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(run_err)
        ) from run_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing AI request: {exc}"
        ) from exc
