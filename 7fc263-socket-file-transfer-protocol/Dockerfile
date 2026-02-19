FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install optional dependencies for evaluation
RUN pip install --no-cache-dir psutil

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p server_files client_downloads logs evaluation/reports

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose default port
EXPOSE 9999

# Default command (can be overridden)
CMD ["python", "repository_after/server.py"]
