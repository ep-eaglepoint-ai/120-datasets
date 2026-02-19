FROM node:20-alpine

WORKDIR /app

# Install Python for evaluation script
RUN apk add --no-cache python3 py3-pip

# Install libc6-compat for Alpine (needed for Next.js SWC binaries)
# This provides glibc compatibility layer for musl-based Alpine
RUN apk add --no-cache libc6-compat

# Copy and install Python dependencies first (for better caching)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy package files for repository_after to enable dependency caching
COPY repository_after/package*.json ./repository_after/

# Install dependencies for repository_after (Next.js) - MUST be done in Dockerfile, not in docker-compose or commands
# This ensures platform-specific binaries (like @next/swc-linux-x64-musl for Alpine) are installed
WORKDIR /app/repository_after
# Use npm install (not npm ci) to ensure platform-specific optional dependencies are installed
# npm ci uses exact versions from package-lock.json which might not install platform-specific binaries correctly
# Don't use --no-optional - we NEED optional dependencies (SWC binaries) for Alpine
RUN npm install --only=production=false

# Copy everything else (after npm install to preserve node_modules)
# .dockerignore ensures node_modules is not copied from host
WORKDIR /app
COPY . .

# Reinstall dependencies after COPY to ensure platform-specific binaries are correct for Alpine
# This ensures the correct musl SWC binary is installed even if package-lock.json was from a different platform
# Remove node_modules to force fresh install with correct platform detection (keep package-lock.json for version consistency)
WORKDIR /app/repository_after
RUN rm -rf node_modules && npm install --only=production=false

# Verify that the correct SWC binary for Alpine (musl) is installed
# Check for either x64 or arm64 musl binary (Alpine requires musl, not glibc)
RUN (test -d node_modules/@next/swc-linux-x64-musl || test -d node_modules/@next/swc-linux-arm64-musl) || \
    (echo "ERROR: No musl SWC binary found! Alpine requires musl SWC binary." && \
     echo "Installed SWC packages:" && \
     ls -la node_modules/@next/swc-* 2>/dev/null || echo "No SWC packages found" && \
     exit 1)

# Ensure npm and node are available in PATH (they should be from base image)
# Verify npm installation
RUN npm --version && node --version

# Create test scripts (npm commands are in Dockerfile, not in docker-compose or commands)
# Create scripts in /usr/local/bin (not /app/bin because volume mount overrides /app)
RUN printf '#!/bin/sh\ncd /app/repository_after && npm run type-check && npm test -- --passWithNoTests --ci\n' > /usr/local/bin/run-tests-after.sh && \
    chmod +x /usr/local/bin/run-tests-after.sh && \
    printf '#!/bin/sh\ncd /app/repository_after && npm run type-check\n' > /usr/local/bin/run-type-check.sh && \
    chmod +x /usr/local/bin/run-type-check.sh && \
    printf '#!/bin/sh\ncd /app/repository_after && npm test -- --ci\n' > /usr/local/bin/run-test-only.sh && \
    chmod +x /usr/local/bin/run-test-only.sh

# Verify scripts were created
RUN ls -la /usr/local/bin/run-*.sh && test -f /usr/local/bin/run-tests-after.sh

# Return to root
WORKDIR /app

CMD ["python3", "--version"]
