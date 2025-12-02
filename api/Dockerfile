FROM rust:1.90 AS build

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
ENV SQLX_OFFLINE=true

ENV COLORMAP_DIR_PATH="/app/colormaps"

RUN apt update && apt install -y musl-tools musl-dev
RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /app

COPY ./api .

RUN cargo build --target x86_64-unknown-linux-musl --release --quiet



FROM alpine:3.17

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
ENV COLORMAP_DIR_PATH="/app/colormaps"
ENV LAYERS_FILE=/configs/layers/layertree.json5

RUN apk add --no-cache util-linux curl

WORKDIR /app

COPY --from=build /app/target/x86_64-unknown-linux-musl/release/api ./
COPY ./titiler/colormaps /app/colormaps

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:3000/api/health_check || exit 1

CMD ["/app/api"]
