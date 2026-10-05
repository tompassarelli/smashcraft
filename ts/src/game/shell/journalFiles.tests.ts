import { assertEquals, test } from "../../runtime/testing";
import { controlFile, devReceiptFile, lifecycleFile, menuFile } from "./journalFiles";

const identity = { build: "playable-0042", epoch: 2, slot: 1 };

test("helper-facing journal files keep the names and lines the helper parses", () => {
  const control = controlFile(identity, 3, "PAUSE_COMMIT", 417);
  assertEquals(control.name, "smashcraft-journal-control-playable-0042-e2-s1-n3.txt");
  assertEquals(control.lines.join("\n"), "SMASHCRAFT JOURNAL CONTROL v=1 build=playable-0042 epoch=2 slot=1 sequence=3 state=PAUSE_COMMIT frame=417");
  const end = lifecycleFile(identity, "end", 900);
  assertEquals(end.name, "smashcraft-journal-end-playable-0042-e2-s1.txt");
  assertEquals(end.lines.join("\n"), "SMASHCRAFT JOURNAL CONTROL v=1 build=playable-0042 epoch=2 slot=1 sequence=0 state=END frame=900");
  const menu = menuFile(identity, "STAGE", { connected: 3, humanFighters: 3, computers: 4, fighters: 7 });
  assertEquals(menu.name, "smashcraft-journal-menu-playable-0042-s1.txt");
  assertEquals(menu.lines.join("\n"), "SMASHCRAFT JOURNAL MENU v=1 build=playable-0042 epoch=2 slot=1 phase=STAGE\nconnected=3 human-fighters=3 computers=4 fighters=7");
  const receipt = devReceiptFile(identity, 4, { rollback: 12, delay: 0, batch: 1 });
  assertEquals(receipt.name, "smashcraft-dev-playable-0042-p1.txt");
  assertEquals(receipt.lines.join("\n"), "SMASHCRAFT DEV v=1 build=playable-0042 receipt=4 epoch=2 rb=12 delay=0 batch=1 ");
});
