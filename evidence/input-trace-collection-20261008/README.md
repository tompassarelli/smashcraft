# Pad input-trace collection

Commit `676ed728` extended response-probe traces from 1,200 callbacks (20 s)
to 4,500 callbacks (75 s) for the item capture. The pad collector still allowed
45 s after the script finished. CPU-Archer's original script ends at frame
1,000, so collection stopped around 62 s, before the trace could be written.
Both trace-start receipts were present in farm run 37671742327, job
112967168821; all four edges and the 710-frame exported replay already passed.

The retained terrain comparison shows the same difference: the original
passing Stratholme trace ends `1200 20.000 end`, while the integrated hazard
session's trace ends `4500 75.000 end`. Adding movement did not change this
collection deadline.

The repair shares the 4,500-callback duration between producer and collector.
The collector allows that recording plus its existing 25-second delivery
grace and returns immediately when both fresh files exist. The producer's
duration, pad edges, frames, checksums, and assertions are unchanged.

The original CPU-Archer fixture and original neutral-only Ahn'Qiraj fixture
from `aca88749` ran together through the real journal helper in headless
clients, with retries disabled: **2 PASS, 0 FAIL, 0 INVALID in 153.4 s**.
CPU-Archer retained four on-frame edges, 12 equal confirmed checksums,
710 equal script rows, 190 equal fighter lines, and all three expectations.
Ahn'Qiraj retained its original two View edges on their frames and passed
the same replay comparison. Both clients published fresh 75-second traces
for each case. No native Warcraft clients ran.

Source tested: `7ca5eedd` plus this collector repair. Raw runs and the untouched
original Ahn'Qiraj script are in
`~/.local/state/smashcraft/input-trace-20261008/`.
Helper: `~/.local/state/smashcraft/wisp19-20261007/4ec5b823/wc3-journal`.

Original fixture SHA256:

- CPU-Archer: `1555808c95436766df3bfe51da9f652876eee199ce1aa4ef945c09d6cdf2a5f3`
- Ahn'Qiraj: `b5632bf87093d9eb2657785202499f79a6f0967df6ef91864a900336351d8370`
