// Passive presentation (#148): the pips follow the fighter's stacks and ready
// state, every passive shows something, and a proc plays once per serial,
// never again after a rollback re-reaches it.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { passivePips, passiveSpec } from "../sim/passives";
import { newPassiveProc, passiveLook } from "./passiveLook";

test("pips show the stacks, all lit when the passive is ready [spec #148]", () => {
  const blademaster = createFighter(Character.blademaster, 0.0, 1);
  assertEquals(passivePips(blademaster).of, 3);
  blademaster.passive.stacks = 2;
  assertEquals(passivePips(blademaster).lit, 2);
  assertFalse(passivePips(blademaster).ready);
  blademaster.passive.stacks = 3;
  assertTrue(passivePips(blademaster).ready);
  const warden = createFighter(Character.warden, 0.0, 1);
  assertEquals(passivePips(warden).lit, 1);
  warden.passive.used = true;
  assertEquals(passivePips(warden).lit, 0);
});

test("every fighter with a passive shows a ready or proc effect [spec #148]", () => {
  for (let character = 0; character <= Character.beastmaster; character++) {
    const look = passiveLook(character as Character);
    const has = passiveSpec(character as Character).stacks > 0;
    assertEquals(look.ready !== undefined || look.proc !== undefined, has);
  }
});

test("a proc plays once per serial; a rollback lowers the cursor without replaying [spec #148]", () => {
  const cursor = { seen: -1 };
  assertFalse(newPassiveProc(cursor, 0));
  assertTrue(newPassiveProc(cursor, 1));
  assertFalse(newPassiveProc(cursor, 1));
  assertFalse(newPassiveProc(cursor, 0));
  assertTrue(newPassiveProc(cursor, 1));
  assertTrue(newPassiveProc(cursor, 2));
});
