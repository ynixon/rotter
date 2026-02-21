
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
