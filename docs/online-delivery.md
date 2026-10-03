# Online play and companion delivery

Deliver responsive, controller-friendly two- to four-player Smashcraft on
current Warcraft III. The companion must support **macOS, Windows and Linux**;
the first native integration and online measurements use the existing Linux
clients. Keep each platform's observed support separate from source-level
portability.

The low-latency/controller/netcode agent owns input, deterministic rollback,
visual/audio recovery, controller integration, companion startup and hosting
comparisons. The independent physics agent owns the verified Melee NTSC 1.02
foundation. Consume its changes and include new mutable simulation state in
snapshots and replay without retuning its mechanics.

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

The immediate priority is [#21](https://github.com/tompassarelli/smashcraft/issues/21):
the bounded competitive input-integrity decision, due 3 October 2026 at
15:15:25 UTC / 23:15:25 Taipei. See
wc3-melee:docs/competitive-integrity-decision.md for evidence, the current HOLD
recommendation and exact release gates, and wc3-melee:docs/online-delivery-goal.md
for the full consolidated goal. Controller/launcher features do not reset or
extend the investigation clock.

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
4. [#20](https://github.com/tompassarelli/smashcraft/issues/20): verify actual
   three/four-player play and ten completed matches, including rematches and
   slot changes under stated network conditions.

Controller implementation may proceed while launcher authentication blocks a
two-client trial. Continuous analog input into Warcraft is a separate unresolved
capability and needs an executable map-ingress proof before it is advertised.

## Acceptance and current limits

Target local visible response median ≤33 ms, p95 ≤50 ms and p99 ≤83 ms, smooth
60 Hz play, no recurring unexplained responses above 100 ms and no observed
confirmed-state disagreements. Report physical controller latency separately
from injected-input timing, with the exact candidate, configuration, input
method, sample count, network conditions and capture uncertainty.

Retained native evidence includes matching sampled confirmed states, attacks
from both humans, a real contact/hitlag/hitstun window and a results-to-combat
rematch transition. It does not yet establish a completed combat round, current
candidate latency acceptance, physical-controller acceptance, native support on
all three platforms or ten completed matches. Client A's signed-in launcher
successfully recovered the real main menu through its Play button on 3 October.
An empty Options/Exit Game shell is the recorded post-login failure; retain the
launcher and use the Warcraft-specific recovery skill rather than direct execution.

Update the owning issue at meaningful executable checkpoints. Builds, synthetic
host turns, controller enumeration and source inspection each prove only their
own boundary; they do not close online or platform acceptance.
