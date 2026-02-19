# Build stage
FROM rust:1.83-slim as builder

WORKDIR /app
COPY . .

RUN cargo build --release

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/bookstore_backend /app/bookstore_backend

EXPOSE 8080

CMD ["./bookstore_backend"]
