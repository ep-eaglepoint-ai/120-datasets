FROM python:3.11-slim
WORKDIR /app

# Install dependencies first for better caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the rest of the task files
COPY . /app

# Default command runs evaluation (tests-before + tests-after + report)
CMD ["python", "-m", "evaluation.evaluation"]
