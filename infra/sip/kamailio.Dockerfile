# Multi-arch Kamailio 5.8 LTS image (Debian Bookworm).
# Replaces the abandoned upstream `kamailio/kamailio-ci` Docker Hub repo
# (last tag: 5.5.2-alpine, amd64 only) with a current build that runs
# natively on Apple Silicon (arm64).
#
# Build:
#   docker buildx build --platform linux/arm64,linux/amd64 \
#     -f infra/sip/kamailio.Dockerfile -t audiotext-kamailio:5.8 infra/sip
#
# Local single-arch (default):
#   docker build -f infra/sip/kamailio.Dockerfile -t audiotext-kamailio:5.8 infra/sip

FROM debian:bookworm-slim

ARG KAMAILIO_REPO=kamailio58

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg \
 && curl -fsSL https://deb.kamailio.org/kamailiodebkey.gpg \
      | gpg --dearmor -o /usr/share/keyrings/kamailio-archive-keyring.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/kamailio-archive-keyring.gpg] http://deb.kamailio.org/${KAMAILIO_REPO} bookworm main" \
      > /etc/apt/sources.list.d/kamailio.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      kamailio \
      kamailio-extra-modules \
 && apt-get purge -y curl gnupg \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

EXPOSE 5060/udp 5060/tcp

ENTRYPOINT ["kamailio", "-DD", "-E"]
