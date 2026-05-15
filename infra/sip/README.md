# SIP dev rig

Signaling-only smoke-test stack. Two Kamailio containers on a private bridge network:

- **`kamailio-edge`** — listens on host `127.0.0.1:5060/udp`, dispatches every `INVITE` to a carrier from set 1.
- **`kamailio-carrier-sink`** — internal-only, fakes a wholesale carrier by replying `200 OK` to any `INVITE`.

No RTPEngine, no FreeSWITCH, no media path. Goal of this slice: prove the dispatcher routes traffic and Kamailio config loads cleanly.

## Layout

```
docker-compose.sip.yml
infra/sip/
  kamailio.Dockerfile          # Kamailio 5.8 LTS, multi-arch (Debian Bookworm + deb.kamailio.org)
  kamailio-edge/
    kamailio.cfg
    dispatcher.list
  kamailio-carrier-sink/
    kamailio.cfg
```

Image built locally as `audiotext-kamailio:5.8` because the upstream Docker Hub repo (`kamailio/kamailio-ci`) abandoned new tags after `5.5.2-alpine` and never published an arm64 manifest.

## Run

```bash
docker compose -f docker-compose.sip.yml up -d --build   # `--build` first time, or after Dockerfile changes
docker compose -f docker-compose.sip.yml logs -f
```

Subsequent runs: drop `--build` (image cached).

You should see both containers reach `INFO: <core> [main.c]: main(): processes: 4 (children=4)` (edge) / `(children=2)` (sink) and then `mod_init` lines for each loaded module. No `ERROR` lines.

Stop:

```bash
docker compose -f docker-compose.sip.yml down
```

## Smoke test

### Option A — sipsak (host) sending OPTIONS

Proves Kamailio is reachable from host. Does **not** exercise the dispatcher (OPTIONS aren't dispatched in this config).

```bash
brew install sipsak
sipsak -s sip:test@127.0.0.1:5060
```

Expected: `*** received final answer 405 Method Not Allowed` (edge rejects OPTIONS in `request_route`). That's a successful round-trip.

### Option B — sipp (docker) sending INVITE — exercises dispatcher

Runs sipp in a one-shot container on the same SIP network, so it can resolve `kamailio-edge` by service name.

```bash
docker run --rm \
  --network audiotext-sip_sip \
  ctaloi/sipp \
  -sn uac \
  -s testuser \
  kamailio-edge:5060 \
  -m 1 -r 1 -trace_screen -nostdin -timeout 5
```

What sipp does: sends one `INVITE`, waits for `100 Trying` then `200 OK`, sends `ACK`, then `BYE`. Edge dispatches → sink answers.

Expected sipp output: `Successful call: 1`.

### Verify in logs

```bash
docker compose -f docker-compose.sip.yml logs --tail=50 kamailio-edge
docker compose -f docker-compose.sip.yml logs --tail=50 kamailio-carrier-sink
```

Look for:

- edge: `[edge] INVITE from <ip>:<port> to sip:testuser@kamailio-edge:5060`
- edge: `[edge] forwarding to sip:kamailio-carrier-sink:5060`
- sink: `[sink] INVITE from <edge_ip>:<port> to sip:testuser@kamailio-edge:5060`

If both appear and sipp reports a successful call, dispatcher is working.

## Common gotchas

- **Port 5060 already in use** — another SIP daemon on the host (linphone, FreeSWITCH). `lsof -iUDP:5060` to identify; stop it or change the host-side port mapping in `docker-compose.sip.yml`.
- **`mod_init` errors for `dispatcher.so`** — almost always `dispatcher.list` syntax. Check the file is mounted (`docker exec audiotext-kamailio-edge cat /etc/kamailio/dispatcher.list`).
- **No reply on INVITE** — sink container not on the same network or hostname mismatch. `docker network inspect audiotext-sip_sip` shows the aliases.
- **Sipp says `unexpected message received`** — the sink replied `405` because the routing block fell through. Check `[sink]` log line for the method.

## Next steps (deferred, NOT in this slice)

1. Replace `dispatcher.list` with a Zig service that builds the carrier list from Postgres and reloads on Redis pub/sub.
2. Add RTPEngine on the edge so calls carry actual RTP audio. Requires explicit RTP UDP port range in compose + `rtpengine.so` Kamailio module.
3. Add FreeSWITCH cluster as a second dispatcher set for IVR routes.
4. Replace sipp with a real softphone (linphone-cli) for end-to-end manual testing.
