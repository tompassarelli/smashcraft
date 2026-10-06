# Production and Melee reference comparisons

smashcraft:tools/move-data/reference-join.jsonl joins the existing production
move export to the independently recorded Melee frame-data corpus by **action
family**, keeping both identities. Archer, Rifleman and Demon Hunter are never
equated with Fox, Marth or another Melee fighter. The result supports factual
comparison, not a parity or balance claim.

Run `~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/reference.sh`
from the current owned checkout. It uses pinned Bun to join the existing move,
comparison and Melee reference JSONL inputs and writes
smashcraft:build/move-reference/reference-join.jsonl. `--check` compares it
with the checked-in snapshot at 12-decimal numeric precision. It consumes the
existing exports and does not rerun the contact sweep or change gameplay.

The family mapping, clock conversion, missing-record detection and trade-off
rules are implemented in smashcraft:ts/scripts/moveData.ts. The result retains
the input facts and nulls for unsupported comparisons; it does not infer
fighter equivalence or fill missing reference data.

## Join coverage and meanings

The snapshot has **1,381 rows**: one context, 1,320 reference joins, six explicit
reference gaps, and 54 production trade-off comparisons.

| Join classification | Rows | Meaning |
| --- | ---: | --- |
| Same action family | 933 | Uncharged named action; identities remain distinct |
| Family only, angle unknown | 156 | Up/down forward tilts paired with the reference forward-tilt family |
| Family only, charge unknown | 231 | Maximum-charge smash paired with a reference whose charge convention is unresolved |
| Reference gap | 6 | Peach has no `fsmash` row, for each production fighter's two charge endpoints |

All 51 exported move/charge records are considered against the 26 reference
attack characters. The anomalous `_marth` throw row is not an attack character.
No missing record is filled from another fighter or inferred from a move name.
This does not extend the production export to specials or other unexported moves.

Each join contains three separate sections:

- `declared`: the production move row and factual reference row, including its
  exact source identifier, revision, raw and normalized values, indexing
  convention and omitted-note flag. “Declared” here means facts supplied by
  the input snapshots; some production fields were already measured or derived
  by their owning export. It does not recategorize those as handwritten constants.
- `derived`: production first-active frame converted to one-based display,
  and its difference from the reference's reported first active when the
  action is uncharged, not an angled variant and the reference start is known.
- `unknown`: fighter equivalence, reference recovery, discrete active windows,
  shield safety, charge comparability and balance parity remain null.

For example, Archer jab has zero-based first-active tick 4, displayed as frame
5. Fox `jab1` reports frame 2; the displayed first-active difference is **+3**.
That is a comparison of reported boundaries, not three frames of proven
cross-game response disadvantage. Charged and angled variants have null deltas.

Reference `stun` means shieldstun; `percent` is rounded strongest base damage,
not a multihit sum. `end` does not establish continuous active intervals, and
`total - end` is not an established recovery calculation. Reference game
revision is unknown. Null can mean missing or inapplicable; zero is never
substituted. Excluded notes may contain conditions and multihit gaps.
Smashcraft omits L-cancelling (smashcraft:docs/gameplay-design.md): a
production aerial's `landingLag` is already the cancelled lag, comparable with
a reference's L-cancel lag rather than its landing lag.
Smashcraft also omits stale moves and freshness bonuses
(smashcraft:docs/gameplay-design.md): a Melee comparison of repeated damage
or knockback must not apply Melee's staling multiplier.

The reference has no established hit/hurtbox geometry, launch angle, knockback
or hitstun data. The join deliberately does not invent corresponding fields.
Production contact regions, damage/launch fields and motion samples remain
queryable in smashcraft:tools/move-data/moves.jsonl using
`(character, style, chargeFrames)`. A reported reference maximum/weak damage
cannot be matched to an exact production hit region without additional evidence.
The reference intake's scope and rights are recorded in
smashcraft:references/melee-frame-data/README.md; no authored source notes,
artwork or outside implementation are copied into this join.

## Bounded trade-off finding

The 54 unordered fighter pairs reuse
smashcraft:tools/move-data/comparisons.jsonl. Pairing requires the same category,
spacing, starting percent and shield/body condition, with the same Rifleman
defender and the export's fixed stage/contact/DI/landing conditions. Complete
input rows are retained, including separation and hitlag. These are contact
checkpoints; the preceding approach is outside the experiment.

The partial order has exactly three dimensions: maximize shield damage on
shield or percent damage on body, minimize attacker normal-action readiness,
and maximize defender normal-action readiness. Dominance requires no worse
result in every dimension and a strictly better result in at least one.
Readiness means the observed production `canAttack` gate, not every possible
defensive escape. Unobserved readiness or a whiff cannot certify dominance.

| Verdict | Pairs |
| --- | ---: |
| Trade-off between dimensions | 22 |
| Equal in these dimensions | 9 |
| Archer dominates this projection | 3 |
| At least one contact unavailable | 13 |
| At least one readiness unobserved | 7 |

The three projected dominance rows are Archer versus Rifleman late neutral-air
at initial spacing 60: shield at 0%, body at 0%, and body at 60%. Archer regains
the normal gate at tick **12**, Rifleman at **13**. Both deal the same sampled
damage (3.5 shield or 5 percent), and both leave the defender ready at the same
tick (23, 15 and 22 respectively). The same late aerials miss at spacing 140.

This is a real one-tick difference in these snapshots. It does **not** establish
that Rifleman's neutral-air, his other moves or his fighter are dominated.
The order deliberately excludes approach/startup, separation, launch direction,
hurtbox geometry, defensive choices and the rest of the moveset. In particular,
greater separation is not assigned a universal good/bad sign: it can improve
safety while reducing reachable follow-ups. Grounded Demon Hunter comparisons
trade earlier readiness against lower damage/earlier defender response; there
is no unsupported universal speed-versus-power score.

The projection is a fact about these snapshots, not a tuning target: it does
not show an overall trade-off, and the Melee corpus maps no Smashcraft fighter
to a Melee one and leaves its recovery arithmetic unresolved. Balance
proposals and their evidence belong to issue #12.

The focused tests check the first-active conversion and variant restrictions,
and distinguish costly extra damage from a deliberate free-damage dominance
counterexample, equality, missing readiness and whiffs. The generated snapshot
was parsed and the Fox/Archer jab pair, six Peach gaps and all verdict counts
were inspected. This is headless evidence only: no new simulation sweep,
gameplay tuning, native trial or before/after playable acceptance is claimed.

```sh
jq 'select(.kind == "reference-join" and .declared.production.character == 0 and .declared.production.style == 0 and .declared.reference.character == "fox")' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/reference-join.jsonl
jq 'select(.kind == "tradeoff" and .derived.verdict == "a-dominates-projection")' \
  ~/code/smashcraft/worktrees/playable-integration-20261005/tools/move-data/reference-join.jsonl
```
