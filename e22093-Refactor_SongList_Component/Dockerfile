FROM node:18-alpine

WORKDIR /workspace

# Copy entire project structure
COPY . .

# Install dependencies with legacy peer deps to resolve conflicts
RUN npm install --legacy-peer-deps

# Expose port
EXPOSE 3000

# Default command runs the app
CMD ["sh", "-c", "cd repository_after && npm start"]
