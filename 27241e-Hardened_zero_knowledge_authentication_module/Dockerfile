FROM nikolaik/python-nodejs:python3.11-nodejs18-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Default command (can be overridden by docker compose run)
CMD ["npm", "test"]