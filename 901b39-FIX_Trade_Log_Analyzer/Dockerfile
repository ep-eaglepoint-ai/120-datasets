FROM rust:1.75-alpine

WORKDIR /app

RUN apk add --no-cache musl-dev

# Cache-friendly copies (Cargo manifests first)
COPY repository_after/Cargo.toml ./repository_after/Cargo.toml
COPY repository_before/Cargo.toml ./repository_before/Cargo.toml
COPY evaluation/Cargo.toml ./evaluation/Cargo.toml

# Copy all sources
COPY . .

# Default command runs evaluation (expects before fail, after pass) and writes reports
CMD ["cargo", "run", "--release", "--manifest-path", "evaluation/Cargo.toml"]
