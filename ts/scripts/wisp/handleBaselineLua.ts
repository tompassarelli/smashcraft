import { parseNativeDeclarations } from "wisp/src/headless/declarations";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { SMASHCRAFT_NOOPS } from "./headlessNatives";
import { gameOf } from "./botMatch";
import { LOOKS, SOAK_MATCHES, handleLine, handleProblems, lookNatives, playHandleBaseline } from "./handleBaseline";
import { SMASHCRAFT_LOCAL_NATIVES } from "./localNatives";
import { compactEmulator } from "./memoryCensus";

declare const arg: Readonly<Record<number, string | undefined>>;

// The Lua32 half of `bun wisp soak handles`: smashcraft:ts/scripts/wisp/handleBaseline.ts's scenario in one look on the
// compiled integrity build, printing the same lines as its Bun half (test/soak/handles.ts).
const [bundlePath, declarationsPath, look, matchesText] = [arg[1], arg[2], arg[3], arg[4]];
const chosen = LOOKS.find((known) => known === look);
const matches = matchesText === undefined ? SOAK_MATCHES : Number(matchesText);
if (bundlePath === undefined || declarationsPath === undefined || chosen === undefined || !(matches >= 2)) throw new Error("usage: lua handles.lua MAP_LUA WARCRAFT_D_TS classic|definitive [MATCHES >= 2]");
const declarationsText = readFile(declarationsPath);
const { functions } = parseNativeDeclarations(declarationsText);
const reads: number[] = [];
const clients = luaLockstep({ filePrefix: "smashcraft", localNatives: SMASHCRAFT_LOCAL_NATIVES, intentionalNoops: SMASHCRAFT_NOOPS, natives: lookNatives(chosen, reads) }, readFile(bundlePath), declarationsText, undefined, syncDelivery(MEASURED_BATTLE_NET, 7));
// compactEmulator hands back and clears each client's errors so far.
const errors: string[] = [];
const run = playHandleBaseline(clients, functions, matches, gameOf, (client, released) => {
  for (const error of compactEmulator(client, released)) errors.push(`p${client.slot + 1}: ${error}`);
});
const slots = clients.clients.map((client) => client.slot);
const problems = [...handleProblems(run, slots), ...errors];
clients.clients.forEach((client, index) => {
  const p = `p${client.slot + 1}`;
  if ((reads[client.slot] ?? 0) === 0) problems.push(`${p} never read its graphics mode`);
  print(`${p} ${chosen} before: ${handleLine(run.cold[index])}`);
  print(`${p} ${chosen} after match 1: ${handleLine(run.afterMatches[0]?.[index])}`);
  print(`${p} ${chosen} after match ${matches} (rematch ${matches - 1}): ${handleLine(run.afterMatches[matches - 1]?.[index])}`);
  for (const error of client.errors) problems.push(`${p}: ${error}`);
});
for (const problem of problems) print(`problem ${problem}`);
print(`done problems=${problems.length}`);
if (problems.length > 0) os.exit(1);
