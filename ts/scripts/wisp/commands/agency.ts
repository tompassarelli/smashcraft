








import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { TIGHT_ESCAPE } from "../../agency";
import { FIGHTERS, type LinkResult, REPORTED_FRAMES, STARTER_NAMES, type StarterResult, sweepComparisonLinks, sweepStarters } from "../../agencySweep";

class AgencyFailure extends Schema.TaggedError<AgencyFailure>()("AgencyFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const group = <T>(items: readonly T[], key: (item: T) => string) => Map.groupBy(items, key);


function stretchLines(results: readonly StarterResult[]): string[] {
  const lines: string[] = [];
  for (const [name, rows] of group(results, ({ attacker, victim, starter }) => `${attacker} ${starter} on ${victim}`)) {
    if (!rows.some(({ alone }) => alone.length > REPORTED_FRAMES)) continue;
    const longest = rows.reduce((most, row) => (row.alone.length > most.alone.length ? row : most));
    lines.push(`  ${name}: longest ${longest.alone.length} frames at ${longest.percent}% (DI only on ${longest.alone.diFrames}); by percent `
      + rows.map(({ percent, alone }) => `${percent}:${alone.length}`).join(" "));
  }
  return lines;
}


const holdsAgainstEveryDi = ({ followUp }: StarterResult) =>
  followUp?.loop !== undefined && followUp.loop.escapeFrames <= TIGHT_ESCAPE && followUp.underDi.length > 0
  && followUp.underDi.every(({ loopEscapeFrames }) => loopEscapeFrames !== undefined && loopEscapeFrames <= TIGHT_ESCAPE);

function loopLines(results: readonly StarterResult[]): string[] {
  return results.flatMap(({ attacker, victim, starter, percent, followUp }) => {
    const loop = followUp?.loop;
    if (followUp === undefined || loop === undefined) return [];
    const escape = loop.escapeFrames === 0 ? `no frame to act on (DI only on ${loop.diFrames})` : `${loop.escapeFrames} frames to act on`;
    const di = followUp.underDi.length === 0 ? ""
      : `; held DI, fewest frames to act on any plan leaves: ${followUp.underDi.map(({ direction, loopEscapeFrames }) => `${direction} ${loopEscapeFrames ?? "none loops"}`).join(", ")}`;
    return [`  ${attacker} ${starter} on ${victim} from ${percent}%: ${followUp.plan}; a ${loop.to - loop.from}-frame cycle, ${loop.fromPercent.toFixed(0)}% to ${loop.toPercent.toFixed(0)}%, ${escape}${di}`];
  });
}

function linkLines(links: readonly LinkResult[]): string[] {
  return links.map(({ name, comparisonContact, contact, stretch, holdsUnderDi }) => {
    const holds = holdsUnderDi.filter(({ holds }) => holds).map(({ direction }) => direction);
    return `  ${name}: contact at ${contact ?? "none"} (comparison ${comparisonContact}); stretch ${stretch.length} frames, DI only on ${stretch.diFrames}; `
      + `holds against ${holds.length} of ${holdsUnderDi.length} held DI directions${holds.length > 0 ? ` (${holds.join(", ")})` : ""}`;
  });
}


export const agency: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { attacker: { type: "string", multiple: true }, starter: { type: "string", multiple: true }, out: { type: "string" } }, strict: true }).values,
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const names = parsed.attacker ?? [];
  const attackers = names.length === 0 ? FIGHTERS : FIGHTERS.filter(({ name }) => names.includes(name));
  if (attackers.length !== Math.max(1, names.length) && names.length > 0) {
    return yield* new UsageFailure({ problem: `--attacker takes ${FIGHTERS.map(({ name }) => name).join(", ")}` });
  }
  const only = parsed.starter;
  const unknown = only?.filter((name) => !STARTER_NAMES.includes(name)) ?? [];
  if (unknown.length > 0) return yield* new UsageFailure({ problem: `--starter takes ${STARTER_NAMES.join(", ")}` });
  const starters = yield* Effect.sync(() => sweepStarters(attackers, only)).pipe(step(`starters of ${attackers.map(({ name }) => name).join(", ")}`));
  const links = only !== undefined ? [] : yield* Effect.sync(() => sweepComparisonLinks().filter(({ name }) => attackers.some((attacker) => name.startsWith(attacker.name))))
    .pipe(step("move comparisons' bounded true links"));
  if (parsed.out !== undefined) {
    const file = parsed.out;
    yield* Effect.try({
      try: () => writeFileSync(file, [...starters, ...links].map((result) => JSON.stringify(result)).join("\n") + "\n"),
      catch: (cause) => new AgencyFailure({ problem: `writing ${file}: ${describeCause(cause)}` }),
    });
  }
  const loops = loopLines(starters);
  const tight = starters.filter(({ followUp }) => followUp?.loop !== undefined && followUp.loop.escapeFrames <= TIGHT_ESCAPE);
  const infinite = starters.filter(holdsAgainstEveryDi);
  yield* Console.log([
    `${starters.length} starters caught their victim; stretches over ${REPORTED_FRAMES} frames without a frame to act on:`,
    ...stretchLines(starters),
    `loops a repeating follow-up made (${loops.length}):`,
    ...loops,
    `the move comparisons' bounded true links through the frame executor (${links.length}):`,
    ...linkLines(links),
    `${tight.length} loops leave the victim ${TIGHT_ESCAPE} frames or fewer to act on when it holds no direction; ${infinite.length} of them do so against every held DI direction:`,
    ...infinite.map(({ attacker, victim, starter, percent }) => `  ${attacker} ${starter} on ${victim} from ${percent}%`),
  ].join("\n"));
  if (infinite.length > 0) return yield* new AgencyFailure({ problem: `${infinite.length} loops hold the victim against every held DI direction` });
});
