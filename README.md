# Smashcraft

<p align="center">
  <img src="https://github.com/user-attachments/assets/999d71b8-8b6e-4077-b9d9-19ca366039fc" alt="Smashcraft cover art" width="100%">
</p>

Smashcraft is an in-development platform fighter for Warcraft III, inspired by
Super Smash Bros. Melee. Warcraft heroes fight on floating stages with jumps,
air dodges, shields, hitstun, knockback and stocks, over rollback netcode.

There is no public release yet. How to play: [player guide](docs/player-guide.md).
Status and next work: [roadmap #16](https://github.com/tompassarelli/smashcraft/issues/16).

## Develop

Smashcraft is written in TypeScript on [Wisp](https://github.com/tompassarelli/wisp),
which compiles it to Warcraft III's Lua. From [smashcraft:ts/](ts/):

```sh
bun install --frozen-lockfile
bun wisp dev
```

Keep `bun wisp dev` running: every save reports type errors, affected tests
and simulated matches. Building the playable map also needs a locally
installed Warcraft III and private game assets, which are not in this
repository.

Where to look next:

- [AGENTS.md](AGENTS.md): workflow rules and the full command list.
- [Documentation index](docs/README.md): how the game and its systems work.
- [Wisp feature index](https://github.com/tompassarelli/wisp/blob/main/docs/index.md):
  framework capabilities and opt-in diagnostics.

## License

Smashcraft is released under the [MIT License](LICENSE). The vendored Effect
source under repos/effect/ keeps its own MIT license. Warcraft III, Super Smash
Bros. Melee and their assets belong to their owners and are not part of this
repository; reference values cite their sources.
