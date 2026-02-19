FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Make evaluation script executable
RUN chmod +x evaluation/evaluation.py

# Default command runs evaluation
CMD ["python", "evaluation/evaluation.py"]
