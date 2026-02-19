FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt
ENV PYTHONUNBUFFERED=1

# Default to tests; docker compose can override.
CMD ["pytest", "-q", "tests"]
