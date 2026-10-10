import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character, PlatformMove } from "./codes";
import { canAttack } from "./conditions";
import { type Fighter, PLATFORM_INTENT_FRAMES, createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import { type Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { CROUCH_STICK_THRESHOLD, STICK_DEADZONE } from "./stickZones";
import { bodyTop } from "./surfaces";
import { advanceSolo, controls, soloWorld } from "./testWorld";
import { melee } from "./tuning";

const STAGE = 1;
const DECK = 1;
const DECK_Z = surfaceZ(STAGE, DECK, 0);
const CENTRE = f32(f32(surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
const FIGHTERS: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];
const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];

const step = (f: Fighter, input: Readonly<Controls>, stage = STAGE) => advanceSolo(f, stage, input, 0.0);
const height = (f: Fighter) => melee(bodyTop(f.character));
const attack = (f: Fighter, style: AttackStyle) => beginFighterAttack(soloWorld(f), 0, style, false);

const NONE = controls();
const analog = (z: number, x = 0.0) => controls({ diStickValid: true, diStickX: x, diStickZ: z, down: z < -CROUCH_STICK_THRESHOLD });
const KEY_DOWN = controls({ down: true, verticalDirection: -1 });
const KEY_TILT_DOWN = controls({ down: true, verticalDirection: -1, walking: true });
const STAND_DOWN = [-STICK_DEADZONE, f32(-0.5), -CROUCH_STICK_THRESHOLD, f32(-0.7), -1.0];

function risingUnder(character: Character, x = CENTRE): Fighter {
  const f = createFighter(character, x, 1);
  f.motion.grounded = false;
  f.motion.z = f32(f32(DECK_Z - height(f)) - 0.5);
  f.motion.vz = 12.0;
  f.jump.remaining = 1;
  return f;
}

function fallingOnto(character: Character, frames: number, x = CENTRE): Fighter {
  const f = createFighter(character, x, 1);
  f.motion.grounded = false;
  f.motion.z = f32(DECK_Z + f32(f.tuning.physics.fastFallSpeed * frames));
  f.motion.vz = -f.tuning.physics.fastFallSpeed;
  f.motion.fastFalling = true;
  f.jump.remaining = 1;
  return f;
}

function finishMove(f: Fighter, input: Readonly<Controls>, stage = STAGE): number {
  let frames = 1;
  for (; frames <= 30 && f.platform.move !== PlatformMove.none; frames++) step(f, input, stage);
  return frames - 1;
}

function untilContact(f: Fighter, input: Readonly<Controls>): void {
  for (let frame = 1; frame <= 30 && !f.motion.grounded && f.platform.move === PlatformMove.none; frame++) step(f, input);
}

function assertStoodOn(f: Fighter): void {
  assertEquals(f.platform.move, PlatformMove.none);
  assertTrue(f.motion.grounded);
  assertEquals(f.motion.surface, DECK);
  assertEquals(f.motion.x, CENTRE);
  assertEquals(f.facing, 1);
  assertEquals(f.landing.lag, 0);
}

test("a full hop under a platform climbs it for the jump squat, carrying its rise, then lands on it [k3 measure #103]", () => {
  for (const character of FIGHTERS) {
    const f = createFighter(character, CENTRE, 1);
    const input = controls({ jumpPressed: true, jumpHeld: true });
    for (let frame = 1; frame <= 60 && f.platform.move === PlatformMove.none; frame++) {
      step(f, input);
      input.jumpPressed = false;
    }
    assertEquals(f.platform.move, PlatformMove.ascent);
    assertEquals(f.platform.duration, f.tuning.physics.jumpSquatFrames);
    const rise = f.platform.rise;
    assertGreaterThan(rise, 0.0);
    assertEquals(finishMove(f, input), f.tuning.physics.jumpSquatFrames);
    assertFalse(f.motion.grounded);
    assertEquals(f.motion.z, DECK_Z);
    assertEquals(f.motion.vz, rise);
    for (let frame = 1; frame <= 150 && !f.motion.grounded; frame++) step(f, input);
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, DECK);
  }
});

test("rising, down anywhere past the deadzone stands on the platform, analog or keyboard; short of the deadzone climbs [k3 measure #392]", () => {
  for (const character of FIGHTERS) {
    for (const input of [...STAND_DOWN.map((z) => analog(z)), KEY_TILT_DOWN, KEY_DOWN]) {
      const f = risingUnder(character);
      step(f, input);
      finishMove(f, input);
      assertStoodOn(f);
    }
    const tilt = risingUnder(character);
    step(tilt, KEY_TILT_DOWN);
    finishMove(tilt, KEY_TILT_DOWN);
    for (let frame = 1; frame <= 20; frame++) step(tilt, KEY_TILT_DOWN);
    assertEquals(tilt.motion.surface, DECK);
    assertTrue(tilt.motion.crouching);
    const shallow = risingUnder(character);
    const inside = analog(f32(-0.27));
    step(shallow, inside);
    finishMove(shallow, inside);
    assertFalse(shallow.motion.grounded);
  }
});

test("falling with full down drops through the platform, ending each aerial, and is actionable as the drop ends [k3 measure #392]", () => {
  for (const character of FIGHTERS) {
    for (const style of AERIALS) {
      for (const input of [analog(-1.0), KEY_DOWN]) {
        const f = fallingOnto(character, 1.5);
        attack(f, style);
        untilContact(f, input);
        assertEquals(f.platform.move, PlatformMove.descent);
        assertEquals(f.attack.style, undefined);
        assertEquals(f.landing.lag, 0);
        while (f.platform.move !== PlatformMove.none) {
          assertFalse(canAttack(f));
          step(f, input);
        }
        assertFalse(f.motion.grounded);
        assertEquals(f.motion.z, subtractFloat32(DECK_Z, height(f)));
        assertTrue(canAttack(f));
      }
    }
    const late = fallingOnto(character, 1.5);
    attack(late, AttackStyle.downAir);
    untilContact(late, NONE);
    assertGreaterThan(late.landing.lag, 0);
    step(late, KEY_DOWN);
    assertEquals(late.platform.move, PlatformMove.descent);
    assertEquals(late.landing.lag, 0);
    const tilt = fallingOnto(character, 1.5);
    untilContact(tilt, KEY_TILT_DOWN);
    for (let frame = 1; frame <= PLATFORM_INTENT_FRAMES; frame++) step(tilt, KEY_TILT_DOWN);
    assertEquals(tilt.motion.surface, DECK);
  }
});

const ROUTE_STAGE = 2;
const TOP = 3;

test("Tom's route: falling down air, drop, up air, drop, double jump, rising up air, climb, down air across two platforms [k1 scenario]", () => {
  const f = createFighter(Character.rifleman, f32(surfaceRight(ROUTE_STAGE, TOP, 0) - 10.0), 1);
  f.motion.grounded = false;
  f.motion.z = f32(surfaceZ(ROUTE_STAGE, TOP, 0) + 20.0);
  f.jump.remaining = 1;
  const route: string[] = [];
  const note = (event: string) => { if (route[route.length - 1] !== event) route.push(event); };
  attack(f, AttackStyle.downAir);
  const DOWN_RIGHT = controls({ direction: 1, down: true, verticalDirection: -1 });
  const RIGHT = controls({ direction: 1 });
  let drops = 0;
  let climbed = false;
  for (let frame = 1; frame <= 400 && !(climbed && f.attack.style === AttackStyle.downAir); frame++) {
    const wasMoving = f.platform.move;
    let input = drops < 2 ? DOWN_RIGHT : RIGHT;
    if (drops === 2 && f.platform.move === PlatformMove.none && f.jump.remaining > 0 && f.motion.vz < 0 && f.motion.z < f32(-f.motion.vz)) {
      input = controls({ jumpPressed: true, jumpHeld: true });
      note("double jump");
    }
    step(f, input, ROUTE_STAGE);
    if (f.platform.move === PlatformMove.descent && wasMoving === PlatformMove.none) {
      drops++;
      note(`drop ${drops}`);
      assertEquals(f.attack.style, undefined);
    }
    if (f.platform.move === PlatformMove.ascent) {
      climbed = true;
      note("climb");
      if (f.platform.frame > 0) assertEquals(f.attack.style, undefined);
    }
    if (f.platform.move !== PlatformMove.none || !canAttack(f)) continue;
    if (drops === 1 && f.attack.style === undefined && !route.includes("up air")) {
      attack(f, AttackStyle.upAir);
      note("up air");
    } else if (route[route.length - 1] === "double jump" && f.motion.vz > 0) {
      attack(f, AttackStyle.upAir);
      note("rising up air");
    } else if (climbed) {
      attack(f, AttackStyle.downAir);
      note("down air");
    }
  }
  assertEquals(route.join(", "), "drop 1, up air, drop 2, double jump, rising up air, climb, down air");
});

test("a platform move and its read window survive a snapshot copy [k1 scenario]", () => {
  for (const [original, inputs, stands] of [
    [risingUnder(Character.rifleman), [NONE, analog(f32(-0.5)), KEY_DOWN, NONE, NONE, NONE, NONE, NONE, NONE], true],
    [fallingOnto(Character.rifleman, 1.5), [NONE, NONE, KEY_DOWN, NONE, NONE, NONE, NONE, NONE, NONE], false],
  ] as const) {
    step(original, inputs[0]);
    const copy = createFighter(Character.rifleman, 0.0, 1);
    copyFighterState(copy, original, 1);
    assertEquals(firstFighterDifference(original, copy, 1, 1), undefined);
    for (const input of inputs.slice(1)) {
      step(original, input);
      step(copy, input);
      assertEquals(firstFighterDifference(original, copy, 1, 1), undefined);
    }
    assertEquals(original.motion.surface, stands ? DECK : undefined);
  }
});
