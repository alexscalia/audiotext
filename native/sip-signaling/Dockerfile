FROM debian:bookworm-slim AS builder

ARG ZIG_VERSION=0.14.0
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils \
      libpq-dev libhiredis-dev \
 && rm -rf /var/lib/apt/lists/*

# Download Zig — naming convention is `zig-{arch}-linux-{ver}` from 0.14 onward.
RUN ARCH=$(uname -m) \
 && URL_NEW="https://ziglang.org/download/${ZIG_VERSION}/zig-${ARCH}-linux-${ZIG_VERSION}.tar.xz" \
 && URL_OLD="https://ziglang.org/download/${ZIG_VERSION}/zig-linux-${ARCH}-${ZIG_VERSION}.tar.xz" \
 && (curl -fsSLo /tmp/zig.tar.xz "$URL_NEW" || curl -fsSLo /tmp/zig.tar.xz "$URL_OLD") \
 && tar -xJf /tmp/zig.tar.xz -C /opt \
 && rm /tmp/zig.tar.xz \
 && mv /opt/zig-*-${ZIG_VERSION} /opt/zig
ENV PATH=/opt/zig:$PATH

WORKDIR /build
COPY build.zig build.zig.zon ./
COPY src ./src
RUN zig build -Doptimize=ReleaseSafe

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates libpq5 libhiredis0.14 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/zig-out/bin/sip-signaling /usr/local/bin/sip-signaling

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/sip-signaling"]
