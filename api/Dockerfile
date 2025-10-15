FROM rust:1.90 AS build

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

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
ENV LAYERS_FILE=/configs/layers/layers.json5

RUN apk add --no-cache util-linux

WORKDIR /app

COPY --from=build /app/target/x86_64-unknown-linux-musl/release/api ./
COPY ./titiler/colormaps /app/colormaps

EXPOSE 3000

CMD ["/app/api"]
