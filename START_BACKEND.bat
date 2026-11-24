@echo off
title TripNest Backend (FastAPI)
cd /d "%~dp0travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code"
"%USERPROFILE%\tripnest-venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
