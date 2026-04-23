FROM rust:1.76-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ ./crates/
COPY services/worker/ ./services/worker/
RUN cargo build --release -p worker

FROM gcr.io/distroless/cc-debian12
COPY --from=builder /app/target/release/worker /worker
CMD ["/worker"]
