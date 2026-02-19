FROM python:3.11-slim

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

# Run the evaluation script which runs tests and generates report
CMD ["python", "evaluation/evaluation.py"]

