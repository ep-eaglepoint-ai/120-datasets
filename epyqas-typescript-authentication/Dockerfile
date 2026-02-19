FROM node:22

WORKDIR /app

# Install build essentials for native modules (e.g. crypto)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

# Set environment variables
ENV SESSION_SECRET=docker-secure-secret-123456789
ENV NODE_ENV=development

# Run tests and evaluation directly
CMD npm test && npx ts-node evaluation/evaluation.ts
