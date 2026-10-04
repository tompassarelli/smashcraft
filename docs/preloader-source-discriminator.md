# Preloader source discriminator

Reserved candidate: Smashcraft 0.0.34. This diagnostic separates changed preload
script execution from sending the string returned by the tooltip read. It has
no native result yet; earlier FileIO observations remain in
wc3-melee:docs/warcraft-api-netcode-findings.md.

Each arm offers 300 messages per client at 30 Hz through the existing SC_GP
receiver. Every valid envelope is 22 bytes: a three-byte arm prefix, three
sequence digits, and `D0B` plus those digits plus ten zeroes.

| Arm | Prefix | Fresh local source | Sent value |
| --- | --- | --- | --- |
| 0 | D0C | No file; generated changing value | Generated changing value |
| 1 | D0D | Direct Preloader; changing tooltip | Generated changing value; read verified and discarded |
| 2 | D0E | Direct Preloader; constant script and tooltip | Generated changing value; read verified and discarded |
| 3 | D0F | Direct Preloader; only a fixed-width comment changes; constant tooltip | Generated changing value; read verified and discarded |
| 4 | D0G | Direct Preloader; changing tooltip | Actual returned string, after verification |

The constant tooltip is `D0B0000000000000`. All scripts have the same byte
length. Arm 3 changes only the three digits in `// NNN`; other arms retain
`// 000`. Arms 1 and 4 have identical script content for the same sequence but
disjoint filenames. No arm prewarms files. Use a fresh build ID for each native
trial, including repeats: repeating a trial with the same build ID may hit the
engine's file cache.

Generate fixtures with the same BUILD_ID selected during map packaging:

```bash
bun ~/code/wc3-melee/worktrees/preloader-source-discriminator-20261004/tools/netcode-probe/generate-preloader-source-fixtures.mjs netcode-0034 2 ~/code/wc3-melee/worktrees/preloader-source-discriminator-20261004/build/preloader-source-fixtures
```

The source slot uses the existing active-participant selection: slot 2 when
active, otherwise slot 0 when active, otherwise the first active slot. Pass
that slot to the generator. It writes 4,800 files, covering sender slots 0–3
and arms 1–4. Copy the complete generated set to **both clients' CustomMapData
directories** before loading the candidate. Filenames distinguish build ID,
selected source slot, actual local sender, arm and sequence.

Existing Ctrl+P starts the synchronized diagnostic. Begin/end receipts retain
the `smashcraft-fileio-probe-BUILD-sS-aA-{begin,end}.txt` filenames, while their
receipt type is `preloader-source-discriminator`. They label source method,
returned-string usage, expected read and wire values. Echo integrity always
checks the generated changing payload, including arm 4. Existing counters
measure own echoes only; peer echo timing is not claimed. Read errors,
send failures and duplicates retain their existing cumulative counters.

Source compilation and fixture generation do not prove native file loading,
message latency, callback cadence, or the source of the previously observed
seconds-long delays. Those require the retained two-client trial.

Preparation check: fixture generation produced 4,800 scripts of 128 bytes each;
inspection confirmed constant/comment-only isolation, matching arm 1/4 content,
and 22-byte expected envelopes. Standalone compilation reached FileIO's
compile-time object definition and stopped because no map was supplied for
object injection. Map packaging remains the compilation gate for this candidate.
