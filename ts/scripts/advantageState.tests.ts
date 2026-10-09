import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Character, DownState } from "../src/game/sim/codes";
import { Explorer, OPENERS, Sim, TECH_OPTIONS, defenderMask, expand, landingSetup, openerRoot } from "./comboExplorer";
import { TARGETS, techChase, throwCell, type AdvantageRow } from "./advantageState";

const DOWN_THROW = OPENERS.find((opener) => opener.name === "down throw");

test("the explorer's tech in and tech away defenders roll on landing instead of teching in place [repro #388]", () => {
  if (DOWN_THROW === undefined) throw new Error("no down throw opener");
  const setup = landingSetup(Character.rifleman, Character.rifleman, DOWN_THROW, 0, "centre");
  if (setup === undefined) throw new Error("Rifleman's down throw does not land");
  const played = openerRoot(setup, DOWN_THROW, { name: "none", di: "none" });
  if (played === undefined) throw new Error("Rifleman's down throw does not land");
  const { best } = new Explorer(played.sim).search(played.root, { name: "none", di: "none" }, 0);
  const held = expand(best.route.held);
  const landing = held.attacker.length + 1;
  const from = landing - 3;
  const floor = TECH_OPTIONS.map((option) => {
    const sim = new Sim(setup);
    const defender = { name: option, di: "none" as const, tech: { option, landing: landing - from } };
    let state: DownState = DownState.none;
    for (let n = 0; n < landing + 4; n++) {
      sim.step(held.attacker[n] ?? 0, n < from ? held.defender[n] ?? 0 : defenderMask(defender, n - from + 1, undefined, sim.b, sim.a));
      if (state === DownState.none && sim.b.motion.grounded && sim.b.down.state !== DownState.tumble) state = sim.b.down.state;
    }
    return state;
  });
  expect(floor).toEqual([DownState.tech, DownState.techRoll, DownState.techRoll, DownState.bound]);
});

test("Pit Lord's down throw knocks the heavy target down under every DI at 0% and a read covers each tech option, one of them a tech trap [spec #388]", () => {
  if (DOWN_THROW === undefined) throw new Error("no down throw opener");
  const target = TARGETS[2].character;
  const cell = throwCell(Character.pitLord, target, DOWN_THROW, 0);
  expect(cell.knockdown).toBe(true);
  const chase = techChase(Character.pitLord, target, [cell]);
  expect(chase?.opener).toBe("down throw");
  expect(chase?.covered.every(({ read }) => read !== undefined)).toBe(true);
  expect(chase?.trap?.options.length ?? 0).toBeGreaterThanOrEqual(2);
});

const rows = (): AdvantageRow[] => readFileSync(join(import.meta.dir, "../../tools/move-data/advantage-state.jsonl"), "utf8").split("\n").filter((line) => line !== "").map((line) => JSON.parse(line));

test("all 78 fighter and target rows meet every advantage-state target [spec #388]", () => {
  const all = rows();
  expect(all).toHaveLength(78);
  expect(all.filter((row) => Object.values(row.targets).some((met) => !met)).map((row) => `${row.fighter} ${row.target}`)).toEqual([]);
});

test("no throw is a true zero-to-death: none takes a stock below 60%, strings stay within two follow-ups and 30% against the escape-optimal DI, and every fighter's tech chase ends in a read [spec #388]", () => {
  const all = rows();
  expect(all.flatMap((row) => row.zeroToDeath.map((problem) => `${row.fighter} ${row.target}: ${problem}`))).toEqual([]);
  const cells = all.flatMap((row) => row.throws.map((cell) => ({ row, cell })));
  expect(cells.filter(({ cell }) => cell.ko && cell.percent < 60).map(({ row, cell }) => `${row.fighter} ${row.target} ${cell.opener} at ${cell.percent}%`)).toEqual([]);
  expect(Math.max(...cells.map(({ cell }) => cell.withDi))).toBeLessThanOrEqual(2);
  expect(Math.max(...cells.filter(({ cell }) => !cell.ko).map(({ cell }) => cell.withDiDamage))).toBeLessThanOrEqual(30);
  expect(all.filter((row) => row.techChase === undefined || row.techChase.covered.some(({ read }) => read === undefined)).map((row) => `${row.fighter} ${row.target}`)).toEqual([]);
});
