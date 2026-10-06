# Saved camera and agency capture interpretation — 6 October 2026

The remaining native boxes for #80 and #94 are **not established by these saved captures**. This is an observation boundary, not a diagnosis of the rendering cause. No additional native run or client input was performed during interpretation; existing logical, compiler, Lua32 and headless passes were reused.

The map was `~/.local/share/smashcraft-build-inputs/native-acceptance-20261006/Smashcraft diagnostic native presentation.w3x`, source `e6fb992e`, main keyboard/native-unit profile, SHA-256 `af9900c62126fa62c3baf87ec2771114e2d59b05856694e1378152b29c29b5af`. Both clients used 2560×1440 private desktops. Captures remain private at `~/.local/share/smashcraft-build-inputs/native-acceptance-20261006/captures/`.

## Camera

The host issued `-dev camera`. The saved bubble-interval frame's OCR identifies `typescript-dev`, `phase=2`, `x=1126 z=300`, `simulation=47`. The saved video has 410 frames at 1280×720, duration 6.816667 seconds; its final interval and the subsequent client observations identify result phase 3, player-one x=1566, z=175 and simulation frame 193. Both clients reached the result. This confirms the intended fixture ran and completed its ordinary stock loss.

The portrait plus directional arrow cannot be positively identified from the saved interval captures. Whole-frame OCR and a 450×850 right-edge crop at x=2100, y=220 did not identify the arrow. A source-portrait pixel comparison did not isolate a reliable portrait match. The saved capture therefore cannot close the native bubble/arrow requirement or independently establish the visual location of the KO. Required remaining observation: an identifiable portrait and arrow while the fighter is alive outside the view, followed by the KO outside that view.

Private artifact hashes:

- `camera-a.mp4`: `fc191dbc8a856a007b0c89d828702031783aff2d1120134ccf00f1c4d49215e8`.
- `camera-bubble-a.png`: `f025f57339c25fcc7ee7e2f019bae18242bd7abb3fd9ef1359d77318cc02d16f`.
- `camera-bubble-b.png`: `4c07f90da68387f0b2bdcfbbca0204a9934631e49506c0083c6633208b45dc08`.
- `camera-ko-a.png`: `e3a34e3697fa0f7b4d52cbc94b57bc0dd361dce68fc8f081df13573bf4100614`.

## Agency markers

All 18 images exist: `agency-{archer,rifleman,illidan}-{none,di,act}-{a,b}.png`. The commands restarted matching fighters and paused each state. The final receipts on both clients agree on `agency illidan act paused p0=act,ice=0,hitlag=0 p1=act,ice=0,hitlag=0`. Static samples exist; no timed `thaw` capture was recorded before A transferred to the primary-display owner.

A bounded colour measurement examined x=250..2299, y=200..1159, excluding the HUD. Green-dominant means G>60, R<170, B<180, G>1.35R and G>1.2B. No green-dominant pixels occur in any of the six `di` images. Counts for `none` and `act` are also zero, except one pixel in Archer/A/none. Orange-dominant pixels occur in all three classes and include the native fighter's existing colours; those counts do not isolate a locked-state halo. Differences between images also include poses and accumulated chat text, so raw difference counts cannot establish marker readability.

These measurements do not prove an asset, placement, colour API or classifier defect. They establish that the saved samples do not provide the requested distinguishable green/orange marker observation. Required remaining observation: identify each drawn marker beside all three fighters on both clients, identify its absence in the actionable sample, and observe removal as the running thaw returns control. Inspect the marker's native drawn placement and visibility first; retain the already-passing classifier contracts rather than changing them to compensate for missing presentation evidence.
