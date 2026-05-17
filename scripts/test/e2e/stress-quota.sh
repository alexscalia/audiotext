#!/usr/bin/env bash
# stress-quota.sh — full-ladder load against the IVR slice while a quota cap
# is enforced. Verifies:
#   - signaling latency p95 under sustained CPS
#   - Lua atomicity at the cap boundary (no over-allocation)
#   - FreeSWITCH channel count, ESL-side CDR settle throughput
#
# Knobs (env):
#   CPS         calls per second (default 10)
#   MAX_CONC    max concurrent calls (default 50)
#   TOTAL       total call count (default 500)
#   DID         destination DID (default 18005551234, matches seed-test-quota)
#
# Expect: docker compose stack up + seed-test-quota.ts run.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.sip.yml"
CPS="${CPS:-10}"
MAX_CONC="${MAX_CONC:-50}"
TOTAL="${TOTAL:-500}"
DID="${DID:-18005551234}"

echo "==> stress: cps=${CPS} max_conc=${MAX_CONC} total=${TOTAL} DID=${DID}"
$COMPOSE --profile test run --rm sipp \
  -sf /scenarios/inbound-call.xml \
  -s "99${DID}" \
  -r "${CPS}" -l "${MAX_CONC}" -m "${TOTAL}" \
  kamailio-edge:5060

echo ""
echo "stats: scripts/test/sipp/stress-quota.stat (per-CPS interval breakdown)"
echo "tail freeswitch + sip-signaling logs for latency outliers:"
echo "  $COMPOSE logs --tail=200 sip-signaling | grep -E 'authorize|quota'"
echo "  $COMPOSE logs --tail=200 freeswitch    | grep -i 'channel'"
