# Attacks

How fast Melee's normal attacks come out, how long they leave their user
committed, how far they reach, and what they leave the attacker with when the
defender shields. Specials, throws and items are left out: they differ by
fighter more than they share a pattern. Conventions and sources are in the
[case study's README](README.md).

## Reading the numbers

- **Startup** is the first frame a hitbox is out; **last active** is the last.
  These are meleeframedata.com's reported bounds; gaps inside multi-hit moves
  are not represented.
- **Actionable** is the first frame the attacker can act again: the
  interruptible frame where one is reported, otherwise the frame after the
  move's last frame. **Ending lag** is the frames between the last hitbox and
  that frame.
- **On shield, ground move**: with contact on frame *c*, the defender leaves
  shieldstun on *c* + shieldstun + 1 and the attacker acts on its actionable
  frame; the difference is the advantage. It is given for contact on the first
  and on the last active frame. Shieldstun is meleeframedata.com's figure for
  the strongest hitbox, so the late figure overstates moves whose late hitbox
  is weaker.
- **On shield, aerial**: contact on the last frame before landing, so the
  attacker's landing lag starts the next frame; the advantage is shieldstun
  minus landing lag. An L, R or Z press within <!-- v:lcancel.window -->7<!-- /v -->
  frames before landing divides the aerial's landing lag by
  <!-- v:lcancel.divisor -->2<!-- /v --> (`ftCo_LandingAir_EnterWithLag`, the
  L-cancel); both cases are given. An aerial that lands while its own flag is
  clear (its autocancel frames) takes the ordinary landing instead.
- **Reach** is the farthest edge of any of the move's hitboxes from the
  attacker's position, in the move's direction: ahead for most moves, behind
  for back air, above for up air, below for down air. It comes from libmelee's
  recorded hitbox positions and sizes and does not include the defender's
  hurtbox or shield.
- Every advantage ignores spacing and pushback; the last section adds them for
  aerials.

## Startup and ending lag

Across the <!-- v:ground.count -->206<!-- /v --> grounded normals with reported startup,
the median comes out on frame <!-- v:ground.startupMedian -->7<!-- /v -->; the median aerial
on frame <!-- v:aerial.startupMedian -->7<!-- /v -->. The fastest grounded
normals hit on frame <!-- v:ground.fastest -->2<!-- /v -->: <!-- v:ground.fastestWho -->Dr. Mario's jab, Falco's jab, Fox's jab, Luigi's jab, Mario's jab, Peach's jab, Pichu's jab, Pikachu's jab and Sheik's jab<!-- /v -->.
<!-- v:ground.within5 -->60<!-- /v --> grounded normals (<!-- v:ground.within5Share -->29%<!-- /v -->)
hit on or before frame <!-- v:ground.withinFrame -->5<!-- /v -->. Jabs and tilts are fast with short ending lag; smashes trade
startup and ending lag for damage.

Each cell gives the least, median and greatest value across the fighters that
have the move.

<!-- table:groundMoves -->
| Move | Fighters | Startup | Ending lag after the last hitbox | Reach | On shield, first active frame | On shield, last active frame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jab | 26 | 2 / 3 / 11 | 8 / 12 / 18 | 11.7 / 16.8 / 26.4 | −17 / −10 / −7 | −16 / −9 / −6 |
| Forward tilt | 26 | 4 / 6 / 16 | 11 / 20 / 26 | 9.1 / 20.5 / 27.7 | −23 / −17 / −13 | −19 / −13.5 / −5 |
| Up tilt | 26 | 4 / 7 / 81 | 1 / 16 / 39 | 5.4 / 11.7 / 22.9 | −35 / −15 / −9 | −32 / −10 / +4 |
| Down tilt | 26 | 3 / 7 / 14 | 8 / 17 / 31 | 10.5 / 19.5 / 27.6 | −33 / −13 / −4 | −23 / −11 / −2 |
| Dash attack | 25 | 4 / 7 / 12 | 8 / 21 / 38 | 7.2 / 12.3 / 28.1 | −45 / −25 / −20 | −32 / −14.5 / −2 |
| Forward smash | 25 | 10 / 13 / 29 | 8 / 28 / 39 | 9.3 / 20.1 / 32.0 | −31 / −23 / −15 | −29 / −20 / +2 |
| Up smash | 26 | 5 / 12 / 24 | 1 / 24 / 37 | 5.9 / 12.0 / 17.9 | −54 / −23.5 / −5 | −27 / −15 / +7 |
| Down smash | 26 | 4 / 7 / 20 | 12 / 26 / 45 | 10.0 / 16.2 / 28.0 | −54 / −29.5 / −9 | −34 / −19 / −2 |
<!-- /table -->

<!-- table:aerials -->
| Move | Fighters | Startup | Reach | Landing lag | L-cancelled lag | On shield, L-cancelled | On shield, not cancelled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Neutral air | 26 | 3 / 5 / 20 | 4.7 / 10.2 / 19.1 | 12 / 15 / 26 | 6 / 7 / 13 | −10 / −0.5 / +2 | −23 / −9 / −5 |
| Forward air | 26 | 4 / 10 / 25 | 2.3 / 15.0 / 23.3 | 15 / 20 / 30 | 7 / 10 / 15 | −8 / −3 / +1 | −21 / −14 / −7 |
| Back air | 26 | 4 / 7 / 12 | 9.7 / 15.9 / 24.1 | 15 / 18 / 35 | 7 / 9 / 17 | −10 / −2 / +1 | −28 / −11 / −7 |
| Up air | 26 | 3 / 6 / 22 | 16.8 / 24.1 / 36.6 | 15 / 18 / 32 | 7 / 9 / 16 | −10 / −3 / +1 | −26 / −12 / −7 |
| Down air | 26 | 3 / 14 / 20 | −1.2 / 7.5 / 13.3 | 15 / 26 / 50 | 7 / 13 / 25 | −17 / −7 / +2 | −41 / −21 / −6 |
<!-- /table -->

## Reach

Swords and disjointed limbs reach farthest: the longest-reaching normals are

<!-- table:longestReach -->
| Fighter | Move | Reach |
| --- | --- | ---: |
| Bowser | Up air | 36.6 |
| Marth | Forward smash | 32.0 |
| Marth | Up air | 30.6 |
| Roy | Forward smash | 30.6 |
| Donkey Kong | Forward smash | 29.7 |
| Ganondorf | Up air | 29.6 |
| Roy | Up air | 29.1 |
| Link | Up air | 28.5 |
| Mewtwo | Up air | 28.4 |
| Ness | Dash attack | 28.1 |
<!-- /table -->

## Safety on shield

Grounded normals lose on shield. Hitting on their first active frame, the median
grounded normal is at <!-- v:ground.onShieldMedian -->−20<!-- /v -->; even hitting on its
last active frame the median is
<!-- v:ground.onShieldLateMedian -->−13<!-- /v -->, and
<!-- v:ground.safeCount -->4<!-- /v --> of <!-- v:ground.onShieldCount -->204<!-- /v --> reach zero
or better. <!-- v:ground.longActiveCount -->50<!-- /v --> grounded normals gain <!-- v:ground.longActiveGain -->10<!-- /v --> or more
frames from hitting late instead of early, mostly multi-hit and lingering moves.

Aerials are where Melee's shield pressure lives. Hit just before landing and
L-cancelled, the median aerial is <!-- v:aerial.onShieldMedian -->−3<!-- /v --> and
<!-- v:aerial.safeCount -->33<!-- /v --> of <!-- v:aerial.onShieldCount -->129<!-- /v --> are zero or
better. Without the L-cancel the median is <!-- v:aerial.uncancelledMedian -->−13<!-- /v -->
and <!-- v:aerial.uncancelledSafe -->0<!-- /v --> are.

The safest normals, at their best timing (grounded moves on their last active
frame, aerials late and L-cancelled):

<!-- table:safest -->
| Fighter | Move | On shield |
| --- | --- | ---: |
| Link | Up smash | +7 |
| Sheik | Up tilt | +4 |
| Mr. Game & Watch | Forward smash | +2 |
| Mr. Game & Watch | Neutral air | +2 |
| Samus | Down air | +2 |
| Bowser | Forward air | +1 |
| Captain Falcon | Forward air | +1 |
| Ganondorf | Up smash | +1 |
| Kirby | Back air | +1 |
| Kirby | Up air | +1 |
| Luigi | Neutral air | +1 |
| Peach | Back air | +1 |
<!-- /table -->

The safest and least safe grounded normals at their best timing:

<!-- table:safestGround -->
| Fighter | Move | On shield, last active frame |
| --- | --- | ---: |
| Link | Up smash | +7 |
| Sheik | Up tilt | +4 |
| Mr. Game & Watch | Forward smash | +2 |
| Ganondorf | Up smash | +1 |
| Mr. Game & Watch | Up smash | −1 |
| Young Link | Up smash | −1 |
| Captain Falcon | Down smash | −2 |
| Mewtwo | Dash attack | −2 |
| Mr. Game & Watch | Dash attack | −2 |
| Roy | Down tilt | −2 |
<!-- /table -->

<!-- table:leastSafe -->
| Fighter | Move | On shield, last active frame |
| --- | --- | ---: |
| Pichu | Down smash | −34 |
| Roy | Down smash | −34 |
| Donkey Kong | Down smash | −33 |
| Bowser | Up tilt | −32 |
| Bowser | Dash attack | −32 |
| Jigglypuff | Down smash | −30 |
| Marth | Down smash | −30 |
| Roy | Forward smash | −29 |
| Captain Falcon | Forward smash | −28 |
| Donkey Kong | Dash attack | −28 |
<!-- /table -->

## Punish windows out of shield

A shielding fighter can, without first dropping the shield, grab, jump, roll,
spot-dodge, or drop through a platform (`ftCo_Guard_IASA`). Jumping starts the
jump squat, from which the fighter can still grab or up-smash
(`ftCo_KneeBend_IASA`): the jump-cancelled grab and up smash. An aerial can
start on the jump's takeoff frame. Dropping the shield itself takes the
shield-release lag in [Defence](defense.md#shield).

The table gives the frame on which each option's first hitbox comes out,
counted from the first frame the defender can act: a grab's startup; the
jump-squat up smash one frame later than its startup, since it starts on the
jump squat's second frame; and jump squat plus the fastest aerial's startup.
The fastest option ranges from <!-- v:oos.min -->6<!-- /v --> frames
(<!-- v:oos.minWho -->Captain Falcon, Dr. Mario, Falco, Fox, Ganondorf, Ice Climbers, Jigglypuff, Kirby, Luigi, Mario, Marth, Mewtwo, Mr. Game & Watch, Peach, Pichu, Pikachu, Roy, Sheik and Zelda<!-- /v -->) to <!-- v:oos.max -->10<!-- /v -->
(<!-- v:oos.maxWho -->Link<!-- /v -->), median <!-- v:oos.median -->6<!-- /v -->.

<!-- table:outOfShield -->
| Fighter | Grab | Up smash from jump squat | Fastest aerial after jump squat | Fastest |
| --- | ---: | ---: | ---: | ---: |
| Bowser | 9 | 17 | 16 (neutral air) | 9 |
| Captain Falcon | 6 | 22 | 10 (up air) | 6 |
| Donkey Kong | 7 | 15 | 11 (up air) | 7 |
| Dr. Mario | 6 | 10 | 7 (neutral air) | 6 |
| Falco | 6 | 8 | 9 (neutral air) | 6 |
| Fox | 6 | 8 | 7 (neutral air) | 6 |
| Ganondorf | 6 | 22 | 12 (up air) | 6 |
| Ice Climbers | 7 | 15 | 6 (down air) | 6 |
| Jigglypuff | 6 | 8 | 10 (down air) | 6 |
| Kirby | 6 | 14 | 9 (back air) | 6 |
| Link | 10 | 12 | 10 (neutral air) | 10 |
| Luigi | 6 | 10 | 7 (neutral air) | 6 |
| Mario | 6 | 10 | 7 (neutral air) | 6 |
| Marth | 6 | 14 | 8 (forward air) | 6 |
| Mewtwo | 6 | 10 | 10 (neutral air) | 6 |
| Mr. Game & Watch | 6 | 25 | 11 (up air) | 6 |
| Ness | 7 | 13 | 9 (neutral air) | 7 |
| Peach | 6 | 14 | 8 (neutral air) | 6 |
| Pichu | 6 | 10 | 6 (neutral air) | 6 |
| Pikachu | 6 | 9 | 6 (neutral air) | 6 |
| Roy | 6 | 16 | 10 (forward air) | 6 |
| Samus | 17 | 13 | 7 (forward air) | 7 |
| Sheik | 7 | 13 | 6 (neutral air) | 6 |
| Yoshi | 17 | 12 | 8 (neutral air) | 8 |
| Young Link | 10 | 12 | 8 (neutral air) | 8 |
| Zelda | 11 | 6 | 11 (back air) | 6 |
<!-- /table -->

A move is punishable on frames alone when the defender's option lands before the
attacker can act, that is when its advantage is at most minus the option's
frame. At their best timing and ignoring spacing, the median fastest option
(frame <!-- v:punish.medianOos -->6<!-- /v -->) punishes
<!-- v:punish.groundByMedian -->179 of 204<!-- /v --> grounded normals and
<!-- v:punish.aerialByMedian -->33 of 129<!-- /v --> aerials; the cast's fastest option punishes
<!-- v:punish.groundByFastest -->179 of 204<!-- /v --> and <!-- v:punish.aerialByFastest -->33 of 129<!-- /v -->.
On frames alone most grounded normals are punishable and most well-timed
aerials are not; spacing, pushback and drift decide the rest.

## Aerials on shield by timing, spacing and drift

Four things set what an aerial on shield leaves behind.

- **Timing.** Every frame between contact and landing is a frame the defender
  gets back. A late aerial hits just before landing; one thrown out on the
  takeoff frame of a short hop, fast-fallen at once, hits on its first active
  frame and then falls for the rest of the hop. That case can be far worse, or
  the aerial may come out only after the hop has landed.
- **L-cancel.** It divides the landing lag; without it
  <!-- v:aerial.uncancelledSafe -->0<!-- /v --> aerials in the cast are zero or better.
- **Spacing.** A spaced aerial touches the shield with the far edge of its
  hitbox, so the fighters start roughly its reach apart; an unspaced one hits
  from inside that range. Shield pushback then slides the defender away. A full
  shield's shieldstun basis is <!-- v:pushback.factor -->0.45<!-- /v --> × damage +
  <!-- v:pushback.base -->2<!-- /v -->, and the defender's starting slide speed is that
  basis × <!-- v:pushback.speed -->0.12<!-- /v -->, at most <!-- v:pushback.cap -->2<!-- /v -->
  (`ftCo_80092F2C`); it brakes by the defender's traction.
- **Drift.** Drifting away after contact (fading) adds the attacker's own
  landing slide to the gap; drifting in (advancing) closes it, and can carry the
  attacker through to the other side (a cross-up).

The defender's slide uses <!-- v:pushback.medianDefender -->Captain Falcon<!-- /v -->'s
traction (<!-- v:pushback.traction -->0.080<!-- /v -->), the one nearest the cast's median. For scale,
the median standing grab reaches <!-- v:pushback.grabReach -->13.2<!-- /v --> units.

<!-- table:pushback -->
| Damage | Shieldstun basis | Defender's initial slide | Slide distance (Captain Falcon's traction) |
| ---: | ---: | ---: | ---: |
| 4 | 3.80 | 0.456 | 1.1 |
| 8 | 5.60 | 0.672 | 2.5 |
| 12 | 7.40 | 0.888 | 3.7 |
| 16 | 9.20 | 1.104 | 5.2 |
| 20 | 11.00 | 1.320 | 7.0 |
<!-- /table -->

For each fighter's aerial with the best L-cancelled advantage: the advantage
late with and without the L-cancel; on the first active frame of a short hop
fast-fallen at once (or "lands first" when it lands before the hitbox comes
out); its reach; the defender's pushback slide; and how far the attacker slides
after landing from full air speed while fading.

<!-- table:aerialSpacing -->
| Fighter | Aerial | Late, L-cancelled | Late, not cancelled | First active frame of a fast-fallen short hop | Reach | Pushback slide | Fade: landing slide at air speed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | Forward air | +1 | −7 | −9 | 23.3 | 4.8 | 3.6 |
| Captain Falcon | Forward air | +1 | −9 | −5 | 11.9 | 5.7 | 5.4 |
| Donkey Kong | Back air | 0 | −8 | −15 | 22.3 | 4.2 | 5.8 |
| Dr. Mario | Neutral air | −1 | −10 | −18 | 8.2 | 4.8 | 6.3 |
| Falco | Neutral air | 0 | −8 | −12 | 10.1 | 3.7 | 3.9 |
| Fox | Neutral air | 0 | −8 | −10 | 9.2 | 3.7 | 3.9 |
| Ganondorf | Forward air | −3 | −16 | −12 | 13.0 | 5.8 | 3.2 |
| Ice Climbers | Back air | −3 | −13 | −15 | 14.3 | 3.7 | 6.6 |
| Jigglypuff | Neutral air | −3 | −13 | −20 | 12.5 | 3.7 | 5.5 |
| Kirby | Back air | +1 | −7 | −20 | 13.7 | 4.8 | 3.4 |
| Link | Forward air | 0 | −8 | −4 | 21.1 | 4.2 | 4.5 |
| Luigi | Neutral air | +1 | −7 | −25 | 10.2 | 4.6 | 8.9 |
| Mario | Neutral air | −1 | −9 | −18 | 7.7 | 3.7 | 5.7 |
| Marth | Forward air | 0 | −8 | −20 | 20.4 | 4.2 | 6.3 |
| Mewtwo | Up air | −2 | −12 | −17 | 28.4 | 4.8 | 14.2 |
| Mr. Game & Watch | Neutral air | +2 | −6 | +2 | – | 5.2 | 7.8 |
| Ness | Back air | 0 | −9 | −14 | 11.3 | 5.2 | 5.9 |
| Peach | Back air | +1 | −7 | −23 | 9.7 | 4.8 | 3.7 |
| Pichu | Neutral air | +1 | −5 | −18 | 4.7 | 3.7 | 3.2 |
| Pikachu | Neutral air | 0 | −8 | −19 | 5.9 | 3.7 | 3.6 |
| Roy | Up air | −3 | −12 | −16 | 29.1 | 2.9 | 6.3 |
| Samus | Down air | +2 | −6 | −16 | 9.0 | 5.2 | 6.2 |
| Sheik | Neutral air | 0 | −8 | −22 | 11.9 | 4.8 | 3.6 |
| Yoshi | Neutral air | +1 | −7 | −23 | 5.5 | 4.8 | 10.3 |
| Young Link | Neutral air | 0 | −8 | −15 | 11.1 | 3.7 | 5.8 |
| Zelda | Forward air | +1 | −8 | −23 | 16.8 | 7.0 | 2.5 |
<!-- /table -->
