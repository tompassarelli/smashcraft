# Grabs

#337 adopts one grab envelope across the roster, measured from Melee's
average standing grab. Distances use the existing physics scale of six
Smashcraft world units per Melee unit; frames remain at 60 Hz.

The 26 standing-grab rows in
`references/melee-frame-data/libmelee.jsonl` give a mean farthest forward
edge of 16.008426 MU, mean bottom 3.409252 MU, mean top 11.663002 MU,
and mean active duration 3.115385 frames. Each fighter contributes once:
reach is its greatest `x + size`, bottom its least `y - size`, top its
greatest `y + size`, across its recorded active spheres. This includes the
four long grabs (Link, Young Link, Samus and Yoshi). These are numerical
observations, not copied move definitions.

Rounding the scaled means gives standing reach 96, bottom 20, top 70,
height 50 and three active frames. Dash and pivot extensions are original
Smashcraft choices required by #337, respectively 1.25 and 1.5 times this
standing reach. Melee has no separate pivot-grab animation; its turn into
standing grab informs the direction change, not the extra reach.

| Grab | Forward reach | Bottom / top | Height | Active frames |
| --- | ---: | ---: | ---: | ---: |
| Standing and out of shield | 96 | 20 / 70 | 50 | 3 |
| Dash | 120 | 20 / 70 | 50 | 3 |
| Pivot during run turn | 144 | 20 / 70 | 50 | 3 |

The regions touch authored body capsules, face forward and reject a target
whose feet exceed the listed reach. Startup and whiff duration retain each
fighter's authored timing; dash and pivot add three startup and eleven
total frames. The larger box does not extend throws or the early-ascent
catch window. A stock loss resets the grab variant; rollback stores it.

A grab pressed while holding shield stays buffered through hitlag and
shield stun and starts on the first free frame, without shield release.
Its ordinary startup still applies, and it catches only if the attacker's
recovery and spacing permit it. A close blocked Rifleman jab is the
acceptance case. A grab pressed on any jump squat frame cancels the jump
and selects standing grab, even with the running direction held.

Sources: [libmelee recorded frame data](https://github.com/altf4/libmelee/blob/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv)
at `ef679270ff95f0d42339dcdf1608282a35023349`, LGPL-3.0 as recorded
in the corpus README; only recorded numerical facts are used, with no code
or assets copied. The local read-only Melee reference at
`0296f009f32f710495979d30772d8332af2d411a` identifies jump squat's grab
cancel in `ftCo_KneeBend_IASA` and shield grab in `ftCo_Guard_IASA`;
these behavior descriptions are also recorded in
[the Melee techniques study](melee/techniques.md#shield-drop-jump-cancelled-grab-and-up-smash).
