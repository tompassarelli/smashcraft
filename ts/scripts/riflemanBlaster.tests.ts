// Rifleman's blaster (neutral special, #117): a grounded shot and a
// short-hop shot played through the interaction graph's match executor
// against a mirror Rifleman, standing or shielding 60, 240 and 480 apart.
// Frames count from the press that starts the sequence (frame 1): the
// special press for a grounded shot, the jump press for a short hop, whose
// special press comes on its first airborne frame (6) and which fast-falls
// once the shot is out.
import { expect, test } from "bun:test";
import { Action } from "../src/game/input/actions";
import { Character } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME } from "../src/game/sim/moves";
import { type Held, type Situation, Timeline } from "./interactions";

const START = 10;
const LAST = 220;
const NONE = [[], []] as const;
const SHORT_HOP_PRESS = 6;

interface Shot {
  readonly shot: number | undefined;
  readonly shots: number;
  readonly landing: number | undefined;
  readonly contact: number | undefined;
  readonly damage: number;
  readonly hitstun: number;
  readonly shieldMet: boolean;
  readonly shooterActs: number;
  readonly defenderActs: number | undefined;
}

/** One sequence; `press` is the special press of a short hop, undefined for a grounded shot; `again` re-presses it every frame after. */
function play(distance: number, defender: "idle" | "shield", press: number | undefined, again = false): Shot {
  const shooter = (n: number, self: Fighter): Held => {
    const frame = n - START + 1;
    if (press === undefined) return frame === 1 ? [Action.special] : [];
    if (frame === 1) return [Action.jump];
    if (frame === press || (again && frame > press && frame % 2 === 0 && !self.motion.grounded)) return [Action.special];
    const fired = self.special.frame >= RIFLEMAN_BLASTER_AIR_SHOT_FRAME || frame > press + RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    return fired && !self.motion.grounded && self.motion.vz < 0 ? [Action.moveDown] : [];
  };
  const sit: Situation = {
    placements: [{ character: Character.rifleman, x: -distance / 2, facing: 1 }, { character: Character.rifleman, x: distance / 2, facing: -1 }],
    policies: [shooter, defender === "shield" ? () => [Action.rightTrigger] : () => []],
  };
  const line = new Timeline(sit, LAST);
  let shot: number | undefined;
  let shots = 0;
  let airborne = false;
  let landing: number | undefined;
  let contact: number | undefined;
  let damage = 0;
  let hitstun = 0;
  let shieldMet = false;
  const serials = new Set<number>();
  line.play(NONE, LAST, (n, a, b) => {
    for (const projectile of a.projectiles) {
      if (projectile.life <= 0 || serials.has(projectile.serial)) continue;
      serials.add(projectile.serial);
      shots++;
    }
    if (shot === undefined && (shots > 0 || (contact === undefined && b.status.damage + b.visuals.shield > 0))) shot = n;
    if (!a.motion.grounded) airborne = true;
    if (airborne && landing === undefined && a.motion.grounded) landing = n;
    if (contact === undefined && (b.status.damage > 0 || b.visuals.shield + b.visuals.shieldReflect > 0)) {
      contact = n;
      damage = b.status.damage;
      hitstun = b.launch.hitstun;
      shieldMet = b.status.damage === 0;
    }
    return false;
  }, true);
  const relative = (frame: number | undefined): number | undefined => (frame === undefined ? undefined : frame - START + 1);
  const shooterActs = line.actionable(NONE, 0, START + (press ?? 0) + 1, LAST);
  const defenderActs = contact === undefined ? undefined : line.actionable(NONE, 1, contact + 1, LAST);
  line.release();
  if (shooterActs === undefined) throw new Error("the shooter never acts");
  return {
    shot: relative(shot), shots, landing: relative(landing), contact: relative(contact), damage, hitstun, shieldMet,
    shooterActs: relative(shooterActs) ?? 0, defenderActs: relative(defenderActs),
  };
}

const advantage = (shot: Shot): number | undefined => (shot.defenderActs === undefined ? undefined : shot.defenderActs - shot.shooterActs);

test("a grounded blaster shot leaves on frame 9, deals 3.72 with 11 frames of hitstun and acts on frame 39", () => {
  const shot = play(240, "idle", undefined);
  expect([shot.shot, shot.damage, shot.hitstun, shot.shooterActs]).toEqual([9, 3.7200002670288086, 11, 39]);
});

test("a short-hop blaster shot leaves on frame 19, deals 2.79 with 8 frames of hitstun and lands into 8 frames", () => {
  const shot = play(240, "idle", SHORT_HOP_PRESS);
  expect([shot.shot, shot.damage, shot.hitstun, shot.landing, shot.shooterActs]).toEqual([19, 2.7900002002716064, 8, 23, 31]);
});

test("the blaster's advantage on hit and on a shield, grounded and from a short hop", () => {
  const table = [60, 240, 480].map((distance) => ({
    distance,
    ground: [advantage(play(distance, "idle", undefined)), advantage(play(distance, "shield", undefined))],
    air: [advantage(play(distance, "idle", SHORT_HOP_PRESS)), advantage(play(distance, "shield", SHORT_HOP_PRESS))],
  }));
  expect(table).toEqual([
    { distance: 60, ground: [-16, -23], air: [-2, -7] },
    { distance: 240, ground: [-11, -19], air: [3, -2] },
    { distance: 480, ground: [-5, -12], air: [9, 4] },
  ]);
});

test("a short-hop shot meets a held shield rather than passing over it", () => {
  for (const distance of [60, 240, 480]) expect(play(distance, "shield", SHORT_HOP_PRESS).shieldMet).toBe(true);
});

test("one shot per short hop, and landing before the shot leaves cancels it", () => {
  expect(play(480, "idle", SHORT_HOP_PRESS, true).shots).toBe(1);
  const late = play(480, "idle", 18);
  expect(late.shots).toBe(0);
  expect(late.shooterActs - (late.landing ?? 0)).toBe(8);
});
