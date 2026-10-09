// Samples each fighter's moves for the animation scorecard (#367): the move is
// played through the production step and pose selection, and its exported
// timeline body (Classic or Definitive) is posed at the clip time shown.
import { join } from "node:path";
import { originalClip } from "../../src/game/assets/fighterOriginalClipInfo";
import { advanceFighterPose, createFighterPose } from "../../src/game/presentation/fighterPose";
import { extremeCamera } from "../../src/game/presentation/arenaCamera";
import { characterModelScale } from "../../src/game/presentation/modelScale";
import { beginFighterAttack, resolveAttacks } from "../../src/game/sim/attacks";
import { AttackPhase, AttackStyle, Character, SpecialAction } from "../../src/game/sim/codes";
import { beginDamageContacts, finishDamageContacts } from "../../src/game/sim/contacts";
import { type Fighter, createFighter } from "../../src/game/sim/fighter";
import { advanceHeroStatus, runningHeroSpecial } from "../../src/game/sim/heroSpecialRules";
import { HERO_ROSTER, fighterSlug } from "../../src/game/sim/heroes/registry";
import { authoredHitRegionCount } from "../../src/game/sim/hitRegions";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../../src/game/sim/matchCamera";
import { advancePlacedObjects } from "../../src/game/sim/placedObjects";
import { updateProjectiles } from "../../src/game/sim/projectiles";
import { type Controls, createRoster, neutralControls, type Roster } from "../../src/game/sim/roster";
import { advanceSpecials, startFighterSpecial } from "../../src/game/sim/specials";
import { FROZEN_THRONE_STAGE } from "../../src/game/sim/stage";
import { advanceFighter } from "../../src/game/sim/step";
import type { MoveClass, MoveSample, ScoreFrame, ScoreSkeleton } from "./animScore";
import { capture, DrawnModel, type PoseFrame } from "./hurtboxView";

export type Look = "classic" | "definitive";

/** Moves the scorecard reads, by name and class; a fighter without a move skips its row. */
export const SCORED_NORMALS: readonly { readonly move: string; readonly style: AttackStyle; readonly moveClass: MoveClass; readonly aerial: boolean }[] = [
  { move: "jab", style: AttackStyle.jab, moveClass: "jab", aerial: false },
  { move: "jab2", style: AttackStyle.jab2, moveClass: "jab", aerial: false },
  { move: "jab3", style: AttackStyle.jab3, moveClass: "jab", aerial: false },
  { move: "forward-tilt", style: AttackStyle.forwardTilt, moveClass: "tilt", aerial: false },
  { move: "forward-tilt-up", style: AttackStyle.forwardTiltUp, moveClass: "tilt", aerial: false },
  { move: "forward-tilt-down", style: AttackStyle.forwardTiltDown, moveClass: "tilt", aerial: false },
  { move: "up-tilt", style: AttackStyle.upTilt, moveClass: "tilt", aerial: false },
  { move: "down-tilt", style: AttackStyle.downTilt, moveClass: "tilt", aerial: false },
  { move: "dash-attack", style: AttackStyle.dashAttack, moveClass: "tilt", aerial: false },
  { move: "forward-smash", style: AttackStyle.forwardSmash, moveClass: "smash", aerial: false },
  { move: "up-smash", style: AttackStyle.upSmash, moveClass: "smash", aerial: false },
  { move: "down-smash", style: AttackStyle.downSmash, moveClass: "smash", aerial: false },
  { move: "neutral-air", style: AttackStyle.neutralAir, moveClass: "aerial", aerial: true },
  { move: "forward-air", style: AttackStyle.forwardAir, moveClass: "aerial", aerial: true },
  { move: "back-air", style: AttackStyle.backAir, moveClass: "aerial", aerial: true },
  { move: "up-air", style: AttackStyle.upAir, moveClass: "aerial", aerial: true },
  { move: "down-air", style: AttackStyle.downAir, moveClass: "aerial", aerial: true },
];

/** Hero specials by input, grounded; the originals' specials are scripted outside the hero kits and aren't sampled. */
export const SCORED_SPECIALS: readonly { readonly move: string; readonly x: number; readonly z: number }[] = [
  { move: "neutral-special", x: 0, z: 0 }, { move: "side-special", x: 1, z: 0 },
  { move: "up-special", x: 0, z: 1 }, { move: "down-special", x: 0, z: -1 },
];

/**
 * Pelvis and chest names the skeleton is searched for, first match wins; the
 * exceptions below name a fighter's nodes outright.
 */
const PELVIS = [/^bone_pelvis/i, /^pelvis_bind_jnt$/i, /^pelvis$/i, /^hips$/i, /^bone rider waist$/i, /^bone koto waist/i, /^bone_butt$/i, /^spine_c0_0_jnt$/i, /^root$/i, /^bone_root/i];
const CHEST = [/^bone_chest/i, /^chest$/i, /^bone neck$/i, /^bone_neck$/i, /^spine_c0_1_jnt$/i];
/**
 * Arm and leg chains, shoulder or hip to hand or foot; {S} is the side letter
 * and {side} the side word. Every template both of whose nodes exist adds a limb.
 */
const LIMBS: readonly (readonly [string, string, string])[] = [
  ["arm", "^bone_arm1_?{S}$", "^bone_hand_?{S}$"],
  ["arm", "^bone_upperarm{S}$", "^bone_hand{S}$"],
  ["arm", "^bone rider {S} arm$", "^bone rider {S} wrist$"],
  ["arm", "^{S}shoulder$", "^{S}hand$"],
  ["arm", "^arm_{S}0_0_jnt$", "^arm_{S}0_end_jnt$"],
  ["arm", "^{S}_upr_arm_bind_jnt$", "^bone_hand_{side}$"],
  ["leg", "^bone_leg1_?{S}$", "^bone_foot_?{S}$"],
  ["leg", "^bone_upperleg{S}$", "^bone_foot{S}$"],
  ["leg", "^{S}hip$", "^{S}foot$"],
  ["leg", "^leg_{S}0_0_jnt$", "^leg_{S}0_end_jnt$"],
  ["leg", "^{S}_leg_01_bind_jnt$", "^bone_leg_{side}$"],
  ["leg", "^bone back {S} leg(01)?$", "^bone (back {S} toe|toe {S})\\s*$"],
  ["foreleg", "^bone front {S} leg(01)?$", "^bone front ?{S} toe(01)?$"],
];
/** Per-fighter skeleton exceptions: node names to use instead of the name search. */
export const SKELETON_EXCEPTIONS: Readonly<Record<string, { readonly pelvis?: string; readonly chest?: string; readonly limbs?: readonly { readonly name: string; readonly root: string; readonly end: string }[] }>> = {};

/** The frames after a move ends that the return-to-ready check reads. */
const AFTER_FRAMES = 2;
const LIMIT = 150;

/** Pixels per world unit at 1080 rows in the widest gameplay framing (Frozen Throne, far), where the body draws smallest. */
export function gameplayPixelsPerUnit(): number {
  const camera = createMatchCamera();
  extremeCamera(camera, FROZEN_THRONE_STAGE, MATCH_CAMERA_ASPECT, "far");
  return 1080 / (2 * camera.distance * camera.tangent);
}

/** The timeline body a look draws for the fighter, under the assets view. */
export function bodyPath(assets: string, character: Character, look: Look): { readonly classic: string; readonly definitive: string } {
  const clip = originalClip(character, 0);
  if (clip === undefined) throw new Error(`${fighterSlug(character)} has no clip table`);
  const relative = clip.modelPath.replaceAll("\\", "/");
  const root = join(assets, "original-clips-static-lights/imports");
  void look;
  return { classic: join(root, relative), definitive: join(root, "_de.w3mod", relative) };
}

export async function loadBody(assets: string, character: Character, look: Look): Promise<DrawnModel> {
  const paths = bodyPath(assets, character, look);
  // Lich King and Malfurion keep their Classic body in both looks (smashcraft:docs/design/hd-fighters.md).
  const path = look === "definitive" && await Bun.file(paths.definitive).exists() ? paths.definitive : paths.classic;
  return new DrawnModel(await Bun.file(path).arrayBuffer(), characterModelScale(character));
}

export function skeletonOf(model: DrawnModel, character: Character): ScoreSkeleton {
  const nodes = model.nodes();
  const names = nodes.map((node) => node.name);
  const exception = SKELETON_EXCEPTIONS[fighterSlug(character)];
  const find = (patterns: readonly RegExp[], named: string | undefined) => {
    if (named !== undefined) {
      const index = names.indexOf(named);
      if (index < 0) throw new Error(`${fighterSlug(character)}: no node named ${named}`);
      return index;
    }
    for (const pattern of patterns) {
      const index = names.findIndex((name) => pattern.test(name.replace(/ArchDruid$/, "")));
      if (index >= 0) return index;
    }
    return undefined;
  };
  const index = (name: string) => {
    const found = names.indexOf(name);
    if (found < 0) throw new Error(`${fighterSlug(character)}: no node named ${name}`);
    return found;
  };
  const limbs = exception?.limbs?.map((limb) => ({ name: limb.name, root: index(limb.root), end: index(limb.end) })) ?? (["R", "L"] as const).flatMap((side) => LIMBS.flatMap(([kind, root, end]) => {
    const pattern = (template: string) => new RegExp(template.replaceAll("{S}", side).replaceAll("{side}", side === "R" ? "right" : "left"), "i");
    const rootAt = find([pattern(root)], undefined), endAt = find([pattern(end)], undefined);
    return rootAt === undefined || endAt === undefined ? [] : [{ name: `${kind} ${side}`, root: rootAt, end: endAt }];
  }));
  return { names, pelvis: find(PELVIS, exception?.pelvis), chest: find(CHEST, exception?.chest), limbs };
}

function timelineSeconds(character: Character, frame: PoseFrame): number {
  const info = frame.clip === undefined ? undefined : originalClip(character, frame.clip);
  if (info === undefined) throw new Error(`${fighterSlug(character)}: frame ${frame.frame} shows no clip`);
  return info.startSeconds + frame.seconds;
}

function pose(model: DrawnModel, character: Character, frame: PoseFrame): ScoreFrame {
  return { frame: frame.frame, ...model.posed(0, timelineSeconds(character, frame), 1) };
}

/** Steps one simulated frame the way the hero special tests do: motion, specials, contacts, projectiles. */
function step(world: Roster, input: Readonly<Controls>): void {
  const f = world.fighters[0];
  if (f === undefined) throw new Error("a sampled world has its fighter");
  advanceFighter(world, 0, 0, input, 0.0);
  beginDamageContacts();
  startFighterSpecial(f, 0, 0, input, world);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  advancePlacedObjects(world);
  advanceHeroStatus(f);
}

function readyPose(model: DrawnModel, character: Character, aerial: boolean): ScoreFrame {
  const f = createFighter(character, 0.0, 1);
  const world = createRoster(1, [f]);
  if (aerial) { f.motion.grounded = false; f.motion.z = 900.0; }
  const p = createFighterPose();
  const input = neutralControls();
  for (let frame = 0; frame < 30; frame++) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(p, f, world, input, false, false, false, false);
  }
  return pose(model, character, capture(f, p));
}

export interface SampledMove {
  readonly move: string;
  readonly sample: MoveSample;
  /** Zero-based last frame of the move, from the simulation. */
  readonly endFrame: number;
  /** Each frame's time on the body's timeline and the fighter's height above the deck, for rendering it. */
  readonly seconds: readonly number[];
  readonly heights: readonly number[];
}

const strikeEnd = (capsule: { readonly x1: number; readonly z1: number; readonly x2: number; readonly z2: number }, chestZ: number) =>
  Math.hypot(capsule.x2, capsule.z2 - chestZ) >= Math.hypot(capsule.x1, capsule.z1 - chestZ) ? { x: capsule.x2, z: capsule.z2 } : { x: capsule.x1, z: capsule.z1 };

/** A normal from rest, through its end and two frames into whatever follows. */
export function sampleNormal(model: DrawnModel, skeleton: ScoreSkeleton, character: Character, entry: (typeof SCORED_NORMALS)[number], pixelsPerUnit: number): SampledMove | undefined {
  const f = createFighter(character, 0.0, 1);
  if (authoredHitRegionCount(entry.style, f.tuning.moves) === 0) return undefined;
  const world = createRoster(1, [f]);
  if (entry.aerial) { f.motion.grounded = false; f.motion.z = 900.0; }
  const p = createFighterPose();
  const input = neutralControls();
  beginFighterAttack(world, 0, entry.style, false);
  if (f.attack.style !== entry.style) return undefined;
  advanceFighterPose(p, f, world, input, false, false, true, false);
  const frames: PoseFrame[] = [capture(f, p)];
  let moveFrames = 0;
  while (frames.length < LIMIT) {
    advanceFighter(world, 0, 0, input, 0.0);
    advanceFighterPose(p, f, world, input, false, false, false, false);
    if (f.attack.style !== entry.style && moveFrames === 0) moveFrames = frames.length;
    frames.push(capture(f, p));
    if (moveFrames > 0 && frames.length >= moveFrames + AFTER_FRAMES) break;
  }
  if (moveFrames === 0) moveFrames = frames.length;
  const active = frames.slice(0, moveFrames).flatMap((frame, index) => frame.phase === AttackPhase.active && frame.strikes.length > 0 ? [index] : []);
  const first = active[0], last = active.at(-1);
  const strike = first === undefined ? undefined : frames[first]?.strikes[0];
  const contactFrame = first === undefined ? undefined : frames[first];
  if (first === undefined || last === undefined || strike === undefined || contactFrame === undefined) return undefined;
  const local = { x1: strike.x1 - contactFrame.x, z1: strike.z1 - contactFrame.z, x2: strike.x2 - contactFrame.x, z2: strike.z2 - contactFrame.z };
  const posed = frames.map((frame) => pose(model, character, frame));
  const chestZ = skeleton.chest === undefined ? 50 : posed[first]?.nodes[skeleton.chest * 2 + 1] ?? 50;
  return {
    move: entry.move, endFrame: moveFrames - 1, seconds: frames.map((frame) => timelineSeconds(character, frame)), heights: frames.map((frame) => frame.z - (entry.aerial ? 900.0 - 300.0 : 0.0)),
    sample: { moveClass: entry.moveClass, frames: posed, moveFrames, ready: readyPose(model, character, entry.aerial), skeleton, firstActive: first, lastActive: last, strike: strikeEnd(local, chestZ), pixelsPerUnit },
  };
}

/** A hero special from standing, through its end and two frames after. */
export function sampleSpecial(model: DrawnModel, skeleton: ScoreSkeleton, character: Character, entry: (typeof SCORED_SPECIALS)[number], pixelsPerUnit: number): SampledMove | undefined {
  if (!HERO_ROSTER.some((hero) => hero.character === character)) return undefined;
  const f: Fighter = createFighter(character, 0.0, 1);
  f.mana.points = 100;
  const world = createRoster(1, [f]);
  const p = createFighterPose();
  const idle = neutralControls();
  for (let frame = 0; frame < 3; frame++) { step(world, idle); advanceFighterPose(p, f, world, idle, false, false, false, false); }
  const press = { ...neutralControls(), specialPressed: true, specialX: entry.x, specialZ: entry.z };
  const frames: PoseFrame[] = [];
  const activeFrames: number[] = [];
  let strike: { x: number; z: number } | undefined;
  let moveFrames = 0;
  for (let tick = 0; tick < LIMIT; tick++) {
    const input = tick === 0 ? press : idle;
    step(world, input);
    advanceFighterPose(p, f, world, input, false, false, false, false);
    const running = f.special.action !== SpecialAction.none;
    if (tick === 0 && !running) return undefined;
    if (!running && moveFrames === 0) moveFrames = frames.length;
    const captured = capture(f, p);
    if (running) {
      const move = runningHeroSpecial(f);
      const frame = f.special.frame - 1;
      const region = move?.regions?.find((candidate) => frame >= candidate.firstFrame && frame <= candidate.lastFrame && candidate.hit.strike !== undefined);
      const projectile = move?.projectiles?.find((candidate) => candidate.spawnFrame - 1 === frame);
      if (region !== undefined || projectile !== undefined) {
        activeFrames.push(frames.length);
        if (strike === undefined && region?.hit.strike !== undefined) strike = strikeEnd(region.hit.strike, 50);
        else if (strike === undefined && projectile !== undefined) {
          const speed = Math.hypot(projectile.velocityX, projectile.velocityZ) || 1;
          strike = { x: projectile.offsetX + projectile.velocityX / speed * 60, z: projectile.offsetZ + projectile.velocityZ / speed * 60 };
        }
      }
    }
    frames.push({ ...captured, frame: frames.length });
    if (moveFrames > 0 && frames.length >= moveFrames + AFTER_FRAMES) break;
  }
  if (moveFrames === 0) moveFrames = frames.length;
  const first = activeFrames[0], last = activeFrames.at(-1);
  if (first === undefined || last === undefined || strike === undefined || frames.some((frame) => frame.clip === undefined)) return undefined;
  const posed = frames.map((frame) => pose(model, character, frame));
  return {
    move: entry.move, endFrame: moveFrames - 1, seconds: frames.map((frame) => timelineSeconds(character, frame)), heights: frames.map((frame) => frame.z),
    sample: { moveClass: "special", frames: posed, moveFrames, ready: readyPose(model, character, false), skeleton, firstActive: first, lastActive: last, strike, pixelsPerUnit },
  };
}

/** Every scored move a fighter has. */
export function sampleFighter(model: DrawnModel, character: Character): SampledMove[] {
  const skeleton = skeletonOf(model, character);
  const pixelsPerUnit = gameplayPixelsPerUnit();
  const out: SampledMove[] = [];
  for (const entry of SCORED_NORMALS) {
    const sampled = sampleNormal(model, skeleton, character, entry, pixelsPerUnit);
    if (sampled !== undefined) out.push(sampled);
  }
  for (const entry of SCORED_SPECIALS) {
    const sampled = sampleSpecial(model, skeleton, character, entry, pixelsPerUnit);
    if (sampled !== undefined) out.push(sampled);
  }
  return out;
}
