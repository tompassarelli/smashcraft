import { readFileSync, writeSync } from "node:fs";
import { Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import type { Character } from "../../../src/game/sim/codes";
import { isCpuTier } from "../../../src/game/match/cpuProfiles";
import { selectableCharacterBySlug } from "../../../src/game/sim/heroes/registry";
import { DEFAULT_OPTIONS, type TextMatchOptions, playTextMatch } from "../../textMatch";
import { parseCommands } from "../../textMatchView";

class TextMatchFailure extends Schema.TaggedError<TextMatchFailure>()("TextMatchFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const whole = (args: readonly string[], name: string, fallback: number): number => {
  const [value] = flagValues(args, name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new UsageFailure({ problem: `--${name} ${value} is not a whole number` });
  return parsed;
};

const fighter = (args: readonly string[], name: string, fallback: Character): Character => {
  const [slug] = flagValues(args, name);
  if (slug === undefined) return fallback;
  const found = selectableCharacterBySlug(slug);
  if (found === undefined) throw new UsageFailure({ problem: `--${name} ${slug} is not a selectable fighter slug` });
  return found;
};

export function optionsFrom(args: readonly string[]): TextMatchOptions {
  const [level = DEFAULT_OPTIONS.level] = flagValues(args, "level");
  if (!isCpuTier(level)) throw new UsageFailure({ problem: `--level ${level} is not a computer level (rookie beginner intermediate advanced expert)` });
  const frames = flagValues(args, "frames").length === 0 ? undefined : whole(args, "frames", 0);
  return {
    seed: whole(args, "seed", DEFAULT_OPTIONS.seed), stage: flagValues(args, "stage")[0] ?? DEFAULT_OPTIONS.stage,
    you: fighter(args, "you", DEFAULT_OPTIONS.you), cpu: fighter(args, "cpu", DEFAULT_OPTIONS.cpu), level,
    delay: whole(args, "delay", DEFAULT_OPTIONS.delay), every: whole(args, "every", DEFAULT_OPTIONS.every),
    stocks: whole(args, "stocks", DEFAULT_OPTIONS.stocks), minutes: whole(args, "minutes", DEFAULT_OPTIONS.minutes), frames,
  };
}

const STDOUT_BUSY = "stdout busy";

const writeAll = (text: string): Effect.Effect<void, TextMatchFailure> => {
  const bytes = Buffer.from(text);
  const from = (at: number): Effect.Effect<void, TextMatchFailure> => at >= bytes.length ? Effect.void : Effect.try({
    try: () => writeSync(1, bytes, at),
    catch: (cause) => typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EAGAIN" ? STDOUT_BUSY : new TextMatchFailure({ problem: describeCause(cause) }),
  }).pipe(
    Effect.map((written) => at + written),
    Effect.catchIf((failure): failure is typeof STDOUT_BUSY => failure === STDOUT_BUSY, () => Effect.sleep("1 millis").pipe(Effect.as(at))),
    Effect.flatMap(from),
  );
  return from(0);
};

export const textMatch: Command = (args) => Effect.try({
  try: () => {
    const options = optionsFrom(args);
    const [file] = flagValues(args, "input");
    const text = file === undefined ? readFileSync(0, "utf8") : readFileSync(file, "utf8");
    return playTextMatch(options, parseCommands(text)).lines.join("\n");
  },
  catch: (cause) => cause instanceof UsageFailure ? cause : new TextMatchFailure({ problem: describeCause(cause) }),
}).pipe(Effect.flatMap((text) => writeAll(`${text}\n`)));
