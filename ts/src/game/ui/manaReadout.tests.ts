import { assertEquals, test } from "wisp/src/runtime/testing";
import { MANA_NOTICE_UPDATES, manaLabel, manaReadout } from "./manaReadout";

test("the mana label shows mana, and a refused special's notice once per refusal", () => {
  const readout = manaReadout();
  assertEquals(manaLabel(readout, undefined, 0), "");
  assertEquals(manaLabel(readout, 82, 0), "|cff8fc4ffMana 82|r");
  assertEquals(manaLabel(readout, 10, 1), "|cffff6060Not enough mana|r");
  for (let update = 2; update <= MANA_NOTICE_UPDATES; update++) assertEquals(manaLabel(readout, 10, 1), "|cffff6060Not enough mana|r");
  assertEquals(manaLabel(readout, 10, 1), "|cff8fc4ffMana 10|r");
  assertEquals(manaLabel(readout, 10, 2), "|cffff6060Not enough mana|r");
  // A rollback that takes a refusal back neither restarts nor blocks the next notice.
  manaLabel(readout, 10, 1);
  assertEquals(readout.seenDenials, 1);
});
