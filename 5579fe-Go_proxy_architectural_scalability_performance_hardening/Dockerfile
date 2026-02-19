FROM golang:1.21-alpine

WORKDIR /app

# Install git for fetching dependencies if needed
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the application
COPY . .

# Default command
CMD ["./main"]
