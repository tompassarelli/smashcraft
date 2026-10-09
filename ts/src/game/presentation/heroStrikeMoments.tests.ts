


import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, AttackStyle } from "../sim/codes";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { FRAME_SECONDS, strikeAlignedRate } from "./fighterPose";
import { attackPose, clipFor, ownAttackClip } from "./fighterClips";
import { HERO_STRIKE_MOMENTS } from "./heroStrikeMomentInfo";
import { SPECIAL_KEY } from "./heroStrikeMomentKeys";
import { SPECIAL_SLOTS } from "./projectileArt";
import { heroCueWindows } from "./specialCues";

test("a measured hero swing reaches its strike on the first active frame [native]", () => {
  let aligned = 0;
  for (const hero of HERO_ROSTER) {
    for (const style of Object.values(AttackStyle)) {
      const move = hero.moves.normals[style];
      const moment = HERO_STRIKE_MOMENTS[hero.character]?.[style];
      const pose = attackPose(style);
      const clip = ownAttackClip(hero.character, style) ?? (pose === undefined ? undefined : clipFor(hero.character, pose));
      if (move === undefined || moment === undefined || clip === undefined) continue;
      const rate = strikeAlignedRate(hero.character, style, clip, move.startupFrames, move.activeFrames, move.totalFrames, AttackPhase.startup);
      if (rate === undefined) continue;
      const atFirstActive = f32(rate * f32(move.startupFrames * FRAME_SECONDS));

      if (rate > f32(0.36) && rate < f32(3.99)) {
        assertTrue(Math.abs(atFirstActive - moment.seconds) < f32(0.002));
        aligned++;
      }
      const after = strikeAlignedRate(hero.character, style, clip, move.startupFrames, move.activeFrames, move.totalFrames, AttackPhase.recovery);
      assertTrue(after !== undefined && after >= 0.0);
    }
  }
  assertTrue(aligned >= 60);
});

test("every measured hero special strikes on its first active frame [native]", () => {
  let aligned = 0;
  for (const hero of HERO_ROSTER) {
    const specials = hero.specials;
    if (specials === undefined) continue;
    SPECIAL_SLOTS.forEach((slot, index) => {
      const moment = HERO_STRIKE_MOMENTS[hero.character]?.[SPECIAL_KEY + index];
      if (moment === undefined) return;
      const move = specials[slot].ground;
      const { active } = heroCueWindows(move, 1);
      const startup = active.first - 1;
      const rate = strikeAlignedRate(hero.character, SPECIAL_KEY + index, clipFor(hero.character, `${slot}Special`), startup, active.last - active.first + 1, move.endFrame, AttackPhase.startup);
      if (rate === undefined || rate <= f32(0.36) || rate >= f32(3.99)) return;
      assertTrue(Math.abs(f32(rate * f32(startup * FRAME_SECONDS)) - moment.seconds) < f32(0.002));
      aligned++;
    });
  }
  assertTrue(aligned >= 10);
});
