import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, Character, PlatformMove } from "./codes";
import { canAttack, canBeGrabbed, isIntangible } from "./conditions";
import { type Fighter, PLATFORM_INTENT_FRAMES, createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import { beginAirDodge } from "./jumpsAndDodges";
import { attackLandingLag } from "./moves";
import { platformMoveFrames, platformSpecialInput } from "./platformMoves";
import { type Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { CROUCH_STICK_THRESHOLD, STICK_DEADZONE } from "./stickZones";
import { bodyTop } from "./surfaces";
import { advanceSolo, controls, soloWorld } from "./testWorld";
import { interruptJumpOrDodge } from "./transitions";
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

function standingOnDeck(character: Character, x = CENTRE): Fighter {
  const f = createFighter(character, x, 1);
  f.motion.surface = DECK;
  f.motion.z = DECK_Z;
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

test("a full hop under a platform climbs it for the jump squat, carrying its rise, then lands on it [spec #103]", () => {
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

test("a climb with no input carries momentum with gravity; jump or up past the jump threshold sustains it [spec #392]", () => {
  for (const character of FIGHTERS) {
    for (const sustain of ["none", "jump", "up"]) {
      const f = risingUnder(character);
      const input = controls({ jumpHeld: sustain === "jump", verticalDirection: sustain === "up" ? 1 : 0 });
      step(f, input);
      assertEquals(f.platform.move, PlatformMove.ascent);
      let expected = f.platform.rise;
      finishMove(f, input);
      if (sustain === "none") for (let frame = 1; frame <= f.tuning.physics.jumpSquatFrames; frame++) expected = subtractFloat32(expected, f.tuning.physics.gravity);
      assertFalse(f.motion.grounded);
      assertEquals(f.motion.x, CENTRE);
      assertEquals(f.motion.vz, expected);
    }
  }
});

test("a rising back air is ended by the climb with no landing lag, and a down air comes out on the first actionable frame [spec #392]", () => {
  for (const character of FIGHTERS) {
    const f = risingUnder(character);
    f.motion.z = f32(f32(DECK_Z - height(f)) - 30.0);
    attack(f, AttackStyle.backAir);
    assertEquals(f.attack.style, AttackStyle.backAir);
    const input = controls({ jumpHeld: true });
    for (let frame = 1; frame <= 60 && f.platform.move === PlatformMove.none; frame++) {
      f.motion.vz = 5.0;
      step(f, input);
    }
    assertEquals(f.platform.move, PlatformMove.ascent);
    step(f, input);
    assertEquals(f.attack.style, undefined);
    while (f.platform.move !== PlatformMove.none) {
      assertFalse(canAttack(f));
      step(f, input);
    }
    assertFalse(f.motion.grounded);
    assertEquals(f.landing.lag, 0);
    assertTrue(canAttack(f));
    attack(f, AttackStyle.downAir);
    assertEquals(f.attack.style, AttackStyle.downAir);
  }
});

test("an aerial in its startup or active frames strikes on the contact frame and ends as the climb's first frame begins [spec #392]", () => {
  for (const character of FIGHTERS) {
    const f = risingUnder(character);
    attack(f, AttackStyle.upAir);
    step(f, controls({ jumpHeld: true }));
    assertEquals(f.platform.move, PlatformMove.ascent);
    assertEquals(f.attack.style, AttackStyle.upAir);
    step(f, controls({ jumpHeld: true }));
    assertEquals(f.attack.style, undefined);
  }
});

test("rising, down anywhere past the deadzone stands on the platform, analog or keyboard; short of the deadzone climbs [spec #392]", () => {
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

test("falling onto a platform with no input lands with the aerial's landing lag [spec #392]", () => {
  for (const character of FIGHTERS) {
    const f = fallingOnto(character, 1.5);
    attack(f, AttackStyle.neutralAir);
    untilContact(f, NONE);
    assertEquals(f.platform.move, PlatformMove.none);
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, DECK);
    assertEquals(f.landing.lag, attackLandingLag(AttackStyle.neutralAir, f.tuning.moves));
  }
});

test("falling with full down drops through the platform, ending each aerial, and is actionable as the drop ends [spec #392]", () => {
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

test("shield held or pressed during a climb ends it shielding on the platform [spec #103]", () => {
  for (const character of FIGHTERS) {
    for (const press of [false, true]) {
      const f = risingUnder(character);
      step(f, NONE);
      step(f, controls({ shield: !press, shieldPressed: press, shieldStrength: 1.0 }));
      finishMove(f, controls({ shield: !press, shieldStrength: 1.0 }));
      assertTrue(f.motion.grounded);
      assertEquals(f.motion.surface, DECK);
      assertTrue(f.shield.raised);
      step(f, controls({ shield: !press, shieldStrength: 1.0 }));
      assertTrue(f.shield.raised);
    }
  }
});

test("standing, a fresh down descends the platform for the jump squat; the tilt modifier crouches instead [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = standingOnDeck(character);
    step(f, KEY_DOWN);
    assertEquals(f.platform.move, PlatformMove.descent);
    assertEquals(f.motion.z, DECK_Z);
    assertEquals(finishMove(f, KEY_DOWN), f.tuning.physics.jumpSquatFrames);
    assertFalse(f.motion.grounded);
    assertEquals(f.motion.z, subtractFloat32(DECK_Z, height(f)));
    for (let frame = 1; frame <= 120 && !f.motion.grounded; frame++) step(f, KEY_DOWN);
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, 0);

    const tilt = standingOnDeck(character);
    for (let frame = 1; frame <= 30; frame++) step(tilt, KEY_TILT_DOWN);
    assertEquals(tilt.platform.move, PlatformMove.none);
    assertEquals(tilt.motion.surface, DECK);
    assertTrue(tilt.motion.crouching);
  }
});

test("there is no platform shield drop: down while shielding stays on the platform [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = standingOnDeck(character);
    for (let frame = 1; frame <= 10; frame++) step(f, controls({ shield: true, shieldStrength: 1.0 }));
    assertTrue(f.shield.raised);
    for (let frame = 1; frame <= 20; frame++) step(f, controls({ shield: true, shieldStrength: 1.0, down: true, verticalDirection: -1 }));
    assertEquals(f.platform.move, PlatformMove.none);
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, DECK);
  }
});

test("a fighter is vulnerable throughout every platform move, and a hit ends the move [spec #103]", () => {
  for (const character of FIGHTERS) {
    const ascent = risingUnder(character);
    beginAirDodge(ascent, 0, 1);
    step(ascent, NONE);
    assertEquals(ascent.platform.move, PlatformMove.ascent);
    const descent = standingOnDeck(character);
    step(descent, KEY_DOWN);
    for (const f of [ascent, descent]) {
      while (f.platform.move !== PlatformMove.none) {
        assertFalse(isIntangible(f));
        assertTrue(canBeGrabbed(f));
        step(f, NONE);
      }
    }
    const hit = risingUnder(character);
    step(hit, NONE);
    interruptJumpOrDodge(hit);
    assertEquals(hit.platform.move, PlatformMove.none);
  }
});

test("an air dodge or special pressed during a descent comes out on its first free frame [spec #103]", () => {
  for (const character of FIGHTERS) {
    const dodge = standingOnDeck(character);
    step(dodge, KEY_DOWN);
    step(dodge, controls({ airDodgePressed: true, shieldPressed: true, dodgeX: 1 }));
    assertFalse(dodge.dodge.airDodging);
    finishMove(dodge, NONE);
    assertTrue(dodge.dodge.airDodging);

    const special = standingOnDeck(character);
    step(special, KEY_DOWN);
    step(special, controls({ specialPressed: true, specialZ: -1 }));
    assertFalse(platformSpecialInput(special, NONE).specialPressed);
    finishMove(special, NONE);
    const queued = platformSpecialInput(special, NONE);
    assertTrue(queued.specialPressed);
    assertEquals(queued.specialZ, -1);
    assertFalse(platformSpecialInput(special, NONE).specialPressed);
  }
});

const ROUTE_STAGE = 2;
const TOP = 3;

test("Tom's route: falling down air, drop, up air, drop, double jump, rising up air, climb, down air across two platforms [spec #392]", () => {
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

test("a platform move and its read window survive a snapshot copy [invariant]", () => {
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
