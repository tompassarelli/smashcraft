# Optimized Wurst workload — 5 October 2026

The retained paired 4096-frame benchmark at Smashcraft
`ba88e6dfb80403a4678113643918c6af33120118` already used Wurst's optimizer.
Its private workspace's `wurst_run.args` contains `+opt`, `+inline` and
`+localOptimizations`. At compiler
`6b129956f6e7cf9582510f26b99d305526bf3ded`,
`WurstCommands.getCompileArgs(root, true)` normalizes those build-only flags to
their `-` forms, and `Main` passes the merged arguments into `CliBuildMap`.
The retained recipe used `-build`, so the flags applied. `-dev` changes the
`isProductionBuild()` predicate; it does not disable these optimizations.

The authentic native Wurst timing of 1.450195296 seconds therefore is an
optimized baseline. Its comparison with the paired TypeScript executor, and
the later production TypeScript sample, remains recorded in
smashcraft:evidence/native-frame-cost-20261005/README.md and
smashcraft:evidence/post-physics-frame-cost-20261005/README.md. No native sample
was rerun to resolve this compiler-argument question.

A separate private build copied all 28 frozen Wurst input files byte for byte
and invoked that same pinned jar with explicit
`-build -dev -lua -noExtractMapScript -stacktraces -inline -localOptimizations
-opt -measure` flags. Compilation returned 0 with 0 errors and the existing
unused `String` import warning at `ReplayState.wurst:8`. The compiler and
standard library retain their Apache-2.0 licenses; they were executed as build
dependencies, and neither their source nor artifacts are republished here.

The retained optimized Wurst script contains **938588 bytes**, while its paired
TypeScript bundle contains **661298 bytes**: a ratio of **0.704567**. The new
explicit-flag Wurst script contains **938227 bytes**. These compare complete
emitted executor scripts including their helpers and stack instrumentation,
excluding terrain initialization, map packaging and assets. They describe the
frozen paired workload, not the byte count of later production revisions.

The new private diagnostic preserves the paired TypeScript bundle, substitutes
the new compiled Wurst script and selects run ID `optimized-wurst-20261005`.
Lua32 parsed the combined script successfully; extracting the packaged script
returned exactly the assembled bytes. The native callback automatically runs
Wurst and then TypeScript for 4096 frames and writes both complete-state
receipts. The existing readback command at smashcraft:ts/scripts/frameCost.ts
can read that run ID and still requires equal initial checksum, final checksum
and complete state, plus time ratio at most one. It is not weakened for a
changed schema. The private map's SHA-256 and the numerical build/size facts
are retained in smashcraft:evidence/optimized-wurst-20261005/build.json; the
map, terrain and generated game-asset facts remain private.
