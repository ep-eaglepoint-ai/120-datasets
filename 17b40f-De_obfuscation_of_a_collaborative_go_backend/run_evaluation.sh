#!/bin/bash

# Run evaluation script and ensure report.json is created at root level
set -e

echo "Starting evaluation process..."

# Start database
echo "Starting MongoDB..."
docker compose up -d db
sleep 10

# Clean database
echo "Cleaning database..."
docker compose exec db mongosh godoc --eval "db.users.deleteMany({}); db.documents.deleteMany({})" || true

# Run evaluation
echo "Running evaluation..."
docker compose run --rm tests sh -c "cd ../evaluation && go mod download && go run evaluation.go"

# Verify report.json exists
if [ -f "report.json" ]; then
    echo "✅ report.json successfully created at root level"
    echo "File size: $(stat -c%s report.json) bytes"
    echo "First few lines of report.json:"
    head -10 report.json
else
    echo "❌ ERROR: report.json not found at root level"
    echo "Checking if it was created elsewhere..."
    find . -name "report.json" -type f
    exit 1
fi

# Clean up
echo "Cleaning up..."
docker compose down || true

echo "Evaluation completed successfully!"