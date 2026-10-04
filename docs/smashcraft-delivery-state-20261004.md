# Smashcraft delivery state — 4 October 2026

## Usable checkpoint: 0.0.40

The integrated candidate is playable in the observed two-client online journey.
Both retained Warcraft clients loaded the same map, entered a fight, moved,
attacked, used specials and jumped. A controlled damaging exchange left Archer
at 15% and Rifleman at 19% on both clients. Pause froze both clients; resume
continued play. An intentional walk-off exercised stock loss and the result
screen. Both players acknowledged rematch, returned to selection and entered a
second fight. Further response and mapper trials used subsequent fights.
Both retained clients remain signed in. No companion writer is running.
The subsequent experimental 0.0.41–0.0.43 journal trials are recorded at
wc3-melee:docs/journal-pause-checkpoint-20261004.md. None established usable
original-frame journal gameplay. In 0.0.43 both helpers retained 5 ms taps,
including one during a 250 ms helper stop, but the native traces received no
production input and confirmation stayed at simulation frame 0. Both clients
then left through ordinary score/browser screens without restart. Exact
0.0.40 bytes are restored in both map folders; journal43 is archived privately.
The earlier recovery from journal42 accepted a 200 ms movement hold, changing
Archer x from -240 to -135. No further latency claim follows from that recovery.
A fresh two-client 0.0.40 fight was restored after journal43. Native screens
showed Archer/Rifleman and build playable-0040 on both clients; Archer moved
from x=-240 to x=27 and started attack serial 1. This closes map restoration,
not a new latency or original-frame guarantee. The fight is retained paused.
A separate fresh 0.0.40 match after the 0.0.41 recovery accepted movement, and
both clients completed ordinary Quit Mission to their score screens. The later
F5 requests did not establish those exits.

The input source is keyboard, with local prediction and direct synchronization.
This is the path consumed by the existing digital Xbox keyboard mapper. The
operator reports that controller play was already responsive before the FileIO
experiments. Those experiments concern a separate continuous-analog path; their
multi-second delays do not establish a regression of the keyboard mapper.
This native check used private XTEST key presses, not physical controller input.

During the controlled held-action trace, both observers recorded the same
attack frame 11585, damage/launch frame 11589, specials, jumps and six confirmed
frame/checksum pairs. Across idle, initial action and held-action traces, all
18 recorded pairs agree. Every trace reports zero dropped rows; recorded
summary intervals show zero rejected rows, speculative failures or rollback
window blocks. Corrections were exercised, with maximum observed replay depth
15 frames in the held-action trace. This is bounded agreement, not every-frame
or physical button-to-pixel proof.

The first action sequence used xdotool's very short default taps and did not
register every injected action. The second used explicit 100 ms presses and
recorded both players' attacks, specials and jumps. Polling can miss a press
that occurs entirely between samples. No arbitrary short-tap/stall retention
guarantee is claimed; this remains a known capture limit, not a reason to delay
handing over the working candidate.

## Local response after capture

The clean response probe recorded six recovery-separated 100 ms shield presses
per client, with 600 ms release gaps. All 12 presses entered predicted shield
state in the exact callback that captured them, while confirmed shield was
still false. Local logical feedback therefore did not wait for synchronized
confirmation in this check. Native game-clock poll/presentation timestamps were
equal at their recorded precision; this is not zero physical latency or a
button-to-pixel percentile measurement.

An initial rapid-repeat sequence used only 220 ms release gaps and overlapped
the game's 15-frame shield-release recovery. Its later shield appearances
cannot be assigned as per-press input latency and are excluded from that
conclusion. Evidence: wc3-melee:docs/native-playable-0040-evidence-20261004/response/.

The current Rust SDL3/EventMapper/enigo companion was then rebuilt and exercised
with one virtual Linux controller against client A in a fresh fight. Its private
foreground check returned true before emission. Movement and all three 100 ms
attack presses reached native play, and both clients recorded attacks at frames
5767, 5809 and 5851 with six matching confirmed checkpoints. No trace drops,
rejected rows or speculative failures appeared. This closes the observed native
software mapper-to-game seam; it does not replace a physical controller trial.
Evidence: wc3-melee:docs/native-playable-0040-evidence-20261004/controller-mapper/.

## Artifact and use

Private map:
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/Smashcraft 0.0.40.w3x

SHA256: 13f0ba7f6a78eff1c7f71e14f2c398ebeb38c6f24b06aad9b2540f4f7eaa1f17.
Both clients' Maps/00-Smashcraft folders contain these exact bytes. Previous
maps are archived privately. Source: fa681100fc429735720325bf479f5bcd6944f25d,
with map-version 0.0.40. Build completed and its capacity lease was released.

Build configuration: WC3_INPUT_PROFILE=shadow-d0-r24,
WC3_INPUT_SOURCE=keyboard, WC3_PRESENTATION=pool-predicted,
WC3_RESPONSE_SERVICE_PROBE=1, WC3_BUILD_ID=playable-0040, WC3_DEPLOY_MAP=0.
Use wc3-melee:build.sh with the private physics-base.w3m and private asset root.

The retained Xbox profile is
~/code/wc3-melee/worktrees/test-loop/tools/controllers/xbox.amgp;
the installed AntiMicroX configuration already selects it. It maps stick
left/right/down to W/R/E, up to Space+I, A to attack N, X to special U,
B/Y to jump I, RB to grab O, LB to walk P, triggers to shield Q and Start to Y.
These primary keys match the bindings exported by this candidate. Keep one
mapper active only for the intended game. Digital mapping supplies no
continuous stick angle, analog walking speed or trigger pressure.

Evidence: wc3-melee:docs/native-playable-0040-evidence-20261004/.
Draft source PR: https://github.com/tompassarelli/smashcraft/pull/24.

## Remaining work, separated from usable delivery

33 ms median / 50 ms p95 / 83 ms p99 are measurement guides, not acceptance gates.
Physical controller response, guaranteed intended-frame retention during stalls,
visual/audio correction quality, full native physics fidelity, additional
platforms/controllers and 3–4-player coverage remain unestablished. The present
result supports viable online gameplay; it does not close those broader claims.

Binary32 explicit-operand repair e3714f629113ee682353c3244065fee3e7d9ae16 is pinned
and integrated. Upstream focused checks passed 15/15; consumer scalar/DI/launch
checks passed 22/22. Six common VFX cues are integrated; Impact checks passed
21/21. Canonical world-scale representation loss remains open. Green focused
checks are not being repeated to delay this checkpoint.

Direct sync remains the best measured transport: native32 all 120/120 correct,
30 Hz means 75–80 ms and 60 Hz means 108–114 ms. GameCache and selection encoding
were slower at 60 Hz. Native34 changing script text reproduced seconds of delay;
identical script text remained fast. Native38 generated controls failed too,
so its vocabulary results cannot rank latency or integrity. Native39 was built
but not run; it is deferred while the playable keyboard candidate is delivered.
Detailed research: wc3-melee:docs/warcraft-api-netcode-findings.md.

Original 08:38:38 Taipei deadline was missed. The later one-hour checkpoint
request arrived at 14:26; this playable journey completed before 15:26.
Peer listeners remain stopped by instruction. Physics/VFX child work is settled.
The journal pause worker is also settled. Its change compiled and passed focused
checks; a native partial-control-file failure was repaired in the companion.
The corrected helpers retained a 5 ms press/release at original frame 19 but
their driver never reached resume or its controlled service stall. Native final
pause/resume and timely original-frame application remain open. The 0.0.40
artifact remains available independently of this diagnostic's unfinished leave.
Issues 3/4/21 remain closed for their delivered scopes; this bounded gameplay
check does not justify closing broader acceptance issues.
