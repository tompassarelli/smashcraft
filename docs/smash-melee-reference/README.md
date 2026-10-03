# Smash Melee reference data

Physics parameters are recorded separately in
[the parameter corpus](physics-parameters.json) and
[its source notes](physics-parameters.md). They include 78 extracted Fox/Falco
values, retail verification for those values, 14 common-data annotations and
74 selected retail common-data fields across 28 gameplay groups. The complete
common table remains outside this corpus. Nine additional common shield and
wall-recovery values, plus five Captain Falcon wall-recovery fields, are
recorded as separate targeted checks.

[ntsc-common-shield-values.json](ntsc-common-shield-values.json) adds a
publisher-claimed NTSC 1.02 extraction of common shield recoil decay (0.05)
and shield ground-friction multiplier (1.1). Its pinned source and exact file
hash are recorded there. The publisher's `PlCo.dat` SHA-1 was not independently
verified, and this partial extraction does not supply the remaining movement,
launch-stacking, tumble, bounce, or general grounded-friction constants.

The recorded Falco fall fixture is in
smashcraft:docs/smash-melee-reference/slippi-ntsc-falco-fall.json. Its ten
neutral fall positions come from a public Slippi recording rather than the
simulation. The recording identifies NTSC but does not identify the disc
revision or export velocity/counter fields. It supports a bounded gravity and
position-integration comparison, not complete NTSC 1.02 physics acceptance.

smashcraft:docs/smash-melee-reference/slippi-ntsc-falco-jump.json adds a
grounded held-jump entry trace: five grounded squat frames followed by takeoff,
including recorded grounded flags and self velocity. Its NTSC recording also
leaves disc revision unresolved. It covers this transition through production
input ordering, not the full jump, air dodge or landing sequence.

smashcraft:docs/smash-melee-reference/slippi-ntsc-grounded-damage.json retains
a grounded damage trace from `techTester.slp`: contact frame 3432 and thirteen
following frames, including hitlag, damage-state countdown, positions and
knockback velocities. Published Captain Falcon traction matches the existing
Fox/Falco traction. This supports a shared flat-ground damage comparison without
porting Captain Falcon. It does not identify the disc revision or independently
extract the grounded common multiplier at +0x200. Floor collision epsilon is
normalized; only horizontal displacement is compared.

wc3-melee:docs/smash-melee-reference/slippi-ntsc-floor-recovery.json retains
post-impact in-place tech frames 203–210 and missed-tech frames 955–958 from
the same recording. Both skids retain horizontal knockback and subtract the
actor's traction before displacement; the tech reaches zero without reversing.
Production recovery tests apply this bounded traction profile to both original
fighter hosts. Collision geometry, disc revision, recovery completion and
platform departure remain unproven; action-specific miscellaneous values are
not interpreted as hitstun. No player metadata or implementation is retained.

smashcraft:docs/smash-melee-reference/slippi-ntsc-shield-contact.json retains
a paired digital-shield contact from `air_dodge.slp`, frames 10523–10534.
Sheik's 4-damage jab produces four frames of hitlag, three released shieldstun
frames, defender pushback and attacker recoil. The source exports defender
ground speed but omits the separate attacker recoil velocity; the attacker's
position trace supplies that comparison. The shield's return to Guard is a
separate frame from resumed held drain. Recorded effective friction supports
this flat-floor case; the disc revision, raw common table, defender cap,
analog/powershield branches and airborne attacker recoil remain unresolved.
The excerpt contains numerical telemetry and no player/account metadata.

The owner's copy-paste snapshot of all 26 character pages from
[Melee Frame Data](https://meleeframedata.com/), captured 2026-10-03, is retained
with its structured conversions:

- [Original paste](melee-frame-data.md)
- [JSON grouped by fighter and move category](melee-frame-data.json)
- [JSONL records for queries](melee-frame-data.jsonl)

The site was created by Janoris / Mitchell Meier and credits Joel Schumacher's
[frame-data extractor](https://github.com/pfirsich/meleeFrameDataExtractor),
Stratocaster's SmashBoards contributors, and SmashWiki. This snapshot preserves
the owner-supplied factual data and technical notes; it incorporates no
implementation or game artwork and grants no license to those materials. The
separate database intake is documented at
smashcraft:references/melee-frame-data/README.md.

Source identity in the records is
smashcraft:docs/smash-melee-reference/melee-frame-data.md. Copies originally
supplied at ~/melee-frame-data.md, ~/melee-frame-data.json, and
~/melee-frame-data.jsonl remain unchanged.

The grouped JSON retains the 26 uppercase fighter sections in pasted order. Each character has an id, exact name, stats record, and move arrays under ground_attacks, aerial_attacks, special_attacks, grabs, throws, and dodges. JSONL contains one self-contained character_stats or move record per line (26 stats and 769 moves); each includes source_context and schema_version.

Move records identify character_id, character_name, category, move_id and move_name. Scalar numbers use startup_frame, total_frames, interruptible_from_frame (IASA), shield_stun_frames (not hitstun), landing_lag_frames, l_cancel_lag_frames and special_fall_landing_lag_frames. damage_percent_values preserves the displayed ordering as an array, without guessing strong/weak meaning.

reported_active_frame_bounds, non_autocancel_frame_bounds and reported_protection_frame_bounds contain start_frame and end_frame. They preserve source endpoints, including incomplete or anomalous values. Headline active bounds do not imply continuous activity: multihit gaps and variants remain in notes. Inv. is retained as protection_source_label, without deciding invulnerability versus intangibility.

Stats contain weight, reported_fast_fall_speed, dash_speed, run_speed, wavedash_length_rank, pla_intangibility_frames, jump_squat_frames and Boolean wall_jump. Labels are reference data, not verified game physics; in particular the displayed Fast Fall Speed label is not corrected or reinterpreted.

Missing properties were not displayed. Explicit blank/dash values are null with source.fields status unknown; the literal None is null with status reported_none. Neither is converted to zero. A partial range retains its known endpoint and null for the other. Zero values actually printed in the source remain zero.

notes contains complete verbatim note lines, including original Notes prefixes and typos. source.raw_lines and source.fields preserve exact nonblank record lines, raw values, source labels where useful, and 1-based line numbers in smashcraft:docs/smash-melee-reference/melee-frame-data.md. Line ranges are inclusive; structural headings and blank formatting remain in the original paste. flags identifies incomplete/reversed ranges, active bounds exceeding total frames, and any unrecognized source lines.

Website context is https://meleeframedata.com/. Game revision is unknown. One-based game-frame numbering is website context, not independently verified from the paste; no subtraction or endlag derivation was performed. Structured fields are a transcription, not a complete move simulator.

Checked 26 characters, 769 moves, all 5622 nonblank source lines classified, no unrecognized source lines, and all eight displayed stats per character. Checked JSON/JSONL parsing, exact source-field line correspondence, Falcon nair's disjoint-hit note, Fox forward-air notes, blank throw startup, plain/slash damage, and Fox's reported 2.8 fall-speed value.
