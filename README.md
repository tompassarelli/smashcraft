# Smashcraft

<p align="center">
  <img src="https://github.com/user-attachments/assets/999d71b8-8b6e-4077-b9d9-19ca366039fc" alt="Smashcraft cover art" width="100%">
</p>

Smashcraft is an in-development platform fighter for Warcraft III, inspired by
Super Smash Bros. Melee. Warcraft heroes fight on floating stages with jumps,
air dodges, shields, hitstun, knockback and stocks, over rollback netcode.

There is no public release yet. [Player guide](docs/player-guide.md) · status
and next work: [roadmap #16](https://github.com/tompassarelli/smashcraft/issues/16).

## Build and test

Smashcraft is written in TypeScript and runs on [Wisp](https://github.com/tompassarelli/wisp),
the framework for Warcraft III maps. smashcraft:ts/wisp.lock pins its source
revision; `bun install --frozen-lockfile` installs the generated package from
the checkout. TypeScriptToLua compiles the game to Warcraft's Lua. Code
changes reach running multiplayer clients without re-hosting, in-game errors
point at TypeScript lines, and logic tests run in Bun and in 32-bit Lua. The
source tree doesn't include Warcraft III's models, textures, terrain map or the
generated game map; building needs a locally configured Warcraft III and the
private assets.

From [smashcraft:ts/](ts/):

- `bun test` runs the logic tests, and `LUA=<32-bit lua> bun scripts/lua-tests.ts`
  runs them in 32-bit Lua. `bun run check` type-checks.
- `bun wisp hot --data <client CustomMapData> ... --watch` reloads every
  save into the running clients.
- `../build.sh BASE_MAP ASSET_CONTAINER` builds the map.

[smashcraft:docs/typescript.md](docs/typescript.md) has the code rules and the
full command list.

## Project notes

Pre-release maps are named **Smashcraft 0.0.N** in both Warcraft and the filename.
Increment only the last number in `smashcraft:map-version` for the next pre-release.
Artifacts stay under the private `WC3_PRIVATE_ASSETS` directory, outside the
repository. The current artifact and matching helper are named in
smashcraft:docs/playable-0041.md. Install one current map in Warcraft's flat
`Maps/00-Smashcraft` folder; retain old maps privately outside the map browser.

- [Gameplay and controls](docs/player-guide.md)
- [Delivery goal](docs/delivery-goal.md)
- [Physics references and implementation](docs/physics.md)
- [Fighter animation authoring and validation](docs/fighter-animation-work.md)
- [Netcode design](docs/netcode-proposal.md)
- [Gameplay design decisions](docs/gameplay-design.md)
- [Documentation index](docs/README.md) · [Trial evidence records](evidence/README.md)

## License

Smashcraft is released under the [MIT License](LICENSE). The vendored Effect
source under repos/effect/ keeps its own MIT license. Warcraft III, Super Smash
Bros. Melee and their assets belong to their owners and are not part of this
repository; reference values cite their sources.
