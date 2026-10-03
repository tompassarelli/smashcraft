# Fast menu observation

`wc3-melee:tools/wc3-screen-state` classifies an existing disk capture of the
English Warcraft III 3.0.0.24268 menu at 2560×1440. It reads three compact text
regions in one OCR pass and returns `main-menu`, `single-player`, `create-game`,
`disconnected`, or `unknown`. Unknown and unsupported geometry return nonzero.
The disconnect label takes precedence over any underlying menu.

```sh
nix shell nixpkgs#tesseract nixpkgs#imagemagick --command \
  ~/code/wc3-melee/worktrees/wc3-screen-speed-20261003/tools/wc3-screen-state \
  /absolute/path/to/fresh-capture.png
```

Use it after a bounded input chain, before choosing the next chain. Capture
freshness remains the caller's responsibility. This tool neither captures a
screen nor sends input. It cannot establish that a map is selected, loaded or
running. These are recognition hints for these four menu screens, not a general
UI oracle. Other resolutions, languages, unexpected dialogs and menu revisions
remain unverified; stop on unknown rather than guessing a procedure.

The implementation is a shell adapter to ImageMagick and Tesseract. It preserves
the earlier bright-text threshold (red >170, green >150) and PSM 11, but masks
only label regions. OCR is limited to one OpenMP thread in both benchmark modes.
The `full` second argument provides the otherwise equivalent full-frame baseline.

## Reproduce the comparison

```sh
nix shell nixpkgs#tesseract nixpkgs#imagemagick --command \
  ~/code/wc3-melee/worktrees/wc3-screen-speed-20261003/tools/bench-wc3-screen-state \
  ~/code/wc3-melee/worktrees/test-loop/build/two-clients/competitive-integrity-20261003/native-bridge-recovery
```

The benchmark checks independently retained screen labels, alternates mode order,
and records three samples for each of four screenshots in each mode. Timings
include process startup, image identification/decoding, masking, OCR and
classification. They exclude capture, model/tool round trips, native menu input,
login, map loading and compilation. Repeated disk reads are warm observations;
they do not measure a cold launch or complete development loop. Four retained
fixtures are a bounded falsification check, not a general false-positive bound.
No proprietary screenshot is published with this tool.

## Observed result — 2026-10-03

All 24 classifications matched their retained labels. ShellCheck passed for
both scripts. Individual elapsed times (milliseconds):

| Fixture / expected state | Full frame | Compact regions |
| --- | --- | --- |
| `a-before` / main menu | 2089, 2089, 2139 | 615, 602, 611 |
| `a-after-key` / Single Player | 1992, 1986, 1998 | 635, 617, 634 |
| `a-after-custom-click` / Create Game | 2547, 2595, 2607 | 777, 721, 692 |
| `a-relative-click` / disconnected | 1934, 1915, 1920 | 553, 542, 564 |

This is roughly **3.4× faster menu observation**, saving about 1.5 seconds per
classification on this machine. It is **not** a measured 5–10× development-loop
speedup. No live GUI action or authentication was attempted in this benchmark.
The native map-entry boundary remains unresolved independently of this result.
