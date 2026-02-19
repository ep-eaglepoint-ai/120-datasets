FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY repository_after/package*.json ./repository_after/
COPY tests/ ./tests/
COPY evaluation/ ./evaluation/

# Install dependencies
WORKDIR /app/repository_after
RUN npm install

# Copy application code
COPY repository_after/ ./

# Generate Prisma client
RUN npx prisma generate

# Copy evaluation script
WORKDIR /app
COPY evaluation/ ./evaluation/

# Default command runs evaluation
CMD ["node", "evaluation/evaluation.js"]
