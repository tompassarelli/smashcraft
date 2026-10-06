# Gameplay design decisions

## Stale moves and freshness bonuses

Smashcraft deliberately has neither stale-move penalties nor freshness bonuses.
Repeating a move does not reduce its damage or knockback parameters, and using
a different move does not grant a damage bonus.

Attack-history penalties add inconsistency without improving the intended
combat decisions. Repetitive play should be punishable through startup and
recovery, spacing, commitment, defensive options, and opponent counterplay. If
a move is too effective when repeated, improve those interactions instead of
adding a hidden repetition penalty. Move outcomes should remain predictable
under the same combat conditions; victim percent, weight, hit region, and
other explicit mechanics still affect the result.

This is an intentional departure from Melee, not a missing feature.

Owner decision reaffirmed 2026-10-04: **skip Melee's stale-move mechanic**,
including its freshness bonus, for the physics foundation and subsequent
character balancing. Do not implement a recent-move queue, history-based damage
or knockback multipliers, or projectile staleness snapshots. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons must state that this modifier is omitted; all
other shared formula requirements remain open until verified.

Reaffirmed by the owner 2026-10-06: stale moves are an over-engineered attempt
to create move diversity. Diversity should come by construction, from move
design (how each move's hitboxes, startup, recovery and rewards work), not from
a bolted-on physics rule that rescales damage behind the player's back.

## Computer opponent

The computer (smashcraft:ts/src/game/match/botPlay.ts and its bot*.ts
siblings) plays inside the synchronized simulation: each frame it reads the
match and writes its fighter's controls and attack commands, as a player's
input row would, so every client and every rollback replay derives the same
decisions. It keeps no state of its own beyond the attack delay in the
replayed runtime (`botAttackDelays`). Each choice that looks random is
`botChoice`, a nonlinear hash of whole numbers from the match (the frame,
attack and grab serials, hits taken, the truncated percent) whose squares
stay inside 32-bit integers, so Bun and Warcraft's Lua compute it alike.

- It never steers its fighter past the point where it could still stop on
  the main deck: on the ground and in the air it compares where the fighter
  would come to rest, braking at traction or air acceleration, with the
  deck's edges less 40 units, and turns back when that point would pass them.
  A ground attack starts only if the slide it leaves ends on the deck it
  stands on, and specials that move it (Disengage, Parry Step) only with room
  to land.
- It attacks with whatever reaches: each move's strike at its first active
  frame, from the authored hit regions and contact capsules, against the
  target where both will be by then. Specials join when they suit the
  distance; shots, Multishot and the bear from range. A 40-frame plan
  weighs ground pressure, jumping in with aerials, or keeping away and
  shooting.
- It shields, spot dodges, rolls or (Illidan) parries some strikes, shots,
  Immolations and bear swipes, one choice per threat, and lets others land.
- Knocked down it gets up: with the target in reach mostly a get-up attack,
  otherwise a stand, a roll or a short wait; one tumble landing in three it
  misses the tech. It never lies still under jab resets.
- Off the stage it returns to the deck or, facing a free ledge, falls onto
  the ledge and climbs, rolls, jumps or attacks from it.

The 540-match `--policy cpu` soak checks this behaviour: departures,
self-destructs, time-outs and the moves that landed
(smashcraft:ts/scripts/soakOutcomes.ts summarizes them).

## L-cancelling

Non-interactive execution is dubious. Smash's execution tests are meant to be
interactive: they reward anticipating and reading the opponent's responses to
your actions. Part of Smash's appeal as an alternative to traditional fighters
is that its most complex execution is an interaction with the opponent, not a
single-player flowchart. L-cancelling is a single-player execution test that
involves no opponent, which is why it is a bad idea.

L-cancelling asks for a thoughtless input on every aerial. It is a persistent
chore that tires players' hands and adds an arbitrary execution test with no
benefit. The game's depth belongs in mechanics with real decisions: combo
follow-ups, directional influence and aerial drift.

Every aerial therefore lands with Melee's L-cancelled landing lag, automatically:
half its authored landing lag, at least one frame (Melee's PlCo +0x0E8 = 2). No
button shortens or lengthens it, and there is no L-cancel input, window or state.
Empty and air-dodge landings keep their own lag.

This is an intentional departure from Melee, not a missing feature.

Owner decision 2026-10-06 (#54): **remove L-cancelling**. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons, including `bun wisp oracle`, must state that
L-cancelling is omitted.
