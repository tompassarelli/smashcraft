






import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, DownState, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { createFighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { Relocation } from "../sim/heroSpecials";
import { attackStartupFrames } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { immolationRegion } from "../sim/specials";
import { HeroSpecialUse, heroSpecialUse, strikeMeets } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { moveReaches } from "./botMoves";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();

const RAISED_STAGE = 1;
const RAISED_Z = 170.0;
const FRAMES = 600;
const ARRIVAL_FRAMES = 5 * MATCH_TICKS_PER_SECOND;

const IDLE_OBSERVATION_FRAMES = 40;

const SLACK = 40.0;

const FEL_RUSH_REACH = 340.0;



const ORIGINAL_ZONING: readonly number[] = [
  SpecialAction.riflemanBear,
  SpecialAction.riflemanBlaster, SpecialAction.riflemanTrap, SpecialAction.demonHunterManaBurn,
];
const ORIGINAL_MOVEMENT: readonly number[] = [SpecialAction.riflemanRecovery, SpecialAction.riflemanRecovery, SpecialAction.demonHunterWingAscent];


const standsIdle = (o: Readonly<Fighter>): boolean => o.motion.grounded && o.motion.deltaX === 0.0 && o.motion.deltaZ === 0.0 && o.launch.hitstun <= 0 && o.launch.hitlag <= 0 && o.down.state === DownState.none;


function strikesNow(c: Readonly<Fighter>, o: Readonly<Fighter>, style: AttackStyle): boolean {
  const dx = f32(o.motion.x - c.motion.x);
  const dz = f32(o.motion.z - c.motion.z);

  for (const slackX of [0.0, SLACK, -SLACK]) {
    for (const slackZ of [0.0, SLACK, -SLACK]) if (moveReaches(c.character, style, o, f32(f32(dx * c.facing) - slackX), f32(dz - slackZ), c.tuning.moves)) return true;
  }
  return false;
}


function specialAccountedFor(c: Readonly<Fighter>, o: Readonly<Fighter>): boolean {
  const action = c.special.action;
  const dx = f32(o.motion.x - c.motion.x);
  const dz = f32(o.motion.z - c.motion.z);
  if (ORIGINAL_ZONING.includes(action) || ORIGINAL_MOVEMENT.includes(action)) return true;
  if (action === SpecialAction.demonHunterFelRush) return Math.abs(dx) <= FEL_RUSH_REACH && Math.abs(dz) <= 70.0;
  if (action === SpecialAction.demonHunterImmolate) {
    const region = immolationRegion(c.motion.grounded);
    const local = f32(dx * c.facing);
    return local >= f32(region.minX - SLACK) && local <= f32(region.maxX + SLACK) && dz >= f32(region.minZ - SLACK) && dz <= f32(region.maxZ + SLACK);
  }
  const move = runningHeroSpecial(c);
  if (move === undefined) return false;
  if (move.projectiles !== undefined || move.placement !== undefined || move.burst !== undefined || move.command !== undefined || move.recallsProjectiles === true) return true;


  if (move.ritual !== undefined) return true;
  if ((move.regions ?? []).length === 0 && move.commandGrab === undefined && (move.followUps ?? []).length === 0) return true;

  for (const step of move.motion ?? []) if (step.relocate === Relocation.behindMark && Math.abs(dx) <= (step.relocateReach ?? 0.0) && Math.abs(dz) <= (step.relocateReach ?? 0.0)) return true;
  for (const slack of [0.0, SLACK, -SLACK]) if (strikeMeets(move, o, f32(f32(dx * c.facing) - slack), dz)) return true;
  return false;
}

interface ReachRun {
  outOfReach: string[];

  idleStarts: number;
  hits: number;
  arrival: number;
}


function playIdleOpponent(character: Character, cx: number, cz: number, surface: number, ox: number, oz: number, opponentSurface: number): ReachRun {
  const opponent = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, ox, cx > ox ? 1 : -1);
  opponent.motion.z = oz;
  opponent.motion.surface = opponentSurface;
  const computer = createFighter(character, cx, cx > ox ? -1 : 1);
  computer.motion.z = cz;
  computer.motion.surface = surface;
  const world = createRoster(3, [opponent, computer]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = RAISED_STAGE;
  match.timeLimitMinutes = 0;
  match.cpuOpponents[1] = "wren";
  match.cpuResolvedOpponents[1] = "wren";
  match.cpuTiers[1] = "expert";
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const c = fighterAt(world, 1);
  const o = fighterAt(world, 0);
  const result: ReachRun = { outOfReach: [], idleStarts: 0, hits: 0, arrival: -1 };
  let serial = c.attack.serial;
  let action: number = c.special.action;
  let idleFrames = 0;
  let idleX = o.motion.x;
  let idleZ = o.motion.z;
  let attack: { serial: number; style: AttackStyle; reached: boolean; where: string } | undefined;
  let special: { action: number; form: number; reached: boolean; where: string } | undefined;
  for (let i = 1; i <= FRAMES; i++) {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    idleFrames = standsIdle(o) && o.motion.x === idleX && o.motion.z === idleZ ? idleFrames + 1 : 0;
    idleX = o.motion.x;
    idleZ = o.motion.z;
    const observedIdle = idleFrames >= IDLE_OBSERVATION_FRAMES;
    if (result.arrival < 0 && c.motion.grounded && o.motion.grounded && c.motion.surface === o.motion.surface) result.arrival = i;
    const style = c.attack.style;
    const where = `frame ${i} at (${Math.round(o.motion.x - c.motion.x)}, ${Math.round(o.motion.z - c.motion.z)}), facing ${c.facing}, travel (${c.motion.deltaX}, ${c.motion.deltaZ}), velocity (${c.motion.vx}, ${c.motion.vz}), dash ${c.ground.dashFrame}`;

    if (attack !== undefined && (c.attack.serial !== attack.serial || style === undefined)) {
      if (!attack.reached) result.outOfReach.push(attack.where);
      attack = undefined;
    }
    if (special !== undefined && (c.special.action !== special.action || c.special.form !== special.form)) {
      if (!special.reached) result.outOfReach.push(special.where);
      special = undefined;
    }
    const started = (c.attack.serial !== serial && style !== undefined) || (c.special.action !== action && c.special.action !== SpecialAction.none);
    if (started && observedIdle) result.idleStarts++;
    if (c.attack.serial !== serial && style !== undefined) attack = { serial: c.attack.serial, style, reached: !observedIdle, where: `attack ${style} started ${where}` };
    if (attack !== undefined && !attack.reached) attack.reached = c.attack.hit || c.grab.target !== undefined || ((attack.style === AttackStyle.grab || c.attack.frame >= attackStartupFrames(attack.style, c.tuning.moves)) && strikesNow(c, o, attack.style));
    if (c.special.action !== action && c.special.action !== SpecialAction.none) special = {
      action: c.special.action, form: c.special.form, reached: !observedIdle || specialAccountedFor(c, o), where: `special ${c.special.action} form ${c.special.form} ${where}`,
    };
    if (special !== undefined && !special.reached) {
      const move = runningHeroSpecial(c);
      const active = move !== undefined && ((move.regions ?? []).some(region => c.special.frame >= region.firstFrame && c.special.frame <= region.lastFrame)
        || (move.commandGrab !== undefined && c.special.frame >= move.commandGrab.first && c.special.frame <= move.commandGrab.last));
      special.reached = c.special.hit || c.grab.target !== undefined || (active && specialAccountedFor(c, o));
    }
    serial = c.attack.serial;
    action = c.special.action;
  }
  result.hits = o.visuals.hit;
  return result;
}

test("Sylvanas waits when her jump lands and cancels Silence before its strike [repro #345]", () => {
  const own = createFighter(Character.sylvanas, 0.0, -1);
  own.motion.grounded = false;
  own.motion.z = 24.0;
  own.motion.deltaZ = 10.0;
  own.motion.vz = 10.0;
  const target = createFighter(Character.rifleman, -173.0, 1);
  assertEquals(heroSpecialUse(own, target, RAISED_STAGE, SpecialSlot.side), HeroSpecialUse.none);
  own.motion.grounded = true;
  own.motion.z = 0.0;
  own.motion.deltaZ = 0.0;
  assertEquals(heroSpecialUse(own, target, RAISED_STAGE, SpecialSlot.side), HeroSpecialUse.close);
});

test("Blademaster approaches the raised deck without drifting a stationary drill into reach [repro #345]", () => {
  const run = playIdleOpponent(Character.blademaster, 450.0, 0.0, 0, -265.0, RAISED_Z, 1);
  if (run.outOfReach.length > 0) throw new Error(run.outOfReach.join("\n"));
  assertTrue(run.arrival >= 0 && run.arrival <= ARRIVAL_FRAMES);
  assertGreaterThan(run.hits, 0);
});

