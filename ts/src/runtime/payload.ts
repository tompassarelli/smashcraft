// Text payloads for hot reload: base64 survives FileIO, which can't carry
// quotes, backslashes or newlines, and a checksum confirms every client read
// the same bytes before anything runs. Shared by the host tool and the map.
import { floorDiv, floorMod } from "../sim/intMath";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeBase64(bytes: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const triple = a * 65536 + b * 256 + c;
    out.push(ALPHABET[floorDiv(triple, 262144)]!, ALPHABET[floorMod(floorDiv(triple, 4096), 64)]!);
    out.push(i + 1 < bytes.length ? ALPHABET[floorMod(floorDiv(triple, 64), 64)]! : "=");
    out.push(i + 2 < bytes.length ? ALPHABET[floorMod(triple, 64)]! : "=");
  }
  return out.join("");
}

/** Byte values of the decoded text, or undefined for malformed input. */
export function decodeBase64(text: string): number[] | undefined {
  if (floorMod(text.length, 4) !== 0) return undefined;
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    let triple = 0;
    let padding = 0;
    for (let k = 0; k < 4; k++) {
      const char = text[i + k]!;
      const value = char === "=" ? 0 : ALPHABET.indexOf(char);
      if (value < 0) return undefined;
      if (char === "=") padding++;
      triple = triple * 64 + value;
    }
    bytes.push(floorDiv(triple, 65536));
    if (padding < 2) bytes.push(floorMod(floorDiv(triple, 256), 256));
    if (padding < 1) bytes.push(floorMod(triple, 256));
  }
  return bytes;
}

/** Two polynomial lanes. Each modulus is the largest prime keeping lane * 263
 * + 256 + 1 below 2^31, so 32-bit Lua integers never wrap. */
export function checksum(bytes: readonly number[]): string {
  let first = 0;
  let second = 0;
  for (const byte of bytes) {
    first = floorMod(first * 257 + byte + 1, 8165329);
    second = floorMod(second * 263 + byte + 1, 8165323);
  }
  return `${first}:${second}`;
}
