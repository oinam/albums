import { createHash } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ID_LENGTH = 9;
const ENTROPY_BYTES = 6;

/**
 * Derives a stable, opaque, URL-safe identifier from an album slug and filename.
 *
 * The value is a starting point only. Once written into photos.json it is the
 * permalink, and callers must never recompute it for an item that already has
 * one — renaming a file would otherwise silently break every existing link.
 */
export function deriveId(albumSlug: string, file: string): string {
  const digest = createHash("sha256").update(`${albumSlug}/${file}`).digest();
  let value = 0n;
  for (const byte of digest.subarray(0, ENTROPY_BYTES)) {
    value = (value << 8n) | BigInt(byte);
  }

  let out = "";
  for (let i = 0; i < ID_LENGTH; i += 1) {
    out = ALPHABET.charAt(Number(value % 58n)) + out;
    value /= 58n;
  }
  return out;
}
