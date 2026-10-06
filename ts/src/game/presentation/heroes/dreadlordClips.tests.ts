// Dreadlord's poses name real sequences of the classic model, and none plays
// the bodiless Dissipate.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../../sim/codes";
import { DREADLORD_HERO } from "../../sim/heroes/dreadlordHero";
import { clipFor } from "../fighterClips";
import { DREADLORD_CLIP_TABLE, DREADLORD_SEQUENCES } from "./dreadlordClips";

// Ground normals retime their sequence so its strike lands on the first active frame.
const RETIMED = new Set(["jab", "forwardTilt", "forwardTiltUp", "forwardTiltDown", "upTilt", "downTilt", "dashAttack"]);

test("every Dreadlord pose plays a classic-model sequence, at its own length unless retimed to a strike, never Dissipate", () => {
  const sequences = Object.values(DREADLORD_SEQUENCES);
  for (const [pose, clip] of Object.entries(DREADLORD_CLIP_TABLE)) {
    assertTrue(clip !== undefined && sequences.some(sequence => sequence.index === clip.index && (RETIMED.has(pose) || sequence.seconds === clip.seconds)));
    assertTrue(clip?.index !== DREADLORD_SEQUENCES.dissipate.index);
  }
  assertEquals(DREADLORD_HERO.presentation.clips, DREADLORD_CLIP_TABLE);
  assertEquals(clipFor(Character.dreadlord, "forwardTilt").index, DREADLORD_SEQUENCES.attack1.index);
  assertEquals(clipFor(Character.dreadlord, "upSpecialAir").index, DREADLORD_SEQUENCES.wingStretch.index);
});
