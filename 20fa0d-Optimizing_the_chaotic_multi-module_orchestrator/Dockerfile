FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY repository_before/package*.json ./repository_before/
COPY repository_after/package*.json ./repository_after/
COPY tests/package*.json ./tests/

# Install dependencies
RUN npm install --no-audit --no-fund && \
    cd repository_before && npm install --no-audit --no-fund && cd .. && \
    cd repository_after && npm install --no-audit --no-fund && cd .. && \
    cd tests && npm install --no-audit --no-fund && npx playwright install --with-deps chromium && cd ..

# Copy source code
COPY repository_before ./repository_before
COPY repository_after ./repository_after
COPY tests ./tests
COPY evaluation ./evaluation

# Create entrypoint with SWAPPED ports
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Starting repository_after on port 5173..."\n\
cd /app/repository_after && npm run dev > /tmp/after.log 2>&1 &\n\
AFTER_PID=$!\n\
echo "Starting repository_before on port 5174..."\n\
cd /app/repository_before && npm run dev -- --port 5174 > /tmp/before.log 2>&1 &\n\
BEFORE_PID=$!\n\
echo "Waiting for servers..."\n\
sleep 10\n\
for i in 1 2 3 4 5; do\n\
  if curl -sf http://localhost:5173 > /dev/null 2>&1 && curl -sf http://localhost:5174 > /dev/null 2>&1; then\n\
    echo "Both servers ready!"\n\
    break\n\
  fi\n\
  sleep 2\n\
done\n\
curl -f http://localhost:5173 > /dev/null 2>&1 || { echo "ERROR: repository_after (5173) failed"; tail -20 /tmp/after.log; exit 1; }\n\
curl -f http://localhost:5174 > /dev/null 2>&1 || { echo "ERROR: repository_before (5174) failed"; tail -20 /tmp/before.log; exit 1; }\n\
cd /app\n\
exec "$@"\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 5173 5174

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "evaluate"]
