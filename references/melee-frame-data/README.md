# Melee frame-data reference

Smashcraft's one corpus of Melee frame data: a factual research reference, not a
physics specification or an importable character definition. It has two
inputs, each with its own provenance: meleeframedata.com's database
(`records.jsonl`, below) and libmelee's recorded per-frame table
(`libmelee.jsonl`, under "libmelee hitbox positions and dodge travel").
Physics parameters and retail observations are in
smashcraft:docs/smash-melee-reference/README.md.

The database intake contains 789 records: 502 attacks,
52 grabs, 105 throws, 104 dodges, and 26 character-stat records. It covers all
26 roster entries (counting Sheik and Zelda separately) plus one anomalous
`_marth` throw row retained exactly as found. Do not treat that as a 27th fighter.

## Source and rights

Observed 2026-10-03. The website https://meleeframedata.com/ links its author
Janoris / Mitchell Meier's repository https://github.com/mitchhit234/meleeWebProject.
The input is that repository's `characters.db` at commit
`ec5155149faeed24b5e5781d7efe17387cc9ee3d`, SHA-256
`ebdc169f3b97a3b8693206ca00f8f9b4fb1684f237a41367bf149af581320eb6`.
The site credits https://github.com/pfirsich/meleeFrameDataExtractor for much of
its data; that extractor was not run in this intake.

No project reuse license was found in the upstream tree or README. This intake
records factual numeric observations, identifiers, and their source locations;
it does not copy the website implementation, authored notes, GIFs, textures, or
other artwork. Those materials require a separate rights decision before reuse.
The independent ingestion tool is confined to the foreign-data boundary.

The public site's certificate failed TLS validation (curl error 60, expired
certificate). Unauthenticated public homepage and Fox/Falco/Marth HTML were
read with certificate checking disabled solely for this comparison. All input
database bytes came from GitHub over normally validated HTTPS. The live-page
comparison is therefore a limited observation, not authenticated provenance.
The repository snapshot is not claimed to equal the entire deployed database.

## Record schema

`smashcraft:references/melee-frame-data/records.jsonl` contains one JSON object
per line, identified by `(character, category, action)`:

- `schema_version`: 1.
- `character`: original database character identifier, unchanged.
- `category`: original table: attacks, grabs, throws, dodges, or misc.
- `action`: original move/type identifier; null for misc.
- `source`: repository, exact revision, database path/table, and corresponding
  website URL. The URL is constructed from the source identifier; `_marth` is
  anomalous and is not asserted to have a functioning page.
- `game_revision`: null. Neither NTSC/PAL nor disc revision was established by
  this intake. Do not silently assume NTSC 1.02.
- `frame_index_origin`: 1, the website's stated timing convention. This does not
  certify GIF counters, action-script indexing, or interrupt-boundary semantics.
- `source_values`: original database scalar fields, preserving numbers, empty
  strings, null, and -1 exactly. SQLite numbers have no retained display string.
- `values`: same keys; -1 and empty strings become null. Source null stays null.
  This combines missing and inapplicable values; it never substitutes zero.
- `notes_present_but_excluded`: whether nonempty authored notes were omitted.
  Consult the source before treating such a move as a simple continuous window.

### Field meanings and traps

The raw column names are intentionally preserved, even when misleading:

| Source field | Meaning / limit |
|---|---|
| attacks.start, end | Reported first/last active frame; not a list of discrete hit windows |
| attacks.total | Reported total/action boundary; do not infer end lag by subtraction without resolving IASA and indexing |
| attacks.iasa | Reported animation interrupt frame |
| attacks.stun | **Shield stun**, not hitstun |
| attacks.percent, percent_weak | Reported strongest/weakest base damage, not multi-hit total; source warns values are rounded |
| attacks.ld_fl_spec | Landing lag after special fall |
| attacks.auto_cancel_s, auto_cancel_e | Source autocancel boundary fields; preserve convention before interpreting intervals |
| attacks.land_lag, cancel_lag | Landing and L-cancel lag |
| grabs.start, total | Grab startup and total |
| throws.start, end, total, percent | Reported throw timing and damage; site's timing assumes Mario as target |
| dodges.start, inv_end, total | Invulnerability start/end and total |
| misc.weight | Reported weight |
| misc.gravity | **Fast-fall speed** on the live site, not gravitational acceleration |
| misc.walk_speed | **Dash speed** on the live site, not walking speed |
| misc.run_speed | Run speed |
| misc.wd_length | Wavedash length **rank**, not distance |
| misc.wd_frames | Perfect-ledgedash-angle intangibility frames, not wavedash duration |
| misc.jump_squat, wall_jump | Jump squat; wall-jump availability as 0/1 |

No hitbox geometry, hurtbox geometry, knockback growth/base knockback, launch
angles, collision rules, hitstun formula, electric hitlag rules, or VFX timing
is established by this dataset. It cannot prove a Melee physics port. Nor can
it directly calculate shield safety without contact frame, spacing, landing,
interrupt rules, defender options, and movement context. Multi-hit gaps and
special-case behavior may exist only in the omitted notes.

## Coverage and observed check

`smashcraft:references/melee-frame-data/coverage.json` records counts for every
character and table and missing counts per scalar field. 584 records contain
at least one null/missing/inapplicable value; 333 have excluded source notes.
These counts do not mean 584 moves are broken: many aerial-only fields are
inapplicable to grounded attacks.

Every output line was parsed; counts cover all five input tables. The nearest
representative check matched these database entries against live HTML:

| Character / action | Start–end | Total | IASA | Shield stun |
|---|---:|---:|---:|---:|
| Fox jab1 | 2–3 | 17 | 16 | 3 |
| Falco jab1 | 2–3 | 17 | 16 | 3 |
| Marth jab1 | 4–7 | 27 | 26 | 4 |

This checks transcription and limited source/site agreement, not game accuracy.
The source `_marth` row and missing values remain unresolved observations.

## Repeat the intake

Run from the checkout's root. The command downloads only the 104 KiB SQLite data file, never images or game assets.
Bun is needed; `nix shell nixpkgs#bun -c bun` can replace `bun` where unavailable.
The tool checks the input hash before reading and refuses unreviewed nonnumeric
field values. It regenerates records and coverage, then parses every line and
checks the three representative entries above. Expected duration: seconds.

```sh
curl --fail --location 'https://raw.githubusercontent.com/mitchhit234/meleeWebProject/ec5155149faeed24b5e5781d7efe17387cc9ee3d/characters.db' --output /tmp/melee-fd-characters.db
bun references/melee-frame-data/intake.mjs /tmp/melee-fd-characters.db references/melee-frame-data
```

The script does not fetch live pages or claim fresh deployment parity. Updating
the pinned revision requires rechecking source terms, column meanings, anomalies,
and representative site values rather than merely replacing the checksum.

## libmelee hitbox positions and dodge travel

`smashcraft:references/melee-frame-data/libmelee.jsonl` reduces libmelee's
recorded frame table to what meleeframedata.com's database lacks: where each
normal attack's and grab's hitboxes are, frame by frame, and how far each ground
dodge moves the fighter. It has 469 records, one per `(character, action)`,
for the 26 fighters (Popo stands for the Ice Climbers; Nana is left out).

Source: https://github.com/altf4/libmelee at revision
`ef679270ff95f0d42339dcdf1608282a35023349`, file `melee/framedata.csv`, SHA-256
`8e0d811290b511902076c0011db1a0116356a7ddaa68dfa369ea4f5dcdc93777`, the same
file smashcraft:docs/physics.md cites for roll travel. libmelee is licensed
LGPL-3.0; only factual numbers recorded from the game are kept, renamed to this
corpus's identifiers, and no libmelee code is used. The table was recorded by
libmelee's authors from the running game; its disc revision is not stated.

Each record has:

- `character`, `category` and `action`: the identifiers of `records.jsonl`
  (`attacks` jab1, jab2, jab3, dattack, ftilt, utilt, dtilt, fsmash, usmash,
  dsmash, nair, fair, bair, uair, dair; `grabs` standing_grab, dash_grab;
  `dodges` forward_roll, back_roll, spot_dodge). Forward tilt and forward smash
  are the unangled versions.
- `source`: repository, revision, path, and libmelee's own character and
  action numbers (the game's fighter kind and action state).
- `frame_index_origin`: 1, as in libmelee; `recorded_frames`, the action's
  recorded length; `first_iasa_frame` and `first_facing_changed_frame`, the
  first frame libmelee marks interruptible or turned, or null.
- `hitbox_frames`: each frame with an active hitbox, and for each hitbox its
  `size` (radius) and `x`, `y` position relative to the fighter, in Melee
  units, with `x` positive ahead of the fighter.
- `locomotion_x`: for dodges, the fighter's horizontal movement on every frame;
  null otherwise.

Coverage is libmelee's: some fighters lack a dash attack or forward smash
record, and up to four hitboxes per frame are recorded. Positions describe the
recorded animation, not the full collision geometry; hurtboxes are not
recorded. Representative checks: Fox's jab hitboxes are on frames 2 and 3, as
in `records.jsonl`, and his forward roll turns on frame 20 of 31.

Repeat the intake from the checkout's root (seconds):

```sh
curl --fail --location 'https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv' --output /tmp/libmelee-framedata.csv
bun references/melee-frame-data/libmelee-intake.ts /tmp/libmelee-framedata.csv references/melee-frame-data
```

The tool checks the input hash, refuses non-numeric values and frame gaps, and
checks the two representative records.
