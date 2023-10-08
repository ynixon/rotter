# RSS Feed Ticker (Rotter News)

## Overview
This project displays Rotter News RSS feed titles as a scrolling ticker using Flask, jQuery, and feedparser.

## Features
- Fetches RSS feed from a specified URL
- Displays titles in a scrolling ticker format
- Refreshes the feed and starts from the beginning after all titles are shown

## Dependencies
### Python Packages
- Flask (Web framework)
- feedparser (RSS feed parser)

## Setup and Run

### Using Docker

#### Dockerizing Rotter News
We've created a Dockerfile to facilitate the dockerization of the Rotter News application:

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
CMD ["python", "Rotter.py"]
```

#### Building and Running the Docker Container
Build the Docker image:
```
docker build -t rotter-news .
```

Run the Docker container in the background:
```
docker run -d --restart always --name Rotter_News -p 3000:3000 rotter-news

```
This will run the Rotter News application in a Docker container, and the container will always restart if it stops for any reason.

### Without Docker
1. Clone the repo.
2. Navigate to the project directory.
3. Install dependencies: `pip install -r requirements.txt`
4. Run the Flask app: `python app.py`
5. Open a browser and go to `http://127.0.0.1:3000/`


