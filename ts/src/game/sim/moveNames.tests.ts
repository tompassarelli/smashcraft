import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "./codes";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { SPECIAL_INPUTS, fighterKit, specialName } from "./moveNames";
import { movesPage } from "../shell/messages";
import { ARCHER_DIVE_FORM } from "./specials";
import { FOLLOW_UP_FORM, SpecialForm } from "./heroSpecials";

test("every selectable fighter's four specials, named forms, passive and ultimate have non-empty, unique names", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const kit = fighterKit(character);
    const who = fighterName(character);
    assertEquals(kit.specials.length, 4, `${who} has four specials`);
    const names: string[] = [];
    for (const special of kit.specials) {
      names.push(special.name);
      assertEquals(special.description.length > 0, true, `${who} ${special.name} has a description`);
      for (const form of special.forms) names.push(form.name);
    }
    // A fighter the design gives no passive says what its hits do instead (Illidan's drain).
    if (kit.passive === undefined) assertEquals((kit.trait ?? "").length > 0, true, `${who} has a passive or a trait`);
    else {
      names.push(kit.passive.name);
      assertEquals(kit.passive.description.length > 0, true, `${who}'s passive has a description`);
    }
    if (kit.ultimate !== undefined) names.push(kit.ultimate.name);
    const seen = new Set<string>();
    for (const name of names) {
      assertEquals(name.trim().length > 0, true, `${who} has an empty move name`);
      assertEquals(seen.has(name), false, `${who} names two moves ${name}`);
      seen.add(name);
    }
  }
});

test("a running special is called by its named form, else by the special", () => {
  assertEquals(specialName(Character.archer, SpecialAction.archerDisengage, 0), "Hippogryph Call");
  assertEquals(specialName(Character.archer, SpecialAction.archerDisengage, ARCHER_DIVE_FORM), "Hippogryph Dive");
  assertEquals(specialName(Character.mountainKing, SpecialAction.heroUp, SpecialForm.ground), "Thunder Leap");
  assertEquals(specialName(Character.mountainKing, SpecialAction.heroUp, SpecialForm.ground + FOLLOW_UP_FORM), "Hammerfall");
  assertEquals(specialName(Character.mountainKing, SpecialAction.heroUp, SpecialForm.free), "Thunder Leap");
  assertEquals(specialName(Character.warden, SpecialAction.heroSide, SpecialForm.marked), "Shadow Pursuit");
  assertEquals(specialName(Character.warden, SpecialAction.heroSide, SpecialForm.ground), "Pursuit Lunge");
});

test("the Moves page lists every selectable fighter's specials and passive in one line each, and its ultimate only while ultimates are on", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const kit = fighterKit(character);
    const off = movesPage(character, false);
    const on = movesPage(character, true);
    assertEquals(off.title, `${fighterName(character).toUpperCase()} — MOVES`);
    assertEquals(off.lines.length, 5);
    for (let slot = 0; slot < 4; slot++) {
      const special = kit.specials[slot];
      assertEquals(off.lines[slot], `${SPECIAL_INPUTS[slot]}: ${special?.name}. ${special?.description}`);
    }
    const passive = off.lines[4] ?? "";
    assertEquals(passive.startsWith(kit.passive === undefined ? "No passive. " : `Passive: ${kit.passive.name}. `), true);
    assertEquals(on.lines.length, kit.ultimate === undefined ? 5 : 6);
    if (kit.ultimate !== undefined) assertEquals(on.lines[5], `Ultimate: ${kit.ultimate.name}. ${kit.ultimate.description}`);
    for (const line of on.lines) assertEquals(line.includes("\n"), false);
  }
});
