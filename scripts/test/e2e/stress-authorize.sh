#!/usr/bin/env bash
# stress-authorize.sh — direct hammer of the Zig /authorize endpoint,
# bypassing kamailio + FS. Measures raw signaling RPS and p99 latency.
#
# Tool: wrk (install via `brew install wrk` on macOS).
#
# Note: this counts as quota reservations against the seeded test range —
# clear keys before/after with redis-cli to avoid polluting functional runs.

set -euo pipefail

DURATION="${DURATION:-30s}"
THREADS="${THREADS:-4}"
CONNECTIONS="${CONNECTIONS:-50}"
AUTHZ_URL="${AUTHZ_URL:-http://localhost:8088/authorize}"

# Use the seeded test-range fixture: SIPP_IP (172.28.99.50), prefix 99, DID 18005551234.
IP="${IP:-172.28.99.50}"
A="${A:-%2B15555550001}"
B="${B:-9918005551234}"

if ! command -v wrk >/dev/null 2>&1; then
  echo "wrk not found — install via 'brew install wrk' or apt"
  exit 1
fi

URL="${AUTHZ_URL}?ip=${IP}&a=${A}&b=${B}"
echo "==> wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} '${URL}'"
wrk -t"${THREADS}" -c"${CONNECTIONS}" -d"${DURATION}" --latency "${URL}"
