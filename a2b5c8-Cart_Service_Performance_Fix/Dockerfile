FROM node:20-slim

WORKDIR /app

# Copy package files (install per-subfolder like the sample template)
COPY repository_after/package*.json ./repository_after/
COPY repository_before/package*.json ./repository_before/
COPY tests/package*.json ./tests/
COPY evaluation/package*.json ./evaluation/

# Install Node dependencies
RUN cd repository_after && npm install
RUN cd repository_before && npm install
RUN cd tests && npm install
RUN cd evaluation && npm install

# Copy all files
COPY . .

# Make evaluation script executable
RUN chmod +x evaluation/evaluation.js

# Default command runs evaluation
CMD ["node", "evaluation/evaluation.js"]

