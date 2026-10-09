# Typescript

Host tools that Bun runs (commands, runners, builds, captures, farm jobs) are
written as Effect programs when they start processes, wait, retry, hold a
resource or parse outside data. Load the effect-development skill before
designing one, and follow the four rules and examples in
smashcraft:docs/typescript.md, "Host tools". Map code compiled to Lua
stays plain TypeScript; pure calculations stay plain functions.
Host-tool enforcement: smashcraft:ts/test/effect-host-tools.test.ts.

Effect is the preferred foundation for Wisp's TypeScript tooling.
Read smashcraft:.agents/skills/effect/SKILL.md for Effect work and for the
weekly dependency/source update. The upstream repository is vendored at
smashcraft:repos/effect/ as read-only reference material: read its LLMS.md,
implementation and tests before choosing APIs. Import installed packages,
never the subtree. Upstream development instructions apply to upstream work,
not to Smashcraft's package manager, language or build commands.

smashcraft:ts/ is the TypeScript side, built on Wisp: the framework and
development loop for Warcraft maps in TypeScript. Read
warcraft-modding before changing TypeScript
or code in a running game, and smashcraft:docs/typescript.md before writing map code.

CPU observation histories retain shared samples through `copyBotMemory` and
release them through `clearBotMemory`; never assign one owner's history to
another. Observation checks stream canonical bytes, while replay text is
materialized on request. Keep this route allocation-free and use the unchanged
`playable-bot-four` performance fixture for whole-frame acceptance.

Map code under ts/src/game takes square roots from `squareRoot`
(smashcraft:ts/src/game/sim/warcraftMath.ts) and sines, cosines and
arctangents from smashcraft:ts/src/game/sim/mathTables.ts, which interpolate
binary32 tables in smashcraft:ts/src/game/sim/mathTableData.ts. Regenerate the
data with `bun scripts/mathTables.ts` from ts/. A source-shape test refuses
`Math.sqrt`, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow`, the other libm
functions and `**` in map code, because Bun and Warcraft differ by an ulp on them.
