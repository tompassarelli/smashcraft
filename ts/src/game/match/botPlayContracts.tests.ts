// The computer opponent's contracts (#56): it never leaves the stage chasing
// an opponent who stands on it, it gets up from jab resets, and the same
// start plays the same match.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { stateChecksum } from "../replay/canonical";
import { AttackStyle, Character, DownState, SpecialAction } from "../sim/codes";
import { isHeroSpecialAction } from "../sim/heroSpecialRules";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceRight } from "../sim/stage";
import { FREEZE_TRAP_FREEZE_FRAMES } from "../sim/summons";
import { produceComputerInput } from "./botPlay";
import { chooseDefense } from "./botDefense";
import { upSpecialStartable } from "./botHeroKit";
import { SpecialSlot } from "../sim/heroSpecials";
import { beginFighterAttack } from "../sim/attacks";
import { attackStartupFrames } from "../sim/moves";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();

/** A two-fighter match on `stage` where the slots in `computers` play themselves and the rest stand still unless `human` acts. */
function computerMatch(characters: readonly [Character, Character], xs: readonly [number, number], stage: number, computers: number) {
  const world = createRoster(3, [createFighter(characters[0], xs[0], xs[0] < xs[1] ? 1 : -1), createFighter(characters[1], xs[1], xs[1] < xs[0] ? 1 : -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.timeLimitMinutes = 0;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const step = (human?: (slot: ParticipantSlot, frame: number) => void) => {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if ((computers & (1 << slot)) !== 0) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      else human?.(slot, frame);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
  };
  return { world, match, controls, runtime, produced, step };
}

test("computerChasesToTheEdgeWithoutLeavingTheStage", () => {
  // The #12 soak's self-destruct: a computer chasing an opponent at the deck's edge ran off it.
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const side of [-1, 1]) {
      const edge = side < 0 ? surfaceLeft(0, 0, 0) : surfaceRight(0, 0, 0);
      const game = computerMatch([Character.rifleman, character], [edge - side * 10.0, -side * 200.0], 0, 2);
      const computer = fighterAt(game.world, 1);
      for (let frame = 1; frame <= 480; frame++) {
        game.step();
        assertTrue(computer.motion.grounded || (computer.motion.x >= surfaceLeft(0, 0, 0) && computer.motion.x <= surfaceRight(0, 0, 0)));
      }
      assertEquals(computer.status.stocks, 3);
      assertGreaterThan(fighterAt(game.world, 0).visuals.hit, 0);
    }
  }
});

test("computerGetsUpUnderJabResets", () => {
  // A 5-damage jab on a lying fighter resets it; a computer that lay still was reset until time ran out.
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const game = computerMatch([Character.rifleman, character], [-60.0, 0.0], 0, 2);
    const computer = fighterAt(game.world, 1);
    computer.status.damage = 100.0;
    computer.down.state = DownState.bound;
    computer.down.frame = 1;
    let resets = 0;
    const resetting = () => computer.down.state === DownState.damage;
    for (let frame = 1; frame <= 300; frame++) {
      const reset = resetting();
      game.step((slot, now) => queueAttack(game.produced.commands[slot], { style: AttackStyle.jab, facing: 1, frame: now, mayCharge: false }));
      if (resetting() && !reset) resets++;
    }
    assertGreaterThan(resets, 0);
    assertLessThan(resets, 3);
  }
});

test("computerMatchesRepeatFromTheSameStart", () => {
  for (const stage of [0, 1]) {
    const checksums: string[] = [];
    let landed = 0;
    for (let run = 0; run < 2; run++) {
      const game = computerMatch([Character.archer, Character.demonHunter], [-240.0, 240.0], stage, 3);
      for (let frame = 1; frame <= 600; frame++) game.step();
      checksums.push(stateChecksum(game));
      landed = fighterAt(game.world, 0).visuals.hit + fighterAt(game.world, 1).visuals.hit;
    }
    assertEquals(checksums[0], checksums[1]);
    assertGreaterThan(landed, 0);
  }
});

/** Counts the hero special starts by slot (neutral, side, up, down) and the grabs a computer makes over `frames`. */
function heroUsage(game: ReturnType<typeof computerMatch>, slot: number, frames: number, human?: (slot: ParticipantSlot, frame: number) => void) {
  const computer = fighterAt(game.world, slot);
  const specials = [0, 0, 0, 0];
  let grabs = 0;
  let action: number = computer.special.action;
  let grabbing = false;
  for (let frame = 1; frame <= frames; frame++) {
    game.step(human);
    const started = computer.special.action - SpecialAction.heroNeutral;
    if (computer.special.action !== action && isHeroSpecialAction(computer.special.action)) specials[started] = (specials[started] ?? 0) + 1;
    action = computer.special.action;
    const holding = computer.grab.target !== undefined;
    if (holding && !grabbing) grabs++;
    grabbing = holding;
  }
  return { specials, grabs, computer };
}

test("computer Uther shoots Holy Light at a level target in range and never presses what its mana can't pay", () => {
  const game = computerMatch([Character.archer, Character.uther], [-200.0, 200.0], 0, 2);
  const { specials } = heroUsage(game, 1, 900);
  assertGreaterThan(specials[0] ?? 0, 0);
  const broke = computerMatch([Character.archer, Character.uther], [-200.0, 200.0], 0, 2);
  const uther = fighterAt(broke.world, 1);
  let pressedWithoutMana = 0;
  for (let frame = 1; frame <= 600; frame++) {
    uther.mana.points = 0;
    uther.mana.sinceSpend = 0;
    broke.step();
    if (broke.produced.inputs[1].specialPressed && broke.produced.inputs[1].specialZ <= 0) pressedWithoutMana++;
  }
  assertEquals(pressedWithoutMana, 0);
  assertEquals(uther.visuals.manaDenied, 0);
});

test("computer Uther raises Divine Shield against a strike timed into its guard window, and grabs a shield", () => {
  // An Archer forward smash about to land on Uther in 6 frames, its 7th: inside Divine Shield's f6-9.
  let guards = 0;
  for (let serial = 0; serial < 30; serial++) {
    const world = createRoster(3, [createFighter(Character.archer, -60.0, 1), createFighter(Character.uther, 30.0, -1)]);
    const archer = fighterAt(world, 0);
    beginFighterAttack(world, 0, AttackStyle.forwardSmash, false);
    archer.attack.serial = serial;
    archer.attack.frame = attackStartupFrames(AttackStyle.forwardSmash) - 6;
    const input = neutralControls();
    if (chooseDefense(fighterAt(world, 1), archer, 0, input) && input.specialPressed) {
      assertEquals(input.specialZ, -1);
      guards++;
    }
  }
  assertGreaterThan(guards, 0);
  const shielding = computerMatch([Character.archer, Character.uther], [-40.0, 40.0], 0, 2);
  const grabbed = heroUsage(shielding, 1, 600, (slot) => {
    const input = shielding.produced.inputs[slot];
    input.shield = true;
    input.shieldStrength = 1.0;
  });
  assertGreaterThan(grabbed.grabs, 0);
});

test("every complete hero's computer uses its specials and grabs in a match against another computer, the same each time", () => {
  for (const hero of HERO_ROSTER) {
    if (!hero.complete) continue;
    const checksums: string[] = [];
    for (let run = 0; run < 2; run++) {
      const game = computerMatch([Character.archer, hero.character], [-240.0, 240.0], 0, 3);
      const { specials, grabs } = heroUsage(game, 1, 3600);
      assertGreaterThan(specials.filter((count, slot) => slot !== 2 && count > 0).length, 0);
      checksums.push(stateChecksum(game));
    }
    assertEquals(checksums[0], checksums[1]);
  }
});

test("a computer hero's recovery counts its up special spent once used this airtime, and free below its cost", () => {
  const uther = createFighter(Character.uther, 0.0, 1);
  uther.motion.grounded = false;
  uther.motion.z = 300.0;
  assertTrue(upSpecialStartable(uther, false));
  uther.mana.points = 0;
  assertTrue(upSpecialStartable(uther, false));
  uther.special.airtimeUses = 1 << SpecialSlot.up;
  assertFalse(upSpecialStartable(uther, true));
  const archer = createFighter(Character.archer, 0.0, 1);
  assertTrue(upSpecialStartable(archer, true));
  assertFalse(upSpecialStartable(archer, false));
});

test("a frozen computer mashes out of the freeze at a human pace", () => {
  // Ten presses a second (botPlay.ts) thaw it on frame 131 of 300, well above the 60-frame floor.
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const game = computerMatch([Character.rifleman, character], [-300.0, 0.0], 0, 2);
    const computer = fighterAt(game.world, 1);
    game.step();
    computer.status.frozenFrames = FREEZE_TRAP_FREEZE_FRAMES;
    let frames = 0;
    while (computer.status.frozenFrames > 0) {
      game.step();
      frames++;
    }
    assertEquals(frames, 131);
  }
});
