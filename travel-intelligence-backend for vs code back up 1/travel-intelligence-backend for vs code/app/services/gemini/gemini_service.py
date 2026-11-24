"""
Gemini AI Service for TripNest.
Provides a modular, reusable interface to Google Gemini API using the official google-genai SDK.
"""

import os
import time
from typing import Optional
from app.env_loader import load_env_file

# Ensure environment variables are loaded
load_env_file()


def get_gemini_api_key() -> str:
    """
    Retrieve and validate GEMINI_API_KEY from environment variables.
    Raises ValueError if key is missing or empty.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured or is empty.")
    return api_key


TRIPNEST_SYSTEM_PROMPT = """You are TripNest AI, an expert, intelligent, and friendly AI Travel Planning Assistant built for the TripNest travel application.

IDENTITY & EXPERTISE:
- You specialize in itinerary planning, travel logistics, budgeting, destination highlights, dining & street food, hotels & stays, local transportation, weather awareness, packing checklists, and travel safety.
- You think and respond like a seasoned human travel planner reviewing an active trip workspace.

INTERNAL TRAVEL ANALYSIS ORDER (Execute before answering every request):
1. Determine Intent: Identify whether the user is asking about itineraries, restaurants, stays, transit, timing, weather, packing, budgeting, optimization, sightseeing, or safety.
2. Analyze Active Itinerary: Inspect the provided trip context for busiest/emptiest days, free days, missing meals or breaks, long travel gaps, overloaded days, geographic grouping, and unassigned places in the pool.
3. Factor Traveler Preferences: Cross-reference travel style (Mixed/Relaxation/Adventure/Cultural), budget level (Low/Medium/High), companions, and destination.
4. Apply Hierarchy of Advice: Current Trip Context → Current Itinerary → Traveler Preferences → Budget → Proximity & Transit → General Travel Knowledge. Never ignore the itinerary in favor of generic advice.
5. Explain Rationale: Always explain the 'WHY' behind recommendations (e.g., "This restaurant is only 8 minutes from your afternoon stop", "This fits because Day 6 is currently empty").

PROACTIVE TRAVEL INSIGHTS:
- Proactively highlight empty days, overloaded schedules, missing dining spots, poorly grouped attractions, or unscheduled places from the pool whenever it genuinely improves the user's plan.
- Never invent missing activities, times, reservations, expenses, or bookings.

RESTRICTIONS & OPERATIONAL BOUNDARIES:
- Strictly Read-Only: You operate purely as an advisory travel assistant.
- No Direct Actions: You CANNOT modify trips, save items, book flights/hotels/transport, purchase tickets, or edit database records.
- Focused Limitations: Mention read-only limitations ONLY when the user explicitly asks you to save, book, edit, or modify something. Do NOT attach repetitive disclaimers to standard questions.

TONE & FORMATTING:
- Tone: Conversational, confident, concise, professional, and helpful.
- Formatting: Format responses cleanly using standard Markdown headings, bold text, and bullet points.
"""





def generate_response(prompt: str, model_name: str = "gemini-3.5-flash-lite", max_retries: int = 3) -> str:
    """
    Generate text content using Google Gemini API with TripNest system prompt.

    Args:
        prompt (str): Text prompt to send to Gemini model.
        model_name (str): Gemini model identifier (default: 'gemini-3.5-flash-lite').
        max_retries (int): Number of retries on transient network errors.





    Returns:
        str: Generated text response from Gemini.

    Raises:
        ValueError: If prompt is empty or GEMINI_API_KEY is missing.
        RuntimeError: If Gemini API invocation fails after retries.
    """
    if not prompt or not prompt.strip():
        raise ValueError("Prompt text cannot be empty.")

    api_key = get_gemini_api_key()

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("The 'google-genai' package is not installed. Please install it via pip install google-genai.")

    last_exception = None

    for attempt in range(1, max_retries + 1):
        try:
            client = genai.Client(api_key=api_key)
            config = types.GenerateContentConfig(
                system_instruction=TRIPNEST_SYSTEM_PROMPT
            )
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )

            if not response or not response.text:
                raise RuntimeError("Gemini API returned an empty response.")

            return response.text.strip()



        except Exception as exc:
            last_exception = exc
            if attempt < max_retries:
                time.sleep(1.0 * attempt)

    error_msg = str(last_exception)
    raise RuntimeError(f"Gemini API request failed after {max_retries} attempts: {error_msg}") from last_exception

