import { floorMod } from "wisp/src/sim/intMath";
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep, sweepSeed } from "../../runtime/sweep";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { produceComputerInput } from "../match/botPlay";
import type { CpuTier } from "../match/cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { fighterAt, isActive, neutralControls } from "./roster";
import { f32 } from "wisp/src/sim/f32";
import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer, queueAttack } from "../input/attackBuffer";
import { createFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { ROSTER_MANA } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";
import { FIGHTER_ULTIMATES, ULTIMATE_REACH } from "./ultimates";
import type { AuthoredSpecial } from "./heroSpecials";
import { firstStateDifference } from "../replay/difference";
import { stateChecksum } from "../replay/canonical";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { isIntangible } from "./conditions";
import { mainDeckLeft, mainDeckRight, mainDeckZAt, SLOPE_TEST_STAGE } from "./stage";

/** How each ultimate is met in its recorded scenario (docs/design/ultimates.md). */
type Defence = "shield" | "spotDodge" | "ground";

interface Scenario {
  readonly character: Character;
  /** The target's distance ahead, and its height when it must be airborne to be reached. */
  readonly x: number;
  readonly z?: number;
  readonly defence: Defence;
  /** The frame the defender starts its answer. */
  readonly answerFrame?: number;
}

export const ULTIMATE_SCENARIOS: readonly Scenario[] = [
  { character: Character.rifleman, x: 400.0, defence: "shield" },
  { character: Character.demonHunter, x: 100.0, defence: "shield" },
  { character: Character.blademaster, x: 80.0, defence: "shield" },
  { character: Character.mountainKing, x: 120.0, defence: "shield" },
  { character: Character.warden, x: 250.0, defence: "shield" },
  { character: Character.lich, x: 200.0, z: 150.0, defence: "ground" },
  { character: Character.forsakenPaladin, x: 220.0, defence: "shield" },
  { character: Character.dreadlord, x: 260.0, defence: "shield" },
  { character: Character.shadowHunter, x: 120.0, defence: "shield" },
  { character: Character.pitLord, x: 90.0, defence: "spotDodge", answerFrame: 16 },
  { character: Character.beastmaster, x: 300.0, defence: "shield" },
  { character: Character.lichKing, x: 300.0, defence: "shield" },
  { character: Character.thrall, x: 300.0, defence: "shield" },
  { character: Character.jaina, x: 300.0, defence: "shield" },
  { character: Character.sylvanas, x: 300.0, defence: "shield" },
  { character: Character.cairne, x: 100.0, defence: "shield" },
  { character: Character.chen, x: 220.0, defence: "shield" },
  { character: Character.peon, x: 250.0, defence: "shield" },
  { character: Character.tinker, x: 150.0, defence: "shield" },
  { character: Character.kaelthas, x: 150.0, defence: "shield" },
  { character: Character.murloc, x: 300.0, defence: "shield" },
  { character: Character.grom, x: 120.0, defence: "spotDodge", answerFrame: 15 },
  { character: Character.anubarak, x: 150.0, defence: "shield" },
  { character: Character.malfurion, x: 300.0, defence: "shield" },
  { character: Character.medivh, x: 240.0, defence: "shield" },
  { character: Character.kobold, x: 200.0, defence: "shield" },
];

const SHIELD = controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const ULTIMATE = controls({ specialPressed: true, ultimatePressed: true, attackHeld: true });

interface Bout {
  readonly owner: Fighter;
  readonly target: Fighter;
  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
  readonly commands: readonly AttackBuffer[];
  readonly frame: () => number;
  readonly game: ReturnType<typeof createMatchState>;
}

function bout(scenario: Readonly<Scenario>, facing: number, target: Character = Character.blademaster, x = scenario.x, off = false): Bout {
  const game = createMatchState();
  game.phase = Phase.match;
  game.ultimatesOff = off;
  const owner = createFighter(scenario.character, f32(-x * facing * 0.5), facing);
  const victim = createFighter(target, f32(x * facing * 0.5), -facing);
  owner.mana.points = ROSTER_MANA.max;
  const world = createRoster(3, [owner, victim]);
  const commands = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const step = (first = controls(), second = controls()): void => {
    frame++;
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    out.commands[1] = commands[1] ?? attackBuffer(ATTACK_BUFFER_FRAMES);
    stepMatch(game, world, out, frame);
  };
  for (let tick = 0; tick < 8; tick++) step();
  owner.mana.points = ROSTER_MANA.max;
  if (scenario.z !== undefined) {
    victim.motion.grounded = false;
    victim.motion.surface = undefined;
    victim.motion.z = f32(victim.motion.z + scenario.z);
  }
  return { owner, target: victim, step, commands, frame: () => frame, game };
}

/** Holds an airborne target where it was put, as a jumper at its apex would be. */
function hover(b: Bout, z: number | undefined, base: number): void {
  if (z === undefined || b.target.launch.hitstun > 0 || b.target.status.damage > 0.0) return;
  b.target.motion.grounded = false;
  b.target.motion.surface = undefined;
  b.target.motion.z = base;
  b.target.motion.vz = 0.0;
}

function ultimateOf(character: Character): AuthoredSpecial {
  const move = FIGHTER_ULTIMATES[character];
  if (move === undefined) throw new Error(`no ultimate for ${character}`);
  return move;
}

/** The first frame an ultimate can strike: a region, a striking projectile or summon, a grab or a guard. */
export function firstThreat(move: Readonly<AuthoredSpecial>): number {
  let first = move.endFrame;
  for (const region of move.regions ?? []) first = Math.min(first, region.firstFrame + 1);
  for (const shot of move.projectiles ?? []) if (shot.effect.damage > 0.0 || shot.expiresInto !== undefined) first = Math.min(first, shot.spawnFrame + (shot.expiresInto !== undefined && shot.effect.damage === 0.0 ? shot.life : 0));
  if (move.placement !== undefined) first = Math.min(first, move.placement.frame + (move.placement.fireAges[0] ?? 0));
  if (move.commandGrab !== undefined) first = Math.min(first, move.commandGrab.first);
  if (move.guard !== undefined) first = move.guard.last;
  return first;
}

function play(scenario: Readonly<Scenario>, facing: number, defend: boolean): Bout {
  const b = bout(scenario, facing);
  const base = b.target.motion.z;
  b.step(ULTIMATE);
  hover(b, scenario.z, base);
  for (let tick = 0; tick < 240; tick++) {
    let answer = controls();
    const live = b.owner.special.action === SpecialAction.heroUltimate || b.owner.placed.life > 0 || b.owner.projectiles.some((shot) => shot.life > 0);
    if (scenario.defence === "shield" && defend && live) answer = SHIELD;
    if (scenario.defence === "spotDodge" && defend && tick + 2 === (scenario.answerFrame ?? 0)) answer = controls({ ...SHIELD, groundDodgePressed: true, groundDodgeDirection: 0 });
    b.step(controls(), answer);
    if (!(scenario.defence === "ground" && defend)) hover(b, scenario.z, base);
    if (!live && b.target.launch.hitstun <= 0 && (defend || b.target.status.damage > 0.0)) break;
  }
  return b;
}

test("each fighter's ultimate needs the full bar, spends all of it and starts from Attack + Special [k3 measure #382]", () => {
  for (const scenario of ULTIMATE_SCENARIOS) {
    const short = bout(scenario, 1, Character.blademaster, 600.0);
    short.owner.mana.points = ROSTER_MANA.max - 1;
    short.step(ULTIMATE);
    assertTrue(short.owner.special.action !== SpecialAction.heroUltimate);
    const full = bout(scenario, 1, Character.blademaster, 600.0);
    full.step(ULTIMATE);
    assertEquals(full.owner.special.action, SpecialAction.heroUltimate);
    assertEquals(full.owner.mana.points, 0);
  }
});

const name = (character: Character): string => Object.keys(Character).find((key) => Character[key as keyof typeof Character] === character) ?? `${character}`;

test("each fighter's ultimate lands undefended and never KOs from 0% in both facings [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, false);
    if (!(b.target.status.damage > 0.0) || b.target.status.out || b.target.status.stocks !== b.owner.status.stocks) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% out=${b.target.status.out}`);
  }
  assertEquals(failures.join("; "), "");
});

test("each fighter's ultimate is answered by its defence on startup and leaves the user committed [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) for (const facing of [-1, 1]) {
    const b = play(scenario, facing, true);
    const move = ultimateOf(scenario.character);
    if (b.target.status.damage !== 0.0 || firstThreat(move) < 16 || move.endFrame < firstThreat(move) + 16) failures.push(`${name(scenario.character)} ${facing}: ${b.target.status.damage}% threat ${firstThreat(move)} end ${move.endFrame}`);
  }
  assertEquals(failures.join("; "), "");
});

const EX = controls({ specialPressed: true, shield: true, shieldPressed: true, airDodgePressed: true, groundDodgePressed: true });

test("Cairne centre ankh burst and arrival replay per frame, including a displaced-anchor fault [k1 scenario]", () => {
  for (const { stage, facing, answer } of [
    { stage: 0, facing: 1, answer: "hit" },
    { stage: SLOPE_TEST_STAGE, facing: -1, answer: "shield" },
    { stage: SLOPE_TEST_STAGE, facing: 1, answer: "leave" },
  ]) {
    const move = ultimateOf(Character.cairne);
    const ankhSpec = move.regionOrigin;
    assertTrue(ankhSpec !== undefined);
    const owner = createFighter(Character.cairne, facing * -450.0, facing);
    const inside = createFighter(Character.blademaster, answer === "leave" ? 250.0 : 50.0, -facing);
    const outside = createFighter(Character.rifleman, 350.0, -1);
    const match = createMatchState();
    match.phase = Phase.match;
    match.stageChoice = stage;
    match.timeLimitMinutes = 0;
    const live: ReplayState = { world: createRoster(7, [owner, inside, outside]), match, controls: createFrameControls(), runtime: createPacingAndPresentation() };
    const replay = createReplaySnapshot();
    const saved = createReplaySnapshot();
    const centreX = f32(f32(mainDeckLeft(stage) + mainDeckRight(stage)) * 0.5);
    const centreZ = mainDeckZAt(stage, centreX);
    for (const fighter of [owner, inside, outside]) fighter.motion.z = mainDeckZAt(stage, fighter.motion.x);
    for (let frame = 1; frame <= 8; frame++) {
      const row = createMatchFrameInput();
      assertTrue(captureFrame(row, frame, 7, live.controls, live.runtime));
      assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, frame));
    }
    owner.mana.points = ROSTER_MANA.max;
    const startX = owner.motion.x;
    let firstHit = 0;
    let firstBurst = 0;
    let arrival = 0;
    let protectedFrames = 0;
    let lastDamage = 0.0;
    let hits = 0;
    const recorded: string[] = [];
    for (let tick = 1; tick <= 70; tick++) {
      copyControls(live.controls.inputs[0], tick === 1 ? ULTIMATE : controls());
      copyControls(live.controls.inputs[1], answer === "shield" ? SHIELD : controls());
      const row = createMatchFrameInput();
      assertTrue(captureFrame(row, tick + 8, 7, live.controls, live.runtime));
      assertTrue(executeMatchFrame(row, match, live.world, live.controls, live.runtime, tick + 8));
      const ankh = owner.projectiles.find((projectile) => projectile.life > 0 && projectile.spec === ankhSpec);
      const region = move.regions?.[0]?.hit.strike;
      const burst = owner.projectiles.some((projectile) => projectile.life > 0 && projectile.spec?.spawnFrame === 25);
      if (burst && firstBurst === 0) firstBurst = tick;
      if (inside.status.damage > lastDamage) {
        hits++;
        if (firstHit === 0) firstHit = tick;
      }
      lastDamage = inside.status.damage;
      if (owner.motion.x === centreX && arrival === 0) arrival = tick;
      if (arrival === tick) assertEquals(owner.motion.z, centreZ, `arrival deck at ${tick}`);
      const intangible = isIntangible(owner);
      if (intangible) {
        assertEquals(arrival > 0, true, `protection before teleport at ${tick}`);
        protectedFrames++;
      }
      assertEquals(outside.status.damage, 0.0, `outside burst at ${tick}`);
      if (arrival === 0) assertEquals(owner.motion.x, startX, `early teleport at ${tick}`);
      if (ankh !== undefined) {
        assertEquals(ankh.x, centreX, `ankh x at ${tick}`);
        assertEquals(ankh.z, centreZ, `ankh deck at ${tick}`);
      }
      if (tick === 1) assertEquals(ankh !== undefined, true, "ankh spawns on the first tick");
      if (arrival > 0) assertEquals(intangible, tick < arrival + 6, `arrival protection at ${tick}`);
      if (tick < 25) assertEquals(inside.status.damage, 0.0, `early hit at ${tick}`);
      recorded.push(`${tick}:stage=${stage},centre=${centreX}/${centreZ},move=${owner.special.frame},ankh=${ankh?.x}/${ankh?.z},owner=${owner.motion.x}/${owner.motion.z},region=${tick === firstBurst && region !== undefined && ankh !== undefined ? `${f32(ankh.x + region.x1)}/${f32(ankh.z + region.z1)}/${region.radius}` : "none"},burst=${burst},inside=${inside.status.damage},outside=${outside.status.damage},arrival=${arrival},intangible=${intangible}`);
      if (tick === 20) {
        copyReplayState(saved, live);
        copyReplayState(replay, live);
      } else if (tick > 20) {
        assertTrue(executeMatchFrame(row, replay.match, replay.world, replay.controls, replay.runtime, tick + 8));
        assertEquals(firstStateDifference(live, replay), undefined, recorded[tick - 1]);
        assertEquals(stateChecksum(live), stateChecksum(replay), recorded[tick - 1]);
      }
    }
    assertEquals(firstBurst, 25, recorded.join("\n"));
    assertEquals(firstHit, answer === "hit" ? 25 : 0, recorded.join("\n"));
    assertEquals(hits, answer === "hit" ? 1 : 0, recorded.join("\n"));
    assertEquals(arrival, answer === "hit" ? 32 : answer === "shield" ? 32 : 26, recorded.join("\n"));
    assertEquals(protectedFrames, 6, recorded.join("\n"));
    copyReplayState(replay, saved);
    const shifted = fighterAt(replay.world, 0).projectiles.find((projectile) => projectile.life > 0 && projectile.spec === ankhSpec);
    assertTrue(shifted !== undefined);
    if (shifted === undefined) throw new Error("missing recorded ankh");
    shifted.x = f32(shifted.x + 400.0);
    assertTrue(firstStateDifference(saved, replay) !== undefined);
    assertTrue(stateChecksum(saved) !== stateChecksum(replay));
  }
});

test("with Ultimates off no fighter performs an ultimate from Attack + Special, EX still spends one segment and a landed hit still fills the bar [k3 measure #382]", () => {
  const failures: string[] = [];
  for (const scenario of ULTIMATE_SCENARIOS) {
    const held = bout(scenario, 1, Character.blademaster, scenario.x, true);
    for (let tick = 0; tick < 90; tick++) {
      held.step(ULTIMATE);
      if (held.owner.special.action === SpecialAction.heroUltimate) failures.push(`${name(scenario.character)} performed it`);
    }
    if (held.owner.mana.points !== ROSTER_MANA.max) failures.push(`${name(scenario.character)} spent ${held.owner.mana.points}`);
    const ex = bout(scenario, 1, Character.blademaster, 600.0, true);
    ex.step(EX);
    if (ex.owner.mana.points !== ROSTER_MANA.max - ROSTER_MANA.exCost) failures.push(`${name(scenario.character)} EX left ${ex.owner.mana.points}`);
  }
  assertEquals(failures.join("; "), "");
  const filling = bout({ character: Character.blademaster, x: 60.0, defence: "shield" }, 1, Character.blademaster, 60.0, true);
  filling.owner.mana.points = 0;
  for (let tick = 0; tick < 200; tick++) {
    if (floorMod(tick, 24) === 0) queueAttack(filling.commands[0] ?? attackBuffer(ATTACK_BUFFER_FRAMES), { style: AttackStyle.jab, facing: 0, frame: filling.frame() + 1, mayCharge: false });
    filling.step();
  }
  assertGreaterThan(filling.target.status.damage, 0.0);
  assertGreaterThan(filling.owner.mana.points, 0);
});

interface CpuUltimates {
  starts: number;
  landed: number;
  outOfReach: number;
  shielded: number;
  users: number;
}

const WATCH_FRAMES = 150;
const REFILL_FRAMES = 120;

function cpuUltimates(characters: readonly Character[], tier: CpuTier, seed: number, frames: number, off: boolean): CpuUltimates {
  const total: CpuUltimates = { starts: 0, landed: 0, outOfReach: 0, shielded: 0, users: 0 };
  for (const [index, character] of characters.entries()) {
    const foe = SELECTABLE_CHARACTERS[floorMod(SELECTABLE_CHARACTERS.indexOf(character) + 7, SELECTABLE_CHARACTERS.length)] ?? Character.blademaster;
    const world = createRoster(3, [createFighter(character, -200.0, 1), createFighter(foe, 200.0, -1)]);
    const match = createMatchState();
    match.phase = Phase.match;
    match.ultimatesOff = off;
    for (const slot of [0, 1] as const) {
      match.cpuOpponents[slot] = "wren";
      match.cpuResolvedOpponents[slot] = "wren";
      match.cpuTiers[slot] = tier;
    }
    match.stageChoice = 0;
    match.timeLimitMinutes = 0;
    match.matchSeed = sweepSeed(seed * 31 + index);
    const produced = createFrameControls();
    const executed = createFrameControls();
    const runtime = createPacingAndPresentation();
    const row = createMatchFrameInput();
    const me = fighterAt(world, 0);
    const other = fighterAt(world, 1);
    me.mana.points = ROSTER_MANA.max;
    const reach = ULTIMATE_REACH[character];
    let was = false;
    let watch = -1;
    let cooldown = 0;
    let base = 0.0;
    let stocks = 0;
    let used = 0;
    for (let n = 0; n < frames; n++) {
      const frame = runtime.simulationFrame + 1;
      if (cooldown > 0) cooldown--;
      else if (watch < 0 && !was && me.mana.points < ROSTER_MANA.max) me.mana.points = ROSTER_MANA.max;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        copyControls(produced.inputs[slot], neutralControls());
        clearAttackBuffer(produced.commands[slot]);
        produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      }
      const gap = Math.abs(f32(other.motion.x - me.motion.x));
      const shield = other.shield.raised;
      const damage = other.status.damage;
      const lives = other.status.stocks;
      captureFrame(row, frame, world.mask, produced, runtime);
      executeMatchFrame(row, match, world, executed, runtime, frame);
      const now = me.special.action === SpecialAction.heroUltimate;
      if (now && !was) {
        total.starts++;
        used++;
        if (shield) total.shielded++;
        if (reach === undefined || gap < reach.near || gap > reach.far) total.outOfReach++;
        watch = WATCH_FRAMES;
        base = damage;
        stocks = lives;
      }
      if (watch >= 0) {
        if (other.status.damage > base || other.status.stocks < stocks) {
          total.landed++;
          watch = -1;
          cooldown = REFILL_FRAMES;
        } else if (--watch < 0) cooldown = REFILL_FRAMES;
      }
      was = now;
    }
    if (used > 0) total.users++;
  }
  return total;
}

const SWEEP_FRAMES = 900;

sweep("Wren Rookie computers never press an ultimate and no computer does with Ultimates off [k3 measure #382]", () => {
  assertEquals(cpuUltimates(SELECTABLE_CHARACTERS, "rookie", 0, SWEEP_FRAMES, false).starts, 0);
  assertEquals(cpuUltimates(SELECTABLE_CHARACTERS, "expert", 0, SWEEP_FRAMES, true).starts, 0);
});
