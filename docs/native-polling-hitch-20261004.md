# Native polling loses a press/release during a client stop

Candidate: Smashcraft 0.0.13, BUILD 1791057726, SHA256
7daec0735a9ed7a895e3e77c71c35febf8841f3bcfd7af444729fc5d6d108cce.
Warcraft III 3.0.0.24268, Linux Steam/GE-Proton, two distinct online accounts,
shadow-d0-r24 / pool-predicted. Retained clients; no restart or sign-in.

## Measured result

The native response probe run 2 contains 163 service rows, all MATCH (phase 2),
163 polls, 161 capture attempts, 163 advances and 163 presentations. Five shield
press/release pairs were injected through private XTEST: three before a client
stop, one wholly inside the stop, and one after resuming. Four shield pairs
(mask 256) are recorded; the stopped pair is absent. The later developer dump
chord also creates a distinct mask 8192 pair, excluded from shield counts.

SIGSTOP/SIGCONT request timestamps span 284.607 ms (17.08 nominal 60 Hz frames).
This is the host interval between successful signal requests, not an independently
observed process-stop duration. The press during that interval was held for
approximately 100 ms plus input-command overhead. Exact host command brackets
are in the injection JSON. No cross-machine clock subtraction is used. Probe
milliseconds are Warcraft game time, not host wall time or photon latency.

The earlier run 1 was invalid: it ran after time expiry, with phase RESULT,
zero polls/captures/advances. It is excluded from timing acceptance.

## Cause and scope

Code inspection: wc3-melee:wurst/Melee.wurst shadowPollLocal uses
BlzIsKeyPressed to poll held state. Broad key events are removed during shadow
combat by syncKeyEventLifecycle. shadowCaptureLocalInput samples that state once
per serviced callback. A full press/release between serviced polls is therefore
not retained in the captured input ledger. The result is consistent with that
mechanism; it is an implementation-path limitation, not evidence that every
Warcraft input path is impossible. Rollback cannot reconstruct an absent edge.

Intervention: consume independently retained, timestamped helper events through
live native ingress and assign them to an independently defined common frame.
The helper journal/replay trials do not yet prove this live integration. The SDL
cold-start timestamp defect is separately unresolved. Native key-event and
command paths remain candidates to compare, not established solutions.

Decisive next test: repeat the same five pairs with live helper ingress, verify
all ten ordered edges and their intended frame identities at capture, receipt
and application, then inspect corrections on both displays. Do not accept a
queued pulse assigned to the recovery frame as preservation of original intent.

## Other native evidence

Fresh per-client trace files have distinct inodes and differ in local rows.
The attack trial records identical applied attacks at frames 21363, 21418 and
21468 and matching six confirmed checkpoint hashes. B's maximum correction
replay depth is 15 frames. Replay depth is not input delay. The following contact
attempt records attacks but no new damaging contact; damaging combat is still
unaccepted. A prior single-side file shows 12 damage but lacked a fresh matching
B export, so it cannot close two-client combat acceptance.

## Verdict

Competitive HOLD. This keyboard polling path does not preserve all input intent
under a client hitch. A helper event journal is a justified development direction,
but its live common-frame assignment remains unverified. Physical Xbox response,
visible/audio correction quality, real human matches, hosting alternatives,
3/4-human play and ten matches remain open. No local latency percentile or bound
is claimed from these game-clock rows.

Evidence: wc3-melee:docs/native-playable-0013-evidence-20261004/response-hitch-fight-injections.json,
wc3-melee:docs/native-playable-0013-evidence-20261004/fight-hitch-smashcraft-response-p0-run2-page0.txt,
and the corresponding page1. Reproduce in an observed MATCH: Ctrl+G; three
100 ms Q holds with 200 ms gaps; stop the owned A process; inject Q down/up
inside the stop; resume in a finally block; inject one further Q pair; Ctrl+H.
Require fresh exports identifying the expected build, local slot and MATCH phase.
