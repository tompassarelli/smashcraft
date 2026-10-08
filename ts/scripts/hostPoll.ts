// Waiting for a condition from a host tool (docs/typescript.md, "Host tools",
// rule 3): one deadline poll instead of hand deadline loops.
import { type Duration, Effect, Predicate, Schedule } from "effect";

/**
 * Runs `check` now and then every `every` until it returns a value other
 * than undefined, and returns that value. After `within`, the poll is
 * interrupted and `orElse` decides the result, normally the tool's failure.
 */
export const pollUntil = <A, E, R, A2, E2, R2>(
  check: Effect.Effect<A | undefined, E, R>,
  options: { readonly every: Duration.Input; readonly within: Duration.Input; readonly orElse: () => Effect.Effect<A2, E2, R2> },
): Effect.Effect<A | A2, E | E2, R | R2> =>
  check.pipe(
    Effect.repeat({ schedule: Schedule.spaced(options.every), until: (value) => value !== undefined }),
    // Narrows the type: repeat ended only once a value arrived.
    Effect.filterOrElse(Predicate.isNotUndefined, () => Effect.never),
    Effect.timeoutOrElse({ duration: options.within, orElse: options.orElse }),
  );
