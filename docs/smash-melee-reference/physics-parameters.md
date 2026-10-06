# Physics parameter sources

smashcraft:docs/smash-melee-reference/physics-parameters.json records 78 Fox/Falco
movement and recovery values, 14 common values reported by the decompile's
annotations, and 78 selected retail common values across 29 gameplay groups.
It also records fourteen additional common shield, wall-recovery and wall-jump
fields, five retail wall-recovery attributes each for Fox, Falco and Captain
Falcon, Captain Falcon's air drift attributes, and each of the three
fighters' airborne ECB top, read from its model's joint tree. It remains a
partial factual reference, not a complete common table or a simulation
oracle.

On 2026-10-03, the complete public Fox and Falco DAT JSON documents were fetched
from https://melee.theshoemaker.de/dat-dumps/Fox.json and
https://melee.theshoemaker.de/dat-dumps/Falco.json. Both parsed as complete JSON
and contained 97 attributes. The corpus retains only the selected numerical
parameters, their source JSON pointers, and whole-document byte lengths and
SHA-256 identities. No DAT binaries, animations, scripts, artwork or source
implementation are included. Every selected float round-trips exactly as
binary32; the jump count is an integer. This preserves the publisher's numbers
without pretending they were extracted from a locally verified disc.

The publisher's https://melee.theshoemaker.de/%21README.md describes unmodified
character files, but neither the inspected README nor the JSON identifies the
disc revision. Their source revision remains unknown. The selected Fox/Falco
values are now separately verified against the owner-supplied GALE01 revision 2
DAT files below; this does not retroactively identify the publisher's source.

Field meanings and structure-relative offsets use
melee:src/melee/ft/types.h at revision
0296f009f32f710495979d30772d8332af2d411a. The older JSON names can be misleading:
its `initialWalkVelocity` is the +0x000 walk acceleration multiplier;
`runAcceleration` at +0x030 is the maximum run-brake frame count.
The +0x054 aerial-jump horizontal parameter sets a velocity scaled by stick
input despite its `air_jump_h_multiplier` identifier. All positions and speeds
are in Melee units and logical frames; rendering scale and seconds conversion
belong at the consuming boundary. Callback order must be established separately.

The corpus distinguishes raw initial jump speeds from trajectory targets.
Fox/Falco full-jump initial speeds are approximately 3.68/4.10, short-hop speeds
2.10/1.90, and aerial vertical multipliers 1.20/0.94. A launch speed selected
by solving backward from a wiki height is not evidence for the DAT parameter.

No gameplay implementation license was established for the decompile.
Numerical facts, layout identifiers and observed use-site facts are retained;
no implementation was copied, translated or structurally adapted. The PC port
is supplementary and supplies no independent binary extraction here. Its
embedded legacy header has older names, including hitlag labels at offsets
that differ from the primary decompile's current hitlag use sites.

The owner supplied a USA v1.02 disc image; its extracted game files and
executable remain private and outside repositories. The disc header identifies
GALE01 revision 2. The local `main.dol` SHA-1 matches the pinned decompile's
GALE01 build hash, and `PlCo.dat` SHA-1 matches the earlier publisher claim.
The corpus records hashes for each extracted DAT and retains only selected
named numeric fields. It records the resolved `ftLoadCommonData` root and that
the root pointer slot is relocation-backed; no pointer values, raw tables,
scripts, artwork, or executable data are included.

Each retained common gameplay group lists its structure offsets, fields,
float32 bit patterns or integer values, known units and use-site path.
Previously reported common annotations were also checked against the retail
file. All 39 selected Fox and 39 Falco attributes match the retail DAT values;
Captain Falcon, Jigglypuff and Sheik traction was independently read from their
retail DATs. Fox's, Falco's and Captain Falcon's wall push-off, wall-jump
launch, ceiling-tech impulse and minimum approach speed (+0x100, +0x104, +0x108,
+0x10C, +0x148) were read from the same retail DATs; all three set
can_walljump when they load (ftFx_Init_OnLoad, ftFc_Init_OnLoad,
ftCa_Init_OnLoad). This confirms these files' revision and values, not full
engine behavior. No engine test or native-game trajectory was run by this data-intake
task.
