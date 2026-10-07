import { assertEquals, test } from "wisp/src/runtime/testing";
import { EffectMotion, SNAP_DISTANCE } from "./motion";

function recorder(): { motion: EffectMotion<string>; drawn: string[] } {
  const drawn: string[] = [];
  const n = (value: number) => `${Math.floor(value)}`;
  const motion = new EffectMotion<string>((handle, x, y, z) => void drawn.push(`${handle} ${n(x)} ${n(y)} ${n(z)}`));
  return { motion, drawn };
}

test("motion: without smoothing an effect is drawn where it is placed and draw does nothing", () => {
  const { motion, drawn } = recorder();
  motion.beginFrame();
  motion.place("a", 0.0, 0.0, 0.0);
  motion.beginFrame();
  motion.place("a", 16.0, 0.0, 8.0);
  motion.draw(0.5);
  assertEquals(drawn.join(","), ["a 0 0 0", "a 16 0 8"].join(","));
});

test("motion: smoothing draws between the last two frames, trailing by one frame", () => {
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

test("motion: newly shown, released and teleported effects are drawn where placed", () => {
  const { motion, drawn } = recorder();
  motion.tracking = true;
  motion.smoothing = true;
  motion.beginFrame();
  motion.place("a", 0.0, 0.0, 0.0);
  motion.place("b", 0.0, 0.0, 0.0);
  motion.beginFrame();
  motion.release("a");
  motion.place("a", 16.0, 0.0, 0.0);
  motion.place("b", SNAP_DISTANCE + 1.0, 0.0, 0.0);
  motion.place("c", 4.0, 0.0, 0.0);
  motion.draw(0.5);
  assertEquals(drawn.slice(2).join(","), ["a 16 0 0", `b ${Math.floor(SNAP_DISTANCE + 1.0)} 0 0`, "c 4 0 0"].join(","));
});

test("motion: an effect not placed on a frame is not drawn on it", () => {
  const { motion, drawn } = recorder();
  motion.tracking = true;
  motion.smoothing = true;
  motion.beginFrame();
  motion.place("a", 0.0, 0.0, 0.0);
  motion.beginFrame();
  motion.place("a", 16.0, 0.0, 0.0);
  motion.beginFrame();
  motion.draw(0.5);
  assertEquals(drawn.join(","), ["a 0 0 0", "a 0 0 0"].join(","));
});
