import { assertEquals, test } from "wisp/src/runtime/testing";
import { EffectMotion } from "./motion";

function recorder(): { motion: EffectMotion<string>; drawn: string[] } {
  const drawn: string[] = [];
  const n = (value: number) => `${Math.floor(value)}`;
  const motion = new EffectMotion<string>((handle, x, y, z) => void drawn.push(`${handle} ${n(x)} ${n(y)} ${n(z)}`));
  return { motion, drawn };
}

test("motion: without smoothing an effect is drawn where it is placed and draw does nothing [spec #169]", () => {
  const { motion, drawn } = recorder();
  motion.beginFrame();
  motion.place("a", 0.0, 0.0, 0.0);
  motion.beginFrame();
  motion.place("a", 16.0, 0.0, 8.0);
  motion.draw(0.5);
  assertEquals(drawn.join(","), ["a 0 0 0", "a 16 0 8"].join(","));
});

test("motion: smoothing draws between the last two frames, trailing by one frame [spec #169]", () => {
  const { motion, drawn } = recorder();
  motion.tracking = true;
  motion.smoothing = true;
  motion.beginFrame();
  motion.place("a", 0.0, 0.0, 0.0);
  motion.beginFrame();
  motion.place("a", 16.0, 0.0, 8.0);
  motion.draw(0.5);
  motion.draw(1.0);
  assertEquals(drawn.join(","), ["a 0 0 0", "a 0 0 0", "a 8 0 4", "a 16 0 8"].join(","));
});

