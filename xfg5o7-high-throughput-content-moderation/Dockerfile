FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (if any)
RUN npm install --production 2>/dev/null || true

# Copy all source files
COPY . .

# Default command - can be overridden
CMD ["node", "--test", "tests/"]
