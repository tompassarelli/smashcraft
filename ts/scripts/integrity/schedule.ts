// The integrity workload of one match: every bound action as raw source edges,
// pressed and released within about 5 ms on both pads, isolated and in rapid
// cycles, two buttons at once, and (in each odd match) a helper stall, a game
// stall and a Start pause.
import { ABS_RZ, ABS_X, ABS_Y, ABS_Z, BTN_A, BTN_B, BTN_TL, BTN_TR, BTN_X, BTN_Y, EV_ABS, EV_KEY, type SourceEdge } from "./linuxInput";
import type { Slot } from "./reconcile";

interface Binding extends SourceEdge {
  readonly name: string;
}

/**
 * How the helper reads the pad's face buttons and stick-up. `xpad`: X (0x133)
 * special and Y (0x134) jump, as the kernel's xpad driver reports them, and
 * stick-up only up. `compass-tap-jump`: captures before #49 (r7, r8), whose
 * helper read 0x133 as jump, 0x134 as special and stick-up as up and jump.
 */
export type PadLayout = "xpad" | "compass-tap-jump";

/** The pressed edge of each binding. The reconciler derives action bits independently. */
function bindings(layout: PadLayout) {
  const xpad = layout === "xpad";
  return [
    { name: "move-left", type: EV_ABS, code: ABS_X, value: -32768 },
    { name: "move-right", type: EV_ABS, code: ABS_X, value: 32767 },
    { name: "move-down", type: EV_ABS, code: ABS_Y, value: 32767 },
    { name: xpad ? "move-up" : "jump-stick", type: EV_ABS, code: ABS_Y, value: -32768 },
    { name: "jump-b", type: EV_KEY, code: BTN_B, value: 1 },
    { name: "jump-y", type: EV_KEY, code: xpad ? BTN_Y : BTN_X, value: 1 },
    { name: "attack", type: EV_KEY, code: BTN_A, value: 1 },
    { name: "special", type: EV_KEY, code: xpad ? BTN_X : BTN_Y, value: 1 },
    { name: "shield-lt", type: EV_ABS, code: ABS_Z, value: 32767 },
    { name: "shield-rt", type: EV_ABS, code: ABS_RZ, value: 32767 },
    { name: "grab", type: EV_KEY, code: BTN_TR, value: 1 },
    { name: "walk", type: EV_KEY, code: BTN_TL, value: 1 },
  ] as const satisfies readonly Binding[];
}

/** Press `group` on both pads, release it 5 ms later, then wait `settleMillis`. */
export interface Pulse {
  readonly kind: "pulse";
  readonly label: string;
  readonly group: readonly Binding[];
  readonly settleMillis: number;
}

/** The process a stall stops: slot 0's helper, or client B's game. */
export type StallTarget = { readonly kind: "helper"; readonly slot: 0 } | { readonly kind: "game"; readonly slot: 1 };

type Step =
  | Pulse
  | { readonly kind: "sleep"; readonly millis: number }
  /** Stop the process, pulse while it is stopped, and continue it 250 ms after it stopped. */
  | { readonly kind: "stall"; readonly target: StallTarget; readonly pulses: readonly Pulse[] }
  /** Pause with Start, see both clients paused, resume with Start. */
  | { readonly kind: "pause" };

export const PULSE_HOLD_MILLIS = 5;
export const STALL_MILLIS = 250;
const SETTLE_MILLIS = 45;

const pulse = (group: readonly Binding[], label: string, settleMillis = SETTLE_MILLIS): Pulse => ({ kind: "pulse", label, group, settleMillis });
const sleep = (millis: number): Step => ({ kind: "sleep", millis });

/**
 * One match's workload. Isolated presses give action decisions in settled
 * states; rapid cycles also cover legal rejection during cooldown.
 */
export function integritySchedule(epoch: number, layout: PadLayout): readonly Step[] {
  const odd = epoch % 2 === 1;
  const BINDINGS = bindings(layout);
  const ATTACK = BINDINGS[6];
  const SPECIAL = BINDINGS[7];
  const steps: Step[] = [sleep(700), ...BINDINGS.map((binding) => pulse([binding], "isolated", 750))];
  for (let cycle = 0; cycle < 10; cycle++) {
    steps.push(...BINDINGS.map((binding) => pulse([binding], `repeat-${cycle}`)), pulse([ATTACK, SPECIAL], `simultaneous-${cycle}`));
    if (odd && (cycle === 3 || cycle === 6)) {
      const target: StallTarget = cycle === 3 ? { kind: "helper", slot: 0 } : { kind: "game", slot: 1 };
      steps.push({ kind: "stall", target, pulses: [0, 1, 2, 3].map((index) => pulse([ATTACK], `${target.kind}-stall-${index}`)) }, sleep(600));
    }
  }
  if (odd) steps.push({ kind: "pause" }, sleep(300), ...BINDINGS.map((binding) => pulse([binding], "after-resume")));
  steps.push(sleep(700));
  return steps;
}

export interface Send {
  readonly slot: Slot;
  readonly edge: SourceEdge;
  readonly phase: string;
}

/** A pulse's presses and releases on both pads, in send order. */
export function pulseSends(epoch: number, { label, group }: Pulse): { readonly presses: readonly Send[]; readonly releases: readonly Send[] } {
  const sends = (released: boolean) =>
    ([0, 1] as const).flatMap((slot) =>
      group.map(({ name, type, code, value }): Send => ({ slot, edge: { type, code, value: released ? 0 : value }, phase: `match-${epoch}-integrity-${label}:${name}` })));
  return { presses: sends(false), releases: sends(true) };
}
