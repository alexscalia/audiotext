---
name: freeswitch-source-build
description: |
  Build FreeSWITCH from upstream git source in a multi-stage Docker image,
  without the SignalWire apt repo or its access token.
  Use this skill when any of these are true:
  1) SignalWire auth fails (401).
  2) The user does not have a SignalWire Personal Access Token.
  3) The user explicitly needs source-level control of modules, version
     pinning, or final image size.
  Trigger on "build freeswitch from source", "freeswitch docker no
  signalwire", "freeswitch 401 unauthorized", "freeswitch source build skill".
triggers:
  - "build freeswitch from source"
  - "freeswitch dockerfile source"
  - "skip signalwire repo"
  - "signalwire token 401"
  - "freeswitch apt repo unauthorized"
---

# FreeSWITCH source build (Docker, no SignalWire repo)

## When to use

- SignalWire apt repo returns 401 / token unavailable
- Need a specific FreeSWITCH version not in apt
- Want to strip modules (mod_signalwire, mod_verto, mod_av) to shrink image
- Cross-arch image (arm64 + amd64) without per-arch repo gymnastics

## When NOT to use

- Valid SignalWire Personal Access Token already in `.env` → apt install is
  10× faster (~1 min vs ~15-30 min)
- Need mod_signalwire (Cloud) or mod_verto — those require libks +
  signalwire-c, which this skill intentionally drops

## Architecture

Two-stage Docker build:

1. **builder** (`debian:bookworm`): clones + compiles spandsp → sofia-sip →
   FreeSWITCH into `${PREFIX}` (default `/usr/local/freeswitch`).
2. **runtime** (`debian:bookworm-slim`): copies `${PREFIX}` from builder,
   installs only shared-library runtime deps. No compilers, no headers, no
   git in final image.

## Required dependencies

### Build stage (apt)
```
ca-certificates git build-essential autoconf automake libtool libtool-bin pkg-config
cmake yasm wget
libncurses5-dev libjpeg-dev zlib1g-dev libsqlite3-dev libpcre3-dev
libspeex-dev libspeexdsp-dev libedit-dev libldns-dev liblua5.4-dev
libcurl4-openssl-dev libssl-dev libapr1-dev libsndfile1-dev libopus-dev
libtiff-dev libpq-dev
```

Notes:
- Drop `libavresample-dev` — removed in FFmpeg 5, gone from bookworm. Only
  matters if you re-enable mod_av.
- Use `liblua5.4-dev` on bookworm (`liblua5.1-0-dev` from gist is older).
- `libcurl4-openssl-dev` (not gnutls flavor) — FreeSWITCH config detects
  OpenSSL elsewhere and mixing causes link warnings.

### Runtime stage (apt)
```
ca-certificates
libssl3 libsqlite3-0 libpcre3 libspeex1 libspeexdsp1 libedit2 libldns3
liblua5.4-0 libcurl4 libapr1 libsndfile1 libopus0 libtiff6 libpq5
libncurses6 libjpeg62-turbo zlib1g
```

Each runtime lib mirrors a `-dev` package from build stage. If you add a
build dep, add its runtime shared lib too.

## Source repos + pinning

| Component   | Repo                                            | Pin (`ARG`)        |
|-------------|-------------------------------------------------|--------------------|
| FreeSWITCH  | `github.com/signalwire/freeswitch`              | `v1.10.12` default |
| sofia-sip   | `github.com/freeswitch/sofia-sip` (the FS fork) | `master`           |
| spandsp     | `github.com/freeswitch/spandsp`                 | commit `67d2455…`  |

The spandsp commit pin is a workaround for freeswitch/freeswitch#2158 —
later spandsp commits break the FS build. Don't bump without testing.

The `signalwire-c` and `libks` repos from the gist are intentionally
omitted because mod_signalwire + mod_verto are disabled.

## Disabling modules

In stage 1, before `./bootstrap.sh`:

```sh
sed -i \
  -e 's|^applications/mod_signalwire|#applications/mod_signalwire|' \
  -e 's|^endpoints/mod_verto|#endpoints/mod_verto|' \
  -e 's|^applications/mod_av|#applications/mod_av|' \
  build/modules.conf.in
```

To enable another module: remove its `#` from `build/modules.conf.in`. To
add one not in the default list: append a line like
`applications/mod_foo` before bootstrap.

## Configure flags

```
./configure --prefix=${PREFIX} --disable-libvpx --disable-dependency-tracking
```

- `--disable-libvpx` — VP8/VP9 codec, not needed for SIP+audio playback,
  adds heavy deps.
- `--disable-dependency-tracking` — speeds up build, fine for one-shot
  Docker.

## Install layout

`${PREFIX}` (default `/usr/local/freeswitch`) contains:
- `bin/freeswitch`, `bin/fs_cli`
- `lib/` — shared libs (libfreeswitch.so, sofia, spandsp, modules)
- `conf/` — config (vanilla samples after `make samples-conf`)
- `sounds/`, `share/freeswitch/sounds/` — only created if `cd-sounds-install`
  / `cd-moh-install` make targets are run; **omitted by default to keep
  image small (~500 MB vs ~2.3 GB)**. Audiotext mounts its own WAVs via
  compose volumes, so defaults aren't needed.

**Important**: volume mounts in compose must target `${PREFIX}/conf/...` not
`/etc/freeswitch/...`. The SignalWire apt package uses `/etc/freeswitch`;
source build uses `${PREFIX}/conf`.

## Compose wiring

```yaml
freeswitch:
  build:
    context: ./infra/sip
    dockerfile: freeswitch.Dockerfile
  image: audiotext-freeswitch:1.10
  volumes:
    - ./conf/dialplan/public/00_app.xml:/usr/local/freeswitch/conf/dialplan/public/00_app.xml:ro
    - ./audio/welcome.wav:/usr/local/freeswitch/sounds/app/welcome.wav:ro
```

No `secrets:` block, no `--build-arg`, no env var needed at build time.

## Build time / size expectations

- Build duration: 15-30 min on M-series Mac, longer in emulation.
- Image size: ~330 MB runtime (without sound packs). Adding
  `cd-sounds-install` + `cd-moh-install` to the make line pushes image to
  ~2.3 GB because FreeSWITCH ships every prompt at 8/16/32/48 kHz.
- Use `--platform linux/arm64` (or `linux/amd64`) to pin if cross-building.

## Verification steps

After `docker compose build freeswitch`:

```sh
docker compose run --rm freeswitch freeswitch -version
docker compose run --rm freeswitch fs_cli -x 'show modules' | head
```

Smoke test inside container:
```sh
docker compose up -d freeswitch
docker compose logs -f freeswitch | grep "freeswitch.*Ready"
```

If `mod_sofia` fails to load, sofia-sip lib path is wrong — check
`LD_LIBRARY_PATH=${PREFIX}/lib` is set in stage 2.

## Common failures

| Symptom                                    | Cause                                | Fix                                                                 |
|--------------------------------------------|--------------------------------------|---------------------------------------------------------------------|
| `Package libavresample-dev has no installation candidate` | FFmpeg 5 removed it                  | Drop it; keep mod_av disabled                                       |
| `libtool not found` during `./bootstrap.sh`              | Debian split: `libtool` = macros only on bookworm | Install `libtool-bin` too (provides the `libtool` binary)         |
| `configure: error: Library requirements (speex >= 1.2rc1 speexdsp >= 1.2rc1) not met` | Only `libspeexdsp-dev` installed | Install **both** `libspeex-dev` and `libspeexdsp-dev` — FS needs the speex codec and the dsp lib separately |
| `error: spandsp.h: No such file or directory` during FS build | spandsp install path not in PKG_CONFIG_PATH | Set `PKG_CONFIG_PATH=${PREFIX}/lib/pkgconfig` on configure call     |
| `undefined reference to su_*` (sofia)      | sofia-sip not installed before FS    | Build sofia-sip stage before FS clone                               |
| `mod_signalwire` build error               | Forgot to disable in modules.conf.in | Re-run sed before bootstrap                                         |
| Conf volume mount silently does nothing    | Mount targets `/etc/freeswitch`      | Use `/usr/local/freeswitch/conf/...`                                |
| Image too big (>1 GB)                      | Build deps leaked into runtime       | Confirm two-stage `FROM ... AS builder` + `COPY --from=builder`     |

## Reference

- Gist this is based on: https://gist.github.com/mariogasparoni/dc4490fcc85a527ac45f3d42e35a962c
- FreeSWITCH source: https://github.com/signalwire/freeswitch
- spandsp issue 2158: https://github.com/signalwire/freeswitch/issues/2158
