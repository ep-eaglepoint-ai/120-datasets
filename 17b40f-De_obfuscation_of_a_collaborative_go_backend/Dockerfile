FROM golang:1.23-alpine

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

# Copy repository_after folder (de-obfuscated code)
COPY repository_after/ ./repository_after/

# Copy root-level tests folder INTO repository_after so they share the same go.mod/sum
COPY tests/ ./repository_after/tests_integration/

# Set working directory to repository_after
WORKDIR /app/repository_after

# Download dependencies
RUN go mod download

# Build the application
RUN go build -o server server.go

# Expose the port
EXPOSE 8080

# Default command - run the compiled server
CMD ["./server"]
