# Smash Melee reference data

Physics parameters are recorded separately in
[the parameter corpus](physics-parameters.json) and
[its source notes](physics-parameters.md). They include 78 extracted Fox/Falco
values, retail verification for those values, 14 common-data annotations and
78 selected retail common-data fields across 29 gameplay groups. The complete
common table remains outside this corpus. Fourteen additional common shield,
wall-recovery and wall-jump values, plus Fox's, Falco's and Captain Falcon's
wall-recovery fields, are recorded as separate targeted checks.

[ntsc-common-shield-values.json](ntsc-common-shield-values.json) adds a
published NTSC 1.02 extraction of common shield recoil decay (0.05)
and shield ground-friction multiplier (1.1). Its pinned source and exact file
hash are recorded there. The owner-supplied retail PlCo SHA-1 now independently
matches the publisher's claim; the parameter corpus records the corresponding
exact binary32 values and the newly recovered movement, launch-stacking,
tumble, bounce and grounded-friction constants. This comparison verifies the
selected values rather than every behavior of the source game.

Additional targeted retail facts are in
smashcraft:docs/smash-melee-reference/retail-air-recoil-cutoff-state.json, which
records four executions of the original below-cutoff stores: vertical launch
and horizontal recoil clear, while vertical recoil persists. The eighteen-vector
boundary corpus composes separately verified classification with those state
facts; it is not a complete original-function trace. See
smashcraft:docs/melee-air-cutoff.md for the comparison scope.

Other targeted retail facts are in
smashcraft:docs/smash-melee-reference/retail-shield-damage-endpoints.json and
smashcraft:docs/smash-melee-reference/retail-air-decay-operations.json. The first
records shield-damage endpoints and accumulation order. The second identifies
single-precision fused operations in airborne knockback decay; it does not
establish matching trigonometric outputs or a native trajectory.

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

smashcraft:docs/smash-melee-reference/slippi-ntsc-floor-recovery.json retains
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
analog/powershield branches remain unresolved. Airborne attacker recoil is
implemented from the revision-identified common table and decompile use-site;
the retained trace does not expose that vector for direct comparison.
The excerpt contains numerical telemetry and no player/account metadata.

Per-move frame data (startup, active frames, interruptible frame, total,
shieldstun, damage, landing lag) and libmelee's recorded hitbox positions and
dodge travel are in the frame-data corpus,
smashcraft:references/melee-frame-data/README.md. That corpus is the one source
of Melee frame data; this directory holds the physics parameters and the
targeted retail observations.

smashcraft:docs/smash-melee-reference/retail-roster.json records, for all 26
fighters (the Ice Climbers as Popo), the character attributes the movement
rules read (walk, dash, run, traction, jump, gravity, fall, air drift, weight,
landing lags and the wall values), the animation length of selected ground,
shield and dodge actions, and their command events that set command
variables, intangibility and interrupt flags. It adds 82 selected common
values. Each fighter's PlXx.dat and PlXxAJ.dat, and PlCo.dat, are identified by
SHA-256; the disc by its image's SHA-256. The values were read from the owner's
GALE01 revision 2 disc by the private reader
~/.local/share/smashcraft-melee-reference/roster-facts.ts, with field layouts,
command lengths and command meanings from the decompilation named in the file.
Only numbers and identifiers are kept; the disc, its files and the reader stay
outside the repository. Its Fox and Falco attributes equal the ones already
recorded in the parameter corpus, and its jump squat, weight and run speed
agree with the frame-data corpus for every fighter. The Melee case study
(smashcraft:docs/design/melee/README.md) computes its numbers from these files.

smashcraft:docs/smash-melee-reference/retail-action-lengths.json records selected
retail animation lengths for Fox, Falco and Captain Falcon. Each numeric header
was matched to its fighter animation-table entry by name, archive offset and
byte length. Shield-break landing/stand entries reuse the down-bound/stand
animations. These frame counts do not by themselves settle action lockouts:
entry-frame processing, rate, command events and interrupt rules still apply.
The independently authored decoder and all animation binaries remain private.
