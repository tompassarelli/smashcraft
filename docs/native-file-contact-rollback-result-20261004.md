# File-backed input corrects a native production combat exchange

Two retained, distinct-account Warcraft III 3.0.0.24268 Linux/GE-Proton clients
completed online custom game sc-contact-0016 without restarting or signing in.
Smashcraft 0.0.16 build 20261003T210905424561942 has SHA256
e375eb690d44f12344261b34632b909d7831fb8c0486bffbbb47613215d49801.
It consumes production simulation/replay sources from commit
f8838abd66dadef75b6d2638aecc3f53065591fc and the project's locked Wurst toolchain.
The separate probe replaces normal gameplay capture; this is not acceptance of
the playable map's controller or frame-assignment path.

## Experiment and observations

Both clients execute eight speculative production simulation steps before
exporting build-specific ready receipts. A jab initiated at F1 hits at F5;
without remote shield input, damage at F8 is 12. The publisher observes both
ready receipts, SIGSTOPs B, observes its process state T, then atomically
publishes eight immutable input files only into B's private CustomMapData.
All eight publications occur while B is verified stopped. A finally block
resumes it. Observed stop to resume request is 251.287 ms, or 15.077 nominal
60 Hz frames; actual resumption instant is not independently measured.

The corpus is independently authored: elapsed_ns=(frame-1)*16666667+8000000,
expected_frame=1+floor(elapsed_ns*60/1000000000), D=0. IDs and frames are 1–8;
shield is held at F5/F6. These are logical timestamps, not physical capture times
or a live common epoch. The approximately 251 ms host stop is distinct from the
four-frame F5-to-F9 counterfactual.

B's nominal 60 Hz FileIO reader retains its cursor on a missing file, drains
available immutable files, and synchronizes each original wire unchanged.
Both observers decode and accept the rows under their original frame numbers.
Edges are derived from adjacent original-frame held states before reconciliation.
The current production ledger, snapshot history and combat step perform the
correction; no hand-written replacement combat calculation is used.

| Check | Client A | Client B |
|---|---:|---:|
| Exact tagged rows accepted | 8/8 | 8/8 |
| Invalid rows / unexpected accepted frames | 0 / 0 | 0 / 0 |
| Speculative steps before ready | 8 | 8 |
| Damage before correction | 12 | 12 |
| Earliest correction frame | 5 | 5 |
| Damage after correction / shield stun | 0 / 7 | 0 / 7 |
| Corrected, canonical and confirmed F8 checksum | 650897:604915 | 650897:604915 |
| Full-state first differences against canonical and confirmed | empty | empty |
| Original F5 replay row matches | yes | yes |
| F9-retarget counterfactual damage after F12 | 12 | 12 |

There are eight unique authored rows and sixteen observer receipts, representing
one scripted exchange on two clients. B sent eight wires, performed fifteen
file reads with seven missing reads, and reports 91 poll callbacks. A sent none.
Every receipt prints observer-local game time 1524.902 ms; this is not
capture-to-response latency or proof of aligned clocks. No native time is
subtracted from the host clock or from another client's clock.

## Decision and limits

**Competitive HOLD remains.** This establishes that externally preserved frame
identity survives the tested stopped-client filesystem/sync path and corrects
the scripted exchange with current production rollback. Assigning the same
shield to F9 instead of F5 materially changes that exchange. Late delivery need
not change the final outcome when original identity is retained within history.

It does not establish reliable physical-controller timestamps, common-frame
assignment across machines, production pause/catch-up policy, visible/audio
recovery, disk cost or sustained throughput bounds. The probe waits at speculative
F8 for the corpus; it does not exercise continuous playable prediction during
the stop. No human match, local response percentile, analog control or engine-wide
worst-case guarantee follows. The observed stop is a process stall, not a measured
Battle.net packet spike. Hosting/FLO may improve delivery conditions but cannot
recover an edge never captured or repair an incorrect source frame tag.

Next required work is reliable helper capture and an explicit shared-frame clock
and pause contract, followed by a playable native trial measuring presentation.
The SDL cold-start timestamp defect and pending fork/backend decision remain
separate blockers. Do not treat warm-up as its repair.

## Reproduce and review

Build wc3-melee:tools/netcode-probe/build-native-file-contact-rollback.sh with
the private base map. It copies current production sources and checks locked
compiler/stdlib identities. The tested build passed compilation with zero errors
and three unused-import warnings, Lua syntax and packaged-script equality.
Keep the original 0.0.10 probe unchanged.

Install only the frozen 0.0.16 map in each Maps/00-Smashcraft. Start
wc3-melee:docs/native-file-contact-rollback-20261004/publisher.py before loading;
arguments are BUILD, ready-name template, required header substring and
sequence-name template. For this build:

```text
20261003T210905424561942
smashcraft-contact-rollback-20261003T210905424561942-pSLOT-ready.txt
NATIVE_FILE_CONTACT_READY v=1 candidate=0.0.16
smashcraft-contact-rollback-20261003T210905424561942-SEQ.pld
```

The retained publisher contains trial-specific process/prefix paths. Verify and
adapt those before replay; never signal an unverified PID. Require both ready
receipts to identify the candidate, source, slot and eight speculative steps.
Host/join online using two retained accounts, then start. Require both complete
exports and compare every exact wire to publication.json, accepted status 0,
original frames 1–8, empty full-state differences, and the numerical checks above.
Raw receipts, host signal/publication brackets and comparison.json are in
wc3-melee:docs/native-file-contact-rollback-20261004.
Published receipt text normalizes CRLF and trailing blank lines; native originals
remain in each private CustomMapData directory. Payloads are unchanged.

Ending state: both original clients remain in the completed probe. Each map folder
contains only 0.0.16; 0.0.15 is archived privately outside the repository.
