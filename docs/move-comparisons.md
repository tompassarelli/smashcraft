# Contextual contact comparisons

Run `~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/compare.sh`
from the current owned checkout. It runs the pinned Bun TypeScript comparison
fixtures and writes smashcraft:build/move-comparisons/comparisons.jsonl. The
bounded sweep takes about 2.5 s. `--check` runs the focused
category/follow-up tests and compares fresh output with
smashcraft:tools/move-data/comparisons.jsonl at 12-decimal numeric precision.

The snapshot contains 54 contact contexts, 2,236 option trials and six category
rule comparisons. It is generated output, never gameplay tuning input. The
fixtures use the TypeScript production simulation APIs for state, motion,
contact resolution and actionability. The existing move export supplies move
names and declared timing/contact facts for further joins.
Smashcraft omits stale moves and freshness bonuses (smashcraft:docs/gameplay-design.md),
so every comparison with Melee damage or knockback leaves that modifier out.

## Conditions and clocks

Each of Archer, Rifleman and Demon Hunter attacks a Rifleman with his production
weight of 80 on stage 0. Initial horizontal separation is 60 or 140 world units.
Forward smash and forward tilt start at their first active frame; late neutral
air starts at attack frame 20, z=20, vz=-2. These are **contact-state fixtures**:
they do not establish that the preceding startup or approach is safe. No move
values are changed. Grounding, cooldown and animation age describe that sampled
state; contact is decided by the actual production capsules and contact resolver.

Shield contexts use 0%, full digital shield held for 20 frames, no powershield,
and release immediately after contact. Body contexts use 0% or 60%, neutral DI,
no SDI/ASDI displacement and no defensive response. The fixture advances
production motion, action entry and contact batching in match order; specials,
grabs, ledge acquisition, input buffering, bots and presentation are excluded.

`contactFrame` is the zero-based age of the original move at the checkpoint.
All other frame fields count ticks after that checkpoint, including hitlag.
`attackerReady` and `defenderReady` are the first production `canAttack` result
in a passive baseline. This includes real shield release/landing recovery and
surface reactions, rather than subtracting declared durations. It is a normal
action gate, **not an oracle for the earliest possible escape of any kind**.
`-1` means unavailable or unobserved within 96 ticks; associated separation
fields have no meaning in that case. Seven high-percent contexts never regain
that gate within the horizon; their follow-ups remain uncertified.

## Observed comparison

Archer against Rifleman's shield, starting 60 units apart:

| Contact | Move frame | Shield damage | Shieldstun | Attacker ready | Defender normal ready | Separation at defender ready |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Forward smash | 6 | 12.6 | 10 | 38 | 34 | 163.56 |
| Forward tilt | 5 | 7 | 6 | 28 | 27 | 96.07 |
| Late neutral air | 20 | 3.5 | 4 | 12 | 23 | 68.28 |

The smash gives up more recovery while removing more shield and creating more
separation. Four apparent response ticks do not establish a reachable punish:
the sampled standing jab/tilt options cannot punish this Archer smash before
normal recovery. At separation 140 the spaced tilt connects with shield, but
leaves about 176.07 separation when the defender can use a normal. The sampled
late aerial misses there. Whiffs remain in the data instead of receiving a
contact-based advantage claim.

There is a bounded reachable punish in another named context: against Demon
Hunter's forward smash at separation 60, Rifleman's immediate forward tilt
starts at tick 31, contacts at 36, and precedes Demon Hunter's normal recovery
at 37. Moving for one tick before a jab also contacts at 36. Those results do
not cover alternative shield responses, defensive inputs or human reactions.

The comparison checks one local category rule: **in the same shield contact
context, greater shield damage costs later attacker recovery or an earlier
defender response**. The 6 Oct delegated mechanic defaults adopt this contextual
rule in smashcraft:docs/gameplay-design.md, "Shields and defence". Production
satisfies it in all six sampled comparisons. A fixture mutation sets only the
smash's post-contact cooldown and remaining attack duration to one tick. The same comparison then rejects
all six mutants; Archer's recovery becomes tick 9 while the normal remains 28,
with the smash's greater shield damage retained. This does not edit production
or establish a universal balance law.

The rule is not applied to late aerial pressure: its checkpoint already spent
20 airborne attack frames, its sampled damage is lower, its landing lag
matters, and it misses at the farther spacing. Counterplay outside the
checkpoint includes contesting that approach or moving outside its contact
geometry; these are not measured. No generic balance score is assigned.

## A follow-up interval needs reach as well as time

Archer late neutral air into Rifleman at 60%, initial spacing 60:

- Archer regains the normal gate at tick 12; Rifleman at tick 22.
- An immediate standing jab becomes active at 16 but misses. Timing alone lies
  inside the window; the target is outside the moving capsules.
- With approach input during the delay, jab delays **2–5** contact at ticks
  **19–21**, before the opponent's normal gate. Delays 0–1 still miss.
- Delay 6 contacts at tick 22: the same-tick response is excluded. Longer
  delays are chase observations against a neutral target, not true links.

These are `bounded-true-link` rows only under the declared neutral-defense
fixture and normal-action gate. The data does not prove a guaranteed combo
against DI, SDI, tech choices or every earlier defensive option. `bounded-punish`
uses the same strict contact-before-recovery test with the defender responding
after shield release. `timing-window-but-reach-miss` distinguishes a timing
opportunity from a reachable contact. Contacts after recovery are labeled
`escapable-pressure` or, with approach, `chase-after-actionable`. A **read**
requires a named opponent choice and a response to that choice; this neutral
fixture never infers one. There is no probability or reaction-time claim.

```sh
jq 'select(.kind == "contact" and .character == 0 and .shielding)' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/comparisons.jsonl
jq 'select(.kind == "option" and .character == 0 and .category == "late-aerial" and .percent == 60 and .spacing == 60 and .candidateStyle == 0 and .approach) | {delay,firstActive,firstContact,opponentReady,verdict}' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/comparisons.jsonl
```

Join contact and option rows by `(character, defenderCharacter, category,
spacing, percent, shielding)`. `actualStyle` records any production action
substitution, including Demon Hunter's dash attack. Floating output has the
same native-formatting limits as smashcraft:docs/move-data.md. Other defenders,
other moves/charges, analog shields and escape policies remain unmeasured.
The factual action-family reference join and bounded trade-off analysis are
recorded in smashcraft:docs/move-reference-join.md. No Melee character is equated
with an original Warcraft fighter. Native parity, balance tuning and playable
before/after acceptance remain in issue #12.

## Evaluating a move against the interaction graph

These comparisons sample one contact state; the
[interaction graph](design/interaction-graph.md) plays whole situations
(aerials on shield at each spacing and drift, out-of-shield options, neutral,
landing, ledge, tech) for every fighter. After changing or adding a move, run
`bun wisp interactions --move FIGHTER:MOVE` from smashcraft:ts/ for every place
the move now appears and what changed in its fighter's graph since the graph
was last written in this checkout (write it before the change), then
`bun wisp interactions` to write the new graph. The graph is not committed.
smashcraft:tools/move-data/compare.sh `--check` runs `bun wisp interactions
--check` after its own comparison, so a changed move fails the check until the
graph's changes are looked at and written.

## Jab change, 6 October 2026 (#12)

Issue #12's first balance change, proposed from bot soak data
(smashcraft:evidence/soak-balance-20261006/) and the Melee reference join:

| Jab | Before | After |
| --- | ---: | ---: |
| Archer and Rifleman damage | 12 | 5 (Illidan's, unchanged) |
| Recovery, every fighter | 30 | 15 |
| Total frames, every fighter | 36 | 21 |
| Knockback at 0%, weight 100 (Archer, Rifleman) | 49.76 | 40.45 |
| Hitstun / victim hitlag (Archer, Rifleman) | 19 / 7 | 16 / 4 |
| Digital shield damage / shieldstun (Archer, Rifleman) | 8.4 / 7 | 3.5 / 4 |

Startup (4), active frames (2), reach and knockback growth and base are
unchanged. Melee's jab1 records for its 26 characters report 2–8 base damage
(median 3, fresh values; Smashcraft has no stale moves) and 15–31 total
frames (median 20); 12 damage and 36 frames were above every one of them.
Each fighter's forward tilt (8–10 damage, 28 frames) is now the stronger,
slower option and the jab the fast, weak one.

The comparison snapshot is unchanged: all 54 contact contexts and 2,236
option trials, including all 21 `bounded-true-link` and 3 `bounded-punish`
rows, are identical. Their verdicts depend on startup, reach and the
opponent's recovery, none of which changed. What changed is what a link is
worth: Archer's late neutral air (5) into jab at 60%, the four approach
delays 2–5 above, now confirms **10%** instead of **17%**.

A jab's 5 damage is below the 7-damage down-damage threshold
(smashcraft:docs/physics.md, "Grounded knockdown and jab resets"), so a jab
on a downed fighter is now a jab reset, not a launch. A downed fighter that
stands, rolls or get-up attacks leaves after the first reset, before the
next jab. One that does nothing stays down: jabbing as fast as the game
allows held a passive Archer for 25 resets in 600 frames from 30% and from
100%. The game's computer never chooses a get-up option, so in
computer-against-computer matches a jabbing Archer or Rifleman can hold a
downed opponent until time runs out.

## Rifleman down tilt, 6 October 2026 (#63)

Rifleman's down tilt deals 10 damage; Archer's stays 8. Rifleman has Falco's
slower ground movement and Archer Fox's faster one, and in Melee's corpus
Falco's down tilt hits 13% and Fox's 10% on identical frames: the slower
fighter of the pair hits harder. Rifleman keeps that ratio (8 × 1.3 ≈ 10).
Timing, hit region, launch direction, growth and base are unchanged.

| Rifleman down tilt, 0%, weight 100 | Before | After |
| --- | ---: | ---: |
| Damage | 8 | 10 |
| Knockback | 43.60 | 46.40 |
| Hitstun / hitlag | 17 / 5 | 18 / 6 |
| Digital shield damage / shieldstun | 5.6 / 5 | 7 / 6 |

The comparison fixtures don't sample down tilts, so their verdicts are
unchanged. In the 540-match computer soak only Rifleman's matches changed;
computer Rifleman beat the fuzzed player in 120 of 120 matches instead of
118 (smashcraft:evidence/rifleman-down-tilt-20261006/). That is below what
the soak resolves as a balance effect.
