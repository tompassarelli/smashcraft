# Focus-free immutable-file ingress: bounded native result

Both retained distinct-account Warcraft III 3.0.0.24268 clients joined the online
custom game sc-immutable-0014 and loaded Smashcraft 0.0.14. Neither game nor its
private desktop was restarted; no sign-in occurred. Candidate BUILD
20261003T203950917701952, SHA256
d551fd1604f4b30959d38851dbe5eb2f179bb67d080f613a726e06b7a7a271c6.
Private artifact:
~/.local/share/smashcraft-build-inputs/immutable-file-ingress-20261004/build.p0EXmq/Smashcraft 0.0.14.w3x.

## Observed

Each client first read a nonexistent retry filename with pinned FileIO; its
fresh native receipt recorded an empty read. The host publisher then atomically
created that exact filename separately in each prefix. Both later read its
expected payload. A first succeeded at retry 1 (250.244 Warcraft timer ms); B
at retry 2 (500.244 Warcraft timer ms). These are callback-clock observations,
not file-publication-to-read wall delays or latency bounds. The host publication
brackets and exact initial ready receipts are retained in the publication JSON.

Each client read three other immutable, precreated filenames once, in sequence.
All four local records exactly matched their authored ASCII ID/frame/action
strings. Each transmitted four records with IF1. Each observer received exactly
one matching copy from each sender: 8/8 at each observer, 16/16 observer receipts
total. This is four distinct authored records replayed by two senders, not sixteen
independent capture samples. Both final exports report callback 40, three unique
matches, retry delivered and eight synchronized receipts. The probe ran about
ten Warcraft seconds at 250 ms callbacks. No gameplay key or editbox focus was
used for file delivery.

Code: wc3-melee:tools/netcode-probe/ImmutableFileIngressProbe.wurst.
Builder: wc3-melee:tools/netcode-probe/build-immutable-file-ingress.sh.
Pinned compiler 9913e1bd300c2053637d756a11bae8c3c8ed568f and stdlib
bb1e0458db5a372ba2a6928112452785e435d01a. Build completed with zero errors/warnings,
Lua syntax and packaged-script checks passed. Evidence:
wc3-melee:docs/native-immutable-ingress-20261004.

## Decision and limits

Reading a filename while it is absent did not permanently prevent these later
reads. This resolves one uncertainty in the immutable-file bridge: a producer
can publish a previously missing sequential record without requiring gameplay
keyboard focus. Previously observed stale content when overwriting an already
loaded filename still rules out assuming mutable-file reload.

Proceed to live helper publication using immutable sequence files and the
production rollback ledger. This experiment does not implement that integration
or prove continuous throughput, bounded queueing, file-cache memory behavior,
60 Hz service cost, physical capture, aligned clocks, correct intended frame
assignment, hitch recovery, combat application, or visual/audio quality. Its
250 ms polling rate is diagnostic and is not a selected gameplay delay.
Competitive HOLD remains; the overall online/controller objective stays active.

## Reproduction

Build the source through its builder using a private base map. Use the printed
build ID in all filenames. For each prefix, precreate 000002, 000003 and 000004
PLD files in Documents/Warcraft III/CustomMapData, with the exact V1 payloads
shown in the probe. Each PLD defines PreloadFiles and sets $wsl tooltip level 0.
Leave the retry filename absent. Load the map in an actual two-account online
session. Observe each build/slot-specific ready receipt containing an empty
INITIAL_MISSING_READ. Only then atomically publish its retry filename with
V1|000001|000000|000001|1;. Wait for phase=complete and compare exact sender/wire
receipts; a send_ok or successful build alone is not acceptance.

Ending state: both original clients retained in completed 0.0.14 probe.
Maps/00-Smashcraft contains only 0.0.14 in each prefix; 0.0.13 is privately
archived under ~/.local/share/smashcraft-build-inputs/native-map-archive-20261004.
