


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { type AuthoredSpecial } from "../sim/heroSpecials";
import { SPECIAL_SLOTS } from "./projectileArt";
import { RIFLEMAN_BLASTER_AIR_SHOT_FRAME, RIFLEMAN_BLASTER_GROUND_SHOT_FRAME } from "../sim/moves";
import { RIFLEMAN_SECOND_SHOT_FIRST, RIFLEMAN_SECOND_SHOT_FORM, RIFLEMAN_SECOND_SHOT_LAST } from "../sim/specials";
import { HERO_BRANCH_CUES, HERO_CUES, ORIGINAL_CUES, fighterBranchCues, fighterMoveCues, heroCueWindows, specialCueState } from "./specialCues";


const FIGHTERS: readonly Character[] = [Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map(({ character }) => character)];


function forms(special: AuthoredSpecial | undefined, into: AuthoredSpecial[]): void {
  if (special === undefined) return;
  into.push(special);
  for (const followUp of special.followUps ?? []) forms(followUp.special, into);
}

test("no two moves or branches show the same startup and active pair, nor the same active spell [k3 measure #144]", () => {
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

test("every hero special form's cue windows lie in its action: startup from frame 1, then active [k2 property]", () => {
  let checked = 0;
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    assertTrue(HERO_CUES[hero.character] !== undefined);
    for (const slot of SPECIAL_SLOTS) {
      const kit = specials[slot];
      const all: AuthoredSpecial[] = [];
      const kitForms = [kit.ground, kit.air, kit.recall, kit.marked?.special];
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
