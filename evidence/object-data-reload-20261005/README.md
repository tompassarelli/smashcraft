# Native object-data reload, 5 October 2026

The two-client trial ran Smashcraft source
`d2377fed1ec61af6763247e90413c64629f12580`, with Waygate
`be5a2bd35d2742ae710f4ba7e70f8490bb1086ec`. The native watcher exited 0.
smashcraft:evidence/object-data-reload-20261005/result.json retains only the
measured timings, slots, native handle/field values and checksums.

| Phase | Reload version | Edit to both clients running |
| --- | --- | --- |
| Initial install | 87 | 8809.258 ms |
| Speed 270 → 300; attack cooldown 1.5 → 0.75 | 88 | 1452.954 ms |
| Restore speed 270; attack cooldown 1.5 | 89 | 1313.280 ms |

For each phase, both clients reported the same application clock, object-field
checksum and confirmed match checksum. Both original unit handles survived
both edits. Native field reads showed the changed values and their restoration.
These fields belong to paused presentation units; they do not retune the
deterministic movement or combat simulation.
