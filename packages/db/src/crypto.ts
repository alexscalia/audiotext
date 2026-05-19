import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_ENV = "TRUNK_SECRET_KEY";

function getKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) throw new Error(`${KEY_ENV} is not set`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} must be 32 bytes (base64 encoded)`);
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

export function decryptSecret(blob: string): string {
  const [ivB64, ctB64, tagB64] = blob.split(".");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("invalid ciphertext blob");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
