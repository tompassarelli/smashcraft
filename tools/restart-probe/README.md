# Restart isolation map

This developer-only map isolates the delayed “Waiting for host” failure after
the prototype's scripted restart. It uses the pinned Lua-targeting Wurst
compiler, the normal terrain fixture, and the same two-slot map configuration.
It imports no fighter assets, gameplay simulation, selection UI, or camera code.

Build from ~/code/wc3-melee/worktrees/test-loop:

```sh
bash tools/restart-probe/build.sh \
  '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Melee_Prototype_Base.w3m' \
  plain
```

Variants are `plain` (timer and two developer chords), `bindings` (adds the
standard-library saved-binding load/sync), and `keys` (also registers the
prototype's 255 key-down/key-up pairs). The build writes
~/code/wc3-melee/worktrees/test-loop/build/restart-probe/A_Restart_Probe.w3x;
copy that exact map into the same prefix's Maps directory and select
**A Restart Probe** from Single Player. Do not replace the playable prototype.

Ctrl+R calls `RestartGame(false)`. Ctrl+T records the current simulation second
and input count in the prefix's Documents/Warcraft III/CustomMapData/
wc3-restart-probe.txt. A loading screen alone is not a passing result: continue,
wait beyond the observed delayed-stall window, then check that a fresh receipt
contains the loaded variant and an advancing tick count. Compare with native
F10 → End Game → Restart Mission when a scripted failure is reproduced.

The source deliberately retains the same direct restart call as the prototype;
this is a diagnostic fixture, not a fix. Current observations are recorded in
wc3-melee:evidence/development-plan.md.
