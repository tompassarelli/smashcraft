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

## Delivery sequence and GitHub ownership

The roadmap is [#16](https://github.com/tompassarelli/smashcraft/issues/16).

Current guarantees, progress and all issue dispositions are recorded in
wc3-melee:docs/netplay-status.md. #21 completed the earlier HOLD decision; it is
not active implementation. The next repair is input retention #26, followed by
the intended-frame contract #25 and response/variation #27. Completed bounded
claims #28–#30 stay closed absent a relevant regression.

1. [#17](https://github.com/tompassarelli/smashcraft/issues/17): complete an
   actual two-client fight, KO/results and rematch on the same candidate;
   incorporate current verified physics into rollback/replay. Then measure
   meaningful movement and combat responses on that candidate.
2. [#18](https://github.com/tompassarelli/smashcraft/issues/18): implement a
   UI-less SDL3/enigo controller core, starting with observation mode. Verify
   the requested Xbox mapping, simultaneous jump/shield sources, focus loss,
   disconnect and neutral rearm. Prove map actions before Tom's primary-display
   hands-on trial. Establish native acquisition, delivery, focus and launch on
   each required platform before claiming support there.
3. [#19](https://github.com/tompassarelli/smashcraft/issues/19): prove native
   discovery/joining for controlled hosting before comparing the same map with
   Battle.net and available W3Champions/FLO paths. Infrastructure is selected
   from measured benefits, not an assumed latency improvement.
4. [#17](https://github.com/tompassarelli/smashcraft/issues/17), incorporating
   the former #20 requirements: verify actual
   three/four-player play and ten completed matches, including rematches and
   slot changes under stated network conditions.

Controller implementation may proceed while launcher authentication blocks a
two-client trial. Continuous analog input into Warcraft is a separate unresolved
capability and needs an executable map-ingress proof before it is advertised.

## Acceptance and current limits

Local visible response figures of median 33 ms, p95 50 ms and p99 83 ms are
advisory measurement targets, not rigid acceptance gates. Assess playable
response, explain observed outliers and preserve consistent input and outcomes.
Report physical controller latency separately
from injected-input timing, with the exact candidate, configuration, input
method, sample count, network conditions and capture uncertainty.

Exact 0.0.40 completed the bounded two-client combat/movement/jump/pause/result/
rematch journey, with 18 matching recorded confirmed checkpoints. Twelve sampled
shield presses entered prediction in their capture callback, and the software
controller mapper produced movement and three attacks. Input polling can still
lose taps; original-frame stall retention, physical response, all-platform
support and ten human matches remain open. Detailed evidence is in
wc3-melee:docs/smashcraft-delivery-state-20261004.md. Preserve signed-in native
clients; use the Warcraft recovery skill for launcher issues.

Update the owning issue body at meaningful executable checkpoints. Add comments
only for a material result or decision. Builds, synthetic
host turns, controller enumeration and source inspection each prove only their
own boundary; they do not close online or platform acceptance.
