import { f32 } from "wisp/src/sim/f32";
import { itemDraw } from "../src/game/match/centreItem";
import { DROP_METER, DROP_TELEGRAPH_FRAMES, type DropPoint, editableMeterDropPoints, meterDropPoints } from "../src/game/match/meterDrops";
import type { MatchState } from "../src/game/match/rules";
import { gainMana } from "../src/game/sim/mana";
import { type Roster, fighterAt } from "../src/game/sim/roster";
import { mainDeckZAt } from "../src/game/sim/stage";

// Field-only variants of #385's meter drops, applied around the shipped rule
// (meterDrops.ts) so a variant is measured before any of it reaches the game:
// centre keeps every drop on the main deck's centre, trailing telegraphs it
// halfway from the centre toward the fighter behind on stocks, and rich
// grants two EX segments on a faster clock.

export const DROP_VARIANTS = ["shipped", "centre", "trailing", "rich"] as const;
export type DropVariant = (typeof DROP_VARIANTS)[number];
export const isDropVariant = (value: string): value is DropVariant => DROP_VARIANTS.some(known => known === value);

const RICH_FIRST_SECONDS = 10;
const RICH_INTERVAL_MIN_SECONDS = 6;
const RICH_INTERVAL_MAX_SECONDS = 10;
const RICH_SALT = 5;

interface DropVariantState {
  readonly variant: DropVariant;
  pickups: number;
  /** The draw whose point the variant last placed. */
  placed: number;
  /** The shipped point list's own entries, restored after a trailing match. */
  readonly shipped: readonly DropPoint[];
}

/** Starts a match's variant after scheduleMeterDrops. */
export function startDropVariant(variant: DropVariant, match: MatchState): DropVariantState {
  const shipped = [...meterDropPoints(match.stageChoice)];
  if (variant === "rich" && match.drops.nextSpawnFrame !== 0) match.drops.nextSpawnFrame = match.startHold + 1 + RICH_FIRST_SECONDS * 60;
  return { variant, pickups: 0, placed: -1, shipped };
}

/** Applies the variant after a frame executes. */
export function advanceDropVariant(state: DropVariantState, match: MatchState, world: Roster): void {
  const { drops } = match;
  if (state.variant === "centre" && drops.nextPoint > 0) drops.nextPoint = 0;
  if (state.variant === "trailing" && drops.nextSpawnFrame !== 0 && drops.draws !== state.placed && drops.nextSpawnFrame - match.matchFrame <= DROP_TELEGRAPH_FRAMES + 1) {
    state.placed = drops.draws;
    const first = fighterAt(world, 0), second = fighterAt(world, 1);
    const behind = first.status.stocks < second.status.stocks ? first : second.status.stocks < first.status.stocks ? second : undefined;
    // The trailing point rides as one more entry after the stage's own points, rewritten per drop.
    const points = editableMeterDropPoints(match.stageChoice);
    points.length = state.shipped.length;
    if (behind !== undefined) {
      const x = f32(behind.motion.x * 0.5);
      points.push({ x, z: mainDeckZAt(match.stageChoice, x) });
      drops.nextPoint = state.shipped.length;
    } else if (drops.nextPoint >= state.shipped.length) drops.nextPoint = 0;
  }
  if (drops.pickupSerial === state.pickups) return;
  state.pickups = drops.pickupSerial;
  if (state.variant !== "rich") return;
  if (drops.lastTaker === 0 || drops.lastTaker === 1) gainMana(fighterAt(world, drops.lastTaker), DROP_METER);
  const seconds = RICH_INTERVAL_MIN_SECONDS + itemDraw(match.matchSeed, drops.draws, RICH_SALT, RICH_INTERVAL_MAX_SECONDS - RICH_INTERVAL_MIN_SECONDS + 1);
  drops.nextSpawnFrame = match.matchFrame + seconds * 60;
}

/** Restores the stage's shipped points after a match. */
export function endDropVariant(state: DropVariantState, match: Readonly<MatchState>): void {
  editableMeterDropPoints(match.stageChoice).length = state.shipped.length;
}
