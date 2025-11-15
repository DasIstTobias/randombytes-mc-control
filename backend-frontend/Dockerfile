# Build stage
FROM rust:1.75-slim as builder

WORKDIR /build

# Install dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy manifests and lock file
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /build/target/release/randombytes-mc-control-backend /app/backend

# Copy frontend files (will be mounted as volume in docker-compose)
RUN mkdir -p /app/frontend

EXPOSE 8080

CMD ["/app/backend"]
