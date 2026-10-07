import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { victimHitlagFrames } from "../sim/knockback";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { DAMAGE_CLIPS } from "./damageClipInfo";
import {
  PAIN_ENTRY_BLEND_FRAMES, PAIN_EXIT_BLEND_FRAMES, isContactPainClip, outgoingPoseAlpha, painEntryBlendFrames, poseBlendFrames,
} from "./damageBlend";

test("stronger hits dissolve into their pain pose faster", () => {
  assertEquals(painEntryBlendFrames(0, 20), 3);
  assertEquals(painEntryBlendFrames(1, 20), 2);
  assertEquals(painEntryBlendFrames(2, 20), 1);
  assertEquals(painEntryBlendFrames(5, 20), 1);
  assertEquals(painEntryBlendFrames(-1, 20), 3);
  // Without hitstop there is no frozen pain pose to protect, so the old pose cuts.
  assertEquals(painEntryBlendFrames(0, 1), 0);
  assertEquals(painEntryBlendFrames(0, 0), 0);
});

test("every hitstop shows its first pain pose alone before it ends", () => {
  for (const electric of [false, true]) {
    for (const crouching of [false, true]) {
      for (let damage = 1; damage <= 60; damage++) {
        const hitlag = victimHitlagFrames(damage, electric, crouching);
        for (let strength = 0; strength < PAIN_ENTRY_BLEND_FRAMES.length; strength++) {
          const frames = painEntryBlendFrames(strength, hitlag);
          // Frame 0 is the contact frame; frame hitlag - 1 is the last frozen one.
          assertEquals(outgoingPoseAlpha(hitlag - 1, frames), 0, `damage ${damage} strength ${strength} hitlag ${hitlag}`);
          if (hitlag >= 2 && frames > 0) assertEquals(outgoingPoseAlpha(0, frames) > 0, true, `damage ${damage} starts from the previous pose`);
        }
      }
    }
  }
});

test("the previous pose fades monotonically to nothing", () => {
  for (const frames of [1, 2, 3, PAIN_EXIT_BLEND_FRAMES]) {
    let last = 256;
    for (let elapsed = 0; elapsed < frames; elapsed++) {
      const alpha = outgoingPoseAlpha(elapsed, frames);
      assertEquals(alpha > 0 && alpha < 255 && alpha < last, true, `${frames}-frame dissolve at ${elapsed}: ${alpha}`);
      last = alpha;
    }
    assertEquals(outgoingPoseAlpha(frames, frames), 0);
    // A rollback that presents an earlier frame ends the dissolve.
    assertEquals(outgoingPoseAlpha(-1, frames), 0);
  }
  assertEquals(outgoingPoseAlpha(0, 3), 191);
  assertEquals(outgoingPoseAlpha(1, 3), 127);
  assertEquals(outgoingPoseAlpha(2, 3), 63);
  assertEquals(outgoingPoseAlpha(0, 0), 0);
});

test("only entering or leaving one of the nine pain poses blends", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const row = DAMAGE_CLIPS[character];
    if (row === undefined) throw new Error(`${fighterName(character)} has no pain grid`);
    assertEquals(row.length, 9);
    const f = createFighter(character, 0.0, 1);
    f.launch.hitlag = 12;
    const pain = row[4]?.index ?? -1;
    const other = row[0]?.index ?? -1;
    let outside = 0;
    while (isContactPainClip(character, outside)) outside++;
    let outsideToo = outside + 1;
    while (isContactPainClip(character, outsideToo)) outsideToo++;
    for (const clip of row) assertEquals(isContactPainClip(character, clip.index), true, `${fighterName(character)} clip ${clip.index}`);
    for (let strength = 0; strength < 3; strength++) {
      f.visuals.hitStrength = strength;
      assertEquals(poseBlendFrames(f, outside, pain), PAIN_ENTRY_BLEND_FRAMES[strength] ?? -1);
      // A new contact interrupting another pain pose blends at the new hit's strength.
      assertEquals(poseBlendFrames(f, other, pain), PAIN_ENTRY_BLEND_FRAMES[strength] ?? -1);
    }
    assertEquals(poseBlendFrames(f, pain, outside), PAIN_EXIT_BLEND_FRAMES);
    assertEquals(poseBlendFrames(f, outside, outsideToo), 0);
    assertEquals(poseBlendFrames(f, pain, pain), 0);
  }
  assertTrue(!isContactPainClip(Character.archer, -1));
});
