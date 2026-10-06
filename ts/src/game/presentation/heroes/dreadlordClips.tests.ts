// Dreadlord's poses name real sequences of the classic model, and none plays
// the bodiless Dissipate.
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../../sim/codes";
import { DREADLORD_HERO } from "../../sim/heroes/dreadlordHero";
import { clipFor } from "../fighterClips";
import { DREADLORD_CLIP_TABLE, DREADLORD_SEQUENCES } from "./dreadlordClips";

test("every Dreadlord pose plays a classic-model sequence with its own length, never Dissipate", () => {
  const sequences = Object.values(DREADLORD_SEQUENCES);
  for (const clip of Object.values(DREADLORD_CLIP_TABLE)) {
    assertTrue(clip !== undefined && sequences.some(sequence => sequence.index === clip.index && sequence.seconds === clip.seconds));
    assertTrue(clip?.index !== DREADLORD_SEQUENCES.dissipate.index);
  }
  assertEquals(DREADLORD_HERO.presentation.clips, DREADLORD_CLIP_TABLE);
  assertEquals(clipFor(Character.dreadlord, "jab").index, DREADLORD_SEQUENCES.attack1.index);
  assertEquals(clipFor(Character.dreadlord, "upSpecialAir").index, DREADLORD_SEQUENCES.wingStretch.index);
});
