// The computer takes the redesigned kits' options (#146): at level 9, in
// seeded computer-against-computer mirror matches, each fighter uses every
// new option at least once, and a seed replays the same counts. Half the
// matches start both fighters at a high percent, so launches send them off
// the stage and the returns' options come up too.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Character, HeroStatusKind, HippogryphKind, SpecialAction } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { isHeroSpecialAction } from "../sim/heroSpecialRules";
import { FOLLOW_UP_FORM, FollowUpInput, SpecialForm } from "../sim/heroSpecials";
import { RIFLEMAN_BLASTER_AIR_FRAMES, RIFLEMAN_BLASTER_GROUND_FRAMES } from "../sim/moves";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { DEMONHUNTER_GLIDE_FORM, DEMONHUNTER_IMMOLATE_DURATION, RIFLEMAN_RECOVERY_STARTUP_FRAMES, RIFLEMAN_SECOND_SHOT_FORM } from "../sim/specials";
import { produceComputerInput } from "./botPlay";
import { cpuSkill } from "./cpuLevel";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();
const SEEDS = [11, 23, 37, 41];
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
}

type Counts = Record<string, number>;
const count = (counts: Counts, option: string) => { counts[option] = (counts[option] ?? 0) + 1; };

/** The option a hero action's form shows: a follow-up's index, the recall or the marked form. */
const followUp = (f: Readonly<Fighter>): number => Math.floor(f.special.form / FOLLOW_UP_FORM) - 1;

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
  watch.action = special.action;
  watch.form = special.form;
  watch.frame = special.frame;
  watch.bird = f.hippogryph.kind;
  watch.divine = f.status.divineFrames;
}

/** A level-9 mirror match of `character` under `seed`, counting both computers' options; the second half of the seeds start at 110%. */
function mirrorMatch(character: Character, seed: number, damage: number, counts: Counts): void {
  const world = createRoster(3, [createFighter(character, -240.0, 1), createFighter(character, 240.0, -1)]);
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
  for (const slot of [0, 1]) {
    fighterAt(world, slot).status.damage = damage;
    watches.push({ action: 0, form: 0, frame: 0, entryFacing: 1, bird: 0, divine: 0, asleep: false });
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
      if (watch !== undefined) observe(fighterAt(world, slot), watch, input.down, input.grabMashPressed, counts);
    }
  }
}

/** Every option named appears at least once over the seeds, and the first seed replays its counts. */
function usesEvery(character: Character, options: readonly string[]): void {
  const counts: Counts = {};
  SEEDS.forEach((seed, index) => mirrorMatch(character, seed, index < SEEDS.length / 2 ? 0.0 : 110.0, counts));
  // "a|b": either option counts.
  for (const option of options) assertGreaterThan(option.split("|").reduce((sum, name) => sum + (counts[name] ?? 0), 0), 0);
  const first: Counts = {};
  const again: Counts = {};
  mirrorMatch(character, SEEDS[0] ?? 0, 0.0, first);
  mirrorMatch(character, SEEDS[0] ?? 0, 0.0, again);
  for (const option of Object.keys(first)) assertEquals(again[option], first[option], option);
  for (const option of Object.keys(again)) assertEquals(again[option], first[option], option);
}

test("kit options are a level's share: none below level 4, all at level 9", () => {
  for (let level = 1; level <= 3; level++) assertEquals(cpuSkill(level).kitTenths, 0);
  assertEquals(cpuSkill(9).kitTenths, 10);
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

test("computer Uther shoots Holy Light and attacks out of Divine Shield", () => {
  usesEvery(Character.uther, ["special0", "divineAttack"]);
});

test("computer Dreadlord feints Vampiric Pounce, sleeps a target, mashes out of Sleep and hits a sleeper", () => {
  usesEvery(Character.dreadlord, ["followUp1.0", "special3", "sleepMash", "sleptHit"]);
});

test("computer Rifleman flies level and diagonal recoil routes with a second shot, short-hops and grounds the blaster, calls the bear", () => {
  usesEvery(Character.rifleman, ["levelRoute", "diagonalRoute", "secondShot", "airBlaster", "groundBlaster", "bear"]);
});

test("computer Illidan jump-cancels Immolate, glides out of Wing Ascent and runs behind Mana Burn", () => {
  usesEvery(Character.demonHunter, ["immolateJump", "glide", "behindOrb"]);
});

test("computer Archer shoots the homing arrow, rides the low line, leaps off and dives from the perch", () => {
  usesEvery(Character.archer, ["homingArrow", "lowRide", "leapOff", "perchDive", "grabMash"]);
});
