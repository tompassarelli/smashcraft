# Frame-tagged history probe (0.0.9)

The native map polls the focused local editbox every 1/60 game-second, parses
only complete semicolon-terminated records appended since its prior read, and
sends each new event ID through `BlzSendSyncData`. Exact local rows are saved
separately from synchronized receive callbacks. It does not apply events to
fighter combat or derive tags from callback time.

Wire form is exactly `V1|iiiiii|tttttt|ffffff|a;`: six decimal ID digits,
elapsed microseconds relative to the externally declared epoch, six decimal
intended-frame digits, and action `0` or `1`. The frozen input-clock contract
defines `frame = 1 + floor(elapsed_us * 60 / 1000000)` and D=0; the native
corpus tags remain authoritative for this comparison. One record is 26 ASCII bytes;
nine records total 234 bytes, within the 240-byte editbox cap. Use the frozen
oracle at `competitive-integrity-20261003:evidence/frame-tagged-history-corpus.json`.
Its frame rule is `1 + floor(elapsed_us * 60 / 1000000)` with D=0; preserve its
frames verbatim. Boundary examples are 16666→F1, 16667→F2, 66666→F4 and
66667→F5.

Parent procedure: start candidate 0.0.9 with two clients; confirm each focused
field, then use each participant's frozen corpus. For the late-delivery trial,
deliver the externally chosen F5 record after it is already four simulation
frames late. For preservation, STOP both owned Warcraft processes, verify
stopped state, inject the complete corpus, verify stopped state again, wait the
specified 250 ms, then CONT in `finally`. Save each client output. Compare the
local `L` wire rows to the corpus and compare both observers' `R` rows by
sender, event ID, elapsed value, frame and action. `L` time is the local
Warcraft timer when polling observed a complete row; `R` time is the Warcraft
timer in the synchronized receive callback. These clocks are not aligned to
the external epoch or each other.

The event ledger sends one ID once, treats same-ID/same-wire repeats as
duplicates, and reports same-ID/different-wire records as conflicts. Repeated
editbox prefixes are not rescanned. An incomplete suffix stays pending until
its semicolon arrives and is exported at save. The map has no combat effects.
Synthetic timestamps bypass device/SDL input and cannot establish physical
latency, shared-clock alignment, production frame assignment, rollback, or
competitive combat fairness.

Build with the pinned toolchain using
`wc3-melee:tools/netcode-probe/build-frame-tagged-history.sh` and the private
base map. The resulting map is stored outside the repository under
`~/.local/share/smashcraft-build-inputs/frame-tagged-history-probe-20261004/`.
Run the three parser/ledger unit cases with
`wc3-melee:tools/netcode-probe/test-frame-tagged-records.sh`.

## Build verification and handoff

Parent recovered directly after an unreadable collaboration checkpoint and
interrupted that worker channel; source files were preserved. The collaboration
transport defect remains unresolved. No native session was restarted.

Focused parser/ledger tests passed3/3, zero compiler errors/warnings. Private
candidate compilation, Lua syntax and archive byte comparison passed.
Build ID20261003T181114345729716, SHA256
fa6b830d9fc6880d008aa8ffe771046c04d38312d7737b7e67ea2efddb9165ec.
Candidate:
~/.local/share/smashcraft-build-inputs/frame-tagged-history-probe-20261004/build.J3Fe3H/Smashcraft 0.0.9.w3x.
Both parent-owned resource scopes reported RELEASED. Native loading and
frame-tag preservation are untested; parent retains that work.
