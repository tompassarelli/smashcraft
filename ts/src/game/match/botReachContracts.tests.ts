// The computer attacks only what it can reach (#160): with its opponent idle
// on another deck, every fighter's Wren Expert computer goes to that deck instead
// of swinging at nothing. An attack start counts as in reach when the move's
// strike meets the opponent where it stands or will stand at the strike,
// or when the move has a purpose at range: a projectile, a trap, a summon, a
// beam. Starts that strike nothing (stances, armor, the up specials that
// carry the fighter) are moves, not attacks.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, DownState, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { createFighter } from "../sim/fighter";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { Relocation } from "../sim/heroSpecials";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { attackStartupFrames } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { immolationRegion } from "../sim/specials";
import { strikeMeets } from "./botHeroKit";
import { moveReachAhead, moveReaches } from "./botMoves";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState } from "./rules";
import { sweep } from "../../runtime/sweep";

const NEUTRAL = neutralControls();

test("jab-chain reach queries preserve adjacent fighters' cached jab and shot reach", () => {
  const target = createFighter(Character.archer, 0.0, 1);
  const jab = moveReachAhead(Character.rifleman, AttackStyle.jab, target);
  const shot = moveReachAhead(Character.rifleman, AttackStyle.shot, target);
  moveReachAhead(Character.archer, AttackStyle.jab2, target);
  moveReachAhead(Character.archer, AttackStyle.jab3, target);
  // Archer has no authored second jab; it must not inherit Rifleman's jab box.
  assertEquals(moveReaches(Character.archer, AttackStyle.jab2, target, 60.0, 0.0), false);
  assertEquals(moveReachAhead(Character.rifleman, AttackStyle.jab, target), jab);
  assertEquals(moveReachAhead(Character.rifleman, AttackStyle.shot, target), shot);
});
/** Stage 1: the main deck at 0 and two pass-through decks 170 up, from 110 to 420 each side. */
const RAISED_STAGE = 1;
const RAISED_Z = 170.0;
const FRAMES = 600;
const ARRIVAL_FRAMES = 5 * MATCH_TICKS_PER_SECOND;
/** A strike passing within about a body width of the opponent was aimed at it: this contract is about swings at nothing. */
const SLACK = 40.0;
/** Fel Rush carries Illidan about this far and Chaos Strike reaches about this far past it (botKitOptions.ts). */
const FEL_RUSH_REACH = 340.0;
/** Eye Blast's floor beam reaches a level target this far ahead (botKitOptions.ts). */
const EYE_BLAST_FAR = 600.0;

/** The original fighters' specials with a purpose at range, and those that only carry the fighter. */
const ORIGINAL_ZONING: readonly number[] = [
  SpecialAction.archerArrow, SpecialAction.archerHomingArrow, SpecialAction.archerDisengage, SpecialAction.riflemanBear,
  SpecialAction.riflemanBlaster, SpecialAction.riflemanTrap, SpecialAction.demonHunterManaBurn,
];
const ORIGINAL_MOVEMENT: readonly number[] = [SpecialAction.archerRecovery, SpecialAction.riflemanRecovery, SpecialAction.demonHunterWingAscent];

/** The opponent stands idle: still on a deck, out of hitstun and not down. Starts at an opponent launched, sliding or down are chases, not this contract. */
const standsIdle = (o: Readonly<Fighter>): boolean => o.motion.grounded && o.motion.deltaX === 0.0 && o.motion.deltaZ === 0.0 && o.launch.hitstun <= 0 && o.launch.hitlag <= 0 && o.down.state === DownState.none;

/** Whether the running attack's strike meets the opponent where both stand now. */
function strikesNow(c: Readonly<Fighter>, o: Readonly<Fighter>, style: AttackStyle): boolean {
  const dx = f32(o.motion.x - c.motion.x);
  const dz = f32(o.motion.z - c.motion.z);
  // Illidan's forward smash charged at a level target past the swing is Eye Blast, a beam.
  if (c.character === Character.demonHunter && style === AttackStyle.forwardSmash && Math.abs(dx) <= EYE_BLAST_FAR && Math.abs(dz) <= 40.0) return true;
  for (const slackX of [0.0, SLACK, -SLACK]) {
    for (const slackZ of [0.0, SLACK, -SLACK]) if (moveReaches(c.character, style, o, f32(f32(dx * c.facing) - slackX), f32(dz - slackZ), c.tuning.moves)) return true;
  }
  return false;
}

/** Whether the special just started strikes the opponent, has a purpose at range, or strikes nothing at all. */
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
  if ((move.regions ?? []).length === 0 && move.commandGrab === undefined && (move.followUps ?? []).length === 0) return true;
  // Shadow Pursuit appears behind its marked target and slashes from there: its reach is the relocation's.
  for (const step of move.motion ?? []) if (step.relocate === Relocation.behindMark && Math.abs(dx) <= (step.relocateReach ?? 0.0) && Math.abs(dz) <= (step.relocateReach ?? 0.0)) return true;
  for (const slack of [0.0, SLACK, -SLACK]) if (strikeMeets(move, o, f32(f32(dx * c.facing) - slack), dz)) return true;
  return false;
}

interface ReachRun {
  outOfReach: string[];
  /** Attack and special starts made while the opponent stood idle, and hits the computer landed. */
  idleStarts: number;
  hits: number;
  arrival: number;
}

/** A Wren Expert computer at (cx, cz) on deck `surface` against an idle opponent at (ox, oz) on deck `opponentSurface`, on the raised stage. */
function playIdleOpponent(character: Character, cx: number, cz: number, surface: number, ox: number, oz: number, opponentSurface: number): ReachRun {
  const opponent = createFighter(character === Character.archer ? Character.rifleman : Character.archer, ox, cx > ox ? 1 : -1);
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
  let attack: { serial: number; style: AttackStyle; reached: boolean; where: string } | undefined;
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
    if (result.arrival < 0 && c.motion.grounded && o.motion.grounded && c.motion.surface === o.motion.surface) result.arrival = i;
    const style = c.attack.style;
    const where = `frame ${i} at (${Math.round(o.motion.x - c.motion.x)}, ${Math.round(o.motion.z - c.motion.z)}), facing ${c.facing}, travel (${c.motion.deltaX}, ${c.motion.deltaZ}), velocity (${c.motion.vx}, ${c.motion.vz}), dash ${c.ground.dashFrame}`;
    // An attack reached when it hit, or when its strike met the opponent on any frame from its first active one.
    if (attack !== undefined && (c.attack.serial !== attack.serial || style === undefined)) {
      if (!attack.reached) result.outOfReach.push(attack.where);
      attack = undefined;
    }
    const started = (c.attack.serial !== serial && style !== undefined) || (c.special.action !== action && c.special.action !== SpecialAction.none);
    if (started && standsIdle(o)) result.idleStarts++;
    if (c.attack.serial !== serial && style !== undefined) attack = { serial: c.attack.serial, style, reached: !standsIdle(o), where: `attack ${style} started ${where}` };
    if (attack !== undefined && !attack.reached) attack.reached = c.attack.hit || c.grab.target !== undefined || ((attack.style === AttackStyle.grab || c.attack.frame >= attackStartupFrames(attack.style, c.tuning.moves)) && strikesNow(c, o, attack.style));
    if (c.special.action !== action && c.special.action !== SpecialAction.none && standsIdle(o) && !specialAccountedFor(c, o)) result.outOfReach.push(`special ${c.special.action} form ${c.special.form} ${where}`);
    serial = c.attack.serial;
    action = c.special.action;
  }
  result.hits = o.visuals.hit;
  return result;
}

sweep("computerApproachesAnOpponentOutOfReachInsteadOfAttacking", () => {
  const failures: string[] = [];
  let idleStarts = 0;
  for (const character of SELECTABLE_CHARACTERS) {
    const layouts = [
      { name: "from a raised deck to the main deck", run: playIdleOpponent(character, 265.0, RAISED_Z, 2, -450.0, 0.0, 0) },
      { name: "from the main deck to a raised deck", run: playIdleOpponent(character, 450.0, 0.0, 0, -265.0, RAISED_Z, 1) },
    ];
    for (const { name, run } of layouts) {
      const who = `${fighterName(character)} ${name}`;
      idleStarts += run.idleStarts;
      if (run.outOfReach.length > 0) failures.push(`${who}: ${run.outOfReach.length} starts out of reach, first ${run.outOfReach.slice(0, 3).join("; ")}`);
      if (run.arrival < 0 || run.arrival > ARRIVAL_FRAMES) failures.push(`${who}: reached the opponent's deck on frame ${run.arrival}`);
      // Having arrived, it fights: the contract holds a computer that attacks, not one that waits.
      if (run.hits === 0) failures.push(`${who}: landed no hit`);
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));
  assertGreaterThan(idleStarts, SELECTABLE_CHARACTERS.length);
});
