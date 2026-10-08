// The computer plays the newest moves (#155): as Wren Expert, in seeded
// computer-against-computer mirror matches, each fighter throws its drills
// and multi-hit aerials, Illidan's raid-boss normals, the heroes' angled
// forward tilts, down tilts and dash attacks.
import { assertEquals, assertGreaterThan, assertTrue } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { floorDiv } from "wisp/src/sim/intMath";
import { attackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { EYE_BLAST_CHARGE_FRAMES } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { gameplanOf } from "./botGameplan";
import { type GameplanMove, GameplanSpecial } from "../sim/gameplan";
import { produceComputerInput } from "./botPlay";
import { chooseAttack } from "./botMoves";
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

interface Watch { attack: number; blast: number; }

function observe(f: Readonly<Fighter>, watch: Watch, counts: Counts): void {
  const style = f.attack.style;
  if (style !== undefined && f.attack.serial !== watch.attack) count(counts, `style${style}`);
  watch.attack = f.attack.serial;
  if (f.character === Character.demonHunter && style === AttackStyle.forwardSmash && !f.attack.smashCharging && f.attack.smashChargeFrames >= EYE_BLAST_CHARGE_FRAMES && watch.blast !== f.attack.serial) {
    count(counts, "eyeBlast");
    watch.blast = f.attack.serial;
  }
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
    watches.push({ attack: 0, blast: 0 });
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
      if (watch !== undefined && (slot === 0 || opponent === character)) observe(fighterAt(world, slot), watch, counts);
    }
  }
  for (const slot of [0, 1] as const) {
    const watch = watches[slot];
    count(counts, "manaDenied", fighterAt(world, slot).visuals.manaDenied);
  }
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

const { forwardTiltUp, forwardTiltDown, downTilt, dashAttack, neutralAir, upAir, downAir, forwardAir, forwardTilt, downSmash } = AttackStyle;

sweep("computer Blademaster throws Bladestorm, Blade Wheel, his down tilt and dash attack [spec #155]", () => {
  // Shields are rare (about 2% of his mirror's attacks) and whiff punishes reshuffle the mirror: 16 matches give the shares a sample.
  const counts = played(Character.blademaster, Character.blademaster, 2 * MATCHES);
  throws(counts, [downAir, neutralAir, downTilt, dashAttack]);
});

sweep("computer Mountain King angles his forward tilt, throws his down tilt and dash attack [spec #155]", () => {
  const counts = played(Character.mountainKing);
  throws(counts, [forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

sweep("computer Warden throws Falling Knives, Sky Crescent, angled forward tilts, her down tilt and dash attack [spec #155] [repro #242]", () => {
  throws(played(Character.warden), [downAir, upAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

sweep("computer Lich throws Frost Halo, angled forward tilts, his down tilt and dash attack [spec #155]", () => {
  // A Lich mirror keeps its range; Warden, who jumps and runs in, brings his close moves out. Frost Halo
  // answers her jump-ins only, a few a match since she stopped spacing with forward air (#160): 16 matches give it a sample.
  throws(played(Character.lich, Character.warden, 2 * MATCHES), [neutralAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

sweep("computer Dreadlord throws Batwing Turn, angled forward tilts, his down tilt and dash attack [spec #155]", () => {
  const counts = played(Character.dreadlord);
  throws(counts, [neutralAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

sweep("computer Shadow Hunter throws the glaive drill, angled forward tilts, his down tilt and dash attack [spec #155]", () => {
  const counts = played(Character.shadowHunter);
  throws(counts, [downAir, forwardTiltUp, forwardTiltDown, downTilt, dashAttack]);
});

sweep("computer Forsaken Paladin throws his down tilt and dash attack [spec #155]", () => {
  throws(played(Character.forsakenPaladin), [downTilt, dashAttack]);
});

sweep("computer Illidan charges Eye Blast and throws Shear, Flames of Azzinoth and the two-hit forward air [spec #155]", () => {
  const counts = played(Character.demonHunter);
  throws(counts, [forwardTilt, downSmash, forwardAir]);
  assertGreaterThan(counts.eyeBlast ?? 0, 0);
});

sweep("computer Archer and Rifleman never press a special their mana can't pay in a seeded mirror, which replays its counts [spec #155]", () => {
  for (const character of [Character.archer, Character.rifleman]) assertEquals(played(character, character, 1).manaDenied ?? 0, 0);
});
