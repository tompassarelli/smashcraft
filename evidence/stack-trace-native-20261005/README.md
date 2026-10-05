# Native TypeScript stack traces, #38 — 5 October 2026

**Pass.** Both clients reported `-dev stack-demo` with its message and all
four TypeScript frames, and `waygate hot` printed them 21 ms (p0) and 29 ms
(p1) after each game wrote its report.

## Candidate

- Source: smashcraft `68dc038` (origin/main) plus lane commits that do not
  touch map source.
- A private copy of the four-fighter integrity diagnostic, rebuilt with
  `bun waygate rebuild MAP.w3x --profile stack-trace`: build
  `typescript-stack-trace`, compile 7.52 s (rebuild.txt).
- Map SHA-256 `d2da510746d53082662421a3017ce8fb5da68e07234a71cce78e02fde4e6b57d`;
  instrumented script 2,553,619 bytes, SHA-256
  `6076ccfd30e7b9542adb1bb1fcb41a942b5ebd988b051913ec41db064ab490e2`.
  Both stay private under ~/.local/share/smashcraft-build-inputs/native-owner-20261005/stack-trace/.

## Steps

1. `bun waygate fresh MAP.w3x` (no `--rebuild`) took both clients from A's
   lobby into a new game in 28.18 s, through fighter selection and both
   `-dev quick` receipts. Both ready files name `BUILD typescript-stack-trace`.
2. `bun waygate hot --profile stack-trace --data <A CustomMapData> --data <B CustomMapData> --watch`
   compiled in 8.34 s and published v101 (2,547,258 bytes in 13 files),
   running on both clients 2.16 s later.
3. In client A: Return, `-dev stack-demo`, Return.
4. The watcher was stopped with SIGINT after the report.

## Result

From hot-output.txt, the same lines for p0 and p1:

```text
error 1 in stackDemo.command
Error: stack demo failure: -dev stack-demo
src/platform/stackDemo.ts:12: in failInnermost
src/platform/stackDemo.ts:16: in runMiddle
src/platform/stackDemo.ts:20: in runOuter
src/platform/stackDemo.ts:24: in stackDemoCommand
```

The raw reports are a-smashcraft-error-p0.txt (client A) and
b-smashcraft-error-p1.txt (client B).

The 2.5 MB instrumented script loaded with the map and again by hot reload,
and it ran normally. After the failure the match kept going: A's simulation
frame read 3478, then 3656 about 3 s later.
