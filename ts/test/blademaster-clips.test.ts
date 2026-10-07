import { expect, test } from "bun:test";
import { BLADEMASTER_AUTHORED_CLIPS, BLADEMASTER_AUTHORED_CLIP_NAMES } from "../src/game/presentation/blademasterClipInfo";
import { DOWN_AIR_CLIPS } from "../src/game/presentation/downAirClipInfo";
import { Character } from "../src/game/sim/codes";

test("Blademaster normals each name a distinct original sword gesture", () => {
  expect(BLADEMASTER_AUTHORED_CLIP_NAMES).toEqual({
    jab: "Sword Gesture Jab Quick Cut",
    jab2: "Sword Gesture Jab Returning Cut",
    forwardTilt: "Sword Gesture Tilt Level Cut",
    forwardTiltUp: "Sword Gesture Tilt Rising Cut",
    forwardTiltDown: "Sword Gesture Tilt Falling Cut",
    upTilt: "Sword Gesture Tilt Overhead Arc",
    downTilt: "Sword Gesture Tilt Low Poke",
    dashAttack: "Sword Gesture Dash Lunging Cut",
    forwardSmash: "Sword Gesture Smash Shoulder Cleave",
    upSmash: "Sword Gesture Smash Sky Splitter",
    downSmash: "Sword Gesture Smash Front Rear Sweep",
    neutralAir: "Sword Gesture Air Crescent Slash",
    forwardAir: "Sword Gesture Air Forward Cleave",
    backAir: "Sword Gesture Air Turning Back Cut",
    upAir: "Sword Gesture Air Upward Pierce",
    throwBack: "Sword Gesture Throw Back Heave",
  });
  const indices = Object.values(BLADEMASTER_AUTHORED_CLIPS).map(clip => clip.index);
  indices.push(DOWN_AIR_CLIPS[Character.blademaster].downAir.index);
  expect(indices).toHaveLength(17);
  expect(new Set(indices).size).toBe(indices.length);
  expect(indices).not.toContain(13);
  expect(BLADEMASTER_AUTHORED_CLIPS).not.toHaveProperty("jab3");
});
