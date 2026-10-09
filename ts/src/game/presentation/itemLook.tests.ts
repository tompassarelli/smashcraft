import { test, assertEquals } from "wisp/src/runtime/testing";
import { ITEM_WARNING_FRAMES } from "../match/centreItem";
import { createMatchItems } from "../match/items";
import { confirmedItemCues, createItemCueObservation, observeItemCues } from "./itemLook";

test("Item sounds start once on confirmed warning, spawn and pickup transitions [spec #196]", () => {
  const items = createMatchItems();
  const spawn = 3600, warning = spawn - ITEM_WARNING_FRAMES;
  items.nextSpawnFrame = spawn;
  const before = createItemCueObservation();
  observeItemCues(before, items, warning - 1);
  assertEquals(confirmedItemCues(before, items, warning), 1);
  observeItemCues(before, items, warning);
  assertEquals(confirmedItemCues(before, items, warning + 1), 0);
  observeItemCues(before, items, spawn - 1);
  items.spawnSerial++;
  items.pickupSerial++;
  items.nextSpawnFrame = spawn * 2;
  assertEquals(confirmedItemCues(before, items, spawn), 6);
  observeItemCues(before, items, spawn);
  assertEquals(confirmedItemCues(before, items, spawn + 1), 0);
});
