import { parseDecimal } from "../netcode/journal/decimal";

export interface VisualCapture {
  readonly token: string;
  readonly frames: readonly number[];
  next: number;
  held: { readonly epoch: number; readonly frame: number } | undefined;
  ticks: number;
}

const captures = new Map<number, VisualCapture>();
export const heldVisualFrame = (slot: number) => captures.get(slot)?.held;
export const visualCapture = (slot: number) => captures.get(slot);
export const clearVisualCapture = (slot: number): void => { captures.delete(slot); };
export const visualReleaseFile = (token: string, slot: number, frame: number) => `smashcraft-visual-${token}-p${slot}-f${frame}.txt`;

/** Diagnostic suffix carried by the existing synchronized quick-match command. */
export function configureVisualCapture(message: string, slot: number): string {
  const marker = message.indexOf(" |capture ");
  if (marker < 0) return message;
  captures.delete(slot);
  const fields = message.substring(marker + 10).split(" ");
  const token = fields[0];
  const rows = fields[slot + 1];
  if (token === undefined || token.length === 0 || token.length > 32 || rows === undefined) return message;
  for (let i = 0; i < token.length; i++) if (!"0123456789abcdefghijklmnopqrstuvwxyz-".includes(token.charAt(i))) return message;
  const frames: number[] = [];
  if (rows !== "-") for (const text of rows.split(",")) {
    const frame = parseDecimal(text);
    if (frame === undefined || frame < 1 || frame > 18000 || frame <= (frames[frames.length - 1] ?? 0)) return message;
    frames.push(frame);
  }
  if (frames.length > 0) captures.set(slot, { token, frames, next: 0, held: undefined, ticks: 0 });
  return message.substring(0, marker);
}

/** Holds only a frame that was actually presented; skipped targets cannot be relabelled. */
export function holdVisualFrame(slot: number, epoch: number, frame: number): boolean {
  const state = captures.get(slot);
  if (state === undefined || state.held !== undefined) return false;
  while (state.next < state.frames.length && (state.frames[state.next] ?? frame) < frame) state.next++;
  if (state.frames[state.next] !== frame) return false;
  state.held = { epoch, frame };
  state.ticks = 0;
  return true;
}

export function releaseVisualFrame(slot: number): void {
  const state = captures.get(slot);
  if (state === undefined || state.held === undefined) return;
  state.held = undefined;
  state.next++;
}
