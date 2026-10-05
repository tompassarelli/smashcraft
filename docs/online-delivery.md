# Online play and companion delivery

Deliver responsive, controller-friendly two- to four-player Smashcraft on
current Warcraft III. The companion must support **macOS, Windows and Linux**;
the first native integration and online measurements use the existing Linux
clients. Keep each platform's observed support separate from source-level
portability.

The current primary owns reconciliation of input, deterministic rollback,
visual/audio recovery, controller integration, hosting and the accepted physics
handoff. Include mutable simulation state in snapshots and replay without
retuning agreed mechanics. The previous cross-peer mailbox is shut down.

## Accepted controller direction

- SDL3 supplies controller discovery, normalization, hotplugging and supported
  GameCube/Steam Deck device handling through Rust bindings.
- enigo supplies keyboard delivery through the supported operating-system
  backends. Native APIs establish the intended game and actual foreground state.
- Custom Rust owns Smashcraft bindings, shared-action aggregation, focus and
  disconnect releases, neutral rearming and game integration.
- Tauri supplies launcher/settings UI after the controller core works; the
  webview does not clock gameplay input.

Use maintained library APIs before copying or vendoring implementations.
Slippi/Dolphin, XInput/GameInput, Steam Input and the C# Blizzard controller
project inform the decision; they do not supply Warcraft rollback or continuous
analog transport. See wc3-melee:docs/controller-prior-art.md and
wc3-melee:docs/controller-platforms.md for source revisions, reuse boundaries
and platform-specific trials.

## Delivery sequence and acceptance

Roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16) orders the
work. Each issue's **Done when** and **Not required** lists are its complete
acceptance: input integrity #26, online play #17, Linux controller #18, physics
#9, then visuals #14, balance #12, hosting #19 and Windows/macOS #34. Current
results and the input integrity table: roadmap #16.

The 33/50/83 ms response figures are advisory targets that #26 reports
against, not gates. Human feel, physical controllers and other platforms are
observed in the owner-gated boxes of #17, #18 and #34, never through
synthetic stand-ins.
