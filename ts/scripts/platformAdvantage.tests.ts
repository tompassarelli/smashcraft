import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { belowLead, platformAdvantages } from "./platformAdvantage";

// Positions are used, not camped (smashcraft:docs/gameplay-design.md,
// "Platforms"): across every selectable pair, the fighter below a platform
// strikes first or level with the one standing on it in at least 60% of pairs
// (measured 407 of 676 at #392's landing: 304 lead, 103 tie, 269 trail).
sweep("the fighter below a platform strikes no later than the one on it in at least 60% of selectable pairs [spec docs/gameplay-design.md]", () => {
  const rows = platformAdvantages();
  const noLater = rows.filter((row) => row.belowFirst !== undefined && belowLead(row) >= 0).length;
  expect(noLater / rows.length).toBeGreaterThanOrEqual(0.6);
}, 300_000);
