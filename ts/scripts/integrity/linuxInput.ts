


const EV_SYN = 0;
export const EV_KEY = 1;
export const EV_ABS = 3;
const SYN_REPORT = 0;



export const BTN_A = 0x130;
export const BTN_B = 0x131;
export const BTN_X = 0x133;
export const BTN_Y = 0x134;
export const BTN_TL = 0x136;
export const BTN_TR = 0x137;
export const BTN_START = 0x13b;

export const BTN_SELECT = 0x13a;

export const ABS_X = 0;
export const ABS_Y = 1;
export const ABS_Z = 2;
export const ABS_RX = 3;
export const ABS_RY = 4;
export const ABS_RZ = 5;


export interface SourceEdge {
  readonly type: number;
  readonly code: number;
  readonly value: number;
}

function iow(number: number, size = 4): number {
  return ((1 << 30) | (size << 16) | (0x55 << 8) | number) >>> 0;
}

const UI_SET_EVBIT = iow(100);
const UI_SET_KEYBIT = iow(101);
const UI_SET_ABSBIT = iow(103);
export const UI_DEV_CREATE = 0x5501;
export const UI_DEV_DESTROY = 0x5502;

export const UI_GET_SYSNAME = ((2 << 30) | (80 << 16) | (0x55 << 8) | 44) >>> 0;
export const EVIOCSCLOCKID = 0x400445a0;
export const CLOCK_REALTIME = 0;
export const CLOCK_MONOTONIC = 1;


export const INPUT_EVENT_BYTES = 24;
const ABS_CNT = 0x40;
const PAD_NAME = "Smashcraft Event Retention Virtual Gamepad";

export const PAD_BUTTONS = [BTN_A, BTN_B, BTN_X, BTN_Y, BTN_TL, BTN_TR, BTN_START] as const;
const PAD_AXES = [ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ] as const;


export function padCapabilities(buttons: readonly number[]): readonly (readonly [request: number, argument: number])[] {
  return [
    [UI_SET_EVBIT, EV_KEY],
    [UI_SET_EVBIT, EV_ABS],
    ...buttons.map((button) => [UI_SET_KEYBIT, button] as const),
    ...PAD_AXES.map((axis) => [UI_SET_ABSBIT, axis] as const),
  ];
}





export function padSetup(): Uint8Array {
  const bytes = new Uint8Array(80 + 8 + 4 + ABS_CNT * 4 * 4);
  bytes.set(new TextEncoder().encode(PAD_NAME));
  const view = new DataView(bytes.buffer);
  view.setUint16(80, 0x03, true);
  view.setUint16(82, 0x045e, true);
  view.setUint16(84, 0x028e, true);
  view.setUint16(86, 0x0114, true);
  const range = (table: number, axis: number, value: number) => view.setInt32(92 + (table * ABS_CNT + axis) * 4, value, true);
  for (const axis of [ABS_X, ABS_Y, ABS_RX, ABS_RY]) {
    range(0, axis, 32767);
    range(1, axis, -32768);
  }
  for (const axis of [ABS_Z, ABS_RZ]) range(0, axis, 32767);
  return bytes;
}






export function edgePacket(monotonicNs: number, edge: SourceEdge): Uint8Array {
  const micros = BigInt(monotonicNs) / 1000n;
  const bytes = new Uint8Array(INPUT_EVENT_BYTES * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, { type, code, value }: SourceEdge) => {
    view.setBigInt64(offset, micros / 1_000_000n, true);
    view.setBigInt64(offset + 8, micros % 1_000_000n, true);
    view.setUint16(offset + 16, type, true);
    view.setUint16(offset + 18, code, true);
    view.setInt32(offset + 20, value, true);
  };
  write(0, edge);
  write(INPUT_EVENT_BYTES, { type: EV_SYN, code: SYN_REPORT, value: 0 });
  return bytes;
}


export interface Injection {

  readonly injectedNs: number;
  readonly beforeNs: number;
  readonly afterNs: number;
}

export interface KernelEvent extends SourceEdge {
  readonly kernelNs: number;
}


export function decodeEvents(bytes: Uint8Array): readonly KernelEvent[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const events: KernelEvent[] = [];
  for (let offset = 0; offset + INPUT_EVENT_BYTES <= bytes.byteLength; offset += INPUT_EVENT_BYTES) {
    events.push({
      kernelNs: Number(view.getBigInt64(offset, true)) * 1_000_000_000 + Number(view.getBigInt64(offset + 8, true)) * 1000,
      type: view.getUint16(offset + 16, true),
      code: view.getUint16(offset + 18, true),
      value: view.getInt32(offset + 20, true),
    });
  }
  return events;
}
