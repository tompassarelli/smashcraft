import { expect, test } from "bun:test";
import { belowLead, platformAdvantages } from "./platformAdvantage";

test("on a platform stage the fighter below strikes before the one standing on the platform, for every selectable pair", () => {
  const rows = platformAdvantages();
  expect(rows.filter((row) => row.belowFirst === undefined || belowLead(row) <= 0)).toEqual([]);
});
