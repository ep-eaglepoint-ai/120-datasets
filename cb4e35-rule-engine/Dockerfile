FROM node:20-slim

WORKDIR /app

# Copy project files
COPY . /app

# Install dependencies for repository_after
WORKDIR /app/repository_after
RUN npm install --legacy-peer-deps && \
    echo "Checking if jest installed..." && \
    ls -la node_modules/.bin/jest

# Set environment
ENV MONGODB_URI=mongodb://localhost:27017/rule-engine
ENV NODE_ENV=test

# Back to root
WORKDIR /app

# Default command
CMD ["npm", "test"]
