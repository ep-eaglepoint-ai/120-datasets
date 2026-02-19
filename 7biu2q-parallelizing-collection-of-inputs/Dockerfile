# Use Python 3.11 slim
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy dependencies first (to leverage caching)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . /app

# Default command (can be overridden at runtime)
CMD ["python", "evaluation/evaluation.py"]
