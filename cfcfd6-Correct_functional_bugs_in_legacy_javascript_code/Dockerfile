FROM node:18-alpine

WORKDIR /app

# Copy test files
COPY tests/package.json tests/package.json
WORKDIR /app/tests
RUN npm install

# Copy all files
WORKDIR /app
COPY . .

CMD ["npm", "test", "--prefix", "tests"]
