@echo off
title TripNest System Launcher
echo ===================================================
echo           Starting TripNest Full System
echo ===================================================
echo.
echo [1/2] Launching Python FastAPI Backend on http://0.0.0.0:8000...
start "TripNest Backend (FastAPI)" cmd /k "cd /d ""%~dp0travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code"" && ""%USERPROFILE%\tripnest-venv\Scripts\python.exe"" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching Expo React Native Mobile App...
start "TripNest Mobile (Expo Metro)" cmd /k "cd /d ""%~dp0tripnest-mobile"" && npx expo start"

echo.
echo ===================================================
echo  TripNest is now running!
echo  - Backend API: http://localhost:8000/docs
echo  - Expo Bundler: http://localhost:8081
echo ===================================================
echo.
pause
