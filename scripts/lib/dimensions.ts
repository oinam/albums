import { readFileSync } from "node:fs";

interface Dimensions {
  width: number;
  height: number;
}

/**
 * Reads pixel dimensions straight from the file header.
 *
 * EXIF is unreliable for this — exported and edited files routinely carry an
 * ICC profile and nothing else — so the container itself is the only source
 * that always answers.
 */
export function readDimensions(path: string): Dimensions | null {
  const buf = readFileSync(path);
  return jpeg(buf) ?? png(buf) ?? gif(buf) ?? webp(buf);
}

function jpeg(buf: Buffer): Dimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === undefined) return null;

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

function png(buf: Buffer): Dimensions | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf: Buffer): Dimensions | null {
  if (buf.length < 10 || buf.subarray(0, 3).toString("ascii") !== "GIF") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function webp(buf: Buffer): Dimensions | null {
  if (
    buf.length < 30 ||
    buf.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buf.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null;
  }

  const format = buf.subarray(12, 16).toString("ascii");
  if (format === "VP8 ") {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (format === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (format === "VP8X") {
    const read24 = (at: number): number =>
      (buf[at] ?? 0) | ((buf[at + 1] ?? 0) << 8) | ((buf[at + 2] ?? 0) << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  return null;
}

/** EXIF orientations 5–8 rotate the image a quarter turn, swapping the axes. */
export function applyOrientation(dims: Dimensions, orientation?: number): Dimensions {
  if (orientation !== undefined && orientation >= 5 && orientation <= 8) {
    return { width: dims.height, height: dims.width };
  }
  return dims;
}
