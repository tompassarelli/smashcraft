# Capture diagnosis and corrected text extraction

The PNG capture is clean. The inspection error was full-screen OCR treating the game's wood grain and decorative edges as letters. One bounded 34,114-byte JPEG crop from the 14:09 UTC capture visually confirmed crisp Single Player, Multiplayer and Replay labels. The source PNG decodes as 2880×1920 RGBA with alpha=255 throughout. There is no evidence of a Niri, driver, channel-order or alpha-compositing corruption bug.

The corrected OS/OCR investigation helper is `wc3-melee:docs/competitive-integrity/capture-menu-text.py`. It crops explicitly supplied label regions, retains bright white/yellow text, and uses Tesseract's single-line segmentation. It preserves measured physical and logical coordinates and OCR confidence in text JSON. There are no hardcoded expected labels. A cursor covering the label can still reduce recognition; `primary-held-click.png` has that occlusion on Multiplayer.

The nearest observed positive check is `wc3-melee:docs/competitive-integrity/capture-corrected.json`, extracted from the existing 2026-10-03 14:05:16 UTC `primary-after-queue.png`. It is explicitly marked `fresh_capture: false`:

| Text | Lowest word confidence | Physical label center | Logical label center |
|---|---:|---|---|
| SINGLE PLAYER | 91.35 | (2218.5, 750) | (1109.25, 375) |
| MULTIPLAYER | 91.47 | (2218, 965) | (1109, 482.5) |
| REPLAY | 91.78 | (2218.5, 1181) | (1109.25, 590.5) |
| OPTIONS | 90.28 | (2218, 1396) | (1109, 698) |

Coordinates are window-relative. XID 169869313 reports origin (0,0) and 2880×1920, so its native X coordinates match these physical coordinates. Niri window 355 reports 1440×960; output eDP-1 has scale 2. A native XTEST click at (2220,970) was on Multiplayer, so the prior failed transition is not explained by a factor-of-two coordinate error. Button activation remains unproven and outside this read-only assignment.

Fresh capture is currently blocked by the locked desktop: Niri logged `locking session` at 2026-10-03 14:11:00.566014 UTC, and all listed windows are unfocused. A `screenshot-window --id 355 --path <unique-path>` command exits zero while creating no image. The helper was checked against this actual state: it waits for a newly decoded image, times out after ten seconds, reports failure, and never reads an earlier image. No unlock, focus, input injection, restart or authentication change was performed.

After the operator's session is available, the exact read-only invocation is:

```sh
NIRI_SOCKET=/run/user/1000/niri.wayland-1.3351.sock nix shell nixpkgs#tesseract -c /run/user/1000/private-desktop.KnmRfuDP/venv/bin/python /home/tom/code/wc3-melee/worktrees/test-loop/build/two-clients/competitive-integrity-20261003/capture-menu-text.py --window 355 --output-prefix /home/tom/code/wc3-melee/worktrees/test-loop/build/two-clients/competitive-integrity-20261003/capture-live --scale 2 --region 2050 725 2390 775 --region 2050 940 2390 990 --region 2050 1155 2390 1205 --region 2050 1370 2390 1420
```

These regions apply to the demonstrated current main menu at its measured resolution, not arbitrary screens. The upstream capture implementation needs no repair on the observed evidence. The OCR consumer is corrected; a fresh game-state claim awaits a successful fresh capture.
