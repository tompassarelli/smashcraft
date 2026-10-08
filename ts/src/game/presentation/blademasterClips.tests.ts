import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { BLADEMASTER_AUTHORED_CLIPS, BLADEMASTER_AUTHORED_CLIP_NAMES } from "./blademasterClipInfo";
import { characterClips, clipFor } from "./fighterClips";

test("Blademaster normal clips are named, separate gestures and only up B plays the whirlwind [spec #236]", () => {
  const used: number[] = [];
  for (const pose of Object.keys(BLADEMASTER_AUTHORED_CLIPS) as (keyof typeof BLADEMASTER_AUTHORED_CLIPS)[]) {
    const clip = clipFor(Character.blademaster, pose);
    assertEquals(clip.index, BLADEMASTER_AUTHORED_CLIPS[pose].index);
    assertEquals(originalClipNamed(Character.blademaster, BLADEMASTER_AUTHORED_CLIP_NAMES[pose].toLowerCase()), clip.index);
    assertTrue(!used.includes(clip.index));
    used.push(clip.index);
  }
  assertEquals(clipFor(Character.blademaster, "upSpecial").index, 13);
  assertEquals(clipFor(Character.blademaster, "upSpecialAir").index, 13);
  for (const [pose, clip] of Object.entries(characterClips(Character.blademaster))) {
    if (clip?.index === 13) assertTrue(pose === "upSpecial" || pose === "upSpecialAir");
  }
});
