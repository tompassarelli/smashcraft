# Slippi human-input measurement

Measures how consistently real Melee players execute inputs, from Slippi
replays, for the computer-noise models in docs/design/cpu-profiles.md and the
results in docs/design/human-input-consistency.md.

Source: [erickfm/melee-ranked-replays](https://huggingface.co/datasets/erickfm/melee-ranked-replays)
(MIT, anonymized Slippi ranked games, no account needed). Replays stay outside
the repository, under `~/.local/share/smashcraft-slippi/` (`SLIPPI_DATA`
overrides it).

```sh
cd tools/slippi
bun install
bun fetch.ts                       # first 220 master and 70 diamond/platinum games per character shard
capacity=$(dirname "$(agents path machine-capacity)")/scripts/machine-capacity.mjs
bun "$capacity" run --class heavy --owner "claude:slippi" --timeout-seconds 1200 -- bun run.ts
bun report.ts > report.md          # Markdown table, one column per rank group
```

- `fetch.ts` streams only the head of each multi-GB shard (`N_MASTER`, `N_LOW`, `ARCHIVE`).
- `extract.ts` writes one JSON line per player per game to `$SLIPPI_DATA/events/`.
- `report.ts` pools the lines per rank group; replays duplicated across character shards count once.
