import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../../src/game/shell/currentBuild";
import { install, startBuild } from "../../src/platform/main";
import { shell } from "../../src/platform/shell/state";
import type { Game } from "../../scripts/wisp/botMatch";
import { type HandleBaseline, type Look, LOOKS, SOAK_MATCHES, handleLine, handleProblems, lookNatives, playHandleBaseline } from "../../scripts/wisp/handleBaseline";
import { SMASHCRAFT_HEADLESS } from "../../scripts/wisp/headless";

export interface LookBaseline extends HandleBaseline {
  readonly slots: readonly number[];
  /** Each client's reads of the graphics-mode string, by slot. */
  readonly reads: readonly number[];
  readonly errors: readonly string[];
}

/** Plays smashcraft:ts/scripts/wisp/handleBaseline.ts's scenario for `matches` matches in `look` on the integrity build in Bun. */
export function playBunHandleBaseline(look: Look, matches: number): LookBaseline {
  const declarations = readNativeDeclarations();
  const reads: number[] = [];
  const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: lookNatives(look, reads) }, declarations);
  try {
    const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
    const baseline = playHandleBaseline(clients, declarations.functions, matches, (client) => {
      let game: Game | undefined;
      client.run(() => {
        game = shell().game;
      });
      if (game === undefined) throw new Error(`p${client.slot} has no shell`);
      return game;
    });
    return { ...baseline, slots: clients.clients.map((client) => client.slot), reads, errors: clients.clients.flatMap((client) => client.errors.map((error) => `p${client.slot + 1}: ${error}`)) };
  } finally {
    headless.restore();
  }
}

// `bun test/soak/handles.ts LOOK [MATCHES]`: the Bun half of `bun wisp soak handles`, printing the
// same lines as its Lua32 half (scripts/wisp/handleBaselineLua.ts).
if (import.meta.main) {
  const [look, matchesText] = process.argv.slice(2);
  const matches = Number(matchesText ?? SOAK_MATCHES);
  const chosen = LOOKS.find((known) => known === look);
  if (chosen === undefined || !Number.isInteger(matches) || matches < 2) throw new Error("usage: bun test/soak/handles.ts classic|definitive [MATCHES >= 2]");
  const run = playBunHandleBaseline(chosen, matches);
  const problems = [...handleProblems(run, run.slots), ...run.errors];
  run.slots.forEach((slot, index) => {
    const p = `p${slot + 1}`;
    if ((run.reads[slot] ?? 0) === 0) problems.push(`${p} never read its graphics mode`);
    console.log(`${p} ${chosen} before: ${handleLine(run.cold[index])}`);
    console.log(`${p} ${chosen} after match 1: ${handleLine(run.afterMatches[0]?.[index])}`);
    console.log(`${p} ${chosen} after match ${matches} (rematch ${matches - 1}): ${handleLine(run.afterMatches[matches - 1]?.[index])}`);
  });
  for (const problem of problems) console.log(`problem ${problem}`);
  console.log(`done problems=${problems.length}`);
  if (problems.length > 0) process.exitCode = 1;
}
