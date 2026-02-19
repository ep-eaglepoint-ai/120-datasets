# Expression Parser Calculator Fix - Python Environment
FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY repository_before/ ./repository_before/
COPY repository_after/ ./repository_after/
COPY tests/ ./tests/

# Default command runs the calculator tests
CMD ["python", "-m", "pytest", "tests/", "-v", "--tb=short"]

