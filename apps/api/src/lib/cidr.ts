import { z } from "@hono/zod-openapi";

// Max hosts per single expansion. Forces v4 prefix >= 24 and v6 prefix >= 120.
export const MAX_CIDR_HOSTS = 256;

export class CidrError extends Error {
  constructor(
    public readonly code: "invalid" | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "CidrError";
  }
}

export type ExpandedCidr = {
  canonicalCidr: string;
  hosts: string[];
};

export function expandCidr(input: string): ExpandedCidr {
  const trimmed = input.trim();
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    throw new CidrError("invalid", "missing prefix length");
  }
  const addr = trimmed.slice(0, slash);
  const prefixStr = trimmed.slice(slash + 1);
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0) {
    throw new CidrError("invalid", "prefix length must be a non-negative integer");
  }

  if (z.ipv4().safeParse(addr).success) {
    return expandV4(addr, prefix);
  }
  if (z.ipv6().safeParse(addr).success) {
    return expandV6(addr, prefix);
  }
  throw new CidrError("invalid", "not a valid IPv4 or IPv6 address");
}

function expandV4(addr: string, prefix: number): ExpandedCidr {
  if (prefix < 0 || prefix > 32) {
    throw new CidrError("invalid", "IPv4 prefix must be 0-32");
  }
  const hostBits = 32 - prefix;
  const count = 2 ** hostBits;
  if (count > MAX_CIDR_HOSTS) {
    throw new CidrError(
      "too_large",
      `IPv4 /${prefix} would expand to ${count} hosts; max ${MAX_CIDR_HOSTS}`,
    );
  }
  const parts = addr.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new CidrError("invalid", "malformed IPv4 octets");
  }
  const [a, b, c, d] = parts as [number, number, number, number];
  const baseInt = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << hostBits) >>> 0;
  const start = (baseInt & mask) >>> 0;
  const canonicalAddr = intToV4(start);
  const canonicalCidr = `${canonicalAddr}/${prefix}`;
  const hosts: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    hosts[i] = intToV4((start + i) >>> 0);
  }
  return { canonicalCidr, hosts };
}

function intToV4(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

function expandV6(addr: string, prefix: number): ExpandedCidr {
  if (prefix < 0 || prefix > 128) {
    throw new CidrError("invalid", "IPv6 prefix must be 0-128");
  }
  const hostBits = 128 - prefix;
  if (hostBits > 8) {
    const wouldExpand = BigInt(1) << BigInt(hostBits);
    throw new CidrError(
      "too_large",
      `IPv6 /${prefix} would expand to ${wouldExpand} hosts; max ${MAX_CIDR_HOSTS}`,
    );
  }
  const baseInt = v6ToBigInt(addr);
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const mask =
    hostBits === 128
      ? ZERO
      : (~ZERO << BigInt(hostBits)) & ((ONE << BigInt(128)) - ONE);
  const start = baseInt & mask;
  const count = Number(ONE << BigInt(hostBits));
  const canonicalAddr = bigIntToV6(start);
  const canonicalCidr = `${canonicalAddr}/${prefix}`;
  const hosts: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    hosts[i] = bigIntToV6(start + BigInt(i));
  }
  return { canonicalCidr, hosts };
}

function v6ToBigInt(addr: string): bigint {
  // Split on "::" (at most once) to handle compressed form.
  const dcIdx = addr.indexOf("::");
  let groups: string[];
  if (dcIdx === -1) {
    groups = addr.split(":");
    if (groups.length !== 8) {
      throw new CidrError("invalid", "IPv6 must have 8 groups when uncompressed");
    }
  } else {
    const head = addr.slice(0, dcIdx);
    const tail = addr.slice(dcIdx + 2);
    const headParts = head.length > 0 ? head.split(":") : [];
    const tailParts = tail.length > 0 ? tail.split(":") : [];
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) {
      throw new CidrError("invalid", "IPv6 too many groups around ::");
    }
    groups = [...headParts, ...new Array(missing).fill("0"), ...tailParts];
  }
  let result = BigInt(0);
  const SHIFT16 = BigInt(16);
  for (const g of groups) {
    if (g.length === 0 || g.length > 4 || !/^[0-9a-fA-F]+$/.test(g)) {
      throw new CidrError("invalid", "malformed IPv6 group");
    }
    result = (result << SHIFT16) | BigInt(parseInt(g, 16));
  }
  return result;
}

function bigIntToV6(n: bigint): string {
  const groups: string[] = [];
  const MASK16 = BigInt(0xffff);
  for (let i = 7; i >= 0; i--) {
    const g = Number((n >> BigInt(i * 16)) & MASK16);
    groups.push(g.toString(16));
  }
  return compressV6(groups);
}

function compressV6(groups: string[]): string {
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen < 2) return groups.join(":");
  const head = groups.slice(0, bestStart).join(":");
  const tail = groups.slice(bestStart + bestLen).join(":");
  return `${head}::${tail}`;
}
