# Frame assignment experiment result

## Result

The focused Wurst run passed **7/7 tests** with zero compile errors. The original combat test ran the same eight-frame corpus for each local-player role. It exercised an attack press and held approach, a shield press/release while directions changed, and held movement. The independent corpus row index was the expected simulation frame.

For the late-input arm, both sides simulated through frame 4 while the remote participant was predicted. At the frame-5 boundary, remote frames 1–4 were delivered in reverse order (4, 3, 2, 1); each packet retained its original absolute frame tag. The oldest tagged row therefore arrived after four complete logical simulation advances. For the delayed attack role, the canonical world had started the attack while the speculative world had not; reconciliation replayed from frame 1 and restored the attack. For the delayed defense role, correction began at frame 4 where the shield changed. After rows through frame 8 were accepted, the replayed speculative snapshot equalled both the directly simulated canonical snapshot and the separately advanced confirmed snapshot, for both local-player assignments. The recorded row at frame 1 still contained the corpus row for its original sender and frame.

This shows that the present **deterministic shadow schedule and replay code** can preserve tagged, received input and produce the same final simulation state when a four-frame-late, reordered row arrives inside its configured 24-frame correction window. The attack-role run also shows the speculative world can temporarily omit an exchange that the corrected result later includes. The test does not show that this temporary presentation is acceptable.

## Direct-contact and service-skew cases

The added contact corpus fixes the attacker jab at F1 and compares defender shield presses at F5 and F9. At F5, the jab reaches the defender's shield and produces shield stun with zero damage. Moving the same shield press four frames later to F9 lets the jab land first and changes the final damage and snapshot. This makes the timing difference an actual combat exchange rather than only a changed animation or attack-start state.

The rollback arm then withholds the F5 shield row while simulating through F8. The speculative world takes damage. At the F9 service boundary, it receives rows F8 through F1 in reverse order with their original tags. Reconciliation begins at F5, removes the speculative damage, restores shield stun, and ends with the same full snapshot as direct canonical execution and the separate confirmed world. This contact case uses local-player slot 0; the preceding attack/shield correction case exercises both local roles. It establishes deterministic final-state repair within the tested 24-frame history, while also exposing a temporary false hit in the predicted state.

A paired schedule model starts both schedules in epoch 1300. One advances four logical frames; the other makes no progress. At the same modeled external action opportunity, the advanced cursor is F5 and the stalled cursor F1. The same action payload is consequently assigned those different original row IDs. Under the continuous 60 Hz contract, F5 is the independent expected frame for both. Under pause-on-stall semantics, F1 can be valid for the paused simulation. This is a modeled contract counterexample; it does not show the native engine actually creates such a service skew.

## Capture-boundary demonstrations

- When the device is neutral at both polling boundaries, a complete press/release between them creates no sampled edge.
- Two press/release cycles of the same action before a row is committed are represented by one bit in each pressed/released mask; the wire row carries no count or edge order.
- After one frame completes, a hypothetical four-interval service gap under a continuously advancing 60 Hz contract gives independent expected frame 6, while the progress-relative scheduler still offers frame 2. The scheduler has no wall-clock source that can recover the independent frame number. If the game is intentionally paused during the gap, frame 2 is instead consistent; wall time alone cannot decide that gameplay contract.

These are executable models plus source-level facts, not native timing samples. A tap that never appears at a polling boundary cannot be recovered by rollback. A same-action edge count coalesced before capture is also unavailable to replay.

## Scope and limits

The test uses the production Wurst combat, `ShadowInputSchedule`, `ShadowInputPlayback`, input-row conversion and replay snapshot code in a headless unit-test runtime. It bypasses the controller/device and OS event path, Warcraft `BlzIsKeyPressed` polling, Warcraft timers and game-loop scheduling, Battle.net sync transport, the network, Wine/Proton, rendering/presentation, wireless routing, and Blizzard services. Its 4-frame delay is a controlled logical-frame arrival schedule, not a measurement of four ticks of wall-clock latency. It tests a configured in-window correction, not behavior beyond the 24-frame history limit. It therefore cannot attribute observed online spikes to Bali Wi-Fi, Blizzard, engine scheduling or local runtime, or establish a competitive-quality visible response.

The capture cursor result distinguishes two possible contracts. If the product requires the fighting frame to advance continuously through a service gap, the current progress-relative cursor loses the external frame relation. If gameplay deliberately pauses and resumes with its cursor, there is no frame reassignment defect in that case, but elapsed wall time is not represented. The owner must choose the intended pause contract before character timing can assume wall-clock continuity.

## Reproduction

From the checkout, run the isolated driver (it invokes the pinned Wurst compiler `9913e1bd300c2053637d756a11bae8c3c8ed568f` and standard library pin `4dfc8a0474bd`):

```sh
/home/tom/code/wc3-melee/worktrees/test-loop/build/two-clients/competitive-integrity-20261003/run-experiment.sh
```

The driver parses the existing test source list from `test.sh`, adds only `FrameIntegrityExperiment.wurst`, filters to that package, and writes compiler output beneath this investigation directory. It does not modify production source or build/install a Warcraft map. Exact expanded command: `experiment-command.txt`. Captured successful output: `experiment-test.log`.
