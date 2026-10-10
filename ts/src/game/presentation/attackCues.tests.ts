

import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { attackStartupFrames } from "../sim/moves";
import { ATTACK_CUES, type AttackCueState, attackCueState } from "./attackCues";

const STYLES = Object.values(AttackStyle);

test("every signature normal shows its cue on its hits and none before them [k3 measure #152]", () => {
  const out: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  for (const key of Object.keys(ATTACK_CUES)) {
    const character = Number(key);
    const styles = ATTACK_CUES[character] ?? {};
    for (const style of STYLES) {
      const cues = styles[style];
      if (cues === undefined) continue;
      const f = createFighter(Object.values(Character).find((c) => c === character) ?? Character.rifleman, 0.0, 1);
      f.attack.style = style;
      const startup = attackStartupFrames(style, f.tuning.moves);
      f.attack.frame = 0;
      assertEquals(attackCueState(f, out).cue, undefined);
      const keys = new Set<number>();
      let shown = 0;
      for (let frame = startup; frame < startup + 40; frame++) {
        f.attack.frame = frame;
        if (attackCueState(f, out).cue !== undefined) {
          shown++;
          keys.add(out.key);
        }
      }
      assertEquals(shown > 0, true, `fighter ${character} style ${style} shows its cue`);
      if (cues.length > 1) assertTrue(keys.size > 1);
    }
  }
});
