// Companion J1 envelopes use zero-padded epoch/sequence/checksum fields and checksummed I4 payload text.






import { floorMod, imod } from "wisp/src/sim/intMath";
import { ALPHABET } from "../../input/wire";
import { padDecimal, parseDecimal } from "./decimal";


export const TEXT_WINDOW = 16;







export const TYPED_AHEAD_CHARACTERS = 160;

const CHECKSUM_ALPHABET = `${ALPHABET}|`;
const PAYLOAD_START = 29;
const LAST_SEQUENCE = 2147483647;

function textChecksum(text: string): number | undefined {
  let checksum = 0;
  for (let i = 0; i < text.length; i++) {
    const symbol = CHECKSUM_ALPHABET.indexOf(text.charAt(i));
    if (symbol < 0) return undefined;
    checksum = imod(checksum * 251 + symbol + 1, 65521);
  }
  return checksum;
}

export function textEnvelope(epoch: number, sequence: number, payload: string): string | undefined {
  const identity = padDecimal(epoch, 10) + padDecimal(sequence, 10);
  const checksum = textChecksum(`${identity}|${payload}`);
  return checksum === undefined ? undefined : `@J1${identity}${padDecimal(checksum, 5)}|${payload};`;
}


export type Inspection =

  | { kind: "wait" }

  | { kind: "ready"; width: number }

  | { kind: "skip"; width: number }

  | { kind: "invalid"; width: number };

const WAIT: Inspection = { kind: "wait" };

interface Received {
  readonly sequence: number;
  readonly payload: string;
}







export class JournalTextStream {
  private readonly window: (Received | undefined)[] = [];
  private receivedThrough = 0;
  private consumedThrough = 0;

  constructor(readonly epoch: number) {}

  received(): number {
    return this.receivedThrough;
  }

  acknowledged(): number {
    return this.consumedThrough;
  }


  next(): string | undefined {
    if (this.receivedThrough <= this.consumedThrough) return undefined;
    return this.at(this.consumedThrough + 1)?.payload;
  }

  consume(): boolean {
    if (this.receivedThrough <= this.consumedThrough) return false;
    this.consumedThrough++;
    return true;
  }

  inspect(text: string): Inspection {
    if (text === "") return WAIT;
    const start = text.indexOf("@");
    if (start !== 0) return { kind: "skip", width: start < 0 ? text.length : start };
    const delimiter = text.indexOf(";");

    const restart = text.indexOf("@", 1);
    if (restart >= 0 && (delimiter < 0 || restart < delimiter)) return { kind: "skip", width: restart };
    if (delimiter < 0) return WAIT;
    const width = delimiter + 1;
    const skip: Inspection = { kind: "skip", width };
    if (delimiter < PAYLOAD_START + 1 || !text.startsWith("@J1") || text.charAt(PAYLOAD_START - 1) !== "|") return skip;
    const epochText = text.substring(3, 13);
    const sequenceText = text.substring(13, 23);
    const sequence = parseDecimal(sequenceText);
    const checksum = parseDecimal(text.substring(23, 28));
    if (epochText !== padDecimal(this.epoch, 10) || sequence === undefined || sequence < 1 || checksum === undefined) return skip;
    const payload = text.substring(PAYLOAD_START, delimiter);
    if (checksum !== textChecksum(`${epochText}${sequenceText}|${payload}`)) return skip;
    const held = this.at(sequence);
    const contradicts = held !== undefined && held.payload !== payload;
    if (sequence <= this.receivedThrough) {
      return this.receivedThrough - sequence < TEXT_WINDOW && contradicts ? { kind: "invalid", width } : skip;
    }
    if (sequence - this.consumedThrough > TEXT_WINDOW) return { kind: "invalid", width };
    if (held !== undefined) return contradicts ? { kind: "invalid", width } : skip;
    this.window[floorMod(sequence, TEXT_WINDOW)] = { sequence, payload };
    while (this.receivedThrough < LAST_SEQUENCE && this.receivedThrough - this.consumedThrough < TEXT_WINDOW
      && this.at(this.receivedThrough + 1) !== undefined) {
      this.receivedThrough++;
    }
    return { kind: "ready", width };
  }


  private at(sequence: number): Received | undefined {
    const received = this.window[floorMod(sequence, TEXT_WINDOW)];
    return received?.sequence === sequence ? received : undefined;
  }
}
