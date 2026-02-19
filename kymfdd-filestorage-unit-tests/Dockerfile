FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN pip install --no-cache-dir -r requirements.txt

ENV REPO_PATH=repository_after
CMD ["python", "tests/run_tests.py"]
