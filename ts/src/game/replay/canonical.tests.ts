import { assertEquals, test } from "../../runtime/testing";
import { canonicalBoolean, canonicalChecksum, canonicalInt, canonicalReal, canonicalRealField } from "./canonical";

test("canonical real fields retain Wurst's exact binary representation", () => {
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

test("canonical fragments and checksums match Wurst's ASCII tape form", () => {
  assertEquals(canonicalInt("frame", 17), "|frame=17");
  assertEquals(canonicalBoolean("ready", true), "|ready=1");
  assertEquals(canonicalBoolean("ready", false), "|ready=0");
  assertEquals(canonicalChecksum("A"), "66:66");
  assertEquals(canonicalChecksum("|x=1"), "825651:309834");
  assertEquals(canonicalChecksum("non-ascii: \u00e9"), "invalid-ascii");
  assertEquals(canonicalChecksum("line\nbreak"), "invalid-ascii");
});
