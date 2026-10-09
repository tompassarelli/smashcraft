// Companion vocabulary filenames are a protocol; publish the readiness marker last.




import { ALPHABET, HEADER_MIN_BYTES, PACKET_MAX_BYTES, RECORD_MIN_BYTES } from "../../input/wire";

export const symbolFile = (base: string, offset: number) => `${base}-c${offset}.pld`;
export const markerFile = (base: string) => `${base}-length.pld`;


export type ReadFile = (filename: string) => string | undefined;

export type VocabularyRead =

  | { kind: "missing" }

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


export function readVocabularyPacket(read: ReadFile, base: string): VocabularyRead {
  return readText(read, base, HEADER_MIN_BYTES + RECORD_MIN_BYTES, PACKET_MAX_BYTES, ALPHABET);
}


export function readVocabularyControlAck(read: ReadFile, base: string): VocabularyRead {
  return readText(read, base, 1, ALPHABET.length - 1, `${ALPHABET}|`);
}
