import { expect, test } from "bun:test";
import { staleDocuments } from "./meleeCaseStudy";

test("the Melee case study's numbers are the ones its script computes from the reference data", async () => {
  expect(await staleDocuments()).toEqual([]);
});
