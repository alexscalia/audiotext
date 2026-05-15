# FreeSWITCH 1.10 — multi-stage source build (no SignalWire token needed).
#
# Stage 1 builds FreeSWITCH from upstream git into /usr/local/freeswitch.
# Stage 2 copies the install tree onto a slim runtime image with only the
# shared libraries required at runtime.
#
# Disabled at build time: mod_signalwire (requires signalwire-c+libks),
# mod_verto (libks), mod_av (libav stack). Audiotext only needs SIP + WAV
# playback, so we skip them to cut build time and image size.
#
# Build:
#   docker compose -f docker-compose.sip.yml build freeswitch

# syntax=docker/dockerfile:1.7

ARG DEBIAN_VERSION=bookworm
ARG FREESWITCH_REF=v1.10.12
ARG SPANDSP_REF=67d2455efe02e7ff0d897f3fd5636fed4d54549e
ARG SOFIA_SIP_REF=master
ARG PREFIX=/usr/local/freeswitch

############################################
# Stage 1 — build
############################################
FROM debian:${DEBIAN_VERSION} AS builder

ARG FREESWITCH_REF
ARG SPANDSP_REF
ARG SOFIA_SIP_REF
ARG PREFIX
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git build-essential autoconf automake libtool libtool-bin pkg-config \
      cmake yasm wget \
      libncurses5-dev libjpeg-dev zlib1g-dev libsqlite3-dev libpcre3-dev \
      libspeex-dev libspeexdsp-dev libedit-dev libldns-dev liblua5.4-dev \
      libcurl4-openssl-dev libssl-dev libapr1-dev libsndfile1-dev libopus-dev \
      libtiff-dev libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# spandsp — pinned commit (workaround for freeswitch#2158)
RUN git clone --depth=1 https://github.com/freeswitch/spandsp.git \
 && cd spandsp \
 && git fetch --depth=1 origin ${SPANDSP_REF} \
 && git checkout ${SPANDSP_REF} \
 && ./bootstrap.sh \
 && ./configure --prefix=${PREFIX} \
 && make -j"$(nproc)" \
 && make install

# sofia-sip — FreeSWITCH fork
RUN git clone --depth=1 --branch ${SOFIA_SIP_REF} \
      https://github.com/freeswitch/sofia-sip.git \
 && cd sofia-sip \
 && ./bootstrap.sh \
 && ./configure --prefix=${PREFIX} \
 && make -j"$(nproc)" \
 && make install

# FreeSWITCH itself
RUN git clone --depth=1 --branch ${FREESWITCH_REF} \
      https://github.com/signalwire/freeswitch.git
WORKDIR /src/freeswitch

# Disable modules we don't need (drops signalwire-c, libks, libav deps).
RUN sed -i \
      -e 's|^applications/mod_signalwire|#applications/mod_signalwire|' \
      -e 's|^endpoints/mod_verto|#endpoints/mod_verto|' \
      -e 's|^applications/mod_av|#applications/mod_av|' \
      build/modules.conf.in

RUN ./bootstrap.sh -j

RUN env PKG_CONFIG_PATH=${PREFIX}/lib/pkgconfig \
      ./configure --prefix=${PREFIX} \
        --disable-libvpx \
        --disable-dependency-tracking \
 && env C_INCLUDE_PATH=${PREFIX}/include make -j"$(nproc)" \
 && make install \
 && make samples-conf

############################################
# Stage 2 — runtime
############################################
FROM debian:${DEBIAN_VERSION}-slim AS runtime

ARG PREFIX
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libssl3 libsqlite3-0 libpcre3 libspeex1 libspeexdsp1 libedit2 libldns3 \
      liblua5.4-0 libcurl4 libapr1 libsndfile1 libopus0 libtiff6 libpq5 \
      libncurses6 libjpeg62-turbo zlib1g \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder ${PREFIX} ${PREFIX}

ENV PATH=${PREFIX}/bin:${PATH}
ENV LD_LIBRARY_PATH=${PREFIX}/lib

RUN groupadd --system freeswitch && useradd --system --gid freeswitch --home ${PREFIX} freeswitch \
 && chown -R freeswitch:freeswitch ${PREFIX}

EXPOSE 5060/udp 5060/tcp 5080/udp 5080/tcp
EXPOSE 16384-16484/udp

USER freeswitch
ENTRYPOINT ["freeswitch", "-nc", "-nf", "-nonat"]
