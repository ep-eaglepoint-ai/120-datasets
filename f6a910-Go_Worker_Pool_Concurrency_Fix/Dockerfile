FROM golang:1.21-alpine

WORKDIR /app

# Install build essentials for race detector
RUN apk add --no-cache gcc musl-dev

# Copy all application code
COPY . /app

# Default: build and run repository_before
CMD ["sh", "-c", "cd /app && go run -race ./repository_before/"]
