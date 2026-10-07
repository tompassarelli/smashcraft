// The computer plays the newest moves (#155): as Wren Expert, in seeded
// computer-against-computer mirror matches, each fighter throws its drills
// and multi-hit aerials, Illidan's raid-boss normals, the heroes' angled
// forward tilts, down tilts and dash attacks; with its passive ready it
// favours the move that cashes it, against a ready opponent it shields
// more, and Archer and Rifleman never press a special their mana can't pay.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv } from "wisp/src/sim/intMath";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { passivePips } from "../sim/passives";
import { type Fighter, createFighter } from "../sim/fighter";
import { EYE_BLAST_CHARGE_FRAMES } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { gameplanOf, passiveLandingMove } from "./botGameplan";
import { type GameplanMove, GameplanSpecial } from "../sim/gameplan";
import { passiveSpec } from "../sim/passives";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();
/** Each fighter plays this many seeded matches, the first half at 0%, the rest at 110%. */
const MATCHES = 8;
const FRAMES = 1800;

type Counts = Record<string, number>;
const count = (counts: Counts, key: string, by = 1) => { counts[key] = (counts[key] ?? 0) + by; };

/** Each fighter's last attack serial, passive serial, and the attack it is shielding against. */
interface Watch {
  attack: number;
  special: number;
  blast: number;
  proc: number;
  /** The opponent's attack serial last seen starting, whether its passive was ready then, and whether this fighter shielded it. */
  threat: number;
  threatReady: boolean;
  shielded: boolean;
}

/** A neutral special started this frame (Archer's arrow, Rifleman's blaster, a hero's neutral special). */
const NEUTRAL_SPECIALS: readonly number[] = [SpecialAction.archerArrow, SpecialAction.riflemanBlaster, SpecialAction.demonHunterManaBurn, SpecialAction.heroNeutral];

/** A move started while the passive is ready or charging, and whether it is the move that cashes it. */
function moveStarted(f: Readonly<Fighter>, move: GameplanMove, counts: Counts): void {
  const plan = gameplanOf(f.character);
  const ready = passivePips(f).ready;
  count(counts, ready ? "readyMoves" : "idleMoves");
  if (plan !== undefined && passiveLandingMove(plan, passiveSpec(f.character).kind, move)) count(counts, ready ? "readyLanding" : "idleLanding");
}

function observe(f: Readonly<Fighter>, opponent: Readonly<Fighter>, watch: Watch, counts: Counts): void {
  const style = f.attack.style;
  if (style !== undefined && f.attack.serial !== watch.attack) {
    count(counts, `style${style}`);
    moveStarted(f, f.ground.dashFrame > 0 && style === AttackStyle.dashAttack ? AttackStyle.dashAttack : style, counts);
  }
  watch.attack = f.attack.serial;
  if (f.special.action !== watch.special && NEUTRAL_SPECIALS.includes(f.special.action)) moveStarted(f, GameplanSpecial.neutral, counts);
  watch.special = f.special.action;
  // Eye Blast: Illidan's forward smash released after its full charge, once per attack.
  if (f.character === Character.demonHunter && style === AttackStyle.forwardSmash && !f.attack.smashCharging && f.attack.smashChargeFrames >= EYE_BLAST_CHARGE_FRAMES && watch.blast !== f.attack.serial) {
    count(counts, "eyeBlast");
    watch.blast = f.attack.serial;
  }
  if (f.passive.serial !== watch.proc) count(counts, "proc");
  watch.proc = f.passive.serial;
  // The opponent's attacks, each counted once as it starts, and whether this fighter raised a shield while it ran.
  if (opponent.attack.style !== undefined && opponent.attack.serial !== watch.threat) {
    if (watch.threat !== 0) count(counts, `${watch.threatReady ? "ready" : "idle"}Shielded`, watch.shielded ? 1 : 0);
    watch.threat = opponent.attack.serial;
    watch.threatReady = passivePips(opponent).ready;
    watch.shielded = false;
    count(counts, watch.threatReady ? "readyThreats" : "idleThreats");
  }
  if (opponent.attack.style !== undefined && f.shield.raised) watch.shielded = true;
}

/** A Wren Expert match of `character` against `opponent` under `seed`, both at `damage`, counting each computer playing `character`. */
function mirrorMatch(character: Character, opponent: Character, seed: number, damage: number, counts: Counts): void {
  const world = createRoster(3, [createFighter(character, -240.0, 1), createFighter(opponent, 240.0, -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  match.matchSeed = seed;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const watches: Watch[] = [];
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = "wren";
    match.cpuResolvedOpponents[slot] = "wren";
    match.cpuTiers[slot] = "expert";
    fighterAt(world, slot).status.damage = damage;
    watches.push({ attack: 0, special: 0, blast: 0, proc: 0, threat: 0, threatReady: false, shielded: false });
  }
  for (let step = 0; step < FRAMES; step++) {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    for (const slot of [0, 1] as const) {
      const watch = watches[slot];
      if (watch !== undefined && (slot === 0 || opponent === character)) observe(fighterAt(world, slot), fighterAt(world, 1 - slot), watch, counts);
    }
  }
  for (const slot of [0, 1] as const) count(counts, "manaDenied", fighterAt(world, slot).visuals.manaDenied);
}

/** The counts over the fighter's seeded matches; a seed replays its counts exactly. */
function played(character: Character, opponent: Character = character, matches = MATCHES): Counts {
  const counts: Counts = {};
  for (let index = 0; index < matches; index++) mirrorMatch(character, opponent, 11 + index * 12, index < floorDiv(matches, 2) ? 0.0 : 110.0, counts);
  const first: Counts = {};
  const again: Counts = {};
  mirrorMatch(character, opponent, 11, 0.0, first);
  mirrorMatch(character, opponent, 11, 0.0, again);
  for (const key of Object.keys(first)) assertEquals(again[key], first[key], key);
  for (const key of Object.keys(again)) assertEquals(again[key], first[key], key);
  return counts;
}

/** Each named move started at least once. */
function throws(counts: Counts, styles: readonly AttackStyle[]): void {
  for (const style of styles) {
    const uses = counts[`style${style}`] ?? 0;
    if (uses <= 0) throw new Error(`inactive attack style ${style}`);
  }
}

/**
 * With its passive ready the fighter's moves are its landing move more often
 * than with it charging, and it procs; against a ready opponent it shields a
 * larger share of attacks than against one still charging.
 */
function playsPassives(counts: Counts): void {
  assertGreaterThan(counts.proc ?? 0, 0);
  const readyShare = (counts.readyLanding ?? 0) * (counts.idleMoves ?? 0);
  const idleShare = (counts.idleLanding ?? 0) * (counts.readyMoves ?? 0);
  if (readyShare <= idleShare) throw new Error(`passive landing shares: ready ${counts.readyLanding ?? 0}/${counts.readyMoves ?? 0}, charging ${counts.idleLanding ?? 0}/${counts.idleMoves ?? 0}; ${Object.keys(counts).map(key => `${key}=${counts[key] ?? 0}`).join(", ")}`);
}

/** Shields a ready opponent's attacks more often than a charging one's (the counts are from both fighters' sides). */
function shieldsReady(counts: Counts): void {
  assertGreaterThan((counts.readyShielded ?? 0) * (counts.idleThreats ?? 0), (counts.idleShielded ?? 0) * (counts.readyThreats ?? 0));
}

const { forwardTiltUp, forwardTiltDown, downTilt, dashAttack, neutralAir, upAir, downAir, forwardAir, forwardTilt, downSmash } = AttackStyle;

test("computer Blademaster throws Bladestorm, Blade Wheel, his down tilt and dash attack, and cashes Critical Strike", () => {
  // Shields are rare (about 2% of his mirror's attacks) and whiff punishes reshuffle the mirror: 16 matches give the shares a sample.
  const counts = played(Character.blademaster, Character.blademaster, 2 * MATCHES);
  throws(counts, [downAir, neutralAir, downTilt, dashAttack]);
  playsPassives(counts);
  shieldsReady(counts);
});

test("computer Mountain King angles his forward tilt, throws his down tilt and dash attack, and cashes Bash", () => {
  const counts = played(Character.mountainKing);
  throws(counts, [forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
  playsPassives(counts);
});

test("computer Warden throws Falling Knives, Sky Crescent, angled forward tilts, her down tilt and dash attack", () => {
  throws(played(Character.warden), [downAir, upAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

test("computer Lich throws Frost Halo, angled forward tilts, his down tilt and dash attack", () => {
  // A Lich mirror keeps its range; Warden, who jumps and runs in, brings his close moves out. Frost Halo
  // answers her jump-ins only, a few a match since she stopped spacing with forward air (#160): 16 matches give it a sample.
  throws(played(Character.lich, Character.warden, 2 * MATCHES), [neutralAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

test("computer Dreadlord throws Batwing Turn, angled forward tilts, his down tilt and dash attack, and cashes Vampiric Aura", () => {
  const counts = played(Character.dreadlord);
  throws(counts, [neutralAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
  playsPassives(counts);
});

test("computer Shadow Hunter throws the glaive drill, angled forward tilts, his down tilt and dash attack, and cashes Voodoo", () => {
  const counts = played(Character.shadowHunter);
  throws(counts, [downAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
  playsPassives(counts);
});

test("computer Uther throws his down tilt and dash attack", () => {
  throws(played(Character.uther), [downTilt, dashAttack]);
});

test("computer Illidan charges Eye Blast and throws Shear, Flames of Azzinoth and the two-hit forward air", () => {
  const counts = played(Character.demonHunter);
  throws(counts, [forwardTilt, downSmash, forwardAir]);
  assertGreaterThan(counts.eyeBlast ?? 0, 0);
});

test("computer Archer and Rifleman never press a special their mana can't pay, and cash Trueshot and Long Rifles", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const counts = played(character);
    assertEquals(counts.manaDenied ?? 0, 0);
    playsPassives(counts);
  }
});
