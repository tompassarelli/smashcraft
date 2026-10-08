import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, HippogryphKind, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { ARCHER_RIDE_HOVER_FRAMES, ARCHER_RIDE_MAX_X } from "../sim/specials";
import { archerMounted, createHippogryphPresentationState, projectHippogryph, HIPPOGRYPH_MODEL, HIPPOGRYPH_RIDER_MODEL } from "./hippogryphPose";

test("hippogryph ride draws only the mounted stock rider, flying then walking and banking in both facings [spec #232]", () => {
  for (const facing of [-1, 1]) {
    const f = createFighter(Character.archer, 100.0, facing);
    const state = createHippogryphPresentationState();
    f.special.action = SpecialAction.archerRecovery;
    f.hippogryph.kind = HippogryphKind.mount;
    f.hippogryph.life = 40;
    f.hippogryph.x = 100.0;
    f.hippogryph.z = 230.0;
    f.special.frame = 1;
    let pose = projectHippogryph(state, f, 61);
    assertTrue(archerMounted(f));
    assertTrue(pose.visible && pose.mounted);
    assertEquals(pose.model, HIPPOGRYPH_RIDER_MODEL);
    assertEquals(pose.clip, "Stand");
    assertEquals(pose.facing, facing);
    f.special.frame = ARCHER_RIDE_HOVER_FRAMES;
    f.hippogryph.velocityX = f32(facing * ARCHER_RIDE_MAX_X);
    pose = projectHippogryph(state, f, 65);
    assertEquals(pose.clip, "Walk");
    assertTrue(pose.pitch < 0.0);
    assertTrue(f32(pose.roll * facing) > 0.0);
    assertEquals(pose.x, f.hippogryph.x);
  }
});

test("hippogryph jump-off restores Archer and keeps the attacking bird at the mount's position [spec #232]", () => {
  const f = createFighter(Character.archer, 100.0, 1);
  const state = createHippogryphPresentationState();
  f.special.action = SpecialAction.archerRecovery;
  f.hippogryph.kind = HippogryphKind.mount;
  f.hippogryph.life = 20;
  f.hippogryph.z = 230.0;
  const before = projectHippogryph(state, f, 80).z;
  f.special.action = SpecialAction.none;
  f.hippogryph.kind = HippogryphKind.released;
  const after = projectHippogryph(state, f, 81);
  assertTrue(!archerMounted(f));
  assertTrue(after.visible && !after.mounted);
  assertEquals(after.model, HIPPOGRYPH_MODEL);
  assertEquals(after.clip, "Attack");
  assertEquals(after.z, before);
});

test("a hit separates the rider without reviving the simulation bird or leaving a mounted body [spec #232]", () => {
  const f = createFighter(Character.archer, 100.0, -1);
  const state = createHippogryphPresentationState();
  f.special.action = SpecialAction.archerRecovery;
  f.hippogryph.kind = HippogryphKind.mount;
  f.hippogryph.life = 35;
  f.hippogryph.x = 100.0;
  f.hippogryph.z = 230.0;
  f.hippogryph.velocityX = -8.0;
  const before = projectHippogryph(state, f, 65).z;
  f.special.action = SpecialAction.none;
  f.hippogryph.kind = HippogryphKind.none;
  f.hippogryph.life = 0;
  const released = projectHippogryph(state, f, 66);
  assertTrue(!archerMounted(f));
  assertEquals(released.model, HIPPOGRYPH_MODEL);
  assertEquals(released.clip, "Attack");
  assertEquals(released.z, before);
  projectHippogryph(state, f, 70);
  assertTrue(state.pose.x < 100.0 && state.pose.z > before);
  assertEquals(f.hippogryph.life, 0);
  assertEquals(f.hippogryph.kind, HippogryphKind.none);
  assertTrue(!projectHippogryph(state, f, 78).visible);
});

test("hippogryph Call and Dive keep the unmounted bird [spec #232]", () => {
  const f = createFighter(Character.archer, 100.0, 1);
  const state = createHippogryphPresentationState();
  for (const kind of [HippogryphKind.strike, HippogryphKind.perch, HippogryphKind.dive]) {
    f.hippogryph.kind = kind;
    f.hippogryph.life = 20;
    const pose = projectHippogryph(state, f, 60 + kind);
    assertTrue(!archerMounted(f) && !pose.mounted);
    assertEquals(pose.model, HIPPOGRYPH_MODEL);
  }
  assertTrue(!projectHippogryph(state, undefined, 100).visible);
});
