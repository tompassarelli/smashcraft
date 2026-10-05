# Project documentation

[Smashcraft project home](../README.md)

Docs hold durable knowledge: how the game and its systems work, design
decisions and their reasons, reference data, and procedures. Anything that
changes, such as status, progress, plans, priorities or claim tables, lives in
GitHub issues under roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16).
Dated trial records live in [evidence](../evidence/README.md).

## Game

- [Player guide](player-guide.md): controls, menus and match flow.
- [Gameplay design decisions](gameplay-design.md): intentional mechanics choices.
- [Delivery goal](delivery-goal.md): what the finished game contains.
- [Current release](playable-0041.md): files, startup and controls for 0.0.41.

## Physics and moves

- [Physics reference](physics.md): source values, implementation and known differences.
- Melee mechanics: [air cutoff](melee-air-cutoff.md), [analog shield](melee-analog-shield.md), [ground motion](melee-ground-motion.md), [hitlag scalars](melee-hitlag-scalars.md), [hitstun boundaries](melee-hitstun-boundaries.md), [powershield](melee-powershield.md), [scalar math](melee-scalar-math.md), [tech input](melee-tech-input.md).
- [Smash Melee reference data](smash-melee-reference/README.md): structured reference corpus used by the physics tests.
- [Melee frame-data reference](../references/melee-frame-data/README.md): factual JSONL intake and conventions.
- [Move data](move-data.md), [move comparisons](move-comparisons.md) and [move reference join](move-reference-join.md): queryable production move facts.
- [Native arithmetic comparison](native-physics-precision.md): how to check Warcraft against headless numbers.

## Netcode and controllers

- [Netcode design](netcode-proposal.md): synchronization and rollback design.
- [Input clock contract](input-clock-contract-20261004.md): how inputs get their frame.
- [Warcraft API and netcode findings](warcraft-api-netcode-findings.md): engine behavior learned the hard way.
- [Online play and companion direction](online-delivery.md): controller architecture choices.
- [Cross-platform companion](controller-platforms.md) and [controller prior art](controller-prior-art.md).

## Building and testing

- [Development setup and loop](development-loop.md): build, reload and test workflow.
- [TypeScript workflow](typescript.md): source rules, build and test commands.
- [Fighter animation work](fighter-animation-work.md): asset authoring and native pose checks.
- [Warcraft procedures](wc3-procedures.md), [screen states](wc3-screen-state.md) and [authentication](warcraft-authentication.md).

## Keeping docs from rotting

- Write a doc only for knowledge that stays true until the code or design changes. Put status, next steps and results-so-far in the owning issue.
- When a trial teaches something durable, add that fact to the relevant doc above, in a sentence, with the build it was observed on. Keep the trial's raw record in `evidence/`.
- Don't add "current state", "updated on" or "remaining work" sections to a doc. If a doc needs one, the content belongs in an issue.
