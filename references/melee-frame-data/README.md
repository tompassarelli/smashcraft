# Melee frame-data reference

This is a factual research reference for Smashcraft, not a physics specification
or an importable character definition. It contains 789 records: 502 attacks,
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

Run from any directory. Substitute the actual checkout path if different. The
command downloads only the 104 KiB SQLite data file, never images or game assets.
Bun is needed; `nix shell nixpkgs#bun -c bun` can replace `bun` where unavailable.
The tool checks the input hash before reading and refuses unreviewed nonnumeric
field values. It regenerates records and coverage, then parses every line and
checks the three representative entries above. Expected duration: seconds.

```sh
curl --fail --location 'https://raw.githubusercontent.com/mitchhit234/meleeWebProject/ec5155149faeed24b5e5781d7efe17387cc9ee3d/characters.db' --output /tmp/melee-fd-characters.db
bun ~/code/wc3-melee/worktrees/melee-foundation-roadmap/references/melee-frame-data/intake.mjs /tmp/melee-fd-characters.db ~/code/wc3-melee/worktrees/melee-foundation-roadmap/references/melee-frame-data
```

The script does not fetch live pages or claim fresh deployment parity. Updating
the pinned revision requires rechecking source terms, column meanings, anomalies,
and representative site values rather than merely replacing the checksum.
