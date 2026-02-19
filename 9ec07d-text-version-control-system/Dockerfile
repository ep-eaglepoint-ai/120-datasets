FROM node:18-alpine

WORKDIR /app

# Copy package.json from the repository_after subdirectory
COPY repository_after/package.json ./

# Install dependencies with verbose output to show progress
RUN npm install --verbose

# Copy the rest of the application code
COPY repository_after/ .

EXPOSE 3000

CMD ["npm", "run", "dev"]
