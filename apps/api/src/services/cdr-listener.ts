import net from "node:net";
import { db, voiceCdrs } from "@audiotext/db";
import Redis from "ioredis";

// FreeSWITCH ESL (event_socket) inbound client.
//
// Subscribes to CHANNEL_DESTROY (fires for every call — answered, busy,
// no-answer, cancelled) and on each event:
//   1. INSERT a row in voice_cdrs with the attribution channel vars set by
//      the dialplan (at_voice_range_id, voice_trunk_id, a_number, b_number,
//      b_number_dialed) plus billsec.
//   2. INCRBY (billsec - RESERVE_SEC) to the four per-range daily-minute
//      counters in Redis. A no-answer call has billsec=0, so the delta is
//      negative — it refunds the 60s reserved at /authorize time.
//
// Fail-mode: on ESL disconnect or Redis error, log and reconnect with
// backoff. Authorize-side is fail-open, so missed settles only cause
// quota under-counting (callers get more headroom, never less).

const ESL_HOST = process.env.FREESWITCH_ESL_HOST ?? "freeswitch";
const ESL_PORT = Number(process.env.FREESWITCH_ESL_PORT ?? 8021);
const ESL_PASSWORD = process.env.FREESWITCH_ESL_PASSWORD ?? "ClueCon";
const REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";
const RESERVE_SEC = 60;
const TTL_SEC = 172800; // 48h — matches Zig signaling

type CdrEvent = {
  rangeId: string;
  trunkId: string;
  aNumber: string;
  bNumber: string;
  bNumberDialed: string;
  billsec: number;
  startedAt: Date;
  endedAt: Date;
};

export type CdrListenerHandle = {
  stop: () => Promise<void>;
};

export function startCdrListener(): CdrListenerHandle {
  const redis = new Redis(REDIS_URL, { lazyConnect: false });
  redis.on("error", (err) => {
    console.error("[cdr] redis error:", err.message);
  });

  let socket: net.Socket | null = null;
  let stopped = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (stopped) return;
    const s = net.createConnection({ host: ESL_HOST, port: ESL_PORT });
    socket = s;
    let buffer = "";
    let state: "auth" | "ready" = "auth";

    s.setEncoding("utf8");
    s.on("connect", () => {
      console.log(`[cdr] esl connected ${ESL_HOST}:${ESL_PORT}`);
    });

    s.on("data", (chunk: string) => {
      buffer += chunk;
      // ESL events: headers terminated by \n\n, optional Content-Length body.
      while (true) {
        const headerEnd = buffer.indexOf("\n\n");
        if (headerEnd === -1) return;
        const rawHeaders = buffer.slice(0, headerEnd);
        const headers = parseHeaders(rawHeaders);
        const contentLength = Number(headers["Content-Length"] ?? 0);
        const totalLen = headerEnd + 2 + contentLength;
        if (buffer.length < totalLen) return;
        const body = contentLength > 0 ? buffer.slice(headerEnd + 2, totalLen) : "";
        buffer = buffer.slice(totalLen);
        handleFrame(headers, body, state).catch((err) => {
          console.error("[cdr] frame handler error:", err);
        });
        if (state === "auth" && headers["Content-Type"] === "auth/request") {
          s.write(`auth ${ESL_PASSWORD}\n\n`);
        }
        if (state === "auth" && headers["Content-Type"] === "command/reply") {
          if ((headers["Reply-Text"] ?? "").startsWith("+OK")) {
            s.write("event plain CHANNEL_DESTROY\n\n");
            state = "ready";
            console.log("[cdr] subscribed to CHANNEL_DESTROY");
          } else {
            console.error("[cdr] esl auth failed:", headers["Reply-Text"]);
            s.destroy();
          }
        }
      }
    });

    const handleFrame = async (
      headers: Record<string, string>,
      body: string,
      _state: string,
    ) => {
      if (headers["Content-Type"] !== "text/event-plain") return;
      const event = parseHeaders(body);
      if (event["Event-Name"] !== "CHANNEL_DESTROY") return;
      const cdr = extractCdr(event);
      if (!cdr) return;
      await writeCdr(cdr);
      await settleQuota(redis, cdr);
    };

    s.on("close", () => {
      console.warn("[cdr] esl socket closed");
      socket = null;
      if (!stopped) scheduleReconnect();
    });
    s.on("error", (err) => {
      console.error("[cdr] esl socket error:", err.message);
      s.destroy();
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  };

  connect();

  return {
    stop: async () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.destroy();
      await redis.quit().catch(() => {});
    },
  };
}

function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = decodeURIComponent(line.slice(idx + 1).trim());
    out[key] = value;
  }
  return out;
}

function extractCdr(event: Record<string, string>): CdrEvent | null {
  const rangeId = event["variable_at_voice_range_id"];
  const trunkId = event["variable_voice_trunk_id"];
  const aNumber = event["variable_a_number"];
  const bNumber = event["variable_b_number"];
  const bNumberDialed = event["variable_b_number_dialed"];
  if (!rangeId || !trunkId || !aNumber || !bNumber || !bNumberDialed) {
    console.warn("[cdr] missing attribution vars, skipping", {
      uuid: event["Unique-ID"],
    });
    return null;
  }
  const billsec = Number(event["variable_billsec"] ?? 0);
  const createdUsec = Number(event["variable_start_uepoch"] ?? 0);
  const endedUsec = Number(event["variable_end_uepoch"] ?? Date.now() * 1000);
  return {
    rangeId,
    trunkId,
    aNumber,
    bNumber,
    bNumberDialed,
    billsec: Number.isFinite(billsec) ? billsec : 0,
    startedAt: new Date(Math.floor(createdUsec / 1000) || Date.now()),
    endedAt: new Date(Math.floor(endedUsec / 1000) || Date.now()),
  };
}

async function writeCdr(cdr: CdrEvent): Promise<void> {
  try {
    await db.insert(voiceCdrs).values({
      atVoiceRangeId: cdr.rangeId,
      voiceTrunkId: cdr.trunkId,
      aNumber: cdr.aNumber,
      bNumber: cdr.bNumber,
      bNumberDialed: cdr.bNumberDialed,
      startedAt: cdr.startedAt,
      endedAt: cdr.endedAt,
      durationSeconds: cdr.billsec,
      // TODO: populate buy/sell currency + rate from at_voice_ranges lookup
      // once a rate snapshot column exists on the range or a separate
      // rate-history table lands. For now, mirror range currency at IVR
      // (inbound carrier rate) using carrier_currency/carrier_rate_per_minute.
      buyCurrency: "usd",
      buyRate: "0",
      sellCurrency: "usd",
      sellRate: "0",
      internalRouteName: "ivr-welcome",
    });
  } catch (err) {
    console.error("[cdr] insert failed:", err);
  }
}

async function settleQuota(redis: Redis, cdr: CdrEvent): Promise<void> {
  const date = utcDate();
  const delta = cdr.billsec - RESERVE_SEC;
  const keys = [
    `quota:range:${cdr.rangeId}:total:${date}`,
    `quota:range:${cdr.rangeId}:a:${cdr.aNumber}:${date}`,
    `quota:range:${cdr.rangeId}:b:${cdr.bNumber}:${date}`,
    `quota:range:${cdr.rangeId}:ab:${cdr.aNumber}:${cdr.bNumber}:${date}`,
  ];
  console.log(
    `[cdr] settle range=${cdr.rangeId} billsec=${cdr.billsec} delta=${delta}`,
  );
  for (const k of keys) {
    try {
      const next = await redis.incrby(k, delta);
      await redis.expire(k, TTL_SEC);
      console.log(`[cdr]   ${k} -> ${next}`);
    } catch (err) {
      console.error(`[cdr] redis settle failed for ${k}:`, err);
    }
  }
}

function utcDate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
