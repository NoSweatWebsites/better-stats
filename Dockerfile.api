FROM rust:1.76-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
COPY apps/api/ ./apps/api/
COPY services/worker/ ./services/worker/
RUN cargo build --release -p api

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/api /api
EXPOSE 8080
CMD ["/api"]
