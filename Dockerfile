# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy package files first for better caching
COPY frontend/package*.json ./
RUN npm install
# Copy the rest of the frontend source
COPY frontend/ ./
# Run build - vite.config.js outputs to ../static/dist
RUN npm run build

# Stage 2: Build Backend & Final Image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies
# Added libgl1, libglib2.0-0 for OpenCV, and build-essential/cmake for dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy requirements and install
COPY requirements.txt .
# Install dlib dependencies first to ensure success
RUN pip install --no-cache-dir cmake
# dlib-bin is faster if available, else build from source
RUN pip install --no-cache-dir dlib-bin || pip install --no-cache-dir dlib

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Copy built frontend assets from Stage 1
# This ensures static/dist is always up-to-date and matches vite.config.js output
COPY --from=frontend-builder /app/static/dist ./static/dist

# Collect static files for Django
RUN python manage.py collectstatic --noinput

# Expose the port
EXPOSE 8000

# Run the application using Gunicorn
# Fixed the path to wsgi:application to match smart_vision_django
CMD ["gunicorn", "smart_vision_django.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]