# TripNest Project — Setup & Run Guide for Another PC

This guide walks you through setting up and running the entire **TripNest** project (Mobile App, Python FastAPI Backend, and React Web Dashboard) on a new or different PC.

---

## 📋 Table of Contents
1. [System Prerequisites](#1-system-prerequisites)
2. [What to Copy to the New PC](#2-what-to-copy-to-the-new-pc)
3. [Backend Setup (FastAPI Python)](#3-backend-setup-fastapi-python)
4. [Mobile App Setup (Expo React Native)](#4-mobile-app-setup-expo-react-native)
5. [Connecting Mobile App to the Backend](#5-connecting-mobile-app-to-the-backend)
6. [Web Dashboard Setup (Vite React - Optional)](#6-web-dashboard-setup-vite-react---optional)
7. [Troubleshooting & FAQs](#7-troubleshooting--faqs)

---

## 1. System Prerequisites

Install the following software on the new PC:

1. **Node.js (LTS version: 20.x or 22.x)**
   - Download & install: [https://nodejs.org/](https://nodejs.org/)
   - Verify in terminal:
     ```bash
     node -v
     npm -v
     ```

2. **Python (3.11 recommended)**
   - Download & install: [https://www.python.org/downloads/](https://www.python.org/downloads/)
   - ⚠️ **CRITICAL:** Check the box **"Add Python to PATH"** during installation!
   - Verify in terminal:
     ```bash
     python --version
     ```

3. **Git (Optional but recommended)**
   - Download & install: [https://git-scm.com/](https://git-scm.com/)

4. **Testing on Mobile Device / Emulator:**
   - **On your physical phone:** Install the **Expo Go** app from Google Play Store (Android) or App Store (iOS).
   - **OR on PC Emulator:** Install **Android Studio** with an Android Virtual Device (AVD).

---

## 2. What to Copy to the New PC

When copying the project folder via USB drive, ZIP, or Git:

### ✅ DO Copy:
- All source files, assets, datasets, and scripts.
- The `.env` files (these contain API keys and database credentials).

### ❌ DO NOT Copy (Delete or exclude these before copying):
- `venv/` (Python virtual environments contain hardcoded file paths from the original machine; **must be recreated**).
- `node_modules/` (Node dependencies are large and OS-dependent; **must be reinstalled via `npm install`**).
- `.expo/` (Cache folders generated automatically).

---

## 3. Backend Setup (FastAPI Python)

### Step 3.1: Open Terminal in the Backend Folder
```bash
# If using PowerShell/CMD, navigate to the backend folder:
cd "travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code"
```

### Step 3.2: Create a Fresh Virtual Environment
```bash
# Windows:
python -m venv venv

# Activate the virtual environment:
.\venv\Scripts\activate
```
*(You will see `(venv)` appear at the beginning of your terminal prompt).*

### Step 3.3: Install Dependencies
Run the following command to install all necessary packages:
```bash
pip install fastapi uvicorn ortools pydantic motor dnspython pymongo requests pandas openpyxl google-auth google-genai httpx
```

### Step 3.4: Verify `.env` File
Make sure a `.env` file exists in the backend root directory (`travel-intelligence-backend for vs code\.env`) with the following keys:
```env
GOOGLE_CLIENT_ID=key
MONGODB_URI=uri
MONGODB_DB_NAME="travelIntelligence"
OPENWEATHER_API_KE-key
SERPAPI_API_KEY=key
GEMINI_API_KEY=key
```

### Step 3.5: Run the Backend Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Open your browser at `http://localhost:8000/docs` to see the interactive Swagger API documentation.
- Using `--host 0.0.0.0` ensures the backend can receive connections from your phone or emulator on the local network.

---

## 4. Mobile App Setup (Expo React Native)

### Step 4.1: Open a New Terminal in the Mobile Folder
Open a separate terminal window:
```bash
cd "tripnest-mobile"
```

### Step 4.2: Install NPM Dependencies
```bash
npm install
```

### Step 4.3: Start the Expo Development Server
```bash
npx expo start
```
This opens the Expo interactive CLI with a QR code in your terminal.

---

## 5. Connecting Mobile App to the Backend

The mobile app environment is configured in:
`tripnest-mobile/src/config/env.js`

### Option A: Offline Mock Mode (No backend needed)
If you just want to run the mobile app without the Python backend:
In `tripnest-mobile/src/config/env.js`:
```javascript
export const CURRENT_ENV = ENVIRONMENTS.MOCK
```

---

### Option B: Real Backend Connection
To connect the mobile app to your live backend:

1. In `tripnest-mobile/src/config/env.js`:
   ```javascript
   export const CURRENT_ENV = ENVIRONMENTS.ISOLATED_DEV
   ```

2. Set `ISOLATED_API_BASE_URL` depending on where you are running the app:

   * **Scenario 1: Testing on a Physical Phone via Expo Go**
     - Both your PC and phone **must be on the same Wi-Fi network**.
     - Find your PC's local IP address:
       Open PowerShell/CMD and type: `ipconfig`
       Look for `IPv4 Address` (e.g. `192.168.1.15`).
     - Set the URL:
       ```javascript
       export const ISOLATED_API_BASE_URL = 'http://192.168.1.15:8000'
       ```

   * **Scenario 2: Testing on Android Studio Emulator**
     - Android emulators access the host PC using the special IP `10.0.2.2`:
       ```javascript
       export const ISOLATED_API_BASE_URL = 'http://10.0.2.2:8000'
       ```

   * **Scenario 3: Testing on Web or iOS Simulator**
     - ```javascript
       export const ISOLATED_API_BASE_URL = 'http://localhost:8000'
       ```

### Step 4.4: Launch the App
In the terminal where `npx expo start` is running:
- **Scan the QR Code** with your phone's camera (iOS) or the **Expo Go** app (Android).
- Or press `a` to open in Android Emulator.
- Or press `w` to open in a web browser.

---

## 6. Web Dashboard Setup (Vite React - Optional)

If you also wish to run the Web frontend:

### Step 6.1: Navigate to Web Folder
Open a terminal in:
```bash
cd "travel-intelligence-backend for vs code back up 1\travel-intelligence-backend for vs code\travel-intelligence-react"
```

### Step 6.2: Install & Run
```bash
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 7. Troubleshooting & FAQs

### Q1: `ModuleNotFoundError` when starting the backend
Make sure your virtual environment is active `(venv)` and reinstall missing packages:
```bash
pip install fastapi uvicorn ortools pydantic motor dnspython pymongo requests pandas openpyxl google-auth google-genai httpx
```

### Q2: Phone cannot connect to backend (`Network Error` / Timeout)
1. Ensure both your PC and Phone are connected to the exact **same Wi-Fi router**.
2. Make sure Windows Firewall is not blocking port 8000. You can temporarily test by allowing Python or port 8000 in Windows Defender Firewall.
3. Make sure the backend was started with `--host 0.0.0.0` (not `127.0.0.1`).

### Q3: `npm install` fails or Expo has dependency conflicts
Run:
```bash
npx expo install --fix
```

### Q4: Port 8000 is already in use
Run backend on a different port:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```
*(Remember to update the port in `env.js` as well).*
