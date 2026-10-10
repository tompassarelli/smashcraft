









import { ABS_RX, ABS_RY, ABS_X, ABS_Y, ABS_Z, BTN_A, BTN_B, BTN_SELECT, BTN_START, BTN_TL, BTN_TR, BTN_X, BTN_Y, EV_ABS, EV_KEY, type SourceEdge } from "./linuxInput";
import type { Slot } from "./reconcile";

/** Recorded pad scripts and test drivers speak wc3-controller's hidden `script` preset; WC3_PAD_PRESET picks another for a preset check. */
export const padScriptPreset = (): readonly string[] => ["--preset", process.env.WC3_PAD_PRESET ?? "script"];

const PAD_SCRIPT_BUTTONS: Readonly<Record<string, number>> = { A: BTN_A, B: BTN_B, X: BTN_X, Y: BTN_Y, LB: BTN_TL, RB: BTN_TR, TL: BTN_TL, TR: BTN_TR, START: BTN_START, VIEW: BTN_SELECT };

export type PadStep =
  | { readonly kind: "edge"; readonly frame: number; readonly slot: Slot; readonly edges: readonly SourceEdge[]; readonly line: number; readonly text: string }
  | { readonly kind: "capture"; readonly frame: number; readonly slot: Slot; readonly line: number; readonly text: string };

const axis = (value: number) => Math.max(-32768, Math.min(32767, Math.round(value * 32767)));


export function parsePadScript(text: string): readonly PadStep[] {
  const steps: PadStep[] = [];
  let previous = 0;
  text.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const source = raw.replace(/#.*/, "").trim();
    if (source === "") return;
    const [frameText, client, action, ...args] = source.split(/\s+/);
    const fail = (problem: string): never => {
      throw new Error(`pad script line ${line} (${source}): ${problem}`);
    };
    if (frameText === undefined || client === undefined || action === undefined) return fail("needs FRAME CLIENT ACTION");
    const offset = Number(frameText.startsWith("+") ? frameText.slice(1) : frameText);
    if (!Number.isInteger(offset) || offset < 0) fail("FRAME is a whole frame number or +N");
    const frame = frameText.startsWith("+") ? previous + offset : offset;
    if (frame < previous) fail(`frame ${frame} comes before frame ${previous}`);
    previous = frame;
    const slot: Slot = client === "a" ? 0 : client === "b" ? 1 : fail("CLIENT is a or b");
    const number = (value: string | undefined, low: number, high: number, name: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= low && parsed <= high ? parsed : fail(`${name} runs ${low}..${high}`);
    };
    const button = (name: string | undefined) => PAD_SCRIPT_BUTTONS[(name ?? "").toUpperCase()] ?? fail(`unknown button ${name ?? ""}`);
    const edge = (edges: SourceEdge[], at = frame) => steps.push({ kind: "edge", frame: at, slot, edges, line, text: source });
    switch (action) {
      case "press": edge([{ type: EV_KEY, code: button(args[0]), value: 1 }]); break;
      case "release": edge([{ type: EV_KEY, code: button(args[0]), value: 0 }]); break;
      case "tap": {
        const code = button(args[0]);
        const held = args[1] === undefined ? 1 : number(args[1], 1, 600, "FRAMES");
        edge([{ type: EV_KEY, code, value: 1 }]);
        edge([{ type: EV_KEY, code, value: 0 }], frame + held);
        break;
      }
      case "stick":
      case "cstick": {
        const [x, y] = [number(args[0], -1, 1, "X"), number(args[1], -1, 1, "Y")];
        const [codeX, codeY] = action === "stick" ? [ABS_X, ABS_Y] : [ABS_RX, ABS_RY];
        edge([{ type: EV_ABS, code: codeX, value: axis(x) }, { type: EV_ABS, code: codeY, value: axis(-y) }]);
        break;
      }
      case "shield": edge([{ type: EV_ABS, code: ABS_Z, value: Math.round(number(args[0], 0, 1, "AMOUNT") * 32767) }]); break;
      case "capture": steps.push({ kind: "capture", frame, slot, line, text: source }); break;
      default: fail(`unknown action ${action}`);
    }
  });
  return steps.map((step, order) => ({ step, order })).sort((a, b) => a.step.frame - b.step.frame || a.order - b.order).map(({ step }) => step);
}


function helperEvents(log: string): ReadonlyMap<number, number> {
  const landed = new Map<number, number>();
  for (const match of log.matchAll(/^event mono_ns=(\d+) frame=(\d+)/gm)) landed.set(Number(match[1]), Number(match[2]));
  return landed;
}

export interface SentEdge {
  readonly line: number;
  readonly text: string;
  readonly slot: Slot;
  readonly planned: number;
  readonly injectedNs: number;
}

interface LandedEdge extends SentEdge {

  readonly landed: number | undefined;
}


export function landEdges(sent: readonly SentEdge[], logs: readonly [string, string]): readonly LandedEdge[] {
  const events = [helperEvents(logs[0]), helperEvents(logs[1])] as const;
  return sent.map((edge) => ({ ...edge, landed: events[edge.slot].get(edge.injectedNs) }));
}






export function matchStart(log: string): { readonly epoch: number; readonly epochNs: number; readonly firstFrame: number; readonly frameOneNs: number } | undefined {
  const starts = [...log.matchAll(/^match_start epoch=(\d+) epoch_ns=(\d+) first_frame=(\d+)/gm)];
  const last = starts.at(-1);
  if (last === undefined) return undefined;
  const epochNs = Number(last[2]);
  const firstFrame = Number(last[3]);
  if (firstFrame < 1) return undefined;
  return { epoch: Number(last[1]), epochNs, firstFrame, frameOneNs: epochNs - Math.round((firstFrame - 1) * 1e9 / 60) };
}


export const frameWriteNs = (epochNs: number, frame: number): number => epochNs + Math.round(((frame - 1) * 1e9 + 0.2e9) / 60);


export function deadlineOrder<T extends { readonly slot: 0 | 1; readonly frame: number }>(items: readonly T[], epochs: readonly [number, number]): T[] {
  return [...items].sort((a, b) => frameWriteNs(epochs[a.slot], a.frame) - frameWriteNs(epochs[b.slot], b.frame));
}


export const ruleFrame = (epochNs: number, stampNs: number): number => 1 + Math.floor((stampNs - epochNs) * 60 / 1e9);
