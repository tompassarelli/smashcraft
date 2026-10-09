// Companion I4/I5 packet text is an external protocol.









import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { ALL_ACTIONS } from "./actions";
import { type Direction, type InputRow, type RowFields, emptyInput, isInputRow, predictInto, sameInput } from "./inputRow";

export const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";


export const INPUT_LAST_FRAME = 2147483646;
const MAX_EPOCH = 2147483647;
export const HEADER_MIN_BYTES = 5;
const HEADER_MAX_BYTES = 17;
export const RECORD_MIN_BYTES = 1;
const RECORD_MAX_BYTES = 21;
export const PACKET_MAX_BYTES = HEADER_MAX_BYTES + 2 * RECORD_MAX_BYTES;

export interface InputPacket {
  epoch: number;
  firstFrame: number;

  rows: readonly InputRow[];
}

const Flag = { held: 1, edges: 2, axes: 4, triggers: 8, metadata: 16, throws: 32 } as const;


export function inputPacket(epoch: number, firstFrame: number, rows: readonly InputRow[]): InputPacket | undefined {
  const valid = epoch >= 0 && firstFrame >= 1 && firstFrame <= INPUT_LAST_FRAME
    && (rows.length === 1 || rows.length === 2) && firstFrame <= INPUT_LAST_FRAME - (rows.length - 1);
  return valid ? { epoch, firstFrame, rows } : undefined;
}

export function packetSizeInRange(bytes: number, records: number): boolean {
  return (records === 1 || records === 2)
    && bytes >= HEADER_MIN_BYTES + RECORD_MIN_BYTES * records
    && bytes <= HEADER_MAX_BYTES + RECORD_MAX_BYTES * records;
}




function digits(value: number, width: number): string {
  let text = "";
  let remaining = value;
  for (let i = 0; i < width; i++) {
    text = ALPHABET[remaining & 63] + text;
    remaining = floorDiv(remaining, 64);
  }
  return text;
}

function varint(value: number): string {
  let text = "";
  let remaining = value;
  do {
    const payload = remaining & 31;
    remaining = floorDiv(remaining, 32);
    text += ALPHABET[payload | (remaining > 0 ? 32 : 0)];
  } while (remaining > 0);
  return text;
}


const directionDigit = (value: Direction) => (value < 0 ? 1 : value * 2);
const signedDigit = (value: number) => (value < 0 ? -2 * value - 1 : 2 * value);
const signedValue = (digit: number) => (floorMod(digit, 2) === 1 ? -floorDiv(digit + 1, 2) : floorDiv(digit, 2));

function encodeRecord(row: Readonly<InputRow>): string {
  let flags = 0;
  let body = "";
  const group = (flag: number, text: string) => {
    flags |= flag;
    body += text;
  };
  if (row.held !== 0) group(Flag.held, digits(row.held, 3));
  if (row.pressed !== 0 || row.released !== 0) group(Flag.edges, digits(row.pressed, 3) + digits(row.released, 3));
  const axes = signedDigit(row.axisX) * 255 + signedDigit(row.axisZ);
  if (axes !== 0) group(Flag.axes, digits(axes, 3));
  const triggers = row.triggerLeft * 256 + row.triggerRight;
  if (triggers !== 0) group(Flag.triggers, digits(triggers, 3));

  const metadata = directionDigit(row.specialX) + 3 * directionDigit(row.specialZ)
    + 9 * directionDigit(row.dodgeX) + 27 * directionDigit(row.dodgeZ)
    + 81 * directionDigit(row.sdiX) + 243 * directionDigit(row.sdiZ) + 729 * directionDigit(row.ledgeVertical);
  if (metadata !== 0) group(Flag.metadata, digits(metadata, 2));
  const throws = signedDigit(row.throwX) * 255 + signedDigit(row.throwZ);
  if (throws !== 0) group(Flag.throws, digits(throws, 3));
  return digits(flags, 1) + body;
}

export function encodePacket(packet: InputPacket): string {
  return `I4${digits(packet.rows.length, 1)}${varint(packet.epoch)}${varint(packet.firstFrame)}${packet.rows.map((row) => encodeRecord(row)).join("")}`;
}




class Reader {
  offset: number;
  constructor(private readonly text: string, offset: number) {
    this.offset = offset;
  }

  atEnd(): boolean {
    return this.offset === this.text.length;
  }

  digit(): number | undefined {
    if (this.offset >= this.text.length) return undefined;
    const value = ALPHABET.indexOf(this.text.charAt(this.offset));
    if (value < 0) return undefined;
    this.offset++;
    return value;
  }

  digits(width: number): number | undefined {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const digit = this.digit();
      if (digit === undefined) return undefined;
      value = (value << 6) | digit;
    }
    return value;
  }


  varint(maximum: number): number | undefined {
    let value = 0;
    let multiplier = 1;
    for (let i = 0; i < 7; i++) {
      const digit = this.digit();
      if (digit === undefined) return undefined;
      const payload = digit & 31;
      const last = digit < 32;
      if ((last && i > 0 && payload === 0) || (i === 6 && payload > 1)) return undefined;
      if (payload > floorDiv(maximum - value, multiplier)) return undefined;
      value += payload * multiplier;
      if (last) return value;
      multiplier *= 32;
    }
    return undefined;
  }


  group(width: number, maximum: number): number | undefined {
    const value = this.digits(width);
    return value !== undefined && value > 0 && value <= maximum ? value : undefined;
  }
}

function decodeRecord(reader: Reader): InputRow | undefined {
  const flags = reader.digit();
  if (flags === undefined) return undefined;
  const present = (flag: number) => (flags & flag) !== 0;

  const held = present(Flag.held) ? reader.group(3, ALL_ACTIONS) : 0;
  const pressed = present(Flag.edges) ? reader.digits(3) : 0;
  const released = present(Flag.edges) ? reader.digits(3) : 0;
  const axes = present(Flag.axes) ? reader.group(3, 65024) : 0;
  const triggers = present(Flag.triggers) ? reader.group(3, 65535) : 0;
  const metadata = present(Flag.metadata) ? reader.group(2, 2186) : 0;
  const throws = present(Flag.throws) ? reader.group(3, 65024) : 0;
  if (held === undefined || pressed === undefined || released === undefined || axes === undefined
    || triggers === undefined || metadata === undefined || throws === undefined) return undefined;
  if (present(Flag.edges) && pressed === 0 && released === 0) return undefined;
  const direction = (place: number) => signedValue(floorMod(floorDiv(metadata, place), 3));
  const sdiX = direction(81);
  const sdiZ = direction(243);

  const row: Required<RowFields> = {
    held, pressed, released,
    axisX: signedValue(floorDiv(axes, 255)), axisZ: signedValue(floorMod(axes, 255)),
    triggerLeft: floorDiv(triggers, 256), triggerRight: floorMod(triggers, 256),
    specialX: direction(1), specialZ: direction(3), dodgeX: direction(9), dodgeZ: direction(27),
    sdi: sdiX !== 0 || sdiZ !== 0, sdiX, sdiZ, ledgeVertical: direction(729),
    throwX: signedValue(floorDiv(throws, 255)), throwZ: signedValue(floorMod(throws, 255)),
  };
  return isInputRow(row) ? row : undefined;
}


export function decodePacket(wire: string): InputPacket | undefined {
  if (wire.length < HEADER_MIN_BYTES + RECORD_MIN_BYTES || wire.length > PACKET_MAX_BYTES || !wire.startsWith("I4")) return undefined;
  const reader = new Reader(wire, 2);
  const count = reader.digit();
  if (count === undefined || !packetSizeInRange(wire.length, count)) return undefined;
  const epoch = reader.varint(MAX_EPOCH);
  const firstFrame = reader.varint(INPUT_LAST_FRAME);
  if (epoch === undefined || firstFrame === undefined) return undefined;
  const rows: InputRow[] = [];
  for (let i = 0; i < count; i++) {
    const row = decodeRecord(reader);
    if (row === undefined) return undefined;
    rows.push(row);
  }
  return reader.atEnd() ? inputPacket(epoch, firstFrame, rows) : undefined;
}
















// BlzSendSyncData limits prefix plus data to about 255 bytes; 200 reserves prefix space (jassbot).




export const MESSAGE_MAX_BYTES = 200;

const MESSAGE_MAX_FRAMES = 64;

export interface InputMessage {
  readonly wire: string;
  readonly firstFrame: number;
  readonly lastFrame: number;
}


const HOLD: InputRow = emptyInput();


function holds(row: Readonly<InputRow>, previous: Readonly<InputRow>): boolean {
  predictInto(HOLD, previous);
  return sameInput(row, HOLD);
}

function holdOf(previous: Readonly<InputRow>): InputRow {
  const row = emptyInput();
  predictInto(row, previous);
  return row;
}






export function encodeInputMessage(epoch: number, firstFrame: number, lastFrame: number, rowAt: (frame: number) => Readonly<InputRow>): InputMessage {
  const head = `I5${varint(epoch)}${varint(firstFrame)}`;
  let previous = rowAt(firstFrame);
  let body = encodeRecord(previous);
  let skipped = 0;
  let last = firstFrame;
  const fits = (frames: number, extra: number) => head.length + varint(frames).length + body.length + extra <= MESSAGE_MAX_BYTES;
  for (let frame = firstFrame + 1; frame <= lastFrame && frame - firstFrame < MESSAGE_MAX_FRAMES; frame++) {
    const row = rowAt(frame);
    const frames = frame - firstFrame + 1;
    if (holds(row, previous)) {
      if (!fits(frames, 0)) break;
      skipped++;
    } else {
      const record = varint(skipped) + encodeRecord(row);
      if (!fits(frames, record.length)) break;
      body += record;
      skipped = 0;
      previous = row;
    }
    last = frame;
  }
  return { wire: `${head}${varint(last - firstFrame + 1)}${body}`, firstFrame, lastFrame: last };
}





export function decodeInputMessage(wire: string): InputPacket[] | undefined {
  if (wire.length > MESSAGE_MAX_BYTES || !wire.startsWith("I5")) return undefined;
  const reader = new Reader(wire, 2);
  const epoch = reader.varint(MAX_EPOCH);
  const firstFrame = reader.varint(INPUT_LAST_FRAME);
  const count = reader.varint(MESSAGE_MAX_FRAMES);
  if (epoch === undefined || firstFrame === undefined || count === undefined || count < 1 || firstFrame > INPUT_LAST_FRAME - (count - 1)) return undefined;
  let previous = decodeRecord(reader);
  if (previous === undefined) return undefined;
  const rows: InputRow[] = [previous];
  while (!reader.atEnd()) {
    const skipped = reader.varint(MESSAGE_MAX_FRAMES);
    if (skipped === undefined || rows.length + skipped >= count) return undefined;
    for (let i = 0; i < skipped; i++) rows.push(holdOf(previous));
    const row = decodeRecord(reader);
    if (row === undefined || holds(row, previous)) return undefined;
    rows.push(row);
    previous = row;
  }
  while (rows.length < count) rows.push(holdOf(previous));
  const packets: InputPacket[] = [];
  for (let index = 0; index < count; index += 2) {
    const packet = inputPacket(epoch, firstFrame + index, rows.slice(index, index + 2));
    if (packet === undefined) return undefined;
    packets.push(packet);
  }
  return packets;
}
