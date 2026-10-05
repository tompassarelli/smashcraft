// Journal text carried on held keys, for an ingress path with no files or
// text box. The helper holds 54 keys outside the game controls: 49 data keys
// carry up to seven printable 7-bit ASCII bytes, least significant bit first,
// three keys the byte count and one the final-chunk flag, and toggling the
// commit key publishes the chunk. The keys stay held until the map writes the
// chunk's receipt. Key order and the receipt's spelling are a protocol.

const BYTE_BITS = 7;
const LENGTH_KEY = 49;
const FINAL_KEY = 52;

/** F20: its toggle publishes the chunk on the other keys. */
export const COMMIT_KEY = 0x83;

/** Warcraft key codes in carrier order. */
export const CARRIER_KEYS: readonly number[] = [
  // Data: digits, A to X, Z (Y is the pause key), OEM punctuation, F13 to F15.
  0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
  0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c,
  0x4d, 0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
  0x5a,
  0xbd, 0xbb, 0xdb, 0xdd, 0xdc, 0xba, 0xde, 0xbc, 0xbe, 0xbf, 0xc0,
  0x7c, 0x7d, 0x7e,
  // Byte count (F16 to F18), final chunk (F19), commit (F20).
  0x7f, 0x80, 0x81, 0x82, COMMIT_KEY,
];

export function isCarrierKey(key: number): boolean {
  return CARRIER_KEYS.includes(key);
}

export interface KeyboardChunk {
  readonly text: string;
  /** The message's last chunk. */
  readonly final: boolean;
}

/** Bits on consecutive carrier keys, least significant first. */
function bitsAt(keys: readonly boolean[], first: number, count: number): number {
  let value = 0;
  for (let index = first + count - 1; index >= first; index--) value = value * 2 + (keys[index] === true ? 1 : 0);
  return value;
}

/** The chunk on the carrier keys, indexed in carrier order; undefined for no chunk or one no helper sends. */
export function decodeChunk(keys: readonly boolean[]): KeyboardChunk | undefined {
  const length = bitsAt(keys, LENGTH_KEY, 3);
  if (length === 0) return undefined;
  let text = "";
  for (let offset = 0; offset < length; offset++) {
    const code = bitsAt(keys, offset * BYTE_BITS, BYTE_BITS);
    if (code < 32 || code > 126) return undefined;
    text += String.fromCharCode(code);
  }
  return { text, final: keys[FINAL_KEY] === true };
}

/**
 * One epoch's chunks, assembled into messages. Every chunk but a message's
 * last is acknowledged when taken; the last is acknowledged once the message
 * has been used, which releases the helper to send the next.
 */
export class KeyboardMailbox {
  private commit = false;
  private chunks = 0;
  private text = "";
  private complete = false;

  constructor(
    readonly build: string,
    readonly epoch: number,
    readonly slot: number,
  ) {}

  /** Whether the commit key moved since the last chunk taken: a new chunk is on the keys. */
  pending(commitKey: boolean): boolean {
    return commitKey !== this.commit;
  }

  /** Takes the chunk the commit key published; true when its receipt is due now. */
  take(commitKey: boolean, chunk: KeyboardChunk): boolean {
    this.commit = commitKey;
    this.text += chunk.text;
    this.chunks++;
    this.complete = chunk.final;
    return !chunk.final;
  }

  /** The assembled message, once its final chunk has arrived. */
  message(): string | undefined {
    return this.complete ? this.text : undefined;
  }

  /** Forgets a used message; true when its final chunk's receipt is due now. */
  release(): boolean {
    if (!this.complete) return false;
    this.text = "";
    this.complete = false;
    return true;
  }

  /** The receipt for the latest chunk, as a Preload file the helper polls. */
  receipt(): { readonly name: string; readonly line: string } {
    const { build, epoch, slot, chunks } = this;
    return {
      name: `smashcraft-journal-mailbox-ack-${build}-e${epoch}-s${slot}-c${chunks}.txt`,
      line: `SMASHCRAFT KEYBOARD ACK v=1 build=${build} epoch=${epoch} slot=${slot} chunk=${chunks}`,
    };
  }
}
