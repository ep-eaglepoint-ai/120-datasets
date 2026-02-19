#!/bin/sh
set -e

echo "Starting repository_after on port 5173..."
cd /app/repository_after && npm run dev > /tmp/after.log 2>&1 &
AFTER_PID=$!

echo "Starting repository_before on port 5174..."
cd /app/repository_before && npm run dev -- --port 5174 > /tmp/before.log 2>&1 &
BEFORE_PID=$!

echo "Waiting for servers..."
sleep 10

# Check both servers with retry
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:5173 > /dev/null 2>&1 && \
     curl -sf http://localhost:5174 > /dev/null 2>&1; then
    echo "Both servers ready!"
    break
  fi
  sleep 2
done

# Final verification
curl -f http://localhost:5173 > /dev/null 2>&1 || {
  echo "ERROR: repository_after (5173) failed"
  tail -20 /tmp/after.log
  exit 1
}

curl -f http://localhost:5174 > /dev/null 2>&1 || {
  echo "ERROR: repository_before (5174) failed"
  tail -20 /tmp/before.log
  exit 1
}

echo "Both servers are ready!"
cd /app
exec "$@"
