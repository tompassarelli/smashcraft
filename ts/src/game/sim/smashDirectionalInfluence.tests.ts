// Bounded smash DI (smashcraft:docs/gameplay-design.md#bounded-sdi): travel per
// hit and per string, the per-tick step, renewal and discard rules, and the
// production-harness fixtures that measured the unbounded teleports (#70).
import { assertEquals, assertFalse, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { clearPulse, neutralDirections, pulsePending, updateDirections } from "../input/directionalInput";
import { firstFighterDifference } from "../replay/difference";
import { copyFighterState } from "../replay/fighterState";
import { Character, ContactKind } from "./codes";
import { collectDamageContact } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { DIAGONAL_UNIT } from "./knockback";
import {
  ASDI_DISTANCE, HIT_TRAVEL, SDI_HIT_TRAVEL, SDI_STEP_DISTANCE, STRING_TRAVEL, beginSmashDirectionalInfluenceHit,
} from "./smashDirectionalInfluence";
import { respawnFighter } from "./stocks";
import { advanceFighter } from "./step";
import { advanceSolo, contactBatch, controls, hitEffect, soloWorld, testWorld, withPhysics } from "./testWorld";
import { melee } from "./tuning";

type Mode = "reset-right" | "alternate" | "held" | "wiggle";

export interface SdiFixture {
  readonly name: string;
  readonly hitlag: number;
  readonly hits: number;
  readonly mode: Mode;
}

export interface SdiStep { readonly hit: number; readonly tick: number; readonly dx: number; readonly dz: number; readonly hitlag: number }

export interface SdiMeasurement extends SdiFixture {
  readonly pathWorld: number;
  readonly maxStepWorld: number;
  readonly netWorld: number;
  readonly sdi: number;
  readonly asdi: number;
  readonly out: boolean;
  readonly steps: readonly SdiStep[];
}

/** The ten fixtures of smashcraft:evidence/sdi-design-20261006.json. */
export const SDI_FIXTURES: readonly SdiFixture[] = [
  { name: "one-frame", hitlag: 1, hits: 1, mode: "reset-right" },
  { name: "two-frame", hitlag: 2, hits: 1, mode: "reset-right" },
  { name: "light", hitlag: 4, hits: 1, mode: "reset-right" },
  { name: "electric-strong", hitlag: 10, hits: 1, mode: "reset-right" },
  { name: "cap", hitlag: 20, hits: 1, mode: "reset-right" },
  { name: "cap-alternate", hitlag: 20, hits: 1, mode: "alternate" },
  { name: "cap-held", hitlag: 20, hits: 1, mode: "held" },
  { name: "light-three-hit-string", hitlag: 4, hits: 3, mode: "reset-right" },
  { name: "cap-three-hit-string", hitlag: 20, hits: 3, mode: "alternate" },
  { name: "cap-wiggle", hitlag: 20, hits: 1, mode: "wiggle" },
];

/** An airborne victim with no gravity, drift or launch, so only SDI and ASDI move it. */
function isolatedVictim(): Fighter {
  const f = createFighter(Character.rifleman, 0.0, 1);
  withPhysics(f, { gravity: 0.0, airAcceleration: 0.0, airFriction: 0.0 });
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = 400.0;
  return f;
}

/** Seeds a hit as contacts install one: hitlag, a DI opportunity, hitstun and a fresh hit allowance. */
function seedHit(f: Fighter, hitlag: number): void {
  f.launch.hitlag = hitlag;
  f.launch.diPending = true;
  f.launch.diLaunchSpeed = 0.0;
  f.launch.hitstun = 60;
  beginSmashDirectionalInfluenceHit(f.launch);
}

function stick(mode: Mode, tick: number): readonly [number, number] {
  switch (mode) {
    case "reset-right":
    case "held": return [1, 0];
    case "alternate": return [floorMod(tick, 2) === 0 ? 1 : -1, 0];
    case "wiggle": return [1, floorMod(tick, 2) === 0 ? 0 : 1];
  }
}

/** Runs one fixture through production advanceSolo and keyboard-style directional input. */
export function measureSdiFixture(fixture: SdiFixture): SdiMeasurement {
  const f = isolatedVictim();
  const direction = neutralDirections();
  const input = controls();
  const steps: SdiStep[] = [];
  const startX = f.motion.x;
  const startZ = f.motion.z;
  let pathWorld = 0.0;
  let maxStepWorld = 0.0;
  for (let hit = 0; hit < fixture.hits; hit++) {
    seedHit(f, fixture.hitlag);
    for (let tick = 0; tick < fixture.hitlag; tick++) {
      const [x, z] = stick(fixture.mode, tick);
      if (fixture.mode === "reset-right") updateDirections(direction, 0, 0);
      updateDirections(direction, x, z);
      input.direction = direction.heldX;
      input.verticalDirection = direction.heldZ;
      input.sdiPulse = pulsePending(direction);
      input.sdiX = direction.pulseX;
      input.sdiZ = direction.pulseZ;
      const oldX = f.motion.x;
      const oldZ = f.motion.z;
      advanceSolo(f, 0, input, -240.0);
      clearPulse(direction);
      const dx = f.motion.x - oldX;
      const dz = f.motion.z - oldZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      pathWorld += length;
      maxStepWorld = Math.max(maxStepWorld, length);
      steps.push({ hit, tick, dx, dz, hitlag: f.launch.hitlag });
    }
  }
  const netX = f.motion.x - startX;
  const netZ = f.motion.z - startZ;
  return {
    ...fixture, pathWorld, maxStepWorld, netWorld: Math.sqrt(netX * netX + netZ * netZ),
    sdi: f.launch.sdiSerial, asdi: f.launch.asdiSerial, out: f.status.out, steps,
  };
}

const TOLERANCE = 0.0010000000474974513;
const STEP = SDI_STEP_DISTANCE;
const WIGGLE_NET_X = f32(f32(STEP + STEP) + f32(f32(DIAGONAL_UNIT * STEP) * 2.0));
const WIGGLE_NET_Z = f32(f32(DIAGONAL_UNIT * STEP) * 2.0);

/** [path, net, SDI steps, ASDI shifts] at the bounded defaults, in world units. */
const EXPECTED: Readonly<Record<string, readonly [number, number, number, number]>> = {
  "one-frame": [18, 18, 0, 1],
  "two-frame": [36, 36, 1, 1],
  "light": [72, 72, 3, 1],
  "electric-strong": [72, 72, 3, 1],
  "cap": [72, 72, 3, 1],
  "cap-alternate": [72, 0, 3, 1],
  "cap-held": [54, 54, 2, 1],
  "light-three-hit-string": [144, 144, 6, 2],
  "cap-three-hit-string": [144, 0, 6, 2],
  "cap-wiggle": [72, Math.sqrt(WIGGLE_NET_X * WIGGLE_NET_X + WIGGLE_NET_Z * WIGGLE_NET_Z), 3, 1],
};

test("the ten teleport fixtures now stay within 72 world units per hit, 144 per string and 18 per tick [spec #70]", () => {
  for (const fixture of SDI_FIXTURES) {
    const measured = measureSdiFixture(fixture);
    const [path, net, sdi, asdi] = EXPECTED[fixture.name] ?? [-1, -1, -1, -1];
    assertEquals(Math.abs(measured.pathWorld - path) < TOLERANCE, true, `${fixture.name} path ${measured.pathWorld}`);
    assertEquals(Math.abs(measured.netWorld - net) < TOLERANCE, true, `${fixture.name} net ${measured.netWorld}`);
    assertEquals(measured.sdi, sdi, `${fixture.name} SDI steps`);
    assertEquals(measured.asdi, asdi, `${fixture.name} ASDI shifts`);
    assertEquals(measured.maxStepWorld <= STEP + TOLERANCE, true, `${fixture.name} step`);
    assertEquals(measured.pathWorld <= melee(STRING_TRAVEL) + TOLERANCE, true, `${fixture.name} string`);
    for (let hit = 0; hit < fixture.hits; hit++) {
      const hitPath = measured.steps.filter((step) => step.hit === hit).reduce((sum, step) => sum + Math.sqrt(step.dx * step.dx + step.dz * step.dz), 0.0);
      assertEquals(hitPath <= melee(HIT_TRAVEL) + TOLERANCE, true, `${fixture.name} hit ${hit}`);
    }
    assertFalse(measured.out);
  }
});

test("a fresh pulse spends its 6 units as two 3-unit steps, and the hit admits at most 9 units of SDI [spec #70]", () => {
  const f = isolatedVictim();
  seedHit(f, 8);
  const pulse = (sdiX: number, sdiZ: number) => advanceSolo(f, 0, controls({ sdiPulse: sdiX !== 0 || sdiZ !== 0, sdiX, sdiZ }), -240.0);
  pulse(1, 0);
  assertEquals(f.motion.x, STEP);
  assertEquals(f.launch.sdiStepTravel, 3);
  pulse(0, 0);
  assertEquals(f.motion.x, f32(STEP + STEP));
  assertEquals(f.launch.sdiStepTravel, 0);
  // Only 3 of the hit's 9 SDI units remain for this diagonal pulse.
  pulse(1, 1);
  assertNear(f.motion.x, f32(STEP + STEP) + STEP * DIAGONAL_UNIT, TOLERANCE);
  assertNear(f.motion.z, 400.0 + STEP * DIAGONAL_UNIT, TOLERANCE);
  assertEquals(f.launch.sdiHitTravel, SDI_HIT_TRAVEL);
  const x = f.motion.x;
  pulse(-1, 0);
  pulse(-1, -1);
  assertEquals(f.motion.x, x);
  assertEquals(f.launch.sdiSerial, 3);
});

test("queued requests count against the hit, and release discards the unfinished request for ASDI [spec #70]", () => {
  const f = isolatedVictim();
  seedHit(f, 3);
  // Right then left on consecutive ticks: 6 right and 3 left are queued, 3 right spent.
  advanceSolo(f, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  advanceSolo(f, 0, controls({ direction: -1, sdiPulse: true, sdiX: -1 }), -240.0);
  assertEquals(f.motion.x, f32(STEP + STEP));
  assertEquals(f.launch.sdiStepTravel, 3);
  assertEquals(f.launch.sdiStepX, -1);
  // The release tick shifts only by ASDI; the queued 3 units left are dropped.
  advanceSolo(f, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  assertEquals(f.motion.x, f32(f32(STEP + STEP) + ASDI_DISTANCE));
  assertEquals(f.launch.sdiStepTravel, 0);
  assertEquals(f.launch.sdiHitTravel, 9);
  advanceSolo(f, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  assertEquals(f.motion.x, f32(f32(STEP + STEP) + ASDI_DISTANCE));
});

test("a replacement hit renews the hit allowance and drops queued travel, but not the string [spec #70]", () => {
  const attacker = createFighter(Character.rifleman, -60.0, 1);
  const victim = isolatedVictim();
  victim.motion.x = 0.0;
  victim.motion.z = 0.0;
  victim.motion.grounded = true;
  victim.motion.surface = 0;
  const world = testWorld(attacker, victim);
  const hit = () => contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(4.0, 0.0, 0.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false));
  hit();
  assertTrue(victim.launch.hitlag > 2);
  advanceFighter(world, 1, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  assertEquals(victim.launch.sdiStepTravel, 3);
  assertEquals(victim.launch.sdiStringTravel, 3);
  hit();
  assertEquals(victim.launch.sdiStepTravel, 0);
  assertEquals(victim.launch.sdiHitTravel, 0);
  assertEquals(victim.launch.sdiStringTravel, 3);
});

/** Spends a 4-frame hit's full 12 units to the right. */
function spendHit(f: Fighter): void {
  seedHit(f, 4);
  for (let tick = 0; tick < 4; tick++) advanceSolo(f, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
}

test("a held gap between hits keeps the string, so a third hit moves nothing [spec #70]", () => {
  const f = isolatedVictim();
  spendHit(f);
  for (let tick = 0; tick < 10; tick++) advanceSolo(f, 0, controls(), -240.0);
  assertTrue(f.launch.hitstun > 0);
  spendHit(f);
  assertEquals(f.launch.sdiStringTravel, STRING_TRAVEL);
  const x = f.motion.x;
  spendHit(f);
  assertEquals(f.motion.x, x);
});

test("one complete actionable tick renews the string; the tick that ends hitstun does not [spec #70]", () => {
  const f = isolatedVictim();
  spendHit(f);
  spendHit(f);
  f.launch.hitstun = 1;
  // This tick ends hitstun; a hit landing at its end is still the same string.
  advanceSolo(f, 0, controls(), -240.0);
  assertEquals(f.launch.hitstun, 0);
  assertEquals(f.launch.sdiStringTravel, STRING_TRAVEL);
  const held = isolatedVictim();
  copyFighterState(held, f, 1);
  const heldX = held.motion.x;
  spendHit(held);
  assertEquals(held.motion.x, heldX);
  // After the actionable tick completes, the next hit starts a new string.
  advanceSolo(f, 0, controls(), -240.0);
  const x = f.motion.x;
  spendHit(f);
  assertEquals(f.motion.x, f32(x + melee(HIT_TRAVEL)));
  assertEquals(f.launch.sdiStringTravel, HIT_TRAVEL);
});

test("respawn clears the string and any queued travel [spec #70]", () => {
  const f = isolatedVictim();
  spendHit(f);
  seedHit(f, 8);
  advanceSolo(f, 0, controls({ sdiPulse: true, sdiX: 1 }), -240.0);
  respawnFighter(soloWorld(f), 0, -240.0);
  assertEquals(f.launch.sdiStringTravel, 0);
  assertEquals(f.launch.sdiHitTravel, 0);
  assertEquals(f.launch.sdiStepTravel, 0);
});

test("an exhausted string withholds ASDI, and a blocked step still charges its length [spec #70]", () => {
  const f = isolatedVictim();
  spendHit(f);
  spendHit(f);
  seedHit(f, 1);
  const x = f.motion.x;
  advanceSolo(f, 0, controls({ direction: 1 }), -240.0);
  assertEquals(f.motion.x, x);
  const floored = isolatedVictim();
  floored.motion.z = 10.0;
  seedHit(floored, 3);
  // Smash DI down can't land; the clipped step is charged anyway.
  advanceSolo(floored, 0, controls({ verticalDirection: -1, sdiPulse: true, sdiZ: -1 }), -240.0);
  assertEquals(floored.motion.z, 10.0);
  assertEquals(floored.launch.sdiHitTravel, 3);
});

test("a restored snapshot continues queued SDI identically [invariant]", () => {
  const original = isolatedVictim();
  seedHit(original, 6);
  advanceSolo(original, 0, controls({ direction: 1, sdiPulse: true, sdiX: 1 }), -240.0);
  advanceSolo(original, 0, controls({ direction: -1, sdiPulse: true, sdiX: -1 }), -240.0);
  const restored = isolatedVictim();
  copyFighterState(restored, original, 1);
  for (const f of [original, restored]) {
    for (let tick = 0; tick < 4; tick++) advanceSolo(f, 0, controls({ direction: 1, verticalDirection: 1, sdiPulse: tick === 0, sdiX: 1, sdiZ: 1 }), -240.0);
  }
  assertEquals(firstFighterDifference(original, restored, 1, 1), undefined);
  assertEquals(restored.launch.sdiHitTravel, HIT_TRAVEL);
});
