FROM node:20-slim

WORKDIR /app

# Copy all files
COPY . .

# Install dependencies at root level
RUN npm install

# Default command runs evaluation
CMD ["node", "evaluation/evaluate.js"]
