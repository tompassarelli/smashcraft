// Wall techs off the main deck's side through a controller's real input path
// (helperPads.ts): an Archer's forward air launches each fighter from below
// the right ledge into the side, at medium and high percent.
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SurfaceContact } from "../sim/codes";
import { WALL_TECH_STARTUP_FRAMES, canAttack, isTumbling } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { surfaceRight } from "../sim/stage";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

interface Run extends PadMatch {
  readonly victim: Fighter;
}

/** Both airborne beside the right side, below the ledge's catch boxes; the victim faces the Archer outside it. */
function startRun(victimCharacter: Character, percent: number): Run {
  const match = testMatch(3, Character.archer);
  const attacker = createFighter(Character.archer, 560.0, -1);
  const victim = createFighter(victimCharacter, 530.0, 1);
  victim.status.damage = percent;
  for (const fighter of [attacker, victim]) {
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.z = -150.0;
  }
  match.world.fighters[0] = attacker;
  match.world.fighters[1] = victim;
  return { ...padMatch(match, "wall-tech"), victim };
}

/** The C-stick toward the stage: a forward air from an Archer facing it. */
const STRIKE: Pad = { cx: -1.0 };

interface Launch {
  /** The first frame after the hit's hitlag, and the frame the victim met the side. */
  readonly free: number;
  readonly contact: number;
}

/** Plays the strike and the victim's pads until the victim meets a solid surface. */
function launch(run: Run, victimPadAt: (frame: number) => Pad): Launch {
  let free: number | undefined;
  for (let frame = 1; frame <= 40; frame++) {
    playPads(run, frame === 1 ? STRIKE : {}, victimPadAt(frame));
    const { victim } = run;
    if (free === undefined && isTumbling(victim) && victim.launch.hitlag === 0) free = frame;
    if (victim.surfaceRecovery.contactSerial > 0) return { free: assertDefined(free, "launch"), contact: frame };
  }
  throw new Error("the victim never met the side");
}

const VICTIMS = [Character.archer, Character.rifleman, Character.demonHunter] as const;
const NEUTRAL = (): Pad => ({});

function assertMetSide(victim: Fighter): void {
  const { contactX, contactNormalX } = victim.surfaceRecovery;
  assertGreaterThan(contactNormalX, 0.0);
  assertLessThan(contactX, surfaceRight(0, 0));
}

test("a launch into the main deck's side bounces off it without a press", () => {
  for (const character of VICTIMS) {
    for (const percent of [60.0, 120.0]) {
      const run = startRun(character, percent);
      launch(run, NEUTRAL);
      const { victim } = run;
      assertMetSide(victim);
      assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.wall);
      assertTrue(isTumbling(victim));
      assertGreaterThan(victim.launch.knockbackX, 0.0);
    }
  }
});

test("a trigger pressed after the hit's hitlag wall techs off the main deck's side", () => {
  for (const character of VICTIMS) {
    for (const percent of [60.0, 120.0]) {
      const missed = launch(startRun(character, percent), NEUTRAL);
      // Inside the 20-frame window (common +0x250; ftCo_PassiveWall.c ftCo_800C1D38 uses the floor's gate).
      assertLessThan(missed.contact - missed.free, 20);
      const run = startRun(character, percent);
      const teched = launch(run, (frame) => ({ trigger: frame === missed.free }));
      assertEquals(teched.contact, missed.contact);
      const { victim } = run;
      assertMetSide(victim);
      assertEquals(victim.surfaceRecovery.contactKind, SurfaceContact.techWall);
      assertEquals(victim.surfaceRecovery.state, SurfaceContact.techWall);
      assertEquals(victim.launch.hitstun, 0);
      assertFalse(isTumbling(victim));
      // Five frames on the wall with movement and gravity suspended, protected for 14 (common +0x760, +0x764).
      const { x, z } = victim.motion;
      for (let frame = 1; frame < WALL_TECH_STARTUP_FRAMES; frame++) {
        playPads(run, {}, {});
        assertEquals(victim.motion.x, x);
        assertEquals(victim.motion.z, z);
        assertGreaterThan(victim.status.invincible, 0);
      }
      for (let frame = 1; frame <= 40 && victim.surfaceRecovery.state === SurfaceContact.techWall; frame++) playPads(run, {}, {});
      assertEquals(victim.surfaceRecovery.state, SurfaceContact.none);
      assertLessThan(victim.motion.z, z);
      assertTrue(canAttack(victim));
      assertFalse(victim.status.out);
    }
  }
});
