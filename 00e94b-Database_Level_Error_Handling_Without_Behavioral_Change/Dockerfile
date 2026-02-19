FROM python:3.11-slim

WORKDIR /app

COPY . /app

# Install libpq for psycopg PostgreSQL driver
RUN apt-get update && apt-get install -y libpq-dev && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

ENV PYTHONPATH=/app/repository_before