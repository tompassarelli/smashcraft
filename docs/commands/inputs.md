# Inputs

- Build inputs: each private asset family is stored once under the hash of
  its contents and never edited; build-inputs/FAMILY names each family's hash,
  so changing art is `bun wisp inputs add FAMILY DIR` plus a commit, landed
  like code. `bun wisp inputs check` verifies them, `bun wisp inputs path
  [assets]` prints them for tools (smashcraft:docs/build-inputs.md).
