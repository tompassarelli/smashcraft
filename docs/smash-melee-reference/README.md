# Smash Melee reference data

Physics parameters are recorded separately in
[the parameter corpus](physics-parameters.json) and
[its source notes](physics-parameters.md). They include 78 extracted Fox/Falco
values, 14 common-data annotations and 28 unresolved common-data groups.
Character dump revision is unknown; missing values remain explicit rather than
being filled with prototype constants.

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
