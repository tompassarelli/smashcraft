import { f32 } from "wisp/src/sim/f32";
import { assertTrue, test } from "wisp/src/runtime/testing";
import { cardSlot } from "../menu/selectionDrag";
import { cpuSettingsBox } from "./ruleButtons";
import { CPU_SETTINGS_DONE, CPU_SETTINGS_PANEL, CPU_SETTINGS_PREVIEW, CPU_SETTINGS_PROMPT, CPU_SETTINGS_ROWS } from "./cpuSettingsLayout";

test("CPU settings hit targets never overlap card chip drag targets, including every edge", () => {
  for (let slot = 0; slot < 4; slot++) {
    const box = cpuSettingsBox(slot);
    for (const x of [box.x, box.x + box.width / 2, box.x + box.width]) for (const y of [box.y, box.y - box.height / 2, box.y - box.height]) {
      assertTrue(cardSlot(x, y, 15) === undefined);
    }
  }
});

test("CPU panel controls and copy stay separated and inside the 4:3 safe area on widescreen", () => {
  const panel = CPU_SETTINGS_PANEL;
  for (const aspect of [4.0 / 3.0, 16.0 / 10.0, 16.0 / 9.0, 21.0 / 9.0]) {
    const screenLeft = f32(0.4) - aspect * f32(0.6) / 2;
    const screenRight = f32(0.4) + aspect * f32(0.6) / 2;
    assertTrue(panel.left > screenLeft && panel.left + panel.width < screenRight);
    for (const box of [CPU_SETTINGS_PREVIEW, CPU_SETTINGS_DONE, CPU_SETTINGS_PROMPT]) {
      assertTrue(box.left >= panel.left && box.left + box.width <= panel.left + panel.width);
      assertTrue(box.top <= panel.top && box.top - box.height >= panel.top - panel.height);
    }
  }
  assertTrue(CPU_SETTINGS_ROWS[0] - 0.027000000700354576 > CPU_SETTINGS_ROWS[1]);
  assertTrue(CPU_SETTINGS_ROWS[1] - 0.027000000700354576 > CPU_SETTINGS_PREVIEW.top);
  assertTrue(CPU_SETTINGS_PREVIEW.top - CPU_SETTINGS_PREVIEW.height > CPU_SETTINGS_DONE.top);
  assertTrue(CPU_SETTINGS_DONE.top - CPU_SETTINGS_DONE.height > CPU_SETTINGS_PROMPT.top);
});
