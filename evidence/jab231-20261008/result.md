# Archer Fist and Boot

Archer's first jab punches with her free right fist, with the bow held behind
her shoulder. Her second jab retains the low kick from Down Tilt. Gameplay
frame data and collision volumes are unchanged.

- Bun jab contracts: 4 passed, 0 failed.
- Bun fighter clip table: 17 passed, 0 failed.
- Emitted Lua32: the four existing jab contracts and the named punch/kick clip
  table contract passed, 5/5, from the newly compiled suite bundle.
- Packaged model: 201 jab joint tracks authored; all 75 unrelated sequences
  preserve their existing keys and all 76 sequence indices remain unchanged.
- Production pose-selection hit captures: jab frame 4, clip 7, 0.16666666 s;
  jab2 frame 3, clip 17, 0.185 s. Both facings are shown and were inspected.

Private captures: `~/.local/share/smashcraft-build-inputs/jab231-20261008/punch-hit.png`
and `kick-hit.png`; authored editable model and export are in `authored/`.
The private input hashes committed alongside this record identify the shipped model.
