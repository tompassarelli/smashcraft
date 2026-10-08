// Each signature normal shows its effect on every hit it lands, restarting per
// hit, and nothing outside its active frames.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { EYE_BLAST_CHARGE_FRAMES, attackStartupFrames } from "../sim/moves";
import { ATTACK_CUES, EYE_BLAST_CHARGE_CUE, type AttackCueState, attackCueState } from "./attackCues";

const STYLES = Object.values(AttackStyle);

test("every signature normal shows its cue on its hits and none before them [spec #152]", () => {
  const out: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  for (const key of Object.keys(ATTACK_CUES)) {
    const character = Number(key);
    const styles = ATTACK_CUES[character] ?? {};
    for (const style of STYLES) {
      const cues = styles[style];
      if (cues === undefined) continue;
      const f = createFighter(Object.values(Character).find((c) => c === character) ?? Character.archer, 0.0, 1);
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
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  illidan.attack.style = AttackStyle.forwardSmash;
  illidan.attack.smashCharging = true;
  illidan.attack.smashChargeFrames = EYE_BLAST_CHARGE_FRAMES;
  assertTrue(attackCueState(illidan, out).cue === EYE_BLAST_CHARGE_CUE);
});
