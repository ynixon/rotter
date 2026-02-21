
---

# RSS Feed Ticker (Rotter News)

## Overview
This project provides a modern web-based interface to display Rotter News RSS feed titles using Flask, jQuery, and feedparser (`RotterWeb.py`). The application features a responsive design with light/dark theme support and offline capabilities.

## Features
- Modern, responsive web interface with light/dark theme support
- Fetches RSS feed from Rotter.net
- Displays news headlines with timestamps in an animated ticker format
- Swipe/tap left-right to navigate between headlines; left half = previous, right half = next
- Expand chevron to fetch and display the full article body on demand
- Adjustable time-range filter (1 / 2 / 4 / 8 / 16 hours back) — persisted across sessions
- Message counter showing current position (e.g. 3 / 12)
- Automatically highlights new headlines
- Offline mode with local storage for continued viewing when disconnected
- Connection status monitoring with automatic reconnection
- Mobile-friendly design with optimized layout for different screen sizes
- Background auto-refresh for latest news updates

### Android App Features
- Full-screen card-based ticker with Tinder-style slide and fade animations
- Swipe or tap left/right zones to navigate headlines
- Expand chevron fetches the full article body from rotter.net on demand
- Adjustable hours-back range spinner (1 / 2 / 4 / 8 / 16 h), preference persisted
- Auto-advance timer (5 s normal, 10 s when card is expanded)
- Night/day theme toggle persisted across launches
- Message counter (e.g. 3 / 12)

## Dependencies
### Python Packages
- Flask (Web framework for `RotterWeb.py`)
- feedparser (RSS feed parser for both versions)
- tkinter (Standard GUI library for `RotterWin.pyw`)

## Setup and Run

### Using Docker (For `RotterWeb.py`)

#### Dockerizing Rotter News Web Interface
We've provided a Dockerfile to facilitate the dockerization of the Rotter News web application:

```Dockerfile
# Use an official Python runtime as the base image
FROM python:3.8-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Set the default command to run when the container starts
CMD ["python", "RotterWeb.py"]
```

#### Building and Running the Docker Container
Build the Docker image:
```
docker build -t rotter-news-web .
```

Run the Docker container in the background:
```
docker run -d --restart always --name Rotter_News_Web rotter-news-web
```
This will run the Rotter News web application in a Docker container. The container will always restart if it stops for any reason.

### Without Docker

#### For `RotterWeb.py` (Web Interface):
1. Clone the repo.
2. Navigate to the project directory.
3. Install dependencies: `pip install -r requirements.txt`
4. Run the Flask app: `python RotterWeb.py`
5. Open a browser and go to `http://127.0.0.1:3000/`

#### For `RotterWin.pyw` (Windows Desktop Interface):
1. Clone the repo.
2. Navigate to the project directory.
3. Install dependencies: `pip install -r requirements.txt`
4. Run the desktop app: `RotterWin.pyw`
5. Observe the Rotter News ticker on the top of your desktop screen.

#### For the Android App (`android/app/src/main/java/com/ynixon/rotter/MainActivity.java`):
The Android app is a standalone native application that fetches and displays Rotter News headlines.

**Build via GitHub Actions (recommended):**
1. Push changes to `android/**` or trigger manually via `workflow_dispatch`.
2. Download the `rotter-news-apk` artifact from the Actions run (CI builds on feature branches).
3. On pushes to `main`/`master` a GitHub Release is created automatically with the APK attached.
4. Sideload the APK on your Android device (enable *Install from unknown sources* in Settings first).

**Build locally:**
1. Install [Android Studio](https://developer.android.com/studio) with SDK Platform 34 and Build-Tools 34.0.0.
2. Navigate to the `android/` directory.
3. Run `./gradlew assembleRelease`.
4. Install the APK: `adb install app/build/outputs/apk/release/rotter-news-<version>.apk`.

> The release build is signed with the persistent debug keystore (`android/keystore/debug.keystore`)
> so repeated installs upgrade in-place without requiring an uninstall.

---

## Deploying Online (Free Hosting)

The web app is already live at **https://rotter.onrender.com/** — free-tier deployment on [Render](https://render.com).

### Render.com (recommended — already configured)

The repository includes a `render.yaml` and `Dockerfile` that automate the entire setup.

**One-click deploy:**
1. Fork or push this repo to your GitHub account.
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect your GitHub repo.
3. Render detects `render.yaml` automatically and creates the web service.
4. Click **Apply** — done. Your live URL appears in the Render dashboard within a few minutes.

**Manual deploy (without Blueprint):**
1. **New → Web Service** → connect your GitHub repo.
2. Set **Environment** → `Docker` (the `Dockerfile` is at the repo root).
3. **Instance type** → Free.
4. Leave the default port — the `Dockerfile` exposes port `10000` and `render.yaml` sets `PORT=10000`.
5. Click **Create Web Service**.

> **Note:** Render free-tier services spin down after 15 minutes of inactivity and take ~30 s to wake on the next request. Upgrade to the paid Starter plan to keep the service always-on.

---

### Other Free Hosting Options

| Platform | How to deploy |
|---|---|
| **[Railway](https://railway.app)** | New project → Deploy from GitHub repo → Railway auto-detects the `Dockerfile`. Free tier includes 500 h/month. |
| **[Fly.io](https://fly.io)** | `fly launch` in the project root (detects Dockerfile), then `fly deploy`. Free allowance covers a small always-on instance. |
| **[Koyeb](https://www.koyeb.com)** | New app → GitHub → select repo → Runtime: Docker. Free nano instance available. |
| **[Hugging Face Spaces](https://huggingface.co/spaces)** | Create a Space with SDK = Docker, push the repo. Free CPU instances. |

All options above use the existing `Dockerfile` without any code changes.

---
