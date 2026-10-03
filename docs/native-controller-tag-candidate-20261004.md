# Native controller-tag transport candidate 0.0.11

Prepared while the SDL capture-clock source decision is pending. The standalone
tagged-history probe now accepts ten 26-byte records (260 bytes) in its 320-byte
editbox. Local and per-sender ledgers remain bounded at 16 events, with 32 log
rows. This is a transport diagnostic, not a playable match or a frame clock.

Private candidate:
~/.local/share/smashcraft-build-inputs/frame-tagged-history-probe-20261004/build.uILHcD/Smashcraft 0.0.11.w3x

SHA256: fb3b8011f0374751ec2d6d57c669d74092d74e23765628a5f8fb6000afa81a48.
Build ID: 20261003T192943016422291. Pinned compilation passed with zero errors
and warnings; Lua syntax and archive script round-trip checks passed. No native
loading or runtime acceptance is claimed. Both retained clients are still in
the completed 0.0.10 contact probe, with the same live processes.

Rebuild with wc3-melee:tools/netcode-probe/build-frame-tagged-history.sh,
the private physics-base.w3m fixture, and explicit second argument 0.0.11.
For a native trial, derive records from the retained helper event journal and
an independently declared experiment epoch; preserve event IDs and assigned
frames through the editbox/poll/sync path. Keep cold defective timestamps out
of assignment until their source is repaired. Compare each observer's exact
wire rows to the external corpus, and label source capture, replayed journal
delivery, frame derivation and presentation separately.

Existing 0.0.9 native measurements apply only to their original candidate/hash,
with the original 240-byte cap. This candidate's larger cap and controller-sourced
corpus require their own native check. Export filenames still use run/slot;
copy earlier exports before overwriting them during a new trial.
