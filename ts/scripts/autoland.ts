import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { judge, plan, train, type Lane, type Run, type Status } from "./autolandCore";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isStatus = (value: unknown): value is Status => isRecord(value) && typeof value.state === "string" && typeof value.description === "string" && typeof value.at === "string";
const isLane = (value: unknown): value is Lane => isRecord(value) && typeof value.branch === "string" && typeof value.tip === "string" && (value.status === null || isStatus(value.status));
const isRun = (value: unknown): value is Run => isRecord(value) && typeof value.title === "string" && typeof value.status === "string";

function readList<T>(file: string | undefined, is: (value: unknown) => value is T): T[] {
  if (file === undefined) return [];
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(value) || !value.every(is)) throw new Error(`${file}: expected a list of ${is.name.slice(2).toLowerCase()} records`);
  return value;
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { lanes: { type: "string" }, runs: { type: "string" }, retry: { type: "string" }, count: { type: "string" }, green: { type: "string" } },
  });
  const command = positionals[0];
  if (command === "plan") {
    const result = plan(readList(values.lanes, isLane), readList(values.runs, isRun), (values.retry ?? "").split(/\s+/).filter(Boolean));
    for (const order of result.test) console.log(["test", order.branch, order.tip, order.slot].join("\t"));
    if (result.train) console.log("train");
  } else if (command === "train") {
    for (const lane of train(readList(values.lanes, isLane))) console.log([lane.branch, lane.tip, lane.base, lane.tree].join("\t"));
  } else if (command === "judge") {
    console.log(judge(Number(values.count), values.green === "true"));
  } else {
    console.error("usage: autoland.ts plan --lanes FILE --runs FILE [--retry BRANCHES] | train --lanes FILE | judge --count N --green true|false");
    process.exit(2);
  }
}
