
---

# RSS Feed Ticker (Rotter News)

## Overview
This project provides a modern web-based interface to display Rotter News RSS feed titles using Flask, jQuery, and feedparser (`RotterWeb.py`). The application features a responsive design with light/dark theme support and offline capabilities.

## Features
- Modern, responsive web interface with light/dark theme support
- Fetches RSS feed from Rotter.net
- Displays news headlines with timestamps in an animated ticker format
- Automatically highlights new headlines
- Offline mode with local storage for continued viewing when disconnected
- Connection status monitoring with automatic reconnection
- Mobile-friendly design with optimized layout for different screen sizes
- Background auto-refresh for latest news updates

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

---
