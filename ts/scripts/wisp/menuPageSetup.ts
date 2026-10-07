// The one-time setup direct play needs on a player's Warcraft III (#142), done
// by the client after the player agrees: Wisp's menu page in the game's
// _retail_ folder and the game's "Allow Local Files" switch, which makes the
// game serve that page (wisp:docs/driving-warcraft.md, "Setup and undo").
// Under Wine the switch lives in the prefix's user.reg, which may be edited
// only while no wineserver uses the prefix.
import { copyFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { prefixUse, serverDirectoryName } from "wisp/scripts/warcraft/battleNet";
import { listProcesses } from "wisp/scripts/warcraft/processes";
import { MenuFailure, installMenuPage } from "wisp/scripts/wisp/menus";

export const retailFolder = (prefix: string) => join(prefix, "drive_c/Program Files (x86)/Warcraft III/_retail_");

const KEY = "[Software\\\\Blizzard Entertainment\\\\Warcraft III]";
const VALUE = `"Allow Local Files"=dword:00000001`;

/**
 * user.reg with Warcraft III's "Allow Local Files" set to 1, or undefined
 * when it already is. `now` is seconds since the epoch, as Wine stamps keys.
 */
export function allowLocalFiles(userReg: string, now: number): string | undefined {
  const lines = userReg.split("\n");
  const header = lines.findIndex((line) => line.toLowerCase().startsWith(KEY.toLowerCase()));
  if (header === -1) {
    const ending = userReg.endsWith("\n") ? "" : "\n";
    return `${userReg}${ending}\n${KEY} ${now}\n${VALUE}\n`;
  }
  let end = header + 1;
  for (let line = lines[end]; line !== undefined && line !== "" && !line.startsWith("["); line = lines[++end]);
  const existing = lines.slice(header + 1, end).findIndex((line) => line.toLowerCase().startsWith(`"allow local files"=`));
  if (existing !== -1) {
    if (lines[header + 1 + existing] === VALUE) return undefined;
    lines[header + 1 + existing] = VALUE;
  } else {
    // Values follow the key's own #time and #class lines.
    let at = header + 1;
    while (at < end && lines[at]?.startsWith("#") === true) at++;
    lines.splice(at, 0, VALUE);
  }
  return lines.join("\n");
}

/** Whether a Wine runtime uses the prefix now. */
const prefixInUse = (prefix: string) => {
  const stats = statSync(prefix, { bigint: true });
  return prefixUse(listProcesses(), prefix, serverDirectoryName(stats.dev, stats.ino)).runtimes.length > 0;
};

export type SetupResult = "ready" | "page written; close Warcraft III and Battle.net once to finish";

/**
 * Installs (or repairs, after a game update) the menu page reporting to
 * `reportPort`, then sets the switch while the prefix is unused. A user.reg
 * changed for the first time keeps its old copy beside it.
 */
export const setUpMenuPage = (prefix: string, reportPort: number) => Effect.gen(function*() {
  yield* installMenuPage(retailFolder(prefix), reportPort);
  const userReg = join(prefix, "user.reg");
  const current = yield* Effect.try({
    try: () => readFileSync(userReg, "utf8"),
    catch: () => new MenuFailure({ operation: "set Allow Local Files", problem: `${userReg} can't be read; is ${prefix} a Wine prefix?` }),
  });
  const next = allowLocalFiles(current, Math.floor(Date.now() / 1000));
  if (next === undefined) return "ready" satisfies SetupResult;
  if (prefixInUse(prefix)) return "page written; close Warcraft III and Battle.net once to finish" satisfies SetupResult;
  yield* Effect.try({
    try: () => {
      const backup = `${userReg}.before-smashcraft`;
      if (!existsSync(backup)) copyFileSync(userReg, backup);
      writeFileSync(`${userReg}.next`, next);
      renameSync(`${userReg}.next`, userReg);
    },
    catch: (cause) => new MenuFailure({ operation: "set Allow Local Files", problem: String(cause) }),
  });
  return "ready" satisfies SetupResult;
});
