import { test, assertEquals } from "wisp/src/runtime/testing";
import { createMatchItems } from "../match/items";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "./itemLook";

test("Item sounds start once on confirmed warning, spawn and pickup transitions [spec #196]", () => {
  const items = createMatchItems();
  items.nextSpawnFrame = 3600;
  const before = createItemCueObservation();
  observeItemCues(before, items, 2999);
  assertEquals(confirmedItemCues(before, items, 3000), 1);
  observeItemCues(before, items, 3000);
  assertEquals(confirmedItemCues(before, items, 3001), 0);
  observeItemCues(before, items, 3599);
  items.spawnSerial++;
  items.pickupSerial++;
  items.nextSpawnFrame = 6000;
  assertEquals(confirmedItemCues(before, items, 3600), 6);
  observeItemCues(before, items, 3600);
  assertEquals(confirmedItemCues(before, items, 3601), 0);
});
