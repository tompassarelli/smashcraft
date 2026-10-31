import { Character } from "../../ts/src/game/sim/codes";
import { authorBowRigClips, ClipBook, phase, type Gesture } from "./bow-rig-clips";

const book = new ClipBook();
const LEAN_JAB = 8, LEAN_TILT = 16;
book.strike("jab", 18, 3, 4, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -62, elbow: -12, chest: 18, knee: 8, yaw: 15, lean: LEAN_JAB });
book.strike("jab2", 20, 4, 5, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -66, elbow: -14, chest: 20, twist: 10, knee: 10, yaw: 30, lean: LEAN_JAB });
book.strike("jab3", 24, 5, 6, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18 }, { bow: -58, elbow: -16, chest: 20, twist: 18, knee: 10 });
book.strike("forwardTilt", 31, 8, 10, { bow: 85, grip: 75, elbow: 30, chest: -25, twist: -18, knee: -40 }, { bow: -60, wrist: -90, elbow: 0, chest: 26, twist: 28, knee: 22, yaw: 10, lean: LEAN_TILT });
book.strike("forwardTiltUp", 31, 8, 10, { bow: 60, grip: 70, elbow: 25, chest: -18, yaw: -60 }, { bow: -85, elbow: -18, chest: 14, grip: 30, knee: 12, yaw: 25 });
book.strike("forwardTiltDown", 31, 8, 10, { bow: 70, grip: 70, elbow: 25, chest: -18, knee: -20, yaw: -60 }, { bow: -28, elbow: 18, chest: 55, knee: 50, tuck: 0.18 });
book.strike("upTilt", 30, 7, 10, { bow: 28, chest: 20, knee: 18 }, { bow: -160, elbow: -20, chest: -22, grip: -25, knee: 6 });
book.strike("downTilt", 27, 6, 8, { bow: 75, grip: 70, elbow: 20, chest: -15, yaw: 90 }, { bow: -28, elbow: 18, chest: 55, knee: 50, tuck: 0.18 });
book.strike("dashAttack", 35, 9, 11, { bow: 70, grip: 70, elbow: 25, chest: -25, yaw: -60 }, { bow: -30, wrist: -90, elbow: 0, chest: 30, lean: LEAN_TILT + 6, knee: 28, yaw: 35 });
book.strike("forwardSmash", 49, 16, 18, { bow: 35, grip: -105, chest: -28, twist: -32, knee: 20 }, { bow: -30, grip: 35, elbow: 0, wrist: -90, chest: 25, twist: 34, knee: 16 }, { bow: -72, chest: 14, knee: 12 });
book.strike("upSmash", 47, 14, 17, { bow: 20, chest: 30, knee: 38 }, { bow: -180, grip: -135, elbow: -18, chest: -26, knee: 0 });
book.add("downSmash", 47, [phase(0), phase(10, { bow: -130, knee: 30, chest: -18 }), phase(13, { bow: -15, chest: 42, knee: 40 }), phase(15, { bow: -15, chest: 42, knee: 40 }), phase(16, { bow: -15, yaw: 180, chest: 42, knee: 40 }), phase(18, { bow: -15, yaw: 180, chest: 42, knee: 40 }), phase(34, { yaw: 300 }), phase(47, { yaw: 360 })]);
book.add("neutralAir", 28, [phase(0), phase(3, { bow: 35, grip: -30, twist: -35, knee: 30 }), phase(5, { bow: -65, yaw: 0, chest: 15, knee: 24 }), phase(8, { bow: -65, yaw: 180, chest: 15, knee: 30 }), phase(15, { yaw: 300, knee: 20 }), phase(28, { yaw: 360 })], { air: true });
book.strike("forwardAir", 35, 9, 11, { bow: 40, chest: -20, knee: 25 }, { bow: -80, elbow: -20, chest: 25, twist: 20, knee: 32 }, { chest: 12, bow: -65 }, true);
book.strike("backAir", 32, 7, 9, { bow: -35, chest: 22 }, { bow: -85, chest: -15, yaw: 180, knee: 32 }, { yaw: 180 }, true);
book.strike("upAir", 31, 7, 10, { bow: -25, chest: 20, knee: 36 }, { bow: -165, elbow: -18, chest: -24, knee: 10 }, {}, true);
book.add("downAir", 43, [phase(0), phase(8, { bow: -155, grip: -110, chest: -20, knee: 45 }), phase(11, { bow: -150, grip: -110, chest: -12, roll: 180, knee: 15 }), phase(14, { bow: -150, grip: -110, chest: -12, roll: 180, knee: 15 }), phase(26, { bow: -90, chest: 12, roll: 270, knee: 30 }), phase(43, { roll: 360 })], { air: true });
book.strike("neutralSpecial", 40, 15, 17, { grip: -110, bow: -40, chest: -12, twist: -25, knee: 12 }, { grip: 30, bow: -65, chest: 10, twist: 20, knee: 8 });
book.strike("sideSpecial", 48, 17, 19, { bow: 30, grip: 25, chest: -18, twist: -20 }, { bow: 25, grip: -105, chest: 25, twist: 22, knee: 20 });
book.add("upSpecial", 31, [phase(0), phase(6, { chest: 25, knee: 55, bow: 20, tuck: 0.15 }), phase(7, { chest: -18, bow: -125, grip: -130, knee: 0 }), phase(20, { chest: -24, bow: -155, grip: -155, knee: 28 }), phase(31, { chest: 10, knee: 35, bow: -65 })], { air: true });
book.add("downSpecial", 52, [phase(0), phase(12, { bow: 20, grip: 25, chest: -18, knee: 20 }), phase(15, { bow: 30, grip: -100, chest: 20, knee: 25 }), phase(30, { bow: 25, grip: -90, chest: 14, knee: 20 }), phase(31, { bow: 20, grip: -35, chest: -20, twist: -24 }), phase(52)]);

book.movement();
book.grabs();
book.pain();

await authorBowRigClips({
  character: Character.sylvanas, label: "Sylvanas", script: "sylvanas-clips.ts", stockSequences: 11, standIndex: 9,
  modelPath: "Units\\Undead\\EvilSylvanas\\EvilSylvanas.mdl", shippedModel: "hero-models/evilsylvanas.mdx",
  clipModule: "ts/src/game/fighters/sylvanas/clips.ts", constant: "SYLVANAS", evidence: "sylvanas-clips.json",
  stockClips: [
    "export const SYLVANAS_FALLBACK_CLIP: HeroClip = { index: 9, seconds: f32(1.134) };", "export const SYLVANAS_CLIPS = {",
    "  idle: SYLVANAS_FALLBACK_CLIP,", "  walk: { index: 8, seconds: f32(0.834) },", "  dash: { index: 8, seconds: f32(0.834) },", "  run: { index: 8, seconds: f32(0.834) },",
    "  ko: { index: 10, seconds: 2.0 },", "  dizzy: { index: 3, seconds: f32(3.7) },",
  ],
}, book.actions, {doubleJump:"jump",wallJump:"jump",wallTech:"tech",fallSpecial:"fall",downDamage:"knockdown",damageTumble:"knockdown",damageGround:"pain11",damageAir:"pain11",damageShield:"stop",smashCharge:"shield",neutralSpecialAir:"neutralSpecial",sideSpecialAir:"sideSpecial",upSpecialAir:"upSpecial",downSpecialAir:"downSpecial"});
