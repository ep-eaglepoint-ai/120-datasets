FROM node:20-slim

# Install Python for evaluation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/bin/python || true

WORKDIR /app

# Copy package files first for better caching
COPY repository_after/package*.json ./repository_after/
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt || true

# Install Node dependencies for repository_after
WORKDIR /app/repository_after
RUN npm install

# Copy the rest of the application (excluding node_modules via .dockerignore)
WORKDIR /app
COPY . /app

# Install Node dependencies for repository_before (if package.json exists)
WORKDIR /app/repository_before
RUN npm install || true

# Create helper scripts for running tests
RUN echo '#!/bin/sh\nset -e\nif [ ! -d "/app/repository_before" ]; then echo "Error: repository_before not found"; exit 1; fi\ncd /app/repository_before\nif [ ! -f "package.json" ]; then echo "Error: package.json not found in repository_before"; exit 1; fi\nnpm test' > /usr/local/bin/run-tests-before.sh && \
    chmod +x /usr/local/bin/run-tests-before.sh

RUN echo '#!/bin/sh\nset -e\nif [ ! -d "/app/repository_after" ]; then echo "Error: repository_after not found"; exit 1; fi\ncd /app/repository_after\nif [ ! -f "package.json" ]; then echo "Error: package.json not found in repository_after"; exit 1; fi\nnpm test' > /usr/local/bin/run-tests-after.sh && \
    chmod +x /usr/local/bin/run-tests-after.sh

# Default command runs evaluation
CMD ["python3", "evaluation/evaluation.py"]
