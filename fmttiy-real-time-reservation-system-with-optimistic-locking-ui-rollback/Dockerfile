FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY repository_after/requirements.txt /app/repository_after/requirements.txt
RUN pip install --no-cache-dir -r /app/repository_after/requirements.txt

# Copy all files
COPY . /app

# Set PYTHONPATH
ENV PYTHONPATH=/app/repository_after:/app

# Default command runs evaluation
CMD ["python", "evaluation/evaluation.py"]
