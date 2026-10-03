# Physics parameter sources

wc3-melee:docs/smash-melee-reference/physics-parameters.json records 78 Fox/Falco
movement and recovery values, 14 common values reported by the decompile's
annotations, and explicit unresolved common-data groups. This is a factual
reference corpus, not a claim of full NTSC 1.02 parity or a simulation oracle.

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
disc revision. **Their game revision remains unknown.** The target remains
NTSC 1.02; matching a few familiar values does not establish that identity.

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

The inspected public directory indexes contain character dumps, not a common
PlCo.dat parameter JSON. The inspected data extractors and modding-tool source
trees yielded no revision-identified common-value table. Neither the local
reference checkouts nor the checked Dolphin configuration paths supplied a
usable game dump. The corpus does not fill missing common values from plausible
constants, infer them from field names, or label preexisting prototype values
as recovered data. A locally owned, revision-identified PlCo.dat or a factual
dump of its common attribute table is still needed for those exact values.

Common `reportedValues` are the decompile's GALE01 `datvalue` annotations;
their original float bits and disc revision were not independently checked.
Each unresolved group lists exact structure offsets and a primary use-site
path. The 78 character values and 14 reported common values were checked for
JSON parsing, source-value equality, unique offsets, valid source fields and
binary32 representability. No engine test or native-game trajectory was run by
this data-intake task.
