/// <reference path="../../node_modules/wisp/src/natives/warcraft.d.ts" />
import { homedir } from "node:os";
import { join } from "node:path";
import { parseModelMDX } from "wisp/scripts/wisp/models";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "../hostProcess";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { captureScene, renderScenes, type RenderScene } from "wisp/scripts/wisp/headlessRender";
import type { Graphics } from "wisp/scripts/wisp/graphicsProfiles";
import { SMASHCRAFT_HEADLESS } from "./headless";
import { headlessRender } from "./headlessRender";
import { ATTACK_CUES } from "../../src/game/presentation/attackCues";
import { ARENA_CAMERA, FLOOR_HEIGHT, PLAYABLE_BOUNDS, cameraFieldOfView, extremeCamera } from "../../src/game/presentation/arenaCamera";
import { specialCueState } from "../../src/game/presentation/specialCues";
import { DEFINITIVE_CUE_EMITTERS } from "../../src/game/presentation/cueEmitterInfo";
import { SpecialCueEffects } from "../../src/game/render/specialCueEffects";
import { ProjectilePresentation } from "../../src/game/render/projectilePresentation";
import { beginFighterAttack, resolveAttacks } from "../../src/game/sim/attacks";
import { AttackPhase, AttackStyle, Character, ContactKind, SpecialAction } from "../../src/game/sim/codes";
import { attackPhase } from "../../src/game/sim/conditions";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "../../src/game/sim/contacts";
import { type Fighter, createFighter } from "../../src/game/sim/fighter";
import { advanceHeroStatus, runningHeroSpecial } from "../../src/game/sim/heroSpecialRules";
import { fighterSlug } from "../../src/game/sim/heroes/registry";
import { isAerialAttack } from "../../src/game/sim/moves";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../../src/game/sim/matchCamera";
import { advancePlacedObjects } from "../../src/game/sim/placedObjects";
import { projectileActive, updateProjectiles } from "../../src/game/sim/projectiles";
import { type Controls, createRoster, neutralControls, type Roster } from "../../src/game/sim/roster";
import { advanceSpecials, startFighterSpecial } from "../../src/game/sim/specials";
import { advanceFighter } from "../../src/game/sim/step";
import { DROP_TELEGRAPH_FRAMES, advanceMeterDrops, meterDropPoint } from "../../src/game/match/meterDrops";
import { Phase, createMatchState } from "../../src/game/match/rules";
import { MeterDropPresentation } from "../../src/game/render/meterDropPresentation";
import { CombatEffects } from "../../src/game/render/combatEffects";
import { advanceImpacts, createImpactState, emitImpacts } from "../../src/game/presentation/impactState";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "../../src/game/presentation/impactEvents";
import { presentImpactSounds } from "../../src/game/presentation/hitPresentation";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion, type HitEffect } from "../../src/game/sim/hitRegions";
import { authoredTuning } from "../../src/game/sim/tuning";

export const CUE_FADE_FRAMES = 12;
export const CUE_COVERAGE_LIMIT = 0.04;
const DRAWN_DELTA = 24;
const SHOWN_SHARE = 0.0005;
const WIDTH = 640, HEIGHT = 360;
export const CUE_FRAMES = join(homedir(), ".local/state/smashcraft/cue-budget");
const AFTER_FRAMES = 40;
const RENDER_BATCH = 600;
const LIMIT = 240;

const SPECIALS = [
  { slot: "neutral", x: 0, z: 0 }, { slot: "side", x: 1, z: 0 }, { slot: "up", x: 0, z: 1 }, { slot: "down", x: 0, z: -1 },
] as const;

export interface CueMove {
  readonly character: Character;
  readonly name: string;
  readonly style?: AttackStyle;
  readonly special?: (typeof SPECIALS)[number];
  readonly ultimate?: true;
  readonly drop?: boolean;
  readonly spark?: "strong" | "weak";
}

export interface CueMeasurement {
  readonly move: string;
  readonly graphics: Graphics;
  readonly lastDanger: number;
  readonly firstShown: number;
  readonly lastShown: number;
  readonly linger: number;
  readonly coverage: number;
  readonly widest: readonly string[];
  readonly over: readonly string[];
  readonly popcorn: boolean;
  readonly colour?: readonly number[];
  readonly feedback?: string;
}

interface ParkPose { readonly handle: number; readonly model: string; readonly shown: boolean; readonly timeScale: number }

const worldLives = new Map<string, number>();
async function worldParticleLife(model: string): Promise<number> {
  const known = worldLives.get(model);
  if (known !== undefined) return known;
  const bytes = await headlessRender().readAsset(model, "classic");
  let life = 0;
  if (bytes !== undefined && /\.mdx$/i.test(model)) {
    for (const emitter of parseModelMDX(bytes.slice().buffer).ParticleEmitters2) {
      if ((emitter.Flags & MODEL_SPACE) === 0) life = Math.max(life, emitter.LifeSpan ?? 0);
    }
  }
  worldLives.set(model, life);
  return life;
}
// ParticleEmitter2's ModelSpace flag (MDX format).
const MODEL_SPACE = 0x80000;

async function particleTails(poses: readonly (readonly ParkPose[])[], graphics: Graphics): Promise<number> {
  let last = -1;
  for (let frame = 1; frame < poses.length; frame++) for (const pose of poses[frame] ?? []) {
    const before = poses[frame - 1]?.find((candidate) => candidate.handle === pose.handle);
    // Definitive draws these as Popcorn, whose particle lives the classic emitters don't describe.
    if (before?.shown !== true || pose.shown || graphics === "definitive" && DEFINITIVE_CUE_EMITTERS[pose.model] === true) continue;
    const life = await worldParticleLife(pose.model);
    if (life <= 0) continue;
    last = Math.max(last, pose.timeScale <= 0 ? Number.POSITIVE_INFINITY : frame - 1 + Math.ceil(life * 60 / pose.timeScale));
  }
  return last;
}

export function cueMoves(): CueMove[] {
  const moves: CueMove[] = [];
  for (const character of Object.values(Character)) for (const [name, style] of Object.entries(AttackStyle)) {
    if (ATTACK_CUES[character]?.[style] !== undefined) moves.push({ character, name: `${fighterSlug(character)}:${name}`, style });
  }
  for (const character of Object.values(Character)) for (const special of SPECIALS) {
    moves.push({ character, name: `${fighterSlug(character)}:${special.slot}-special`, special });
  }
  for (const character of Object.values(Character)) moves.push({ character, name: `${fighterSlug(character)}:ultimate`, ultimate: true });
  moves.push({ character: Character.rifleman, name: "meter-drop:telegraph-and-orb", drop: true });
  for (const spark of ["strong", "weak"] as const) moves.push({ character: Character.blademaster, name: `blademaster:forwardSmash-${spark}-spark`, style: AttackStyle.forwardSmash, spark });
  return moves;
}

function sparkEffect(character: Character, style: AttackStyle, strong: boolean): HitEffect {
  const moves = authoredTuning(character).moves;
  const region = emptyHitRegion();
  for (let frame = 0; frame < 120; frame++) for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
    authoredHitRegion(region, character, style, frame, 0, index, moves);
    if (region.window > 0 && region.effect.damage > 0 && (region.effect.strong === true) === strong) return { ...region.effect };
  }
  throw new Error(`${fighterSlug(character)} style ${style} has no ${strong ? "strong" : "weak"} hit`);
}

export function sparkScenes(move: CueMove, graphics: Graphics): { readonly scenes: RenderScene[]; readonly poses: (readonly ParkPose[])[]; readonly lastDanger: number; readonly empty: RenderScene; readonly feedback: string } {
  if (move.style === undefined) throw new Error("a spark row names its move");
  const attacker = createFighter(move.character, -60.0, 1);
  const victim = createFighter(Character.rifleman, 0.0, -1);
  const world = createRoster(3, [attacker, victim]);
  beginFighterAttack(world, 0, move.style, false);
  const effect = sparkEffect(move.character, move.style, move.spark === "strong");
  const events = createImpactEvents();
  captureImpactEventsBefore(events, victim);
  beginDamageContacts();
  queueDamageContact(world, 0, 1, effect, 1, ContactKind.launch, true, undefined);
  finishDamageContacts(world);
  finishImpactEventsAfter(events, victim, world);
  const sounds: string[] = [];
  presentImpactSounds(events, (sound, _x, _z, volume) => { sounds.push(`${sound.split("\\").at(-1)} volume ${volume}`); });
  const feedback = `damage ${effect.damage.toFixed(1)}%, hitlag ${victim.launch.hitlagFrames} victim/${attacker.launch.hitlag} attacker, tier ${events.tier}, sound ${sounds.join(" + ") || "none"}`;
  const runtime = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: (client) => ({
    ...SMASHCRAFT_HEADLESS.natives?.(client),
    GetLocalizedString: (key: string) => key === "SMASHCRAFT_CUE_GRAPHICS" ? graphics : key,
  }) });
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
    let combat: CombatEffects | undefined;
    client.run(() => { combat = new CombatEffects(origin); });
    if (combat === undefined) throw new Error("missing impact renderer");
    const impacts = createImpactState();
    emitImpacts(impacts, events, 0);
    const scenes: RenderScene[] = [];
    const poses: (readonly ParkPose[])[] = [];
    let empty: RenderScene | undefined;
    for (let tick = 0; tick < 24; tick++) {
      const renderer = combat;
      client.run(() => {
        renderer.present(impacts, tick, impacts, true);
        SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
        SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, ARENA_CAMERA.angleOfAttack, 0.0);
        SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, near.distance, 0.0);
        SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + 100.0, 0.0);
        SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, cameraFieldOfView(near, MATCH_CAMERA_ASPECT), 0.0);
        SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
        SetCameraPosition(origin.x + victim.motion.x, origin.y);
      });
      advanceImpacts(impacts);
      clients.frames(1);
      const scene = captureScene(client, { visibleOnly: true });
      empty ??= { ...scene, frame: -1, effects: [] };
      scenes.push({ ...scene, frame: tick, units: [] });
      poses.push(client.effectPoses().map(({ handle, model, scale, alpha, timeScale }) => ({ handle: Number(handle.id), model, shown: scale > 0 && alpha > 0, timeScale })));
    }
    if (empty === undefined) throw new Error("no frames");
    return { scenes, poses, lastDanger: 0, empty, feedback };
  } finally { runtime.restore(); }
}

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

function dangerous(f: Fighter, style: AttackStyle | undefined): boolean {
  for (let index = 0; index < f.projectiles.length; index++) if (projectileActive(f, index)) return true;
  if (style !== undefined) return f.attack.style === style && attackPhase(f) === AttackPhase.active;
  if (f.special.action === SpecialAction.none) return false;
  if (specialCueState(f).phase === "active") return true;
  const move = runningHeroSpecial(f);
  const frame = f.special.frame - 1;
  return move?.regions?.some((region) => frame >= region.firstFrame && frame <= region.lastFrame) === true;
}

const near = createMatchCamera();
extremeCamera(near, 0, MATCH_CAMERA_ASPECT, "near");

function aimNear(x: number, z: number): void {
  SetCameraField(CAMERA_FIELD_ROTATION, ARENA_CAMERA.rotation, 0.0);
  SetCameraField(CAMERA_FIELD_ANGLE_OF_ATTACK, ARENA_CAMERA.angleOfAttack, 0.0);
  SetCameraField(CAMERA_FIELD_TARGET_DISTANCE, near.distance, 0.0);
  SetCameraField(CAMERA_FIELD_ZOFFSET, FLOOR_HEIGHT + z + 100.0, 0.0);
  SetCameraField(CAMERA_FIELD_FIELD_OF_VIEW, cameraFieldOfView(near, MATCH_CAMERA_ASPECT), 0.0);
  SetCameraField(CAMERA_FIELD_FARZ, ARENA_CAMERA.farZ, 0.0);
  SetCameraPosition(x, PLAYABLE_BOUNDS.centreY);
}

function dropScenes(graphics: Graphics): ReturnType<typeof cueScenes> {
  const runtime = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: (client) => ({
    ...SMASHCRAFT_HEADLESS.natives?.(client),
    GetLocalizedString: (key: string) => key === "SMASHCRAFT_CUE_GRAPHICS" ? graphics : key,
  }) });
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
    let drops: MeterDropPresentation | undefined;
    client.run(() => { drops = new MeterDropPresentation(origin); });
    if (drops === undefined) throw new Error("missing drop renderer");
    const game = createMatchState();
    game.phase = Phase.match;
    game.stageChoice = 0;
    game.drops.nextSpawnFrame = DROP_TELEGRAPH_FRAMES + 1;
    game.drops.nextPoint = 0;
    game.drops.draws = 1;
    const world = createRoster(1, [createFighter(Character.rifleman, 1000.0, 1)]);
    const point = meterDropPoint(0, 0);
    const scenes: RenderScene[] = [];
    let empty: RenderScene | undefined;
    for (let tick = 0; tick < LIMIT; tick++) {
      game.matchFrame = tick + 1;
      advanceMeterDrops(game, world);
      const shown = drops;
      client.run(() => { shown.present(game); aimNear(origin.x + point.x, point.z); });
      clients.frames(1);
      const scene = captureScene(client, { visibleOnly: true });
      empty ??= { ...scene, frame: -1, effects: [] };
      scenes.push({ ...scene, frame: tick, units: [] });
    }
    if (empty === undefined) throw new Error("no frames");
    return { scenes, poses: [], lastDanger: LIMIT - 1, empty };
  } finally { runtime.restore(); }
}

export function cueScenes(move: CueMove, graphics: Graphics): { readonly scenes: RenderScene[]; readonly poses: (readonly ParkPose[])[]; readonly lastDanger: number; readonly empty: RenderScene; readonly feedback?: string } {
  if (move.drop === true) return dropScenes(graphics);
  if (move.spark !== undefined) return sparkScenes(move, graphics);
  const runtime = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: (client) => ({
    ...SMASHCRAFT_HEADLESS.natives?.(client),
    GetLocalizedString: (key: string) => key === "SMASHCRAFT_CUE_GRAPHICS" ? graphics : key,
  }) });
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.client(0);
    clients.start();
    const origin = { x: 0.0, y: PLAYABLE_BOUNDS.centreY, z: FLOOR_HEIGHT };
    let cues: SpecialCueEffects | undefined, shots: ProjectilePresentation | undefined;
    client.run(() => {
      globalThis.__smashcraftCueDefinitive = undefined;
      cues = new SpecialCueEffects(move.character, origin);
      shots = new ProjectilePresentation(move.character, origin);
    });
    if (cues === undefined || shots === undefined) throw new Error("missing cue renderers");
    const f = createFighter(move.character, 0.0, 1);
    f.mana.points = 100;
    const world = createRoster(1, [f]);
    const idle = neutralControls();
    for (let frame = 0; frame < 3; frame++) step(world, idle);
    if (move.style !== undefined) {
      if (isAerialAttack(move.style)) { f.motion.grounded = false; f.motion.z = 300.0; }
      beginFighterAttack(world, 0, move.style, false);
    }
    const press = move.ultimate === true ? { ...neutralControls(), specialPressed: true, ultimatePressed: true, attackHeld: true }
      : move.special === undefined ? idle : { ...neutralControls(), specialPressed: true, specialX: move.special.x, specialZ: move.special.z };
    const scenes: RenderScene[] = [];
    const poses: (readonly ParkPose[])[] = [];
    let lastDanger = -1, ended = -1, lastLive = 0;
    let empty: RenderScene | undefined;
    for (let tick = 0; tick < LIMIT; tick++) {
      if (tick > 0 || move.style === undefined) step(world, tick === 0 ? press : idle);
      const running = move.style !== undefined ? f.attack.style === move.style : f.special.action !== SpecialAction.none;
      if (tick === 0 && !running) return { scenes: [], poses: [], lastDanger: -1, empty: captureScene(client) };
      if (dangerous(f, move.style)) lastDanger = tick;
      const live = running || f.projectiles.some((_, index) => projectileActive(f, index));
      if (!live && ended < 0) ended = tick;
      if (live) lastLive = tick;
      const renderers = { cues, shots };
      client.run(() => {
        renderers.cues.confirm(f, true, tick / 60);
        renderers.cues.present(f, true, false);
        renderers.shots.present(f, true, false);
        aimNear(origin.x + f.motion.x, f.motion.z);
      });
      clients.frames(1);
      const scene = captureScene(client, { visibleOnly: true });
      empty ??= { ...scene, frame: -1, effects: [] };
      scenes.push({ ...scene, frame: tick, units: [] });
      poses.push(client.effectPoses().map(({ handle, model, scale, alpha, timeScale }) => ({ handle: Number(handle.id), model, shown: scale > 0 && alpha > 0, timeScale })));
      if (ended >= 0 && tick >= ended + AFTER_FRAMES) break;
    }
    if (empty === undefined) throw new Error("no frames");
    return { scenes, poses, lastDanger: lastDanger >= 0 ? lastDanger : lastLive, empty };
  } finally { runtime.restore(); }
}

function drawnPixels(empty: Uint8Array, frame: Uint8Array): { readonly share: number; readonly colour: readonly number[] } {
  let drawn = 0;
  const sum = [0, 0, 0];
  for (let index = 0; index < frame.length; index += 4) {
    const delta = Math.abs((frame[index] ?? 0) - (empty[index] ?? 0)) + Math.abs((frame[index + 1] ?? 0) - (empty[index + 1] ?? 0)) + Math.abs((frame[index + 2] ?? 0) - (empty[index + 2] ?? 0));
    if (delta <= DRAWN_DELTA) continue;
    drawn++;
    for (let channel = 0; channel < 3; channel++) sum[channel] = (sum[channel] ?? 0) + (frame[index + channel] ?? 0);
  }
  return { share: drawn / (frame.length / 4), colour: sum.map((total) => drawn === 0 ? 0 : Math.round(total / drawn)) };
}

const rgba = (path: string) => Effect.gen(function*() {
  const raw = path.replace(/\.png$/, ".rgba");
  yield* runProcess(ChildProcess.make("magick", [path, "-depth", "8", `rgba:${raw}`], { stdin: "ignore" }));
  return yield* Effect.promise(() => Bun.file(raw).bytes());
}).pipe(Effect.provide(BunServices.layer));

export const measureCueMoves = (moves: readonly CueMove[], graphics: Graphics, directory: string) => Effect.gen(function*() {
  const sampled = moves.map((move, index) => ({ move, index, ...cueScenes(move, graphics) })).filter(({ scenes }) => scenes.length > 0);
  const empty = sampled[0]?.empty;
  if (empty === undefined) return [];
  const frameOf = (index: number, tick: number) => (index + 1) * 1000 + tick;
  const drawn = sampled.flatMap(({ index, scenes }) => scenes.filter(({ effects }) => effects.length > 0).map((scene) => ({ ...scene, frame: frameOf(index, scene.frame) })));
  const project = { ...headlessRender(), width: WIDTH, height: HEIGHT };
  const undrawn = new Set<string>();
  // Wisp stops one render call after five minutes.
  for (let first = 0; first <= drawn.length; first += RENDER_BATCH) {
    yield* renderScenes(project, [empty, ...drawn.slice(first, first + RENDER_BATCH)], directory, graphics).pipe(Effect.catchTag("RenderFailure", (failure) => Effect.sync(() => {
      for (const line of String(failure.cause).split("\n")) undrawn.add(line.replace(/^.*?: /, ""));
    })));
  }
  const blank = yield* rgba(join(directory, "p0-frame--1.png"));
  const results: CueMeasurement[] = [];
  for (const { move, index, scenes, poses, lastDanger, feedback } of sampled) {
    const shares: number[] = [];
    const colours: (readonly number[])[] = [];
    for (const scene of scenes) {
      const pixels = scene.effects.length === 0 ? { share: 0, colour: [0, 0, 0] } : drawnPixels(blank, yield* rgba(join(directory, `p0-frame-${frameOf(index, scene.frame)}.png`)));
      shares.push(pixels.share);
      colours.push(pixels.colour);
    }
    const shown = shares.flatMap((share, tick) => share >= SHOWN_SHARE ? [tick] : []);
    const tail = yield* Effect.promise(() => particleTails(poses, graphics));
    const firstShown = shown[0] ?? -1, lastShown = Math.max(shown.at(-1) ?? -1, tail);
    const linger = lastShown < 0 ? 0 : Math.max(0, lastShown - Math.max(lastDanger, 0));
    const coverage = Math.max(0, ...shares);
    const widest = [...new Set(scenes[shares.indexOf(coverage)]?.effects.map(({ model }) => model.split("\\").at(-1) ?? model) ?? [])];
    const over = [
      ...(linger > CUE_FADE_FRAMES ? [`shown ${linger} frames after its last hit or frame, limit ${CUE_FADE_FRAMES}`] : []),
      ...(coverage > CUE_COVERAGE_LIMIT ? [`covers ${(coverage * 100).toFixed(1)}% of the screen, limit ${(CUE_COVERAGE_LIMIT * 100).toFixed(1)}%`] : []),
    ];
    const models = new Set(scenes.flatMap(({ effects }) => effects.map(({ model }) => model)));
    const popcorn = [...undrawn].filter((line) => [...models].some((model) => line.startsWith(model)));
    results.push({ move: move.name, graphics, lastDanger, firstShown, lastShown, linger, coverage, widest, over, popcorn: popcorn.length > 0,
      ...(move.spark === undefined ? {} : { colour: colours[shares.indexOf(coverage)] ?? [0, 0, 0], feedback }) });
  }
  return results;
});
