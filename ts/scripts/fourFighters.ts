// Issue #17's four-fighter gate uses the existing native capture files;
// input timing and all-binding integrity remain issue #26's separate gate.
import { join } from "node:path";
import { Effect } from "effect";
import { readEvidence, readMetadata, tryIntegrityPromise } from "./integrity/evidence";
import { type CaptureEvidence, type SlotMode, SLOTS, capturePair } from "./integrity/reconcile";

interface FinalChecksum {
  readonly frame: number;
  readonly checksum: string;
}

const modesMatch = (modes: readonly SlotMode[], expected: readonly (readonly [number, number])[]) =>
  modes.length === expected.length && modes.every((mode, index) => mode.humanFighters === expected[index]?.[0] && mode.computers === expected[index]?.[1]);

/** Answers only #17: four fighters finish both matches, change a slot, and agree at results. */
export function fourFighterResult(evidence: CaptureEvidence) {
  const { metadata } = evidence;
  const pair = capturePair(metadata);
  const failures: string[] = [];
  const require = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
  require(metadata.fourFighters && metadata.sweep.length === 0 && metadata.epochs?.length === 2, "capture is not one four-fighter match and rematch");
  require(pair[0] > 0 && pair[0] % 2 === 1 && pair[1] === pair[0] + 1, "match/rematch epochs are not consecutive");
  const setup = metadata.events.find((event) => event.event === "four-fighter-setup");
  require(setup?.event === "four-fighter-setup" && setup.epoch === pair[0] && modesMatch(setup.changes, [[7, 0], [3, 4], [11, 4], [3, 12]]), "two-player two-CPU setup absent");
  const change = metadata.events.find((event) => event.event === "integrity-slot-change");
  require(change?.event === "integrity-slot-change" && change.epoch === pair[1] && modesMatch(change.changes, [[3, 8], [7, 8], [3, 12]]), "rematch slot change absent");
  const finalChecksums: Record<string, FinalChecksum> = {};
  for (const epoch of pair) {
    for (const kind of ["start", "end"] as const) {
      require(metadata.events.filter((event) => event.event === kind && event.epoch === epoch).length === 1, `epoch ${epoch}: one native ${kind} boundary required`);
    }
    for (const client of SLOTS) {
      const exported = evidence.exports.get(epoch)?.[client];
      require(exported?.trace?.includes("connected 3 human-fighters 3 computers 12 fighters 15") === true, `epoch ${epoch} client ${client}: native two-player two-CPU roster absent`);
      const checksums = [...(exported?.pages.join("\n") ?? "").matchAll(/Preload\( "I (\d+) checksum (\d+) (\d+) (\d+:\d+) (\d+)"/g)]
        .filter((row) => Number(row[2]) === epoch && Number(row[5]) === 3)
        .sort((a, b) => Number(a[1]) - Number(b[1]));
      const final = checksums.at(-1);
      require(final !== undefined && Number(final[3]) > 0, `epoch ${epoch} client ${client}: final result checksum absent`);
      if (final !== undefined && final[4] !== undefined) finalChecksums[`epoch-${epoch}-client-${client}`] = { frame: Number(final[3]), checksum: final[4] };
    }
    const a = finalChecksums[`epoch-${epoch}-client-0`];
    const b = finalChecksums[`epoch-${epoch}-client-1`];
    require(a !== undefined && b !== undefined && a.frame === b.frame && a.checksum === b.checksum, `epoch ${epoch}: final checksums differ`);
  }
  return { build: metadata.build, helper_sha256: metadata.helperSha256, epochs: pair, four_fighters: true, final_checksums: finalChecksums, failures, passed: failures.length === 0 };
}

/** Writes the native journey's #17 verdict without evaluating #26's timing gates. */
export const reconcileFourFighters = (root: string) => Effect.gen(function*() {
  const metadata = yield* readMetadata(root);
  const result = fourFighterResult(yield* readEvidence(root, metadata));
  yield* tryIntegrityPromise("write four-fighter result", root, () => Bun.write(join(root, "four-fighters.json"), `${JSON.stringify(result, undefined, 2)}\n`));
  yield* Effect.sync(() => console.log(JSON.stringify(result, undefined, 2)));
  return result.passed;
});
