// The computer takes the redesigned kits' options (#146): as Wren Expert, in
// seeded computer-against-computer mirror matches, each fighter uses every
// new option at least once, and a seed replays the same counts. Half the
// matches start both fighters at a high percent, so launches send them off
// the stage and the returns' options come up too.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv } from "wisp/src/sim/intMath";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Character, HeroStatusKind, HippogryphKind, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { isHeroSpecialAction } from "../sim/heroSpecialRules";
import { FOLLOW_UP_FORM, FollowUpInput, SpecialForm } from "../sim/heroSpecials";
import { RIFLEMAN_BLASTER_AIR_FRAMES, RIFLEMAN_BLASTER_GROUND_FRAMES } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { CHAOS_STRIKE_AIR_FORM, CHAOS_STRIKE_FORM, VENGEFUL_RETREAT_FORM, DEMONHUNTER_GLIDE_FORM, DEMONHUNTER_IMMOLATE_DURATION, RIFLEMAN_RECOVERY_STARTUP_FRAMES, RIFLEMAN_SECOND_SHOT_FORM } from "../sim/specials";
import { produceComputerInput } from "./botPlay";
import { cpuSkill } from "./cpuSkill";
import { CPU_PROFILES } from "./cpuProfiles";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();
/** Each fighter plays this many seeded matches, the first half at 0%, the rest at 110%. */
const MATCHES = 8;
const FRAMES = 1800;

/** Where each fighter's special stood last frame, and the facing its current action started with. */
interface Watch {
  action: number;
  form: number;
  frame: number;
  entryFacing: number;
  bird: number;
  divine: number;
  asleep: boolean;
  hexed: boolean;
}

type Counts = Record<string, number>;
const count = (counts: Counts, option: string) => { counts[option] = (counts[option] ?? 0) + 1; };

/** The option a hero action's form shows: a follow-up's index, the recall or the marked form. */
const followUp = (f: Readonly<Fighter>): number => floorDiv(f.special.form, FOLLOW_UP_FORM) - 1;

/** Whether the fighter's grounded down special has a branch a shield press takes (Thunder Clap's Hold). */
const dropsCharge = (f: Readonly<Fighter>): boolean => {
  for (const branch of f.tuning.specials?.down.ground.followUps ?? []) if (branch.input === FollowUpInput.shield) return true;
  return false;
};

/** Counts the options both computers take as the frames go. */
function observe(f: Readonly<Fighter>, watch: Watch, down: boolean, grabMash: boolean, counts: Counts): void {
  const { special } = f;
  const started = special.action !== watch.action || (special.frame < watch.frame && special.form === watch.form);
  const changedForm = special.action === watch.action && special.form !== watch.form;
  if (isHeroSpecialAction(special.action)) {
    const slot = special.action - SpecialAction.heroNeutral;
    if (started) watch.entryFacing = f.facing;
    if (started || changedForm) {
      if (special.form === SpecialForm.recall) count(counts, `recall${slot}`);
      else if (special.form === SpecialForm.marked) count(counts, `marked${slot}`);
      else if (special.form >= FOLLOW_UP_FORM) {
        count(counts, `followUp${slot}.${followUp(f)}`);
        if (f.facing !== watch.entryFacing) count(counts, `crossUp${slot}`);
      } else count(counts, `special${slot}`);
    }
    // A charge run out to its end slams at full.
    if (special.form < FOLLOW_UP_FORM && special.frame === 50 && watch.frame === 49) count(counts, `runOut${slot}`);
  }
  switch (special.action) {
    case SpecialAction.riflemanRecovery:
      if (special.frame === RIFLEMAN_RECOVERY_STARTUP_FRAMES && watch.frame !== special.frame) {
        count(counts, f.motion.vz === 0.0 ? "levelRoute" : f.motion.vx !== 0.0 ? "diagonalRoute" : "upRoute");
      }
      if (special.form === RIFLEMAN_SECOND_SHOT_FORM && watch.form !== special.form) count(counts, "secondShot");
      break;
    case SpecialAction.riflemanBlaster:
      if (started) count(counts, special.duration === RIFLEMAN_BLASTER_AIR_FRAMES ? "airBlaster" : special.duration === RIFLEMAN_BLASTER_GROUND_FRAMES ? "groundBlaster" : "blaster");
      break;
    case SpecialAction.riflemanBear:
      if (started) count(counts, "bear");
      break;
    case SpecialAction.demonHunterFelRush:
      if (started) count(counts, "felRush");
      if (changedForm && special.form === VENGEFUL_RETREAT_FORM) count(counts, "vengefulRetreat");
      if (changedForm && (special.form === CHAOS_STRIKE_FORM || special.form === CHAOS_STRIKE_AIR_FORM)) count(counts, f.facing !== watch.entryFacing ? "chaosCrossUp" : "chaosStrike");
      if (started) watch.entryFacing = f.facing;
      break;
    case SpecialAction.demonHunterWingAscent:
      if (special.form === DEMONHUNTER_GLIDE_FORM && watch.form !== special.form) count(counts, "glide");
      break;
    case SpecialAction.archerHomingArrow:
      if (started) count(counts, "homingArrow");
      break;
    case SpecialAction.archerRecovery:
      if (down) count(counts, "lowRide");
      break;
  }
  // A one-frame branch (Thunder Clap's Hold) ends the action on the frame it is taken.
  if (isHeroSpecialAction(watch.action) && special.action === SpecialAction.none && watch.form < FOLLOW_UP_FORM && f.launch.hitstun <= 0 && f.launch.hitlag <= 0
    && watch.action === SpecialAction.heroDown && watch.frame >= 9 && watch.frame < 48 && f.motion.grounded && dropsCharge(f)) count(counts, "dropped3");
  if (watch.action === SpecialAction.demonHunterImmolate && special.action !== SpecialAction.demonHunterImmolate && watch.frame < DEMONHUNTER_IMMOLATE_DURATION - 1
    && f.launch.hitstun <= 0 && f.launch.hitlag <= 0) count(counts, "immolateJump");
  if (f.character === Character.demonHunter && f.motion.grounded) {
    for (const orb of f.projectiles) {
      const behind = (orb.x - f.motion.x) * orb.direction;
      if (orb.life > 0 && orb.kind === 4 && behind > 30.0 && behind < 120.0 && f.motion.deltaX * orb.direction > 0) count(counts, "behindOrb");
    }
  }
  if (f.hippogryph.kind !== watch.bird) {
    if (f.hippogryph.kind === HippogryphKind.released) count(counts, "leapOff");
    if (f.hippogryph.kind === HippogryphKind.dive) count(counts, "perchDive");
  }
  if (watch.divine > 1 && f.status.divineFrames === 0 && (f.attack.style !== undefined || f.special.action !== SpecialAction.none || f.grab.target !== undefined)) count(counts, "divineAttack");
  if (grabMash && f.grab.owner !== undefined) count(counts, "grabMash");
  if (grabMash && f.status.frozenFrames > 0) count(counts, "freezeMash");
  const asleep = f.status.condition === HeroStatusKind.sleep;
  if (grabMash && asleep) count(counts, "sleepMash");
  if (watch.asleep && f.launch.hitlag > 0) count(counts, "sleptHit");
  watch.asleep = asleep;
  const hexed = f.status.condition === HeroStatusKind.hex;
  if (grabMash && hexed) count(counts, "hexMash");
  if (watch.hexed && f.launch.hitlag > 0) count(counts, "hexedHit");
  watch.hexed = hexed;
  watch.action = special.action;
  watch.form = special.form;
  watch.frame = special.frame;
  watch.bird = f.hippogryph.kind;
  watch.divine = f.status.divineFrames;
}

/** A Wren Expert match of `character` against `opponent` under `seed`, both at `damage`, counting the options of each computer playing `character`. */
function computerMatch(character: Character, opponent: Character, seed: number, damage: number, counts: Counts): void {
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
    watches.push({ action: 0, form: 0, frame: 0, entryFacing: 1, bird: 0, divine: 0, asleep: false, hexed: false });
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
      const input = produced.inputs[slot];
      const watch = watches[slot];
      if (watch !== undefined) observe(fighterAt(world, slot), watch, input.down, input.grabMashPressed, slot === 0 || opponent === character ? counts : {});
    }
  }
}

/** Every option named appears at least once over the seeds, and the first seed replays its counts. */
function usesEvery(character: Character, options: readonly string[], opponent: Character = character, matches = MATCHES, extra: readonly (readonly [seed: number, damage: number])[] = []): void {
  const counts: Counts = {};
  for (let index = 0; index < matches; index++) computerMatch(character, opponent, 11 + index * 12, index < floorDiv(matches, 2) ? 0.0 : 110.0, counts);
  for (const [seed, damage] of extra) computerMatch(character, opponent, seed, damage, counts);
  // "a|b": either option counts.
  for (const option of options) {
    const uses = option.split("|").reduce((sum, name) => sum + (counts[name] ?? 0), 0);
    if (uses <= 0) throw new Error(`inactive kit option ${option}: ${Object.keys(counts).map(name => `${name}=${counts[name] ?? 0}`).join(", ")}`);
  }
  const first: Counts = {};
  const again: Counts = {};
  computerMatch(character, opponent, 11, 0.0, first);
  computerMatch(character, opponent, 11, 0.0, again);
  for (const option of Object.keys(first)) assertEquals(again[option], first[option], option);
  for (const option of Object.keys(again)) assertEquals(again[option], first[option], option);
}

test("every named profile can take legal kit options, with greater reliability as execution grows", () => {
  for (const profile of CPU_PROFILES) assertTrue(cpuSkill(profile.opponent, profile.tier).kitTenths > 0);
  assertTrue(cpuSkill("wren", "expert").kitTenths > cpuSkill("wren", "rookie").kitTenths);
});

test("computer Blademaster backstabs from Wind Walk in front and crossed up, feints, and swaps onto Mirror Image", () => {
  usesEvery(Character.blademaster, ["followUp1.0", "crossUp1", "followUp1.1", "special3", "recall3"]);
});

test("computer Mountain King claps small, full and as bait, recalls Storm Bolt and spikes with Hammerfall", () => {
  usesEvery(Character.mountainKing, ["followUp3.0", "followUp3.1|runOut3", "dropped3", "recall0", "followUp2.0"]);
});

test("computer Warden marks and follows with Shadow Pursuit", () => {
  usesEvery(Character.warden, ["special0", "marked1"]);
});

test("computer Lich bursts Frost Nova, places Death and Decay, arms Frost Armor and cashes Dark Ritual", () => {
  usesEvery(Character.lich, ["recall0", "special1", "special3", "recall3"]);
});

test("computer Uther sends Holy Radiance and attacks out of Divine Shield", () => {
  // Divine Shield succeeds only against a strike timed into its window, about once in 30 mirror matches, so
  // the usual matches add two seeds of the same series (indices 37 and 55 at 110%) where it does.
  usesEvery(Character.uther, ["special1", "divineAttack"], Character.uther, 2 * MATCHES, [[11 + 37 * 12, 110.0], [11 + 55 * 12, 110.0]]);
});

test("computer Dreadlord feints Vampiric Pounce, sleeps a target, mashes out of Sleep and hits a sleeper", () => {
  usesEvery(Character.dreadlord, ["followUp1.0", "special3", "sleepMash", "sleptHit"]);
});

test("computer Shadow Hunter throws Spirit Glaive, hexes, presses a hexed target and mashes out of a Hex", () => {
  usesEvery(Character.shadowHunter, ["special0", "special3", "hexedHit", "hexMash"]);
});

test("computer Pit Lord roars, charges, leaps and calls Rain of Fire", () => {
  usesEvery(Character.pitLord, ["special0", "special1", "special2", "special3"]);
});

test("computer Beastmaster summons the pack, commands Stampede, Hawk Dive and Quill Volley", () => {
  usesEvery(Character.beastmaster, ["special0", "special1", "special2", "special3", "recall1", "recall2", "recall3"]);
});

test("computer Rifleman flies level and diagonal recoil routes with a second shot, short-hops and grounds the blaster, calls the bear", () => {
  usesEvery(Character.rifleman, ["levelRoute", "diagonalRoute", "secondShot", "airBlaster", "groundBlaster", "bear"]);
});

test("computer Illidan jump-cancels Immolate, glides out of Wing Ascent, runs behind Mana Burn and Fel Rushes into Chaos Strike or Vengeful Retreat", () => {
  // Whiff punishes (botPunish.ts) take most close windows with a normal, so Immolate starts rarely: 16 matches.
  usesEvery(Character.demonHunter, ["immolateJump", "glide", "behindOrb", "felRush", "chaosStrike|chaosCrossUp", "vengefulRetreat"], Character.demonHunter, 2 * MATCHES);
});

test("computer Archer shoots the homing arrow, rides the low line, leaps off and dives from the perch", () => {
  usesEvery(Character.archer, ["homingArrow", "lowRide", "leapOff", "perchDive", "grabMash"]);
});
