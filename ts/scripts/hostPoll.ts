

import { type Duration, Effect, Predicate, Schedule } from "effect";






export const pollUntil = <A, E, R, A2, E2, R2>(
  check: Effect.Effect<A | undefined, E, R>,
  options: { readonly every: Duration.Input; readonly within: Duration.Input; readonly orElse: () => Effect.Effect<A2, E2, R2> },
): Effect.Effect<A | A2, E | E2, R | R2> =>
  check.pipe(
    Effect.repeat({ schedule: Schedule.spaced(options.every), until: (value) => value !== undefined }),

    Effect.filterOrElse(Predicate.isNotUndefined, () => Effect.never),
    Effect.timeoutOrElse({ duration: options.within, orElse: options.orElse }),
  );
