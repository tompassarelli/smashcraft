// Every special of every fighter shows a stock spell on its startup and on its
// active frames, read from its kit's authored frames, and no two moves look
// alike (#144).
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import type { AuthoredSpecial } from "../sim/heroSpecials";
import { SPECIAL_SLOTS } from "./projectileArt";
import { RIFLEMAN_MODEL_FILE } from "./fighterAssetInfo";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { HERO_BRANCH_CUES, HERO_CUES, ORIGINAL_CUES, fighterBranchCues, fighterMoveCues, heroCueWindows, specialCueState } from "./specialCues";

/** The original three and every registered hero, so a new hero needs its cues. */
const FIGHTERS: readonly Character[] = [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];

test("Rifleman readies his rifle without Flare and fires a barrel muzzle flash", () => {
  const blaster = ORIGINAL_CUES[SpecialAction.riflemanBlaster];
  assertEquals(blaster?.startup.model, RIFLEMAN_MODEL_FILE);
  assertEquals(blaster?.startup.drawn, true);
  assertEquals(blaster?.startup.anchor, "barrel");
  assertEquals(blaster?.active.model, "Abilities\\Weapons\\GyroCopter\\GyroCopterImpact.mdx");
  assertEquals(blaster?.active.anchor, "barrel");
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.special.action = SpecialAction.riflemanBlaster;
  for (const grounded of [true, false]) {
    fighter.motion.grounded = grounded;
    fighter.special.frame = 1;
    assertEquals(specialCueState(fighter).phase, "startup");
    fighter.special.frame = grounded ? RIFLEMAN_BLASTER_GROUND_SHOT_FRAME : RIFLEMAN_BLASTER_AIR_SHOT_FRAME;
    assertEquals(specialCueState(fighter).phase, "active");
  }
});

/** Every form a kit can run: grounded, airborne, free, recall, marked and each follow-up. */
function forms(special: AuthoredSpecial | undefined, into: AuthoredSpecial[]): void {
  if (special === undefined) return;
  into.push(special);
  for (const followUp of special.followUps ?? []) forms(followUp.special, into);
}

test("every fighter's four specials each show a startup and an active spell", () => {
  for (const character of FIGHTERS) {
    const moves = fighterMoveCues(character);
    assertEquals(moves.length, 4, `fighter ${character} cues`);
    for (const move of moves) assertTrue(move.startup.model !== "" && move.active.model !== "" && move.spell !== "");
  }
});

test("no two moves or branches show the same startup and active pair, nor the same active spell", () => {
  const pairs = new Map<string, string>();
  const actives = new Map<string, string>();
  for (const character of FIGHTERS) {
    [...fighterMoveCues(character), ...fighterBranchCues(character)].forEach((move, slot) => {
      const id = `${character}:${slot} ${move.spell}`;
      const pair = `${move.startup.model}|${move.active.model}`;
      assertEquals(pairs.get(pair), undefined, `${id} pair`);
      pairs.set(pair, id);
      assertEquals(actives.get(move.active.model), undefined, `${id} active ${move.active.model}`);
      actives.set(move.active.model, id);
    });
  }
});

test("every hero special form's cue windows lie in its action: startup from frame 1, then active", () => {
  let checked = 0;
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    assertTrue(HERO_CUES[hero.character] !== undefined);
    for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      const all: AuthoredSpecial[] = [];
      const kitForms = [kit.ground, kit.air, kit.free, kit.recall, kit.marked?.special];
      for (let form = 0; form < 5; form++) forms(kitForms[form], all);
      for (const move of all) {
        const { startup, active } = heroCueWindows(move);
        assertEquals(startup.first, 1);
        assertTrue(active.first >= 1 && active.last >= active.first && active.last <= move.endFrame);
        assertTrue(startup.last === 1 || startup.last === active.first - 1);
        checked++;
      }
    }
  }
  assertTrue(checked >= 28);
});

test("a running special shows its startup cue, then its active cue", () => {
  for (const hero of HERO_ROSTER) {
    if (hero.specials === undefined) continue;
    const fighter = createFighter(hero.character, 0.0, 1);
    for (let slot = 0; slot < 4; slot++) {
      const move = hero.specials[SPECIAL_SLOTS[slot] ?? "neutral"].ground;
      const { active } = heroCueWindows(move);
      fighter.special.action = [SpecialAction.heroNeutral, SpecialAction.heroSide, SpecialAction.heroUp, SpecialAction.heroDown][slot] ?? SpecialAction.heroNeutral;
      fighter.special.form = 0;
      fighter.special.frame = active.first;
      const cues = HERO_CUES[hero.character]?.[SPECIAL_SLOTS[slot] ?? "neutral"];
      assertEquals(specialCueState(fighter).phase, "active");
      assertTrue(specialCueState(fighter).cues === cues);
      if (active.first > 1) {
        fighter.special.frame = 1;
        assertEquals(specialCueState(fighter).phase, "startup");
      }
    }
  }
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  illidan.special.action = SpecialAction.demonHunterManaBurn;
  illidan.special.frame = 1;
  assertEquals(specialCueState(illidan).phase, "startup");
  assertTrue(specialCueState(illidan).cues === ORIGINAL_CUES[SpecialAction.demonHunterManaBurn]);
});

test("every hero branch (recall, marked form, follow-up) names its cue", () => {
  let branches = 0;
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      const named = HERO_BRANCH_CUES[hero.character]?.[slot];
      if (kit.recall !== undefined) {
        assertEquals(named?.recall !== undefined, true, `${hero.name} ${slot} recall`);
        branches++;
      }
      if (kit.marked !== undefined) {
        assertEquals(named?.marked !== undefined, true, `${hero.name} ${slot} marked`);
        branches++;
      }
      const kitForms = [kit.ground, kit.air, kit.free, kit.recall, kit.marked?.special];
      for (let form = 0; form < 5; form++) {
        const followUps = kitForms[form]?.followUps ?? [];
        for (let index = 0; index < followUps.length; index++) {
          assertEquals(named?.followUps?.[index] !== undefined, true, `${hero.name} ${slot} follow-up ${index}`);
          branches++;
        }
      }
    }
  }
  assertTrue(branches >= 10);
});
