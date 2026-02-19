# ============================================
# BASE STAGE: Install dependencies and MongoDB
# ============================================
FROM node:20-slim AS base

WORKDIR /app

# Install required libs for MongoDB and git for reports
RUN apt-get update && apt-get install -y \
    git \
    libcurl4 \
    && rm -rf /var/lib/apt/lists/*

# Create package.json inline
RUN echo '{"name":"cart-service-tests","version":"1.0.0","devDependencies":{"jest":"^29.7.0","mongodb-memory-server":"^9.1.6"},"dependencies":{"mongoose":"^8.0.0"}}' > package.json

# Install dependencies with optimizations
RUN npm install --prefer-offline --no-audit --no-fund

# Pre-download MongoDB binary (cached in base layer)
ENV MONGOMS_VERSION=7.0.4
RUN node -e "const{MongoMemoryServer}=require('mongodb-memory-server');MongoMemoryServer.create().then(s=>{console.log('MongoDB ready');s.stop();process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"

# Create jest config with minimal output
RUN echo 'module.exports={testTimeout:30000,forceExit:true,detectOpenHandles:true}' > jest.config.js

# Create minimal test reporter script
RUN printf '#!/bin/bash\nREPO=${TEST_REPO:-repository_after}\necho ""\necho "Testing: $REPO"\necho "========================================"\nOUTPUT=$(npx jest tests/cartService.test.js --forceExit --no-coverage 2>&1)\necho "$OUTPUT" | grep -E "✓|✕|○" | sed "s/^[[:space:]]*//"\necho "========================================"\necho "$OUTPUT" | grep -E "^Tests:" | head -1\necho ""\n' > /app/run-tests.sh && chmod +x /app/run-tests.sh

# ============================================
# TEST-BEFORE: Run tests against repository_before
# ============================================
FROM base AS test-before

ENV TEST_REPO=repository_before

COPY repository_before/ ./repository_before/
COPY tests/ ./tests/

CMD ["/bin/bash", "/app/run-tests.sh"]

# ============================================
# TEST-AFTER: Run tests against repository_after
# ============================================
FROM base AS test-after

ENV TEST_REPO=repository_after

COPY repository_after/ ./repository_after/
COPY tests/ ./tests/

CMD ["/bin/bash", "/app/run-tests.sh"]

# ============================================
# EVALUATION: Run full evaluation with reports
# ============================================
FROM base AS evaluation

COPY repository_before/ ./repository_before/
COPY repository_after/ ./repository_after/
COPY tests/ ./tests/
COPY evaluation/evaluation.js ./evaluation/

# Create reports directory
RUN mkdir -p ./evaluation/reports

CMD ["node", "evaluation/evaluation.js"]
