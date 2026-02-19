FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL client libraries
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

# Default command (can be overridden)
CMD ["python", "evaluation/evaluation.py"]
