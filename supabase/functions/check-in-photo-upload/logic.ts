export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 12_000;

export type CheckInPhotoSlot = "front" | "side";

export interface ValidatedImage {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
  width: number;
  height: number;
}

export function mondayPrague(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  const pragueDate = new Date(
    Date.UTC(value("year"), value("month") - 1, value("day")),
  );
  const daysSinceMonday = (pragueDate.getUTCDay() + 6) % 7;
  pragueDate.setUTCDate(pragueDate.getUTCDate() - daysSinceMonday);
  return pragueDate.toISOString().slice(0, 10);
}

export function parseSlot(value: string | null): CheckInPhotoSlot | null {
  return value === "front" || value === "side" ? value : null;
}

export function isCurrentWeek(
  value: string | null,
  now = new Date(),
): value is string {
  return value === mondayPrague(now);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function validateDimensions(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height) &&
    width > 0 && height > 0 && width <= MAX_IMAGE_DIMENSION &&
    height <= MAX_IMAGE_DIMENSION;
}

function sanitizeJpeg(bytes: Uint8Array): ValidatedImage | null {
  if (bytes.length < 8 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return null;
  }

  const output: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  let width = 0;
  let height = 0;
  let foundScan = false;

  while (offset < bytes.length - 2) {
    const markerStart = offset;
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset++];
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9) return null;

    if (marker === 0xda) {
      if (offset + 2 > bytes.length) return null;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length - 2) return null;
      output.push(bytes.slice(markerStart));
      foundScan = true;
      break;
    }

    // Restart and TEM markers are only valid inside entropy-coded scan data.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    const segmentEnd = offset + length;

    const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3 ||
      marker >= 0xc5 && marker <= 0xc7 ||
      marker >= 0xc9 && marker <= 0xcb ||
      marker >= 0xcd && marker <= 0xcf;
    if (isStartOfFrame) {
      if (length < 7) return null;
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (!validateDimensions(width, height)) return null;
    }

    // Keep only JFIF/Adobe application data. EXIF, XMP, comments and other
    // application metadata are removed before the health image is persisted.
    const isApplicationMetadata = marker >= 0xe0 && marker <= 0xef;
    const keep = !isApplicationMetadata || marker === 0xe0 || marker === 0xee;
    if (keep && marker !== 0xfe) {
      output.push(bytes.slice(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  if (!foundScan || !validateDimensions(width, height)) return null;
  return {
    bytes: concat(output),
    mimeType: "image/jpeg",
    extension: "jpg",
    width,
    height,
  };
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizePng(bytes: Uint8Array): ValidatedImage | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 33 ||
    !signature.every((value, index) => bytes[index] === value)
  ) return null;

  const output: Uint8Array[] = [bytes.slice(0, 8)];
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;

  while (offset + 12 <= bytes.length) {
    const chunkStart = offset;
    const length = readU32(bytes, offset);
    if (length > MAX_UPLOAD_BYTES || offset + 12 + length > bytes.length) {
      return null;
    }
    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = new TextDecoder().decode(typeBytes);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const storedCrc = readU32(bytes, dataEnd);
    if (crc32(bytes.slice(offset + 4, dataEnd)) !== storedCrc) return null;

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return null;
      width = readU32(bytes, dataStart);
      height = readU32(bytes, dataStart + 4);
      if (!validateDimensions(width, height)) return null;
      if (
        bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 ||
        bytes[dataStart + 12] > 1
      ) return null;
      sawHeader = true;
    } else if (type === "IHDR") {
      return null;
    }

    if (type === "IDAT") sawImageData = true;
    if (type === "acTL" || type === "fcTL" || type === "fdAT") return null;

    // Preserve only chunks required for pixel decoding and basic colour
    // interpretation. Text, EXIF, timestamps and private ancillary chunks are
    // deliberately discarded.
    const keep = [
      "IHDR",
      "PLTE",
      "IDAT",
      "IEND",
      "tRNS",
      "sRGB",
      "gAMA",
      "cHRM",
    ].includes(type);
    if (keep) output.push(bytes.slice(chunkStart, dataEnd + 4));

    offset = dataEnd + 4;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length) return null;
      sawEnd = true;
      break;
    }
  }

  if (!sawHeader || !sawImageData || !sawEnd) return null;
  return {
    bytes: concat(output),
    mimeType: "image/png",
    extension: "png",
    width,
    height,
  };
}

export function validateAndSanitizeImage(
  bytes: Uint8Array,
  declaredMimeType: string | null,
): ValidatedImage | null {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return null;
  const image = sanitizeJpeg(bytes);
  if (!image || image.mimeType !== declaredMimeType?.toLowerCase()) return null;
  return image;
}
