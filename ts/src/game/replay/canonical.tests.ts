import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { attackBuffer, queueAttack } from "../input/attackBuffer";
import type { FrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput } from "../match/frameInput";
import { neutralControls } from "../sim/roster";
import { beginStateChecksum, canonicalBoolean, canonicalChecksum, canonicalInt, canonicalReal, canonicalRealField, canonicalState, fighterMovesCanonical, foldStateChecksum, kitDigestBuildCount, observedOpponentKitCanonical, stateChecksum, writeCanonicalNumber } from "./canonical";
import { createFighter } from "../sim/fighter";
import { AttackStyle, Character } from "../sim/codes";
import { RIFLEMAN_MOVES } from "../sim/originalMoves";
import { captureTape, createTapeWorld, executeTapeRow } from "./tapeWorld";

test("canonical real fields retain Wurst's exact binary representation [reference]", () => {
  assertEquals(canonicalReal(Number.NaN), "nan");
  assertEquals(canonicalReal(Number.POSITIVE_INFINITY), "+inf");
  assertEquals(canonicalReal(Number.NEGATIVE_INFINITY), "-inf");
  assertEquals(canonicalReal(-0), "0");
  assertEquals(canonicalReal(1), "+0:0:0");
  assertEquals(canonicalReal(-1), "-0:0:0");
  assertEquals(canonicalReal(0.5), "+-1:0:0");
  assertEquals(canonicalReal(1.5), "+0:33554432:0");
  assertEquals(canonicalRealField("speed", -1), "|speed=-0:0:0");
});

test("canonical fragments and checksums match Wurst's ASCII tape form [reference]", () => {
  assertEquals(canonicalInt("frame", 17), "|frame=17");
  assertEquals(canonicalBoolean("ready", true), "|ready=1");
  assertEquals(canonicalBoolean("ready", false), "|ready=0");
  assertEquals(canonicalChecksum("A"), "66:66");
  assertEquals(canonicalChecksum("|x=1"), "825651:309834");
  assertEquals(canonicalChecksum("non-ascii: é"), "invalid-ascii");
  assertEquals(canonicalChecksum("line\nbreak"), "invalid-ascii");
});

test("relinked immutable kit copies reuse digests and edited kits keep canonical checksums [repro #312]", () => {
  const fighter = createFighter(Character.rifleman, 0, 1);
  fighter.tuning.moves = { ...RIFLEMAN_MOVES };
  const original = observedOpponentKitCanonical(fighter);
  const built = kitDigestBuildCount();
  fighter.tuning.moves = { ...RIFLEMAN_MOVES };
  assertEquals(observedOpponentKitCanonical(fighter), original);
  assertEquals(kitDigestBuildCount(), built);
  fighter.tuning.moves = { ...RIFLEMAN_MOVES, dashAttack: AttackStyle.jab };
  const changed = observedOpponentKitCanonical(fighter);
  assertTrue(changed !== original);
  assertEquals(changed, `|moves.digest=${canonicalChecksum(fighterMovesCanonical(fighter.tuning.moves))}`);
  assertEquals(kitDigestBuildCount(), built + 1);
});

test("canonical integers print as Wurst's I2S whichever Lua number type holds them [reference]", () => {
  assertEquals(canonicalInt("facing", 4.0 / 2.0), "|facing=2");
  assertEquals(canonicalInt("facing", -0), "|facing=0");
  assertEquals(canonicalInt("frame", 2147483647), "|frame=2147483647");
  assertEquals(canonicalInt("frame", -2147483648), "|frame=-2147483648");
});

test("streamed numbers preserve canonical bytes at decimal boundaries and signed integer endpoints [invariant]", () => {
  for (const value of [0, -0, 1, -1, 9, -9, 10, -10, 99, -99, 100, -100,
    999, -999, 1000, -1000, 2147483647, -2147483648, 0.5, -0.5, 1.5, -1.5]) {
    const bytes: string[] = [];
    writeCanonicalNumber(code => { bytes.push(String.fromCharCode(code)); }, value);
    assertEquals(bytes.join(""), canonicalInt("", value).slice(2));
  }
});

test("a played state's checksum folds exactly its canonical text, in which every value is an integer or exact real [invariant]", () => {
  const tape = createTapeWorld({ stocks: 3 });
  const requests = attackBuffer(0);
  const controls: FrameControls = { inputs: [neutralControls(), neutralControls(), neutralControls(), neutralControls()], commands: [requests, attackBuffer(0), attackBuffer(0), attackBuffer(0)] };
  const row = createMatchFrameInput();
  for (let frame = 1; frame <= 40; frame++) {
    if (frame === 1) queueAttack(requests, { style: 1, facing: 1, frame, mayCharge: false });
    controls.inputs[1].direction = frame > 20 ? -1 : 0;
    assertTrue(captureFrame(row, frame, 3, controls, tape.live.runtime));
    assertTrue(executeTapeRow(tape, row));
  }
  const snapshot = captureTape(tape);
  const text = canonicalState(snapshot);
  assertEquals(stateChecksum(snapshot), canonicalChecksum(text));
  // The input trace folds the captured text a slice a callback (#48).
  const fold = beginStateChecksum(snapshot);
  let slices = 1;
  let folded = foldStateChecksum(fold, 1000);
  for (; folded === undefined; slices++) folded = foldStateChecksum(fold, 1000);
  assertEquals(folded, stateChecksum(snapshot));
  assertTrue(slices > 1);
  let fields = 0;
  for (const field of text.split("|")) {
    const value = field.split("=")[1];
    if (value === undefined) continue;
    fields++;
    assertEquals(value.includes(".") || value.includes("e"), false, field);
  }
  assertTrue(fields > 800);
});
