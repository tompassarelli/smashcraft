// Drills and multi-hit aerials (#152), through the match step with scripted
// inputs: every hit of each multi-hit connects in sequence at 0, 50 and 100%,
// drills land as designed, a shield and SDI still answer them, and a crouching
// victim fares worse against a drill than against a single-hit down air.
// smashcraft:docs/design/aerials.md.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character } from "../sim/codes";
import { canAttack, canShieldGrab } from "../sim/conditions";
import { createFighter, type Fighter } from "../sim/fighter";
import { type Controls, type Roster, copyControls, createRoster, neutralControls } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES } from "../sim/shield";
import { controls } from "../sim/testWorld";
import { type FrameControls, createBufferedFrameControls } from "./controls";
import { type MatchState, Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

/** One contact the victim took: the frame, the attack's hit window and the damage dealt. */
interface Contact {
  readonly frame: number;
  readonly window: number;
  readonly damage: number;
  readonly shielded: boolean;
}

interface Trace {
  readonly contacts: Contact[];
  /** First frame, after the attack started, on which each fighter could act again; -1 if never within the run. */
  attackerActs: number;
  victimActs: number;
  /** Frame the attacker touched the floor; -1 if it never did. */
  attackerLands: number;
  /** The victim's highest feet height after its first contact. */
  victimPeakZ: number;
  readonly attacker: Fighter;
  readonly victim: Fighter;
}

interface Setup {
  readonly attacker: Character;
  readonly style: AttackStyle;
  readonly victim?: Character | undefined;
  readonly percent?: number | undefined;
  /** The attacker's start, relative to the victim's feet: ahead along its facing and above. */
  readonly offsetX: number;
  readonly height: number;
  readonly victimHeight?: number | undefined;
  /** The victim's controls on each frame since the attack was queued (frame 1 starts it). */
  readonly victimInput?: ((frame: number, victim: Fighter) => Controls) | undefined;
  readonly shielding?: boolean | undefined;
  readonly frames?: number | undefined;
  /** Out of a raised shield, the victim grabs on the first frame it can once the attacker is on the floor. */
  readonly shieldGrab?: boolean | undefined;
}

/** The ground request code an airborne press turns into this aerial (input/combat.ts). */
function aerialRequest(style: AttackStyle): AttackStyle {
  switch (style) {
    case AttackStyle.neutralAir: return AttackStyle.jab;
    case AttackStyle.upAir: return AttackStyle.upTilt;
    case AttackStyle.downAir: return AttackStyle.downTilt;
    case AttackStyle.forwardAir:
    case AttackStyle.backAir: return AttackStyle.forwardTilt;
    default: return style;
  }
}

/** Plays one attack through the match step and records what the victim took. */
function playAttack(setup: Setup): Trace {
  const game: MatchState = createMatchState();
  game.phase = Phase.match;
  // The flat deck: no raised decks to catch either fighter.
  game.stageChoice = 0;
  const attacker = createFighter(setup.attacker, f32(-setup.offsetX), 1);
  const victim = createFighter(setup.victim ?? Character.rifleman, 0.0, -1);
  victim.status.damage = setup.percent ?? 0.0;
  if (setup.height > 0) {
    attacker.motion.grounded = false;
    attacker.motion.surface = undefined;
    attacker.motion.z = setup.height;
    attacker.jump.remaining = 1;
  }
  if ((setup.victimHeight ?? 0) > 0) {
    victim.motion.grounded = false;
    victim.motion.surface = undefined;
    victim.motion.z = setup.victimHeight ?? 0;
    victim.jump.remaining = 1;
  }
  if (setup.shielding === true) {
    victim.shield.raised = true;
    victim.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
  }
  const world: Roster = createRoster(3, [attacker, victim]);
  const frameControls: FrameControls = createBufferedFrameControls();
  const trace: Trace = { contacts: [], attackerActs: -1, victimActs: -1, attackerLands: -1, victimPeakZ: 0.0, attacker, victim };
  queueAttack(frameControls.commands[0], { style: aerialRequest(setup.style), facing: setup.style === AttackStyle.backAir ? -1 : 0, frame: 1, mayCharge: false });
  let hits = victim.visuals.hit;
  let shields = victim.visuals.shield;
  let damage = victim.status.damage;
  let victimHeld = false;
  const neutral = neutralControls();
  const idleVictim = setup.shielding === true ? shield() : neutral;
  for (let frame = 1; frame <= (setup.frames ?? 90); frame++) {
    copyControls(frameControls.inputs[0], neutral);
    copyControls(frameControls.inputs[1], setup.victimInput?.(frame, victim) ?? idleVictim);
    if (setup.shieldGrab === true && attacker.motion.grounded && trace.contacts.length > 0 && canShieldGrab(victim) && frameControls.commands[1].pending === undefined) {
      queueAttack(frameControls.commands[1], { style: AttackStyle.grab, facing: 0, frame: frame, mayCharge: false });
    }
    stepMatch(game, world, frameControls, frame);
    if (trace.contacts.length > 0) trace.victimPeakZ = Math.max(trace.victimPeakZ, victim.motion.z);
    const struck = victim.visuals.hit !== hits;
    const blocked = victim.visuals.shield !== shields;
    if (struck || blocked) {
      trace.contacts.push({ frame, window: victim.hits.lastWindow, damage: f32(victim.status.damage - damage), shielded: blocked && !struck });
      victimHeld = struck;
    }
    hits = victim.visuals.hit;
    shields = victim.visuals.shield;
    damage = victim.status.damage;
    if (trace.attackerLands < 0 && attacker.motion.grounded && setup.height > 0) trace.attackerLands = frame;
    if (frame > 1 && trace.attackerActs < 0 && attacker.motion.grounded && canAttack(attacker)) trace.attackerActs = frame;
    if (victimHeld && trace.victimActs < 0 && canAttack(victim)) trace.victimActs = frame;
    if (setup.frames === undefined && setup.shieldGrab !== true && trace.attackerActs >= 0 && trace.victimActs >= 0 && canAttack(attacker) && canAttack(victim)) break;
  }
  return trace;
}

const shield = (): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
const crouch = (): Controls => controls({ down: true, verticalDirection: -1 });

/**
 * Smash DI away from the attacker: during the victim's hitlag, a fresh pulse on
 * every other frame with the stick held there (so the release also shifts);
 * otherwise neutral, so the victim never walks out.
 */
function sdiAway(direction: number) {
  return (frame: number, victim: Fighter): Controls => victim.launch.hitlag <= 0 ? neutralControls() : controls(floorMod(frame, 2) === 0
    ? { sdiPulse: true, sdiX: direction, sdiZ: 0, direction, verticalDirection: 0 }
    : { direction, verticalDirection: 0 });
}

interface Case {
  readonly name: string;
  readonly setup: Setup;
  /** Every contact, the landing hit included, each in the next window. */
  readonly hits: number;
}

const DRILLS: readonly Case[] = [
  { name: "Bladestorm on a standing target", setup: { attacker: Character.blademaster, style: AttackStyle.downAir, offsetX: 0.0, height: 170.0 }, hits: 7 },
  { name: "Bladestorm in the air", setup: { attacker: Character.blademaster, style: AttackStyle.downAir, offsetX: 30.0, height: 400.0, victimHeight: 250.0 }, hits: 6 },
  { name: "Falling Knives on a standing target", setup: { attacker: Character.warden, style: AttackStyle.downAir, offsetX: 0.0, height: 130.0 }, hits: 4 },
  { name: "Falling Knives in the air", setup: { attacker: Character.warden, style: AttackStyle.downAir, offsetX: 0.0, height: 400.0, victimHeight: 300.0 }, hits: 4 },
  { name: "glaive drill on a standing target", setup: { attacker: Character.shadowHunter, style: AttackStyle.downAir, offsetX: 30.0, height: 150.0 }, hits: 5 },
  { name: "glaive drill in the air", setup: { attacker: Character.shadowHunter, style: AttackStyle.downAir, offsetX: 30.0, height: 400.0, victimHeight: 300.0 }, hits: 5 },
];

const AERIALS: readonly Case[] = [
  { name: "Blademaster neutral air", setup: { attacker: Character.blademaster, style: AttackStyle.neutralAir, offsetX: 40.0, height: 300.0, victimHeight: 300.0 }, hits: 2 },
  { name: "Dreadlord neutral air", setup: { attacker: Character.dreadlord, style: AttackStyle.neutralAir, offsetX: 40.0, height: 300.0, victimHeight: 300.0 }, hits: 3 },
  { name: "Lich neutral air", setup: { attacker: Character.lich, style: AttackStyle.neutralAir, offsetX: 70.0, height: 300.0, victimHeight: 300.0 }, hits: 4 },
  { name: "Warden up air", setup: { attacker: Character.warden, style: AttackStyle.upAir, offsetX: 0.0, height: 300.0, victimHeight: 380.0 }, hits: 3 },
];

/**
 * Rifleman's up air: both hits link, but its
 * second hit fills the same box as the first, so one hit's smash DI cannot clear it.
 */
const SHARED_UP_AIRS: readonly Case[] = [
  { name: "Rifleman up air", setup: { attacker: Character.rifleman, style: AttackStyle.upAir, offsetX: 0.0, height: 300.0, victimHeight: 400.0 }, hits: 2 },
];

const PERCENTS = [0.0, 50.0, 100.0] as const;

/** Each contact as frame:window:damage, for failure messages. */
function contactsText(trace: Readonly<Trace>): string {
  return trace.contacts.map(contact => `${contact.frame}:${contact.window}:${contact.damage}${contact.shielded ? "S" : ""}`).join(" ")
    + ` attacker acts ${trace.attackerActs}, victim acts ${trace.victimActs}`;
}

/** Frames the attacker can act before the victim; a victim still held when the run ends counts as the whole run. */
function advantage(trace: Readonly<Trace>, frames = 90): number {
  return (trace.victimActs < 0 ? frames : trace.victimActs) - trace.attackerActs;
}

test("every hit of each drill and multi-hit aerial connects in sequence at 0, 50 and 100% [spec #152]", () => {
  for (const c of [...DRILLS, ...AERIALS, ...SHARED_UP_AIRS]) {
    for (const percent of PERCENTS) {
      const trace = playAttack({ ...c.setup, percent });
      const label = `${c.name} at ${percent}%: ${contactsText(trace)}`;
      assertEquals(trace.contacts.length, c.hits, label);
      trace.contacts.forEach((contact, index) => {
        assertEquals(contact.window, index + 1, label);
        assertEquals(!contact.shielded && contact.damage > 0, true, label);
      });
    }
  }
});

test("Bladestorm's landing hit pops the target up and Blademaster acts first [spec #152]", () => {
  for (const percent of PERCENTS) {
    const trace = playAttack({ ...DRILLS[0]!.setup, percent });
    const label = `${percent}%`;
    assertEquals(trace.contacts[trace.contacts.length - 1]?.frame, trace.attackerLands, label);
    assertEquals(trace.victimPeakZ > 40.0, true, label);
    assertEquals(advantage(trace) > 0, true, label);
  }
});

test("Falling Knives has no landing hit and leaves Warden able to act first [spec #152]", () => {
  for (const percent of PERCENTS) {
    const trace = playAttack({ ...DRILLS[2]!.setup, percent });
    const label = `${percent}%: ${contactsText(trace)}`;
    assertEquals(trace.contacts.every(contact => contact.frame < trace.attackerLands), true, label);
    assertEquals(advantage(trace) >= 0, true, label);
  }
});

test("the glaive drill carries its target sideways along Shadow Hunter's facing [spec #152]", () => {
  for (const c of [DRILLS[4]!, DRILLS[5]!]) {
    for (const percent of PERCENTS) {
      const trace = playAttack({ ...c.setup, percent, frames: 90 });
      assertEquals(trace.victim.motion.x > 100.0, true, `${c.name} at ${percent}%`);
    }
  }
});

test("a shielded Bladestorm is punished by a shield grab [spec #152]", () => {
  for (const percent of PERCENTS) {
    const trace = playAttack({ ...DRILLS[0]!.setup, percent, shielding: true, shieldGrab: true });
    assertEquals(trace.contacts.length > 0 && trace.contacts.every(contact => contact.shielded), true, `${percent}%`);
    assertEquals(trace.attacker.grab.owner, 1, `${percent}%`);
  }
});

test("smash DI escapes every drill and new multi-hit aerial before its last hit [spec #152]", () => {
  for (const c of [...DRILLS, ...AERIALS]) {
    for (const percent of PERCENTS) {
      const trace = playAttack({ ...c.setup, percent, victimInput: sdiAway(1) });
      const label = `${c.name} at ${percent}%: ${contactsText(trace)}`;
      assertEquals(trace.contacts.length > 0, true, label);
      assertEquals(trace.contacts.length < c.hits, true, label);
    }
  }
});

test("crouching leaves the attacker better off against each drill than against a single-hit down air [spec #152]", () => {
  const single = advantage(playAttack({ attacker: Character.dreadlord, style: AttackStyle.downAir, offsetX: 0.0, height: 170.0, victimInput: () => crouch() }));
  for (const c of [DRILLS[0]!, DRILLS[2]!, DRILLS[4]!]) {
    for (const percent of PERCENTS) {
      const trace = playAttack({ ...c.setup, percent, victimInput: () => crouch() });
      assertEquals(trace.contacts.length, c.hits, c.name);
      assertEquals(advantage(trace) > single, true, `${c.name} at ${percent}%: ${advantage(trace)} against ${single}`);
    }
  }
});
