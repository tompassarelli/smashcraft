

import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { FEL_LUNGE_BASE, FEL_LUNGE_CHARGE, attackDurationFramesForGrounding } from "./moves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { authoredTuning } from "./tuning";
import { EYE_BLAST_MARKS, eyeBlastMark } from "../presentation/eyeBlastMarker";
import { EYE_BLAST_FORM, EYE_BLAST_LAST, EYE_BLAST_REACH, EYE_BLAST_WINDUP } from "./specials";
import { ROSTER_MANA } from "./mana";
import { duel } from "./testDuel";
import { controls } from "./testWorld";

const EYE_BLAST_PRESS = controls({ specialPressed: true, shield: true, shieldStrength: 1.0 });

test("Fel Lunge's full-charge reach stays inside the roster's forward smash band [spec #379]", () => {
  const out = emptyHitRegion();
  let illidan = 0.0;
  let widest = 0.0;
  for (const character of SELECTABLE_CHARACTERS) {
    const moves = authoredTuning(character).moves;
    let reach = 0.0;
    for (let frame = 0; frame < attackDurationFramesForGrounding(AttackStyle.forwardSmash, true, moves); frame++) {
      for (let index = 0; index < authoredHitRegionCount(AttackStyle.forwardSmash, moves); index++) {
        const region = authoredHitRegion(out, character, AttackStyle.forwardSmash, frame, 0, index, moves);
        if (region.effect.damage > 0.0) reach = Math.max(reach, region.strike === undefined ? region.maxX : Math.max(region.strike.x1, region.strike.x2) + region.strike.radius);
      }
    }
    reach += moves?.normals[AttackStyle.forwardSmash]?.startupTravelX ?? 0.0;
    if (character === Character.demonHunter) illidan = reach + FEL_LUNGE_BASE + FEL_LUNGE_CHARGE;
    else widest = Math.max(widest, reach);
  }
  assertGreaterThan(illidan, 0.0);
  assertTrue(illidan <= widest);
});

test("Eye Blast: a grounded EX neutral special spending one meter segment, with a 24-frame windup and ground marker before a beam reaching 645 [spec #379]", () => {
  const d = duel(420.0);
  d.illidan.mana.points = 100;
  d.target.mana.points = 50;
  d.step(EYE_BLAST_PRESS);
  assertEquals(d.illidan.special.action, SpecialAction.demonHunterManaBurn);
  assertEquals(d.illidan.special.form, EYE_BLAST_FORM);
  assertEquals(d.illidan.mana.points, 100 - ROSTER_MANA.exCost);
  assertGreaterThan(EYE_BLAST_WINDUP + 1, 20);
  while (d.illidan.special.frame < EYE_BLAST_WINDUP) {
    for (let mark = 0; mark < EYE_BLAST_MARKS; mark++) assertTrue(eyeBlastMark(d.illidan, mark) !== undefined);
    assertEquals(d.target.status.damage, 0.0);
    d.step();
  }
  assertEquals(d.target.status.damage, 0.0);
  d.run(EYE_BLAST_LAST - EYE_BLAST_WINDUP);
  assertEquals(d.target.status.damage, 13.0);
  assertEquals(EYE_BLAST_REACH, 645.0);

  const empty = duel(420.0);
  empty.illidan.mana.points = ROSTER_MANA.exCost - 1;
  empty.step(EYE_BLAST_PRESS);
  assertEquals(empty.illidan.special.form, 0);
  assertEquals(empty.illidan.mana.points, ROSTER_MANA.exCost - 1);
});
