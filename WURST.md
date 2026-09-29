# Wurst migration

The owner selected Wurst on 2026-09-29. Gameplay source will be Wurst compiled
to Lua. Keep the signed-in Warcraft III client running through Steam/Battle.net;
build the map and restart the map in that client. World Editor is not part of
the normal code/test loop.

## Why this toolchain

- Typed fighter state and compiler diagnostics catch mistakes before entering
  Warcraft. The language server supports partial typechecking.
- Wurstunit can test movement arithmetic and state transitions without the game.
  It does not prove native input timing, rendering, or multiplayer behavior.
- Compile-time object definitions and the standard library reduce dependence
  on World Editor for units, abilities, keyboard events, and frames.
- The VS Code extension includes map archive inspection and Warcraft asset
  previews. These are useful for selecting the Archer and Rifleman animations.

## Important limits

Wurst supports both JASS and Lua output. Integrated JHCR hot reload is a JASS
pipeline; the compiler's Lua branch returns before JHCR instrumentation. It is
not a demonstrated live-Lua-reload solution. JHCR also does not rerun package
initializers or retroactively update existing objects.

The inspected Linux Run Map implementation invokes `wine` directly. That is
not this machine's Steam/Proton/Battle.net session. Use build separately from
launch. Do not return to direct game-executable launches that previously lost
authentication.

The existing Lua restart loop recorded 12.834 s and 14.970 s end-to-end,
including approximately 1.0–1.1 s builds. Those are pre-migration measurements,
not Wurst benchmarks. The initial Wurst port subsequently measured 12.078 s
and 11.269 s from build to in-game readiness with the client process retained;
compilation and packaging took about 5.0–5.2 s. Character selection, stage
selection, combat and the result screen were observed after removing default
melee initialization from the base map. JHCR compatibility remains unverified.

Wurst does not change Warcraft's network transport or provide rollback. Keep
fighter physics separate from rendering so deterministic calculations can be
checked independently. Multiplayer fairness still requires a two-client test.

## Inspected sources

- Compiler: https://github.com/wurstscript/WurstScript/tree/c34f833850cad1a13445db6f710c6af1f2a6d17b
  (`RunMap.java`, `MapRequest.java`, `ModelManagerImpl.java`).
- Standard library: https://github.com/wurstscript/WurstStdlib2/tree/c79452908e20c96f71cf976cc356dc951ab8cd0c
- Documentation: https://github.com/wurstscript/wurstscript.github.io/tree/3c75b782c12d44aef1a100cabecead21d3b5ec7d
- Editor extension: https://github.com/wurstscript/wurst4vscode
- Hot reload guide: https://wurstlang.org/tutorials/jhcr.html

Additional local references downloaded on 2026-09-29:

- ~/code/resources/wurst4vscode at
  a7ba40c0b3bde3c303ab444499ab06a886cfd284 (Apache-2.0).
- ~/code/resources/wurst-jhcr at
  ea54ed7c86cfc13e1332dded072ab33343963c42 (LGPL-3.0).

The JHCR flake sets `PATCH_LVL=300`, which makes it worth testing against this
client. Its build dry-run stopped before compilation with a Nix input NAR-hash
mismatch for nixpkgs c043004d1c6985732bcc1cbc5a9c9aecbbb4e0f0. No JHCR timing
or compatibility result has been obtained; no integrity check was bypassed.

Local reference checkouts are read-only under ~/code/resources/WurstScript,
~/code/resources/WurstStdlib2, and ~/code/resources/wurstscript.github.io.
The compiler and standard library declare Apache-2.0. Preserve applicable
licenses and notices when distributing their artifacts or derived source.
The Melee reference is ~/code/resources/melee; exact Melee physics values
have not yet been extracted or incorporated.

## Standard-library UI affordances

Use WurstStdlib2's Framehandle package for creation, anchoring, text, textures,
visibility and focus; ClosureFrames supplies typed callback registration for
clicks, hover, sliders, checkboxes and edit boxes. Buttons can use
onClickReleaseFocus to avoid capturing gameplay keyboard input. These wrap
Warcraft frames; Widget is the separate Warcraft unit/item/destructable handle
family, not a custom UI component toolkit.

Create/cache frame handles consistently across players, then vary local
presentation. Do not let local-player presentation branches mutate shared
fighter or match state. Use the library's screen-coordinate definitions;
its normal frame area and whole-screen simple-frame area differ. Check the
actual game aspect ratio and text legibility in the client.

Relevant local sources:
~/code/resources/WurstStdlib2/wurst/_handles/Framehandle.wurst and
~/code/resources/WurstStdlib2/wurst/closures/ClosureFrames.wurst.
