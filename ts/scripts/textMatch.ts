import { f32 } from "wisp/src/sim/f32";
import { copyInput } from "../src/game/input/inputRow";
import { participantInputs } from "../src/game/input/participants";
import { createFrameControls } from "../src/game/match/controls";
import { CPU_TIERS, type CpuTier } from "../src/game/match/cpuProfiles";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { AttackPhase, type Character, DownState, GrabAction, LedgeState, ShieldBreak, SpecialAction } from "../src/game/sim/codes";
import { attackPhase } from "../src/game/sim/conditions";
import { createFighter, type Fighter } from "../src/game/sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { normalName, specialName } from "../src/game/sim/moveNames";
import { createRoster, fighterAt } from "../src/game/sim/roster";
import { mainDeckLeft, mainDeckRight, surfaceCount, surfaceLeft, surfaceRight, surfaceTopZ } from "../src/game/sim/stage";
import { FIELD_STAGES } from "./cpuField";
import { type Command, type FighterView, type Hitbox, InputTimeline, frameLine, headerLines, ledgeDistance, resultLine } from "./textMatchView";

export interface TextMatchOptions {
  readonly seed: number;
  readonly stage: string;
  readonly you: Character;
  readonly cpu: Character;
  readonly level: CpuTier;
  readonly delay: number;
  readonly every: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frames: number | undefined;
}

export const DEFAULT_OPTIONS: TextMatchOptions = {
  seed: 0, stage: "sky-deck", you: selectableCharacterBySlug("blademaster") ?? 3, cpu: selectableCharacterBySlug("rifleman") ?? 1,
  level: "expert", delay: 4, every: 1, stocks: 3, minutes: 4, frames: undefined,
};

const REACH = 150;
const SIDE_PLATFORMS_FROM = 1;

function stateOf(f: Readonly<Fighter>): string {
  if (f.status.out) return "out";
  if (f.ledge.state !== LedgeState.none) return ["", "ledge-hang", "ledge-climb", "ledge-roll", "ledge-attack"][f.ledge.state] ?? "ledge";
  if (f.launch.hitlag > 0) return "hitlag";
  if (f.status.frozenFrames > 0) return "frozen";
  if (f.down.state !== DownState.none) return f.down.state === DownState.tumble ? "tumble" : "down";
  if (f.launch.hitstun > 0) return f.motion.grounded ? "hitstun" : "tumble";
  if (f.grab.owner !== undefined) return "grabbed";
  if (f.grab.action !== GrabAction.none) return ["", "grab-hold", "pummel", "throw-forward", "throw-back", "throw-up", "throw-down", "grab-escape"][f.grab.action] ?? "grab";
  if (f.shield.breakState !== ShieldBreak.none) return "shield-break";
  if (f.special.action !== SpecialAction.none) return `special-${specialName(f.character, f.special.action, f.special.form).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (f.attack.style !== undefined) return `${normalName(f.attack.style).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${["", "startup", "active", "recovery"][attackPhase(f)] ?? ""}`;
  if (f.shield.raised) return "shield";
  if (!f.motion.grounded) return f.jump.isDouble ? "air-double-jumped" : "air";
  if (f.motion.crouching) return "crouch";
  if (f.ground.action === 1) return "dash";
  if (f.ground.action === 2) return "run";
  return Math.abs(f.motion.vx) > 1.0 ? "walk" : "idle";
}

function platformOf(f: Readonly<Fighter>, stage: number, frame: number): FighterView["platform"] {
  let best: { dx: number; dz: number } | undefined;
  for (let index = SIDE_PLATFORMS_FROM; index < surfaceCount(stage); index++) {
    const left = surfaceLeft(stage, index, frame);
    const right = surfaceRight(stage, index, frame);
    const dx = f.motion.x < left ? left - f.motion.x : f.motion.x > right ? f.motion.x - right : 0;
    const dz = surfaceTopZ(stage, index, frame) - f.motion.z;
    if (best === undefined || Math.abs(dx) + Math.abs(dz) < Math.abs(best.dx) + Math.abs(best.dz)) best = { dx, dz };
  }
  return best;
}

const region = emptyHitRegion();

function hitboxesOf(f: Readonly<Fighter>, other: Readonly<Fighter>): Hitbox[] {
  const style = f.attack.style;
  if (style === undefined || f.status.out || attackPhase(f) !== AttackPhase.active) return [];
  const boxes: Hitbox[] = [];
  const localX = f32(other.motion.x - f.motion.x) * f.facing;
  const localZ = f32(other.motion.z - f.motion.z);
  for (let index = 0; index < authoredHitRegionCount(style, f.tuning.moves); index++) {
    authoredHitRegion(region, f.character, style, f.attack.frame, f.attack.smashChargeFrames, index, f.tuning.moves);
    if (region.window <= 0) continue;
    const gap = Math.max(region.minX - localX, localX - region.maxX, region.minZ - localZ, localZ - region.maxZ, 0);
    if (gap <= REACH) boxes.push({ move: normalName(style), minX: region.minX, maxX: region.maxX, minZ: region.minZ, maxZ: region.maxZ, gap });
  }
  return boxes;
}

function viewOf(label: string, f: Readonly<Fighter>, other: Readonly<Fighter>, stage: number, frame: number): FighterView {
  return {
    label, x: f.motion.x, z: f.motion.z, percent: f.status.damage, stocks: f.status.stocks, state: stateOf(f), facing: f.facing,
    ledge: ledgeDistance(f.motion.x, mainDeckLeft(stage), mainDeckRight(stage)), platform: platformOf(f, stage, frame), hitboxes: hitboxesOf(f, other),
  };
}

export interface TextMatch {
  readonly lines: readonly string[];
  readonly frames: number;
  readonly winner: "A" | "B" | "none";
}

export function playTextMatch(options: TextMatchOptions, commands: readonly Command[]): TextMatch {
  const stage = FIELD_STAGES[options.stage];
  if (stage === undefined) throw new Error(`no stage named ${options.stage} (known: ${Object.keys(FIELD_STAGES).join(" ")})`);
  if (!CPU_TIERS.includes(options.level)) throw new Error(`no computer level ${options.level} (known: ${CPU_TIERS.join(" ")})`);
  if (!Number.isInteger(options.every) || options.every < 1) throw new Error(`--every ${options.every} is not a positive whole number`);
  const match = createMatchState();
  setParticipants(match, 1, 2);
  match.characterChoices[0] = options.you;
  match.characterChoices[1] = options.cpu;
  match.stageChoice = stage;
  match.cpuOpponents[1] = "wren";
  match.cpuResolvedOpponents[1] = "wren";
  match.cpuTiers[1] = options.level;
  match.matchSeed = options.seed;
  match.stockCount = options.stocks;
  match.timeLimitMinutes = options.minutes;
  match.remainingFrames = options.minutes * 60 * MATCH_TICKS_PER_SECOND;
  match.phase = Phase.match;
  const world = createRoster(3, [createFighter(options.you, f32(matchSpawnX(0)), 1), createFighter(options.cpu, f32(matchSpawnX(1)), -1)]);
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const rows = participantInputs();
  const timeline = new InputTimeline(commands, options.delay);
  initializeMatchFighters(match, world);
  const limit = options.frames ?? (options.minutes * 60 + 5) * MATCH_TICKS_PER_SECOND;
  const lines = headerLines({
    seed: options.seed, stage: options.stage, you: fighterSlug(options.you), cpu: fighterSlug(options.cpu), level: options.level,
    delay: options.delay, every: options.every, stocks: options.stocks,
  });
  const a = fighterAt(world, 0);
  const b = fighterAt(world, 1);
  const show = (frame: number) => lines.push(frameLine(frame, [viewOf("A", a, b, stage, frame), viewOf("B", b, a, stage, frame)]));
  let frame = 0;
  show(frame);
  while (match.phase === Phase.match && frame < limit) {
    frame = runtime.simulationFrame + 1;
    copyInput(rows[0], timeline.row(frame));
    if (!captureNetworkFrame(row, frame, rows, world, 1)) throw new Error(`capture refused frame ${frame}`);
    if (!executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`execution refused frame ${frame}`);
    if (frame % options.every === 0) show(frame);
  }
  const winner = match.winner === 0 ? "A" : match.winner === 1 ? "B" : "none";
  lines.push(resultLine(frame, winner, match.timedOut));
  return { lines, frames: frame, winner };
}
