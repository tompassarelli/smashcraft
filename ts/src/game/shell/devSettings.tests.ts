import { assertEquals, test } from "../../runtime/testing";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { type DevSettings, applyDevCommand } from "./devSettings";

const settings = (): DevSettings => ({ rollback: 24, delay: 0, batch: 2 });

test("dev commands set the next match's window, delay and batch", () => {
  const dev = settings();
  assertEquals(applyDevCommand(dev, "-dev rb 12"), "dev: next match rb=12 delay=0 batch=2");
  assertEquals(applyDevCommand(dev, "-dev delay 2"), "dev: next match rb=12 delay=2 batch=2");
  assertEquals(applyDevCommand(dev, "-dev batch 1"), "dev: next match rb=12 delay=2 batch=1");
  assertEquals(applyDevCommand(dev, "-dev show"), "dev: next match rb=12 delay=2 batch=1");
  assertEquals(dev.rollback, 12);
  assertEquals(dev.delay, 2);
  assertEquals(dev.batch, 1);
});

test("dev commands reject values the schedule cannot start", () => {
  const dev = settings();
  const rollbackRange = `dev: rb must be 1-${REPLAY_MAX_CORRECTION_FRAMES}`;
  assertEquals(applyDevCommand(dev, "-dev rb 0"), rollbackRange);
  assertEquals(applyDevCommand(dev, `-dev rb ${REPLAY_MAX_CORRECTION_FRAMES + 1}`), rollbackRange);
  assertEquals(applyDevCommand(dev, "-dev rb 64x"), rollbackRange);
  assertEquals(applyDevCommand(dev, "-dev delay 4"), "dev: delay must be 0, 1, 2, 3 or 5");
  assertEquals(applyDevCommand(dev, "-dev batch 3"), "dev: batch must be 1 or 2");
  assertEquals(applyDevCommand(dev, "-dev nothing"), undefined);
  assertEquals(applyDevCommand(dev, "hello -dev rb 64"), undefined);
  assertEquals(dev.rollback, 24);
  assertEquals(dev.delay, 0);
  assertEquals(dev.batch, 2);
});
