// Journal text published as files of one symbol each, for ingress paths that
// read files. The helper writes "<base>-c<offset>.pld" for every symbol, then
// "<base>-length.pld", whose single I4-alphabet digit is the symbol count. The
// marker is published last, so a missing file means "not yet", never
// "malformed". File names are a protocol.
import { ALPHABET, HEADER_MIN_BYTES, PACKET_MAX_BYTES, RECORD_MIN_BYTES } from "../../input/wire";

export const symbolFile = (base: string, offset: number) => `${base}-c${offset}.pld`;
export const markerFile = (base: string) => `${base}-length.pld`;

/** Reads one published file's text: undefined while it is missing or empty. */
export type ReadFile = (filename: string) => string | undefined;

export type VocabularyRead =
  /** Not published yet, or still being published. */
  | { kind: "missing" }
  /** Published text no writer produces; the journal cannot continue. */
  | { kind: "invalid"; reason: "invalid-vocabulary-length" | "invalid-vocabulary-symbol" }
  | { kind: "text"; text: string };

const MISSING: VocabularyRead = { kind: "missing" };
const INVALID_LENGTH: VocabularyRead = { kind: "invalid", reason: "invalid-vocabulary-length" };
const INVALID_SYMBOL: VocabularyRead = { kind: "invalid", reason: "invalid-vocabulary-symbol" };

function readText(read: ReadFile, base: string, minimum: number, maximum: number, alphabet: string): VocabularyRead {
  const marker = read(markerFile(base));
  if (marker === undefined) return MISSING;
  const length = marker.length === 1 ? ALPHABET.indexOf(marker) : -1;
  if (length < minimum || length > maximum) return INVALID_LENGTH;
  let text = "";
  for (let offset = 0; offset < length; offset++) {
    const symbol = read(symbolFile(base, offset));
    if (symbol === undefined) return MISSING;
    if (symbol.length !== 1 || !alphabet.includes(symbol)) return INVALID_SYMBOL;
    text += symbol;
  }
  return { kind: "text", text };
}

/** An I4 packet the helper published under base; the journal source validates its text. */
export function readVocabularyPacket(read: ReadFile, base: string): VocabularyRead {
  return readText(read, base, HEADER_MIN_BYTES + RECORD_MIN_BYTES, PACKET_MAX_BYTES, ALPHABET);
}

/** A control acknowledgment ("ACK1|..."), as long as one marker digit can count. */
export function readVocabularyControlAck(read: ReadFile, base: string): VocabularyRead {
  return readText(read, base, 1, ALPHABET.length - 1, `${ALPHABET}|`);
}
