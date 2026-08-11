import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isCurrentWeek,
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  mondayUtc,
  parseSlot,
  validateAndSanitizeImage,
} from "./logic.ts";

function u32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
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

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes);
  crcInput.set(data, typeBytes.length);
  const result = new Uint8Array(12 + data.length);
  result.set(u32(data.length), 0);
  result.set(typeBytes, 4);
  result.set(data, 8);
  result.set(u32(crc32(crcInput)), 8 + data.length);
  return result;
}

function png(includeText = false): Uint8Array {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(10), 0);
  ihdr.set(u32(20), 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunks = [chunk("IHDR", ihdr)];
  if (includeText) {
    chunks.push(chunk("tEXt", new TextEncoder().encode("Location\0secret")));
  }
  chunks.push(
    chunk("IDAT", new Uint8Array([1, 2, 3])),
    chunk("IEND", new Uint8Array()),
  );
  const size = signature.length +
    chunks.reduce((total, value) => total + value.length, 0);
  const result = new Uint8Array(size);
  result.set(signature);
  let offset = signature.length;
  for (const value of chunks) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function jpeg(width = 10, height = 20, includeExif = false): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  if (includeExif) {
    parts.push(0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00);
  }
  parts.push(
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x11,
    0x22,
    0xff,
    0x00,
    0x33,
    0xff,
    0xd9,
  );
  return new Uint8Array(parts);
}

Deno.test("week and slot contract is deterministic", () => {
  const sunday = new Date("2026-08-16T23:59:59Z");
  assertEquals(mondayUtc(sunday), "2026-08-10");
  assert(isCurrentWeek("2026-08-10", sunday));
  assertEquals(parseSlot("front"), "front");
  assertEquals(parseSlot("other"), null);
});

Deno.test("JPEG validation strips EXIF and preserves bounded dimensions", () => {
  const source = jpeg(10, 20, true);
  const result = validateAndSanitizeImage(source, "image/jpeg");
  assert(result);
  assertEquals([result.width, result.height], [10, 20]);
  assert(result.bytes.length < source.length);
  assert(!new TextDecoder().decode(result.bytes).includes("Exif"));
});

Deno.test("PNG validation strips text metadata and validates CRC", () => {
  const source = png(true);
  const result = validateAndSanitizeImage(source, "image/png");
  assert(result);
  assertEquals([result.width, result.height], [10, 20]);
  assert(!new TextDecoder().decode(result.bytes).includes("Location"));
  const corrupt = source.slice();
  corrupt[corrupt.length - 1] ^= 1;
  assertEquals(validateAndSanitizeImage(corrupt, "image/png"), null);
});

Deno.test("validation rejects MIME spoofing, excessive dimensions and size", () => {
  assertEquals(validateAndSanitizeImage(jpeg(), "image/png"), null);
  assertEquals(
    validateAndSanitizeImage(jpeg(MAX_IMAGE_DIMENSION + 1, 20), "image/jpeg"),
    null,
  );
  assertEquals(
    validateAndSanitizeImage(
      new Uint8Array(MAX_UPLOAD_BYTES + 1),
      "image/jpeg",
    ),
    null,
  );
});
