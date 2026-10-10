import { parseNativeDeclarations } from "wisp/src/headless/declarations";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { SMASHCRAFT_NOOPS, smashcraftNativeBehavior } from "./headlessNatives";
import { gameOf } from "./botMatch";
import { type HandleCounts, BASELINE_LINEUP, playHandleBaseline } from "./handleBaseline";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";

declare const arg: Readonly<Record<number, string | undefined>>;

// The Lua32 side of test/handle-baseline.test.ts: the same match and rematch, run on the compiled integrity build.
const [bundlePath, declarationsPath] = [arg[1], arg[2]];
if (bundlePath === undefined || declarationsPath === undefined) throw new Error("usage: lua handles.lua MAP_LUA WARCRAFT_D_TS");
const declarationsText = readFile(declarationsPath);
const { functions } = parseNativeDeclarations(declarationsText);
const clients = luaLockstep({ filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: smashcraftNativeBehavior }, readFile(bundlePath), declarationsText, undefined, syncDelivery(MEASURED_BATTLE_NET, 7));
const { cold, afterMatches } = playHandleBaseline(clients, functions, 2, gameOf);
const [first = [], rematch = []] = afterMatches;
const line = (counts: HandleCounts | undefined) => (counts ?? []).map(([kind, count]) => `${kind}=${count}`).join(" ");
const problems: string[] = [];
clients.clients.forEach((client, index) => {
  const p = `p${client.slot + 1}`;
  print(`${p} before: ${line(cold[index])}`);
  print(`${p} after the match: ${line(first[index])}`);
  print(`${p} after the rematch: ${line(rematch[index])}`);
  if (line(rematch[index]) !== line(first[index])) problems.push(`${p}: the rematch left ${line(rematch[index])}, the match ${line(first[index])}`);
  const units = (first[index] ?? []).find(([kind]) => kind === "unit")?.[1];
  if (units !== BASELINE_LINEUP.length) problems.push(`${p}: ${units} fighter bodies for ${BASELINE_LINEUP.length} fighters`);
  for (const error of client.errors) problems.push(`${p}: ${error}`);
});
for (const problem of problems) print(`problem ${problem}`);
print(`done problems=${problems.length}`);
if (problems.length > 0) os.exit(1);
