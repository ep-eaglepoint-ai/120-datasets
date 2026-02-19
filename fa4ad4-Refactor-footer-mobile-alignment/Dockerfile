FROM node:20-slim

# Install git for evaluation script
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy project files
COPY . /app

# Install dependencies for root (tests/evaluation)
RUN npm install

# Install dependencies for repositories (needed for potential imports or just completeness)
RUN cd repository_before/demo-app && npm install
RUN cd repository_after/demo-app && npm install

# Default command
ENV REPO=repository_after
# Run structural tests by default
CMD ["npm", "test"]
