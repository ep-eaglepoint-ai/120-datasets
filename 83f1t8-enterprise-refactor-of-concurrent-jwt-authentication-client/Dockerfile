FROM node:20-slim

WORKDIR /app

# Install root test-runner dependencies first for better layer caching.
COPY package.json /app/package.json

# If a lockfile exists (recommended), copy it as well.
COPY package-lock.json /app/package-lock.json

RUN npm ci

# Copy the rest of the workspace (repos + tests).
COPY . /app

CMD ["npm", "test"]
