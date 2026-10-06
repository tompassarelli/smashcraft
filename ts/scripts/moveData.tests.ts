import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { authoredHitRegion, emptyHitRegion } from "../src/game/sim/hitRegions";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { attackStartupFrames } from "../src/game/sim/moves";
import { createRoster } from "../src/game/sim/roster";
import { observeLandingLag } from "./moveData";

test("move export reads jab contact through production resolution for all fighters", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const attacker = createFighter(character, 0, 1);
    const defender = createFighter(Character.rifleman, 60, -1);
    const world = createRoster(3, [attacker, defender]);
    beginFighterAttack(world, 0, AttackStyle.jab, false);
    const moves = attacker.tuning.moves;
    attacker.attack.frame = attackStartupFrames(AttackStyle.jab, moves);
    const expected = authoredHitRegion(emptyHitRegion(), character, AttackStyle.jab, attacker.attack.frame, 0, 0, moves);
    resolveAttacks(world);
    expect(defender.status.damage).toBe(expected.effect.damage);
  }
});

test("move export observes the short aerial landing lag through the production step", () => {
  expect(observeLandingLag(Character.archer, AttackStyle.neutralAir)).toBe(5);
});
