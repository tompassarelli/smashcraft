# Fixed-script vocabulary ingress — candidate 0.0.36

This candidate tests whether immutable filenames carrying only 64 distinct
preload scripts avoid the source-text-dependent delay measured in 0.0.34.
It does not yet have native performance evidence. The conventional alternative
is the existing FileIO tooltip boundary carrying a complete changing I4 packet;
0.0.34 showed that identical script contents at fresh paths stayed fast, while
changing only a comment reproduced the delay. These observations select the
finite-vocabulary experiment without establishing Warcraft's internal cause.
Sources: wc3-melee:docs/warcraft-api-netcode-findings.md and the resolved
WurstStdlib2 FileIO implementation at commit bb1e0458db5a.

wc3-melee:wurst/VocabularyIngress.wurst reads an immutable base path's
`-length.pld` marker first. Its one returned alphabet character gives the packet
length, bounded by the production protocol's 17-byte maximum header plus two
21-byte records: 59. It then reads `-c0.pld` through `-c(length-1).pld` and
concatenates their single characters. Every script, including length markers,
is one of the same 64 exact source strings. Filenames carry build/source/sender/
arm/sequence/offset; script source carries no changing comment, frame or identity.
The tooltip is cleared before and after every read. Missing marker or symbol
returns empty for retry; malformed data is rejected by the existing I4 path.
No value is inferred from file absence.

The writer must publish all symbols before atomically renaming the marker into
place. Published packet bases are immutable and never overwritten. This is a
representation adapter only: the production JournalInputSource continues to
validate canonical bytes, epoch, first frame, row count and admission cursor.
The live companion has not been changed.

| Arm | Offered packets/player/sec | Records/packet | Source |
| --- | --- | --- | --- |
| 0 | 30 | 2 | Generated canonical I4 |
| 1 | 30 | 2 | Changing whole-packet script |
| 2 | 30 | 2 | Fixed-script vocabulary |
| 3 | 60 | 1 | Generated canonical I4 |
| 4 | 60 | 1 | Changing whole-packet script |
| 5 | 60 | 1 | Fixed-script vocabulary, contents previously used by arm 2 |

Each arm offers 300 packets per active player. Original frames run 1–600 in
30 Hz arms and 1–300 in 60 Hz arms, at epoch 36. Shared typed Wurst fixture logic
changes held directions, press/release edges (including completed short taps),
axes, triggers, press-time metadata and throw contributions. All arms use the
same seven-character `D0V`/arm/sequence envelope and send their actual source
result through SC_GP. The receiver compares complete expected bytes, invokes
JournalInputSource, and compares every decoded NetworkInput field. No generated
replacement hides a missing or corrupt file result. Local and peer integrity
counters remain separate; echo-age measurements describe own echoes only.

No explicit prewarm occurs. Arm 2 includes first use of the vocabulary during
this run. Arm 5 deliberately retains prior-content reuse, so it is not a second
cold observation. Receipts label this distinction and retain the first packet's
read/echo duration. Per-sample read and echo timings are exported after all six
arms, keeping first-use and later samples available. Fresh BUILD_IDs prevent
filename reuse; they do not prove the engine discarded source caches between
map loads. Do not call the arm cold across retained native client processes
without further evidence.

Run the focused check through the shared capacity helper (about 30 seconds in
this lane). It uses the pinned project compiler, checks 3,600 packets / 5,400
rows against the production decoder and JournalInputSource, emits a checked
corpus and compiles the reader/probe without object injection:

```bash
cd ~/code/wc3-melee/worktrees/vocabulary-ingress-20261004
nix shell nixpkgs#bun --command bun ~/.codex/skills/machine-capacity-distilled/scripts/machine-capacity.mjs run --class moderate --owner codex:/root/vocabulary_ingress --timeout-seconds 180 -- ./tools/netcode-probe/check-vocabulary-ingress.sh
nix shell nixpkgs#bun --command bun ~/code/wc3-melee/worktrees/vocabulary-ingress-20261004/tools/netcode-probe/generate-vocabulary-fixtures.mjs netcode-0036 0 ~/code/wc3-melee/worktrees/vocabulary-ingress-20261004/build/vocabulary-check/corpus.txt ~/code/wc3-melee/worktrees/vocabulary-ingress-20261004/build/vocabulary-fixtures
```

Use the same BUILD_ID during normal map packaging. The check expects the pinned
compiler artifact at wc3-melee:toolchain/wurstscript.jar. The generator is an
existing-style Bun foreign filesystem/JASS boundary; all packet semantics are
owned by Wurst. For the measured two-client layout, source is 0 and active
sender slots are 0 and 1. The probe selects the first active source slot.
The generator intentionally supports sender slots 0/1 only for this experiment.

Observed generation: 2,400 packets, 32,210 scripts, 3,442,870 script bytes,
1,200 marker files, packet lengths 14–44, all 64 vocabulary scripts used.
Each vocabulary script is 106 bytes. Whole-packet scripts are 105 bytes plus
packet length. Copy the complete fixture set into **both** clients'
CustomMapData directories before starting the candidate; the JSON summary is
not loaded by Warcraft. Live publication must retain marker-last atomicity.

Existing Ctrl+P starts the synchronized probe when the normal diagnostic build
has RESPONSE_SERVICE_PROBE and JOURNAL_INPUT_SOURCE enabled and shadow input is
active. Existing begin/end names remain
`smashcraft-fileio-probe-BUILD-sS-aA-{begin,end}.txt`; sample pages are
`smashcraft-vocabulary-samples-BUILD-sS-aA-pageP.txt` (10 pages per arm).
Check 300 attempts/sends/echoes, zero read/record/send/duplicate/peer errors,
300 peer packets with two players, and complete per-sample receipts. Each arm
waits for own and peer packets or a 20-second drain bound. A timeout or missing
receipt is incomplete evidence, not success.

Normal-map packaging/object injection and the retained two-client native run
remain required. If vocabulary stays fast at both rates while preserving all
rows, the next action is integrating the companion writer. If it has the same
seconds-long backlog or its many reads make the offered rate impractical,
reject this representation; do not roll it into production.

Preparation observed in the implementation lane: focused Wurst test 1/1 passed,
compilation reported zero errors and zero warnings, and a separate readback
reconstructed all 2,400 generated on-disk packets exactly against the checked
corpus with exactly 64 distinct vocabulary script source strings. This proves
fixture bytes and typed source consistency, not native Preloader behavior.


Native36 startup did not deliver any probe receipts; both clients ended at the
score screen. No vocabulary performance result follows. Startup-instrumented
0.0.38 retains this same corpus/epoch36 and six arms, using BUILD_IDnetcode-0038
and fresh filenames. CandidateSHA256
`f2d678bad9c0f7268a870fc47135950cf4ab759a723253e0c1c979b9feeab411`.
Startup markers distinguish local request, sync reception, and reset completion;
the developer F5 exit handler now leaves a separate marker. All markers precede
timed samples. Source `fc26d79`; built before later physics/VFX integrations.


Native38 finished all24 receipts and120 sample pages, but all arms recorded
zero own/peer receipt, including generated controls. No performance verdict.
Source39 next runs only the generated30Hz arm to establish rawSC_GP delivery.
It counts receiver entries before parsing and suspends normal journal reads
from local start request through the synchronized probe. Startup logs include
accepted/rejected start send. This is a harness isolation experiment, not a
production fix. Existing38 fixture paths are retained (no file arm runs); it
is explicitly not a fresh-path or cold-cache vocabulary comparison. Expect
four begin/end receipts and20 sample pages, not the prior six-arm totals.
The first rawSC_GP event writes one marker and can perturb that sample.
