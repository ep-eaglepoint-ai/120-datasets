# Stage 1: Build
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
    -ldflags='-s -w -extldflags "-static"' \
    -o server ./repository_after/cmd/server

# Stage 2: Test and Evaluation (Go + Python)
FROM golang:1.21-alpine AS test

RUN apk add --no-cache python3

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Stage 3: Run (production)
FROM scratch

COPY --from=builder /app/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]