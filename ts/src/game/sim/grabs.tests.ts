import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { HERO_ROSTER } from "./heroes/registry";
import { AttackStyle, Character, GrabAction } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { resolveGrabs } from "./grabs";
import { GRAB_HOLD_FRAMES, GRAB_HOLD_MINIMUM_FRAMES, PUMMEL_CONTACT_FRAME, PUMMEL_DAMAGE, PUMMEL_TOTAL_FRAMES, attackStartupFrames } from "./moves";
import type { Controls, Roster } from "./roster";
import { controls, testBeginAttacks, testGrabFrame, testWorld } from "./testWorld";

test("simultaneous grabs give neither slot ownership [spec docs/physics.md]", () => {
  const first = createFighter(Character.rifleman, 0.0, 1);
  const second = createFighter(Character.rifleman, 90.0, -1);
  const world = testWorld(first, second);
  testBeginAttacks(world, AttackStyle.grab, AttackStyle.grab);
  first.attack.frame = attackStartupFrames(AttackStyle.grab);
  second.attack.frame = attackStartupFrames(AttackStyle.grab);
  resolveAttacks(world);
  assertEquals(first.grab.target, undefined);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
  assertEquals(second.grab.grabbedFrames, 0);
  first.launch.hitlag = 1;
  second.attack.frame++;
  resolveAttacks(world);
  assertEquals(second.grab.target, undefined);
  assertEquals(first.grab.grabbedFrames, 0);
});

const GRABBERS = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];

type Mash = "none" | "slow" | "human" | "quick" | "fastest";

function mashInput(mash: Mash, frame: number): Controls {
  if (mash === "none") return controls();
  if (mash === "human" || mash === "quick" || mash === "slow") {
    const rate = mash === "human" ? 8 : mash === "quick" ? 10 : 6;
    return controls({ grabMashPressed: floorDiv(frame * rate, 60) !== floorDiv((frame - 1) * rate, 60) || frame === 1 });
  }
  return controls({ grabMashPressed: floorMod(frame, 2) === 1, direction: floorMod(frame, 2) === 1 ? 1 : -1 });
}

function heldBy(character: Character, percent: number): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = createFighter(character, 0.0, 1);
  const target = createFighter(Character.rifleman, 50.0, -1);
  target.status.damage = percent;
  const world = testWorld(owner, target);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  beginFighterAttack(world, 0, AttackStyle.grab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
  resolveAttacks(world);
  resolveGrabs(world);
  assertEquals(owner.grab.target, 1, `${character} catches`);
  assertEquals(target.grab.grabbedFrames, GRAB_HOLD_FRAMES);
  return { world, owner, target };
}

/** The held frame each mash frees the victim on from a 120-frame hold. */
const MASH_ESCAPE = { none: GRAB_HOLD_FRAMES, slow: 64, human: 56, quick: 48, fastest: GRAB_HOLD_MINIMUM_FRAMES };

/** Runs held frames until the victim is free; the frame it went free on, or undefined. */
function holdUntilFree(world: Roster, target: Fighter, mash: Mash, owner: (frame: number) => Controls, frames = GRAB_HOLD_FRAMES + 30): number | undefined {
  for (let frame = 1; frame <= frames; frame++) {
    testGrabFrame(world, [owner(frame), mashInput(mash, frame)], false);
    if (target.grab.owner === undefined) return frame;
  }
  return undefined;
}

test("every grab holds the same time at any percent, and mashing shortens it within its bounds [spec docs/gameplay-design.md]", () => {
  for (const character of GRABBERS) {
    for (const percent of [0.0, 150.0]) {
      for (const mash of ["none", "slow", "human", "quick", "fastest"] as const) {
        const { world, owner, target } = heldBy(character, percent);
        const frame = holdUntilFree(world, target, mash, () => controls());
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertEquals(frame, MASH_ESCAPE[mash], label);
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.status.damage, percent, label);
      }
    }
  }
});

test("a victim mashing 8 or more times a second escapes the pummel; 6 a second or caught off guard takes it [spec docs/gameplay-design.md]", () => {
  assertTrue(MASH_ESCAPE.human < PUMMEL_CONTACT_FRAME);
  assertTrue(MASH_ESCAPE.slow > PUMMEL_CONTACT_FRAME);
  for (const character of GRABBERS) {
    for (const percent of [0.0, 150.0]) {
      for (const mash of ["none", "slow", "human", "quick", "fastest"] as const) {
        const { world, owner, target } = heldBy(character, percent);
        const pummel = owner.tuning.moves?.throws[GrabAction.pummel]?.effect.damage ?? PUMMEL_DAMAGE;
        // The grabber pummels on the first held frame and keeps pressing attack.
        const frame = holdUntilFree(world, target, mash, () => controls({ attackPressed: true }));
        const label = `${character} at ${percent}% with ${mash} mashing`;
        assertEquals(owner.grab.pummels, 1, label);
        if (mash === "none" || mash === "slow") {
          const damage = character === Character.forsakenPaladin ? f32(pummel * f32(0.8)) : pummel;
          assertEquals(target.status.damage, f32(percent + damage), label);
          // No throw input: the pummel's end lets the victim go.
          assertEquals(frame, mash === "none" ? PUMMEL_TOTAL_FRAMES + 1 : MASH_ESCAPE.slow, label);
        } else {
          assertEquals(target.status.damage, percent, label);
          assertEquals(frame !== undefined && frame < PUMMEL_CONTACT_FRAME, true, label);
        }
        assertEquals(owner.grab.action, GrabAction.escape, label);
        assertEquals(target.launch.throwHitstun, false, label);
      }
    }
  }
});

