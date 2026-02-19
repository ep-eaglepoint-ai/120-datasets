FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default: run full evaluation (tests for before + after, then report).
# Override with: docker compose run app <command>
CMD ["python", "evaluation/evaluation.py"]
