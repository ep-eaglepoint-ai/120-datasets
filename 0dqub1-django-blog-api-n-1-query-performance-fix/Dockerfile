FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and tests
COPY . .

# Set python path to include current directory for imports
ENV PYTHONPATH=/app
