FROM node:20-slim

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./
RUN npm install 2>/dev/null || true

# Copy application code
COPY . /app

# Default command
CMD ["node", "-e", "console.log('Node OK')"]

