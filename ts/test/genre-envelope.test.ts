import { expect, test } from "bun:test";
import { AttackStyle } from "../src/game/sim/codes";
import { type Envelope, FIELDS, MOVE_CLASSES, type Tolerances, allowance, classify, outliers } from "../scripts/genreEnvelope";

const random = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const TOLERANCES: Tolerances = { frames: 3, shieldAdvantage: 3, killPercentShare: 0.15, special: { frames: 10, shieldAdvantage: 10, killPercentShare: 0.3 }, ex: { frames: 15, shieldAdvantage: 15, killPercentShare: 0.4 } };

test("the classifier puts every attack style, special path and universal option in exactly one class, EX only on an ex segment [k2 property]", () => {
  const next = random(426);
  for (const name of Object.keys(AttackStyle)) expect(classify(`normal.${name}`)?.moveClass).toBeDefined();
  for (const name of MOVE_CLASSES.filter((moveClass) => ["spot-dodge", "roll", "shield-drop", "jump-squat"].includes(moveClass))) expect(classify(name)?.moveClass).toBe(name);
  const parts = ["air", "ground", "ex", "followUps", "0", "special", "form", "true", "false"];
  for (let trial = 0; trial < 500; trial++) {
    const path = Array.from({ length: 1 + Math.floor(next() * 5) }, () => parts[Math.floor(next() * parts.length)] ?? "air");
    const kind = classify(["special", ["neutral", "side", "up", "down"][trial % 4], ...path].join("."));
    expect(kind?.moveClass).toBe("special");
    expect(kind?.tier === "ex").toBe(path.includes("ex") || path.includes("true"));
    expect(classify(`unknown${trial}.${path.join(".")}`)).toBeUndefined();
  }
});

test("a move is an outlier exactly when one field leaves its class range by more than its tier's allowance, at distance above 1 [k2 property]", () => {
  const next = random(355);
  for (let trial = 0; trial < 400; trial++) {
    const low = Math.round(next() * 40) - 20, high = low + Math.round(next() * 30);
    const envelope: Envelope = { tilt: Object.fromEntries(FIELDS.map((field) => [field, { low, high }])) };
    const field = FIELDS[Math.floor(next() * FIELDS.length)] ?? "startup";
    const value = low - 20 + Math.round(next() * (high - low + 40));
    const special = trial % 2 === 0;
    const move = special ? "special.side.ground" : "normal.forwardTilt";
    const env: Envelope = special ? { special: envelope.tilt ?? {} } : envelope;
    const found = outliers([{ fighter: "f", move, measures: { [field]: value } }], env, TOLERANCES);
    const excess = Math.max(low - value, value - high, 0);
    const expected = excess > allowance(field, { low, high }, special ? "special" : "normal", TOLERANCES);
    expect(found.length).toBe(expected ? 1 : 0);
    if (expected) expect(found[0]?.distance ?? 0).toBeGreaterThan(1);
  }
});
