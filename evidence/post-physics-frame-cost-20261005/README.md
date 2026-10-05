# Post-physics native frame cost — 5 October 2026

The final TypeScript production simulation ran 4096 frames in Warcraft in
**1.389648416 seconds**. The retained historical Wurst workload took
**1.450195296 seconds** for 4096 frames. The observed TypeScript/Wurst ratio
is **0.958249154326315**, below the ≤1.0 frame-cost target. This comparison
uses one native sample per implementation; the Wurst sample was retained from
the earlier paired benchmark, not rerun alongside the final TypeScript sample.

TypeScript source: `5a60a9cfd8198a6f7319b8169c9ba3796200cf72`.
The native diagnostic receipt identifies bundle `7456824-48244`.
Private diagnostic map SHA256:
`ccb0add570defcf3dc2b92e996a63dbb10d0a5bde89caf9ba7579845874ff362`.
The historical Wurst source and map identity are recorded in
smashcraft:evidence/native-frame-cost-20261005/README.md.

smashcraft:evidence/post-physics-frame-cost-20261005/result.json contains
the decoded numerical records and complete canonical final-state strings.
The existing canonical checksum function validates each final-state string
against its own receipt: TypeScript `52536:209825`, Wurst `391715:668934`.
Comparing fields by name gives **874 shared fields, 0 differences**.
TypeScript contains **16 additional fields**, all zero in this final state:
original/published X/Z knockback and shield recoil for each of two fighters.
The result lists their exact names and values. The complete schemas, initial
checksums, final checksums and state strings therefore differ; this evidence
establishes shared-field equality, not identical full-state parity.

Timing uses Warcraft's `os.clock`, as in the earlier benchmark. No native
run or passing test was repeated to prepare this record. Only decoded,
authored numerical receipts are published; the diagnostic maps, proprietary
assets, raw client files and account paths remain private. This frame-cost
sample does not measure input response or a distribution of simulation cost.
