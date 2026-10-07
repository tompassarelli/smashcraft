import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { BLADEMASTER_SPECIALS } from "../sim/heroes/blademasterSpecials";
import { HERO_REFERENCE_HEIGHT } from "../sim/heroMoves";
import { f32 } from "wisp/src/sim/f32";
import { originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { BLADEMASTER_AUTHORED_CLIPS, BLADEMASTER_AUTHORED_CLIP_NAMES } from "./blademasterClipInfo";
import { characterClips, clipFor } from "./fighterClips";

test("Blademaster normal clips are named, separate gestures and only up B plays the whirlwind", () => {
  const used: number[] = [];
  for (const pose of Object.keys(BLADEMASTER_AUTHORED_CLIPS) as (keyof typeof BLADEMASTER_AUTHORED_CLIPS)[]) {
    const clip = clipFor(Character.blademaster, pose);
    assertEquals(clip.index, BLADEMASTER_AUTHORED_CLIPS[pose].index);
    assertEquals(originalClipNamed(Character.blademaster, BLADEMASTER_AUTHORED_CLIP_NAMES[pose].toLowerCase()), clip.index);
    assertTrue(!used.includes(clip.index));
    used.push(clip.index);
  }
  assertEquals(clipFor(Character.blademaster, "downAir").index, 54);
  assertEquals(clipFor(Character.blademaster, "doubleJump").index, 55);
  assertEquals(clipFor(Character.blademaster, "upSpecial").index, 13);
  assertEquals(clipFor(Character.blademaster, "upSpecialAir").index, 13);
  for (const [pose, clip] of Object.entries(characterClips(Character.blademaster))) {
    if (clip?.index === 13) assertTrue(pose === "upSpecial" || pose === "upSpecialAir");
  }
});

test("Rising Whirlwind keeps the charged ascent, six active hit frames and mana-free recovery", () => {
  const up = BLADEMASTER_SPECIALS.up;
  assertEquals(up.name, "Rising Whirlwind");
  assertEquals(up.ground.cost, 15);
  assertEquals(up.ground.endFrame, 24);
  assertEquals(up.ground.regions?.length, 6);
  assertEquals(up.ground.regions?.[0]?.firstFrame, 8);
  assertEquals(up.ground.regions?.[5]?.lastFrame, 13);
  assertEquals(up.ground.aimFrames, 8);
  const ascent = up.ground.motion?.[1];
  assertEquals(ascent?.first, 9);
  assertEquals(ascent?.last, 22);
  assertTrue(ascent !== undefined && Math.abs(f32(ascent.velocityZ * 14) - HERO_REFERENCE_HEIGHT * f32(2.8)) < f32(0.01));
  assertEquals(up.ground.helpless, true);
  assertEquals(up.free?.cost, 0);
  assertEquals(up.free?.regions, undefined);
  assertEquals(up.free?.endFrame, 24);
});
