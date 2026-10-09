

import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { addFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";
import { AttackPhase, AttackStyle, Character, PlatformMove } from "./codes";
import { attackPhase, canAttack, canBeGrabbed, isIntangible } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { HERO_ROSTER } from "./heroes/registry";
import { beginAirDodge } from "./jumpsAndDodges";
import { attackDurationFramesForGrounding } from "./moves";
import { PLATFORM_WRAP_REACH, platformMoveFrames, platformSpecialInput } from "./platformMoves";
import { type Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { bodyTop } from "./surfaces";
import { advanceSolo, controls } from "./testWorld";
import { interruptJumpOrDodge } from "./transitions";
import { melee } from "./tuning";

const STAGE = 1;
const DECK = 1;
const DECK_Z = surfaceZ(STAGE, DECK, 0);
const CENTRE = f32(f32(surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2);
const FIGHTERS: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)];

const step = (f: Fighter, input: Readonly<Controls>) => advanceSolo(f, STAGE, input, 0.0);
const height = (f: Fighter) => melee(bodyTop(f.character));


function risingUnder(character: Character, x = CENTRE): Fighter {
  const f = createFighter(character, x, 1);
  f.motion.grounded = false;
  f.motion.z = f32(f32(DECK_Z - height(f)) - 0.5);
  f.motion.vz = 12.0;
  f.jump.remaining = 1;
  return f;
}

function standingOnDeck(character: Character, x = CENTRE): Fighter {
  const f = createFighter(character, x, 1);
  f.motion.surface = DECK;
  f.motion.z = DECK_Z;
  return f;
}


function finishMove(f: Fighter, input: Readonly<Controls>): number {
  let frames = 1;
  for (; frames <= 30 && f.platform.move !== PlatformMove.none; frames++) step(f, input);
  return frames - 1;
}

test("a full hop under a platform ascends it for the jump squat, carrying its rise, then lands on it [spec #103]", () => {
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

test("an ascent carries momentum by default; jump or up past the tap-jump threshold sustains it [spec #103]", () => {
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
      assertEquals(f.motion.vz, expected);
    }
  }
});

test("an ascent cancels an aerial's remaining recovery after it hits [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = risingUnder(character);
    f.attack.style = AttackStyle.upAir;
    f.attack.duration = attackDurationFramesForGrounding(AttackStyle.upAir, false, f.tuning.moves);
    f.attack.frame = f.attack.duration - 4;
    f.attack.hit = true;
    step(f, controls());
    assertEquals(f.platform.move, PlatformMove.ascent);
    assertEquals(f.attack.style, undefined);
    assertFalse(canAttack(f));
    finishMove(f, controls());
    assertFalse(f.motion.grounded);
    assertTrue(canAttack(f));
  }
});

test("an aerial in its startup or active frames carries on through the platform; the ascent begins as they end [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = risingUnder(character);

    f.motion.z = f32(f32(DECK_Z - height(f)) + 1.0);
    f.attack.style = AttackStyle.upAir;
    f.attack.duration = attackDurationFramesForGrounding(AttackStyle.upAir, false, f.tuning.moves);
    f.attack.frame = 1;
    const input = controls({ jumpHeld: true });
    let frames = 0;
    while (attackPhase(f) === AttackPhase.startup || attackPhase(f) === AttackPhase.active) {
      f.motion.vz = 5.0;
      step(f, input);
      frames++;
      if (attackPhase(f) === AttackPhase.startup || attackPhase(f) === AttackPhase.active) assertEquals(f.platform.move, PlatformMove.none);
    }
    assertGreaterThan(frames, 1);
    assertEquals(f.platform.move, PlatformMove.ascent);
    assertEquals(f.attack.style, undefined);
  }
});

test("down held or pressed during an ascent ends it standing; held down crouches without descending [spec #103]", () => {
  for (const character of FIGHTERS) {
    const held = risingUnder(character);
    const down = controls({ down: true, verticalDirection: -1 });
    step(held, down);
    finishMove(held, down);
    assertTrue(held.motion.grounded);
    assertEquals(held.motion.surface, DECK);
    assertEquals(held.landing.lag, 0);
    assertTrue(held.motion.crouching);
    for (let frame = 1; frame <= 30; frame++) step(held, down);
    assertEquals(held.platform.move, PlatformMove.none);
    assertEquals(held.motion.surface, DECK);
    assertTrue(held.motion.crouching);

    const buffered = risingUnder(character);
    step(buffered, controls());
    step(buffered, down);
    finishMove(buffered, controls());
    assertTrue(buffered.motion.grounded);
    assertEquals(buffered.motion.surface, DECK);
    assertFalse(buffered.motion.crouching);
  }
});

test("shield held or pressed during an ascent ends it shielding on the platform [spec #103]", () => {
  for (const character of FIGHTERS) {
    for (const press of [false, true]) {
      const f = risingUnder(character);
      step(f, controls());
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

test("a fresh down on a platform descends it for the jump squat; the tilt modifier crouches instead [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = standingOnDeck(character);
    const down = controls({ down: true, verticalDirection: -1 });
    step(f, down);
    assertEquals(f.platform.move, PlatformMove.descent);
    assertEquals(f.motion.z, DECK_Z);
    assertEquals(finishMove(f, down), f.tuning.physics.jumpSquatFrames);
    assertFalse(f.motion.grounded);

    assertEquals(f.motion.z, subtractFloat32(DECK_Z, height(f)));
    for (let frame = 1; frame <= 120 && !f.motion.grounded; frame++) step(f, down);
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, 0);

    const tilt = standingOnDeck(character);
    for (let frame = 1; frame <= 30; frame++) step(tilt, controls({ down: true, verticalDirection: -1, walking: true }));
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
    step(ascent, controls());
    assertEquals(ascent.platform.move, PlatformMove.ascent);
    const descent = standingOnDeck(character);
    step(descent, controls({ down: true, verticalDirection: -1 }));
    for (const f of [ascent, descent]) {
      while (f.platform.move !== PlatformMove.none) {
        assertFalse(isIntangible(f));
        assertTrue(canBeGrabbed(f));
        step(f, controls());
      }
    }
    const hit = risingUnder(character);
    step(hit, controls());
    interruptJumpOrDodge(hit);
    assertEquals(hit.platform.move, PlatformMove.none);
  }
});

test("an air dodge or special pressed during a descent comes out on its first free frame [spec #103]", () => {
  for (const character of FIGHTERS) {
    const dodge = standingOnDeck(character);
    step(dodge, controls({ down: true, verticalDirection: -1 }));
    step(dodge, controls({ airDodgePressed: true, shieldPressed: true, dodgeX: 1 }));
    assertFalse(dodge.dodge.airDodging);
    finishMove(dodge, controls());
    assertTrue(dodge.dodge.airDodging);

    const special = standingOnDeck(character);
    step(special, controls({ down: true, verticalDirection: -1 }));
    step(special, controls({ specialPressed: true, specialZ: -1 }));
    assertFalse(platformSpecialInput(special, controls()).specialPressed);
    finishMove(special, controls());
    const queued = platformSpecialInput(special, controls());
    assertTrue(queued.specialPressed);
    assertEquals(queued.specialZ, -1);
    assertFalse(platformSpecialInput(special, controls()).specialPressed);
  }
});

const AWAY_LEFT = controls({ direction: -1 });
const DOWN = controls({ down: true, verticalDirection: -1 });
const TOWARD_RIGHT = controls({ direction: 1 });
const DOWN_LEFT = controls({ direction: -1, down: true, verticalDirection: -1 });
const DOWN_RIGHT = controls({ direction: 1, down: true, verticalDirection: -1 });

test("a half-circle during an ascent wraps over onto the platform toward its side, facing reversed [spec #103]", () => {
  for (const character of FIGHTERS) {
    const f = risingUnder(character);
    step(f, controls());
    for (const input of [AWAY_LEFT, DOWN, TOWARD_RIGHT]) step(f, input);
    assertEquals(f.platform.move, PlatformMove.wrapOver);
    assertEquals(finishMove(f, controls()), platformMoveFrames(f));
    assertTrue(f.motion.grounded);
    assertEquals(f.motion.surface, DECK);
    assertEquals(f.motion.x, addFloat32(CENTRE, PLATFORM_WRAP_REACH));
    assertEquals(f.facing, -1);


    const drift = risingUnder(character);
    step(drift, controls());
    for (const input of [DOWN_LEFT, DOWN_RIGHT, DOWN_RIGHT]) step(drift, input);
    finishMove(drift, controls());
    assertTrue(drift.motion.grounded);
    assertEquals(drift.motion.x, CENTRE);
    assertEquals(drift.facing, 1);


    const edge = risingUnder(character, surfaceRight(STAGE, DECK, 0));
    step(edge, controls());
    for (const input of [AWAY_LEFT, DOWN, TOWARD_RIGHT]) step(edge, input);
    finishMove(edge, controls());
    assertEquals(edge.facing, 1);
    assertEquals(edge.motion.x, surfaceRight(STAGE, DECK, 0));
  }
});

test("a half-circle onto a falling contact wraps under the platform toward its side, facing reversed [spec #103]", () => {
  for (const character of FIGHTERS) {
    const falling = (): Fighter => {
      const f = createFighter(character, CENTRE, 1);
      const { gravity, fastFallSpeed } = f.tuning.physics;
      f.motion.grounded = false;

      f.motion.z = f32(DECK_Z + f32(gravity + f32(fastFallSpeed * 1.5)));
      f.jump.remaining = 1;
      return f;
    };
    const f = falling();
    for (const input of [AWAY_LEFT, DOWN, TOWARD_RIGHT]) step(f, input);
    assertEquals(f.platform.move, PlatformMove.wrapUnder);
    const contactX = f.motion.x;
    assertEquals(finishMove(f, controls()), platformMoveFrames(f));
    assertFalse(f.motion.grounded);
    assertEquals(f.motion.z, subtractFloat32(DECK_Z, height(f)));
    assertEquals(f.motion.x, addFloat32(contactX, PLATFORM_WRAP_REACH));
    assertEquals(f.facing, -1);

    const drift = falling();
    for (let frame = 1; frame <= 10 && !drift.motion.grounded; frame++) step(drift, frame === 1 ? DOWN_LEFT : DOWN_RIGHT);
    assertTrue(drift.motion.grounded);
    assertEquals(drift.motion.surface, DECK);
    assertEquals(drift.facing, 1);


    const standing = standingOnDeck(character);
    for (const input of [AWAY_LEFT, DOWN, TOWARD_RIGHT]) step(standing, input);
    assertEquals(standing.platform.move, PlatformMove.descent);
  }
});

test("a platform move survives a snapshot copy mid-move [invariant]", () => {
  const original = risingUnder(Character.rifleman);
  step(original, controls());
  step(original, AWAY_LEFT);
  const copy = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(copy, original, 1);
  assertEquals(firstFighterDifference(original, copy, 1, 1), undefined);
  for (const input of [DOWN, TOWARD_RIGHT, controls(), controls(), controls(), controls(), controls(), controls(), controls()]) {
    step(original, input);
    step(copy, input);
    assertEquals(firstFighterDifference(original, copy, 1, 1), undefined);
  }
  assertTrue(original.motion.grounded);
  assertEquals(original.facing, -1);
});
