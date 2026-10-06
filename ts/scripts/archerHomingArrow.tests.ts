// Archer's homing arrow (side special, #112): it turns toward the nearest
// opponent at a bounded rate, so a standing or late-jumping defender is hit, a
// held shield blocks it, and a jump timed as it closes in leaves it behind.
import { expect, test } from "bun:test";
import { Action } from "../src/game/input/actions";
import { Character, ProjectileKind } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import {
  HOMING_ARROW_LIFETIME, HOMING_ARROW_MAX_PITCH_DEGREES, HOMING_ARROW_SPEED, HOMING_ARROW_TURN_DEGREES, updateProjectiles,
} from "../src/game/sim/projectiles";
import { testWorld } from "../src/game/sim/testWorld";
import { fighter, frame, scene } from "./frameScene";

const FIRE = 10;
const SPACINGS = [240, 480, 720] as const;
const DEFENDERS = [[Character.archer, "Archer"], [Character.rifleman, "Rifleman"], [Character.demonHunter, "Illidan"]] as const;
/** Jump presses sampled from the shooter's press on. */
const JUMP_PRESSES = Array.from({ length: 71 }, (_, index) => FIRE + index);
const LATE_JUMP_FRAMES = 3;

type Defense = "stand" | "shield" | number;
type Outcome = { readonly hit: boolean; readonly shield: boolean; readonly frame: number };

/** Archer fires his side special on FIRE at a defender `spacing` away, which stands, holds shield or full-jumps on the given frame. */
function fired(defender: Character, spacing: number, defense: Defense): Outcome {
  const s = scene(0, [{ character: Character.archer, x: -spacing / 2, facing: 1 }, { character: defender, x: spacing / 2, facing: -1 }]);
  const shooter = fighter(s, 0);
  const target = fighter(s, 1);
  let released = false;
  for (let n = 1; n <= FIRE + 120; n++) {
    const held = defense === "shield" ? [Action.rightTrigger] : typeof defense === "number" && n >= defense && n < defense + 8 ? [Action.jump] : [];
    frame(s, n === FIRE ? [Action.moveRight, Action.special] : [], held);
    const flying = shooter.projectiles.some((projectile) => projectile.life > 0);
    released ||= flying;
    if (target.status.damage > 0) return { hit: true, shield: false, frame: n };
    if (target.visuals.shield + target.visuals.shieldReflect > 0) return { hit: false, shield: true, frame: n };
    if (released && !flying) return { hit: false, shield: false, frame: n };
  }
  return { hit: false, shield: false, frame: FIRE + 120 };
}

test("the homing arrow keeps its speed and turns at most its rate a frame, never past its pitch cap", () => {
  expect(HOMING_ARROW_SPEED).toBeLessThan(36.0);
  expect(HOMING_ARROW_LIFETIME).toBeLessThanOrEqual(90);
  const owner = createFighter(Character.archer, -400.0, 1);
  const target = createFighter(Character.rifleman, 200.0, -1);
  target.motion.grounded = false;
  target.motion.z = 600.0;
  const arrow = owner.projectiles[0]!;
  Object.assign(arrow, { life: HOMING_ARROW_LIFETIME, kind: ProjectileKind.homingArrow, direction: 1, x: -365.0, z: 75.0, velocityX: HOMING_ARROW_SPEED, velocityZ: 0.0 });
  const world = testWorld(owner, target);
  let heading = 0.0;
  let turned = 0;
  for (let n = 0; n < 30 && arrow.life > 0; n++) {
    updateProjectiles(world);
    const next = (Math.atan2(arrow.velocityZ, arrow.velocityX) * 180) / Math.PI;
    expect(Math.abs(next - heading)).toBeLessThanOrEqual(HOMING_ARROW_TURN_DEGREES + 1e-3);
    expect(Math.abs(next)).toBeLessThanOrEqual(HOMING_ARROW_MAX_PITCH_DEGREES + 1e-3);
    expect(Math.hypot(arrow.velocityX, arrow.velocityZ)).toBeCloseTo(HOMING_ARROW_SPEED, 3);
    if (next !== heading) turned++;
    heading = next;
  }
  expect(turned).toBeGreaterThan(10);
  expect(heading).toBeGreaterThan(HOMING_ARROW_MAX_PITCH_DEGREES - HOMING_ARROW_TURN_DEGREES);
});

test("the homing arrow flies straight once its target is behind it", () => {
  const owner = createFighter(Character.archer, -400.0, 1);
  const target = createFighter(Character.rifleman, -300.0, -1);
  const arrow = owner.projectiles[0]!;
  Object.assign(arrow, { life: 20, kind: ProjectileKind.homingArrow, direction: 1, x: 0.0, z: 75.0, velocityX: HOMING_ARROW_SPEED, velocityZ: 0.0 });
  updateProjectiles(testWorld(owner, target));
  expect(arrow.velocityX).toBe(HOMING_ARROW_SPEED);
  expect(arrow.velocityZ).toBe(0.0);
});

for (const [character, name] of DEFENDERS) {
  test(`the homing arrow hits a standing ${name}, a shield blocks it and a timed jump avoids it`, () => {
    const report: string[] = [];
    for (const spacing of SPACINGS) {
      const standing = fired(character, spacing, "stand");
      expect(standing.hit).toBe(true);
      expect(fired(character, spacing, "shield").shield).toBe(true);
      const dodges = JUMP_PRESSES.filter((press) => !fired(character, spacing, press).hit);
      expect(dodges.length).toBeGreaterThan(0);
      for (let late = 1; late <= LATE_JUMP_FRAMES; late++) expect(fired(character, spacing, standing.frame - late).hit).toBe(true);
      report.push(`${spacing}: ${dodges.length}/${JUMP_PRESSES.length} jump presses dodge, ${dodges[0]! - FIRE}-${dodges.at(-1)! - FIRE} after the press`);
    }
    console.log(`${name}: ${report.join("; ")}`);
  }, 60000);
}
