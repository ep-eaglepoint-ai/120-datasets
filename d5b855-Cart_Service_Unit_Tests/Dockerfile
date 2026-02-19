FROM node:18-alpine

WORKDIR /app

# Copy all project files
COPY . .

# Install dependencies for repository_after
WORKDIR /app/repository_after
RUN npm install

# Install dependencies for tests (metatests)
WORKDIR /app/tests
RUN npm install

# Install dependencies for evaluation
WORKDIR /app/evaluation
RUN npm init -y 2>/dev/null || true

WORKDIR /app

