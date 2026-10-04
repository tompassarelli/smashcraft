# Native authored KO checkpoint — 5 October

Two online clients ran the unchanged `ko-20261005` fixture. Archer's authored
screen KO visibly approaches, tumbles, holds and departs; Rifleman's body
recedes above the platform. One pause/resume held the foreground pose, then
both live fighters returned to ordinary play. Source, authored timings and
remaining cases are in wc3-melee:docs/smash-melee-reference/vfx-inventory.md.

The six paired frame/checksum checkpoints agree. The recorded foreground crop
at 1.35 and 1.80 seconds differs by normalized RMSE 0.00002893, consistent with
the observed held pose in the lossy video. This is native presentation evidence
for the named fixture, not an exact retail-fidelity or all-camera claim.

The JSON and text files alongside this record retain the input timing, map
identity, traces and observation. The 5.433-second 30 fps compositor video is
local at wc3-melee:build/native-ko-capture-20261005/ko-pause.mp4. The earlier
failed FFmpeg capture remains recorded in the inventory; wf-recorder completed
successfully and its process was reaped. No tests or map build were repeated.
