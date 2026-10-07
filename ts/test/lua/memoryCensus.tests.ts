// Lua debug upvalues and native handle representations are the foreign boundary
// this census observes; Bun cannot execute its graph walk.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { reach } from "../../scripts/wisp/memoryCensus";

test("the map table census excludes opaque native identities and still counts matching domain records", () => {
  const first = { id: 1, kind: "effect" };
  const second = { id: 2, kind: "effect" };
  const retained: { value: number }[] = [];
  const state = { handles: [first], domain: { id: 3, kind: "effect" }, retained };
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("map", state);
  const baseline = reach(environment, [first], true);
  assertEquals(baseline.tables, 4);
  state.handles.push(second);
  assertEquals(reach(environment, [first, second], true).tables, baseline.tables);
  state.retained.push({ value: 4 });
  assertEquals(reach(environment, [first, second], true).tables, baseline.tables + 1);
  assertEquals(reach(environment, [first], true).tables, baseline.tables + 2);
});
