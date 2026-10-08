/**
 * BLP1 JPEG writer for map textures. Warcraft decodes a BLP1 JPEG as four
 * components, B G R A, with no colour transform, so each channel is coded
 * as its own full-resolution plane in a baseline JPEG.
 */

/** Pixels in RGBA order, rows top to bottom. */
export interface Rgba {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly alpha: boolean;
}

/** Reads an uncompressed true-colour TGA (type 2, 24 or 32 bits), either row order. */
export function readTga(bytes: Uint8Array): Rgba {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idLength = bytes[0] ?? 0, colorMap = bytes[1] ?? 0, type = bytes[2] ?? 0;
  const width = view.getUint16(12, true), height = view.getUint16(14, true), depth = bytes[16] ?? 0, descriptor = bytes[17] ?? 0;
  if (colorMap !== 0 || type !== 2 || (depth !== 24 && depth !== 32)) throw new Error(`unsupported TGA: type ${type}, ${depth} bits`);
  const stride = depth / 8, top = (descriptor & 32) !== 0, start = 18 + idLength;
  if (bytes.length < start + width * height * stride) throw new Error("TGA is shorter than its pixels");
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = start + (top ? y : height - 1 - y) * width * stride;
    for (let x = 0; x < width; x++) {
      const from = row + x * stride, to = (y * width + x) * 4;
      data[to] = bytes[from + 2] ?? 0;
      data[to + 1] = bytes[from + 1] ?? 0;
      data[to + 2] = bytes[from] ?? 0;
      data[to + 3] = stride === 4 ? bytes[from + 3] ?? 0 : 255;
    }
  }
  return { width, height, data, alpha: stride === 4 };
}

// ITU T.81 Annex K: luminance quantisation table.
const BASE_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];
/** Canonical Huffman codes for a table's counts and values: [code, length] by symbol. */
function huffmanCodes(counts: readonly number[], values: readonly number[]) {
  const code = new Uint16Array(256), length = new Uint8Array(256);
  let next = 0, index = 0;
  for (let bits = 1; bits <= 16; bits++) {
    for (let n = 0; n < (counts[bits - 1] ?? 0); n++) {
      const symbol = values[index++] ?? 0;
      code[symbol] = next++;
      length[symbol] = bits;
    }
    next <<= 1;
  }
  return { code, length };
}
const NO_CODES = huffmanCodes([], []);

const COS = Float64Array.from({ length: 64 }, (_, i) => {
  const x = i >> 3, u = i & 7;
  return Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.SQRT1_2 : 1) / 2;
});

/** libjpeg's quality scaling of the Annex K table, in row order. */
export function quantTable(quality: number): Uint8Array {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const scale = q < 50 ? 5000 / q : 200 - q * 2;
  return Uint8Array.from(BASE_QUANT, (value) => Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))));
}

class BitWriter {
  private bytes = new Uint8Array(1 << 16);
  private size = 0;
  private buffer = 0;
  private count = 0;
  write(value: number, bits: number) {
    for (let bit = bits - 1; bit >= 0; bit--) {
      this.buffer = (this.buffer << 1) | ((value >> bit) & 1);
      if (++this.count === 8) {
        this.push(this.buffer);
        if (this.buffer === 0xff) this.push(0);
        this.buffer = 0;
        this.count = 0;
      }
    }
  }
  private push(byte: number) {
    if (this.size === this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2);
      grown.set(this.bytes);
      this.bytes = grown;
    }
    this.bytes[this.size++] = byte;
  }
  /** Pads the last byte with ones and appends EOI. */
  finish(): Uint8Array {
    if (this.count > 0) this.write((1 << (8 - this.count)) - 1, 8 - this.count);
    this.push(0xff);
    this.push(0xd9);
    return this.bytes.slice(0, this.size);
  }
}

const magnitude = (value: number) => {
  let bits = 0;
  for (let v = Math.abs(value); v > 0; v >>= 1) bits++;
  return bits;
};

/** Quantised coefficients of every block, in scan order (block row, block column, component B G R A), zigzag order. */
function quantise(image: Rgba, quant: Uint8Array): Int16Array {
  const { width, height, data } = image;
  const blocksX = Math.ceil(width / 8), blocksY = Math.ceil(height / 8);
  const out = new Int16Array(blocksX * blocksY * 4 * 64), block = new Float64Array(64), rows = new Float64Array(64);
  const channels = [2, 1, 0, 3], natural = new Uint8Array(64);
  ZIGZAG.forEach((index, k) => (natural[index] = k));
  let at = 0;
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      for (let component = 0; component < 4; component++, at += 64) {
        const channel = channels[component] ?? 0;
        for (let y = 0; y < 8; y++) {
          const py = Math.min(height - 1, by * 8 + y);
          for (let x = 0; x < 8; x++) {
            const px = Math.min(width - 1, bx * 8 + x);
            block[y * 8 + x] = (data[(py * width + px) * 4 + channel] ?? 0) - 128;
          }
        }
        for (let y = 0; y < 8; y++) {
          for (let u = 0; u < 8; u++) {
            let sum = 0;
            for (let x = 0; x < 8; x++) sum += (block[y * 8 + x] ?? 0) * (COS[x * 8 + u] ?? 0);
            rows[y * 8 + u] = sum;
          }
        }
        for (let v = 0; v < 8; v++) {
          for (let u = 0; u < 8; u++) {
            let sum = 0;
            for (let y = 0; y < 8; y++) sum += (rows[y * 8 + u] ?? 0) * (COS[y * 8 + v] ?? 0);
            out[at + (natural[v * 8 + u] ?? 0)] = Math.round(sum / (quant[v * 8 + u] ?? 1));
          }
        }
      }
    }
  }
  return out;
}

/** Calls `emit` for each Huffman symbol and its extra bits, per component; `table` is 0 for colour, 1 for alpha. */
function walk(coefficients: Int16Array, emit: (table: number, ac: boolean, symbol: number, extra: number, extraBits: number) => void) {
  const previous = [0, 0, 0, 0];
  for (let at = 0; at < coefficients.length; at += 64) {
    const component = (at >> 6) & 3, table = component === 3 ? 1 : 0;
    const dc = coefficients[at] ?? 0, diff = dc - (previous[component] ?? 0);
    previous[component] = dc;
    const dcBits = magnitude(diff);
    emit(table, false, dcBits, diff < 0 ? diff + (1 << dcBits) - 1 : diff, dcBits);
    let zeros = 0;
    for (let k = 1; k < 64; k++) {
      const value = coefficients[at + k] ?? 0;
      if (value === 0) {
        zeros++;
        continue;
      }
      for (; zeros > 15; zeros -= 16) emit(table, true, 0xf0, 0, 0);
      const size = magnitude(value);
      emit(table, true, (zeros << 4) | size, value < 0 ? value + (1 << size) - 1 : value, size);
      zeros = 0;
    }
    if (zeros > 0) emit(table, true, 0, 0, 0);
  }
}

/** ITU T.81 Annex K.2: code lengths limited to 16 bits from symbol frequencies, as DHT counts and values. */
function optimalTable(frequencies: Uint32Array): { counts: number[]; values: number[] } {
  const freq = Array.from(frequencies, (count) => count);
  freq[256] = 1; // reserves the all-ones code
  const codesize = new Array<number>(257).fill(0), others = new Array<number>(257).fill(-1);
  for (;;) {
    let c1 = -1, c2 = -1;
    for (let i = 0; i <= 256; i++) if ((freq[i] ?? 0) > 0 && (c1 < 0 || (freq[i] ?? 0) <= (freq[c1] ?? 0))) c1 = i;
    for (let i = 0; i <= 256; i++) if ((freq[i] ?? 0) > 0 && i !== c1 && (c2 < 0 || (freq[i] ?? 0) <= (freq[c2] ?? 0))) c2 = i;
    if (c2 < 0) break;
    freq[c1] = (freq[c1] ?? 0) + (freq[c2] ?? 0);
    freq[c2] = 0;
    for (codesize[c1] = (codesize[c1] ?? 0) + 1; (others[c1] ?? -1) >= 0; codesize[c1] = (codesize[c1] ?? 0) + 1) c1 = others[c1] ?? -1;
    others[c1] = c2;
    for (codesize[c2] = (codesize[c2] ?? 0) + 1; (others[c2] ?? -1) >= 0; codesize[c2] = (codesize[c2] ?? 0) + 1) c2 = others[c2] ?? -1;
  }
  const bits = new Array<number>(33).fill(0);
  for (let i = 0; i <= 256; i++) if ((codesize[i] ?? 0) > 0) bits[codesize[i] ?? 0] = (bits[codesize[i] ?? 0] ?? 0) + 1;
  for (let i = 32; i > 16; i--) {
    while ((bits[i] ?? 0) > 0) {
      let j = i - 2;
      while ((bits[j] ?? 0) === 0) j--;
      bits[i] = (bits[i] ?? 0) - 2;
      bits[i - 1] = (bits[i - 1] ?? 0) + 1;
      bits[j + 1] = (bits[j + 1] ?? 0) + 2;
      bits[j] = (bits[j] ?? 0) - 1;
    }
  }
  let longest = 16;
  while ((bits[longest] ?? 0) === 0) longest--;
  bits[longest] = (bits[longest] ?? 0) - 1; // drops the reserved symbol
  const values: number[] = [];
  for (let size = 1; size <= 32; size++) for (let symbol = 0; symbol < 256; symbol++) if (codesize[symbol] === size) values.push(symbol);
  return { counts: bits.slice(1, 17), values };
}

interface Table { readonly counts: number[]; readonly values: number[] }
const segment = (marker: number, body: readonly number[]) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];

/** Baseline JPEG of four full-resolution components (B G R A, no colour transform), split at the scan. */
export function encodeJpegPlanes(image: Rgba, quality: number): { header: Uint8Array; scan: Uint8Array } {
  const quant = quantTable(quality), coefficients = quantise(image, quant);
  const frequencies = [0, 1, 2, 3].map(() => new Uint32Array(256));
  walk(coefficients, (table, ac, symbol) => {
    const counts = frequencies[table * 2 + (ac ? 1 : 0)];
    if (counts !== undefined) counts[symbol] = (counts[symbol] ?? 0) + 1;
  });
  const tables: Table[] = frequencies.map(optimalTable), codes = tables.map(({ counts, values }) => huffmanCodes(counts, values));
  const bits = new BitWriter();
  walk(coefficients, (table, ac, symbol, extra, extraBits) => {
    const { code, length } = codes[table * 2 + (ac ? 1 : 0)] ?? NO_CODES;
    bits.write(code[symbol] ?? 0, length[symbol] ?? 0);
    if (extraBits > 0) bits.write(extra, extraBits);
  });
  const ids = [1, 2, 3, 4], tableOf = (id: number) => (id === 4 ? 1 : 0);
  const header = Uint8Array.from([
    0xff, 0xd8,
    ...segment(0xdb, [0, ...ZIGZAG.map((index) => quant[index] ?? 1)]),
    ...segment(0xc0, [8, image.height >> 8, image.height & 0xff, image.width >> 8, image.width & 0xff, 4, ...ids.flatMap((id) => [id, 0x11, 0])]),
    ...segment(0xc4, tables.flatMap(({ counts, values }, index) => [((index & 1) << 4) | (index >> 1), ...counts, ...values])),
    ...segment(0xda, [4, ...ids.flatMap((id) => [id, tableOf(id) * 0x11]), 0, 63, 0]),
  ]);
  return { header, scan: bits.finish() };
}

/** One-level BLP1 JPEG: 156-byte header, the JPEG header, then mip 0's scan. */
export function encodeBlp(image: Rgba, quality: number): Uint8Array {
  const { header, scan } = encodeJpegPlanes(image, quality);
  const offset = 160 + header.length, out = new Uint8Array(offset + scan.length), view = new DataView(out.buffer);
  out.set([0x42, 0x4c, 0x50, 0x31]);
  view.setUint32(4, 0, true);
  view.setUint32(8, image.alpha ? 8 : 0, true);
  view.setUint32(12, image.width, true);
  view.setUint32(16, image.height, true);
  view.setUint32(20, image.alpha ? 4 : 5, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, offset, true);
  view.setUint32(92, scan.length, true);
  view.setUint32(156, header.length, true);
  out.set(header, 160);
  out.set(scan, offset);
  return out;
}

/** JPEG quality of the fighter portraits (#307). */
export const PORTRAIT_QUALITY = 90;
