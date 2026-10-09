// The computer opponent's contracts (#56): it never leaves the stage chasing
// an opponent who stands on it, it gets up from jab resets, and the same
// start plays the same match.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep, sweepSeed } from "../../runtime/sweep";
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
import { produceComputerInput, sameComputerInputs } from "./botPlay";
import { observeOpponents } from "./botPerception";
import { cpuSkill, cpuReactionFloor } from "./cpuSkill";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { chooseDefense } from "./botDefense";
import { beginFighterAttack } from "../sim/attacks";
import { attackStartupFrames } from "../sim/moves";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();

/** A two-fighter match on `stage` where the slots in `computers` play themselves and the rest stand still unless `human` acts. */
function computerMatch(characters: readonly [Character, Character], xs: readonly [number, number], stage: number, computers: number, seed = 0) {
  const world = createRoster(3, [createFighter(characters[0], xs[0], xs[0] < xs[1] ? 1 : -1), createFighter(characters[1], xs[1], xs[1] < xs[0] ? 1 : -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.timeLimitMinutes = 0;
  match.matchSeed = sweepSeed(seed);
  // Strongest-play contracts select Wren Expert explicitly rather than the Intermediate default.
  for (const slot of PARTICIPANT_SLOTS) {
    match.cpuOpponents[slot] = "wren";
    match.cpuResolvedOpponents[slot] = "wren";
    match.cpuTiers[slot] = "expert";
  }
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

test("computerChasesToTheEdgeWithoutLeavingTheStage [spec #56]", () => {
  // The #12 soak's self-destruct: a computer chasing an opponent at the deck's edge ran off it.
  for (const character of [Character.rifleman, Character.demonHunter]) {
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

test("computerGetsUpUnderJabResets [repro #56]", () => {
  // A 5-damage jab on a lying fighter resets it; a computer that lay still was reset until time ran out.
  for (const character of [Character.rifleman, Character.demonHunter]) {
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

test("computerMatchesRepeatFromTheSameStart [invariant]", () => {
  for (const stage of [0, 1]) {
    const checksums: string[] = [];
    let landed = 0;
    for (let run = 0; run < 2; run++) {
      const game = computerMatch([Character.rifleman, Character.demonHunter], [-240.0, 240.0], stage, 3);
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

test("computer Forsaken Paladin uses Righteous Fury in range and regular specials at zero meter [spec #155] [spec #335]", () => {
  let furies = 0;
  for (let seed = 0; seed < 4; seed++) furies += heroUsage(computerMatch([Character.rifleman, Character.forsakenPaladin], [-50.0, 50.0], 0, 2, seed), 1, 900).specials[1] ?? 0;
  assertGreaterThan(furies, 0);
  const broke = computerMatch([Character.rifleman, Character.forsakenPaladin], [-50.0, 50.0], 0, 2);
  const forsakenPaladin = fighterAt(broke.world, 1);
  let pressedWithoutMana = 0;
  for (let frame = 1; frame <= 600; frame++) {
    forsakenPaladin.mana.points = 0;
    broke.step();
    if (broke.produced.inputs[1].specialPressed && broke.produced.inputs[1].specialZ <= 0) pressedWithoutMana++;
  }
  assertGreaterThan(pressedWithoutMana, 0);
  assertEquals(forsakenPaladin.visuals.manaDenied, 0);
});

test("computer Forsaken Paladin shields or dodges an incoming strike and grabs a shield [spec #56]", () => {
  // The hammer kit defends with ordinary shield or dodge.
  let guards = 0;
  for (let serial = 0; serial < 30; serial++) {
    const world = createRoster(3, [createFighter(Character.rifleman, -60.0, 1), createFighter(Character.forsakenPaladin, 30.0, -1)]);
    const rifleman = fighterAt(world, 0);
    beginFighterAttack(world, 0, AttackStyle.forwardSmash, false);
    rifleman.attack.serial = serial;
    rifleman.attack.frame = attackStartupFrames(AttackStyle.forwardSmash) - 6;
    const input = neutralControls();
    if (chooseDefense(fighterAt(world, 1), rifleman, 0, input)) {
      assertFalse(input.specialPressed);
      assertTrue(input.shield || input.groundDodgePressed);
      guards++;
    }
  }
  assertGreaterThan(guards, 0);
  const shielding = computerMatch([Character.rifleman, Character.forsakenPaladin], [-40.0, 40.0], 0, 2);
  const grabbed = heroUsage(shielding, 1, 600, (slot) => {
    const input = shielding.produced.inputs[slot];
    input.shield = true;
    input.shieldStrength = 1.0;
  });
  assertGreaterThan(grabbed.grabs, 0);
});

// One test a hero: the roster grows, and each hero's two 3600-frame matches take 0.3-0.5 s alone.
// The suite plays the first complete hero; the others run as sweeps.
const firstCompleteHero = HERO_ROSTER.find((hero) => hero.complete);
for (const hero of HERO_ROSTER) {
  if (!hero.complete) continue;
  sweep(`${hero.name}'s computer uses its specials and grabs in a match against another computer, the same each time [spec #146] [invariant]`, () => {
    const checksums: string[] = [];
    for (let run = 0; run < 2; run++) {
      // Seed 33331: a Thrall bolt left its electric flag on the shared projectile hit, so the next match's rifle shot hit differently (#371).
      const game = computerMatch([Character.rifleman, hero.character], [-240.0, 240.0], 0, 3, 33331);
      const { specials } = heroUsage(game, 1, 3600);
      assertGreaterThan(specials.filter((count, slot) => slot !== 2 && count > 0).length, 0);
      checksums.push(stateChecksum(game));
    }
    assertEquals(checksums[0], checksums[1]);
  });
}

test("a match ends the same after a match between other heroes in the same process [invariant]", () => {
  const play = (characters: readonly [Character, Character]): string => {
    const game = computerMatch(characters, [-240.0, 240.0], 0, 3, 33331);
    heroUsage(game, 1, 600);
    return stateChecksum(game);
  };
  const fresh = play([Character.rifleman, Character.kaelthas]);
  play([Character.thrall, Character.rifleman]);
  assertEquals(play([Character.rifleman, Character.kaelthas]), fresh);
});

test("a frozen computer mashes out of the freeze at a human pace [spec #114]", () => {
  // Ten presses a second (botPlay.ts) thaw it after the 60-frame floor and before the freeze runs out.
  for (const character of [Character.rifleman, Character.demonHunter]) {
    const game = computerMatch([Character.rifleman, character], [-300.0, 0.0], 0, 2);
    const computer = fighterAt(game.world, 1);
    game.step();
    computer.status.frozenFrames = FREEZE_TRAP_FREEZE_FRAMES;
    let frames = 0;
    while (computer.status.frozenFrames > 0) {
      game.step();
      frames++;
    }
    assertTrue(frames >= 60 && frames < FREEZE_TRAP_FREEZE_FRAMES);
  }
});

test("a computer repeats a decision only from the same state: any change to its fighter, perception, strategy, delay or clock refuses it [invariant]", () => {
  const game = computerMatch([Character.demonHunter, Character.rifleman], [-100.0, 100.0], 0, 2);
  for (let frame = 1; frame <= 90; frame++) game.step();
  const live = { world: game.world, match: game.match, controls: game.controls, runtime: game.runtime };
  const before = createReplaySnapshot();
  copyReplayState(before, live);
  const frame = game.runtime.simulationFrame + 1;
  const same = () => sameComputerInputs(game.match, game.world, game.runtime, before.match, before.world, before.runtime, 1, frame);
  assertTrue(same());
  // Every number and flag of the computer's own fighter that the copy holds apart from live state.
  let leaves = 0;
  const visit = (mine: Record<string, unknown>, copy: Record<string, unknown>, depth: number) => {
    for (const key of Object.keys(copy)) {
      const value = copy[key];
      const own = mine[key];
      if (typeof value === "number" || typeof value === "boolean") {
        copy[key] = typeof value === "number" ? value + 1 : !value;
        if (same()) throw new Error(`a changed fighter field ${key} still matched`);
        copy[key] = value;
        leaves++;
      } else if (typeof value === "object" && value !== null && value !== own && typeof own === "object" && own !== null && depth < 4) {
        visit(own as Record<string, unknown>, value as Record<string, unknown>, depth + 1);
      }
    }
  };
  visit(fighterAt(game.world, 1) as unknown as Record<string, unknown>, fighterAt(before.world, 1) as unknown as Record<string, unknown>, 0);
  assertGreaterThan(leaves, 100);
  assertTrue(same());
  before.runtime.botAttackDelays[1] += 1.0;
  assertFalse(same());
  before.runtime.botAttackDelays[1] -= 1.0;
  before.runtime.botStrategies[1].events++;
  assertFalse(same());
  before.runtime.botStrategies[1].events--;
  before.runtime.botMemory.directionFrames[1]++;
  assertFalse(same());
  before.runtime.botMemory.directionFrames[1]--;
  before.match.matchFrame++;
  assertFalse(same());
  before.match.matchFrame--;
  // The perceived sample: a memory with one more observation sees a newer one.
  const seen = frame + cpuReactionFloor(fighterAt(game.world, 1), cpuSkill("wren", "expert"));
  assertTrue(sameComputerInputs(game.match, game.world, game.runtime, before.match, before.world, before.runtime, 1, seen));
  observeOpponents(before.runtime.botMemory, before.world, frame);
  assertFalse(sameComputerInputs(game.match, game.world, game.runtime, before.match, before.world, before.runtime, 1, seen));
});
