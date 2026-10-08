# Movement

Smashcraft deliberately uses a stronger air dodge than this Melee reference
(#347): 3.4 Melee units per frame rather than 3.1, about 9.7% faster.
Decay stays 0.9, landing lag stays 10 frames, and intangibility is unchanged.
Airborne dodge travel increases with the launch speed; a wavedash carries
that faster landing velocity into each fighter's existing ground traction.

How Melee's fighters move: the rules the game applies to every fighter, and the
per-fighter parameters those rules read. Conventions and sources are in the
[case study's README](README.md). Function names are from the decompilation at
the revision named there.

## Ground movement

Walking accelerates toward the fighter's walk speed. A stick pushed past
<!-- v:dash.smashThreshold -->0.80<!-- /v --> within <!-- v:dash.smashWindow -->2<!-- /v -->
frames of leaving the deadzone starts a dash (`ftCo_Dash_CheckInput`). The dash's
first frame sets the fighter's initial dash speed (`ftCo_Dash_Enter`); later
frames accelerate or brake toward its run speed (`ftCommon_CalcGroundAccel_DashRun`).
Run speed ranges from <!-- v:run.min -->1.10<!-- /v --> (<!-- v:run.minWho -->Jigglypuff and Zelda<!-- /v -->)
to <!-- v:run.max -->2.30<!-- /v --> (<!-- v:run.maxWho -->Captain Falcon<!-- /v -->), median
<!-- v:run.median -->1.50<!-- /v -->; initial dash speed from <!-- v:dashSpeed.min -->1.00<!-- /v -->
(<!-- v:dashSpeed.minWho -->Bowser<!-- /v -->) to <!-- v:dashSpeed.max -->2.00<!-- /v -->
(<!-- v:dashSpeed.maxWho -->Captain Falcon<!-- /v -->). <!-- v:dashOverRun -->Falco, Jigglypuff, Pichu, Samus and Young Link<!-- /v --> dash faster
than they run, so their dash slows into the run.

The dash's command stream sets a flag on a fighter-specific frame; from that
frame a held stick turns the dash into a run (`ftCo_Dash_IASA`). Before it, a
fresh smash the other way turns the fighter into a new dash the other way
(`ftCo_Turn_Enter_Smash`): repeated, that is the dash dance. Holding the stick
backward without a smash changes the dash's velocity without turning, which
players call a moonwalk. The initial dash, the frames before a run can start,
lasts from <!-- v:initialDash.min -->7<!-- /v --> frames (<!-- v:initialDash.minWho -->Sheik<!-- /v -->)
to <!-- v:initialDash.max -->18<!-- /v --> (<!-- v:initialDash.maxWho -->Mewtwo<!-- /v -->),
median <!-- v:initialDash.median -->13<!-- /v -->, and covers from
<!-- v:dashDistance.min -->12.0<!-- /v --> units (<!-- v:dashDistance.minWho -->Mr. Game & Watch<!-- /v -->)
to <!-- v:dashDistance.max -->34.1<!-- /v --> (<!-- v:dashDistance.maxWho -->Captain Falcon<!-- /v -->).
These initial dash lengths agree with SmashWiki's [Dash](https://www.ssbwiki.com/Dash) table.

Traction, the ground friction, runs from <!-- v:traction.min -->0.025<!-- /v -->
(<!-- v:traction.minWho -->Luigi<!-- /v -->) to <!-- v:traction.max -->0.100<!-- /v -->
(<!-- v:traction.maxWho -->Link, Peach, Pichu and Zelda<!-- /v -->). Standing and landing
states brake by traction, multiplied by <!-- v:friction.aboveWalk -->2<!-- /v --> while
the fighter moves faster than its walk speed (`ft_80084F3C`).

"Run from frame" is the frame the dash's flag is set; "Dash animation" is the
dash's length when nothing ends it early; "Initial dash distance" is the travel
from the dash's first frame to the frame before a run can start.

<!-- table:ground -->
| Fighter | Walk | Initial dash | Run | Traction | Run from frame | Dash animation | Initial dash distance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 0.65 | 1.00 | 1.50 | 0.060 | 14 | 29 | 17.2 |
| Captain Falcon | 0.85 | 2.00 | 2.30 | 0.080 | 16 | 28 | 34.1 |
| Donkey Kong | 1.20 | 1.60 | 1.60 | 0.080 | 16 | 30 | 24.0 |
| Dr. Mario | 1.10 | 1.50 | 1.50 | 0.060 | 11 | 21 | 15.0 |
| Falco | 1.40 | 1.90 | 1.50 | 0.080 | 12 | 21 | 17.7 |
| Fox | 1.60 | 1.90 | 2.20 | 0.080 | 12 | 21 | 23.7 |
| Ganondorf | 0.73 | 1.30 | 1.35 | 0.070 | 16 | 28 | 20.2 |
| Ice Climbers | 0.95 | 1.40 | 1.40 | 0.035 | 14 | 21 | 18.2 |
| Jigglypuff | 0.70 | 1.40 | 1.10 | 0.090 | 13 | 23 | 13.9 |
| Kirby | 0.85 | 1.40 | 1.40 | 0.080 | 13 | 23 | 16.8 |
| Link | 1.20 | 1.30 | 1.30 | 0.100 | 13 | 30 | 15.6 |
| Luigi | 1.10 | 1.30 | 1.34 | 0.025 | 11 | 21 | 13.4 |
| Mario | 1.10 | 1.50 | 1.50 | 0.060 | 11 | 21 | 15.0 |
| Marth | 1.60 | 1.50 | 1.80 | 0.060 | 16 | 27 | 26.1 |
| Mewtwo | 1.00 | 1.40 | 1.40 | 0.040 | 19 | 29 | 25.2 |
| Mr. Game & Watch | 1.10 | 1.50 | 1.50 | 0.060 | 9 | 17 | 12.0 |
| Ness | 0.84 | 1.30 | 1.40 | 0.060 | 14 | 25 | 18.1 |
| Peach | 0.85 | 1.20 | 1.30 | 0.100 | 16 | 21 | 19.4 |
| Pichu | 1.24 | 1.80 | 1.72 | 0.100 | 14 | 22 | 22.4 |
| Pikachu | 1.24 | 1.80 | 1.80 | 0.090 | 14 | 22 | 23.4 |
| Roy | 1.20 | 1.40 | 1.61 | 0.060 | 16 | 27 | 23.7 |
| Samus | 1.00 | 1.86 | 1.40 | 0.060 | 9 | 22 | 13.2 |
| Sheik | 1.20 | 1.70 | 1.80 | 0.080 | 8 | 21 | 12.5 |
| Yoshi | 1.15 | 1.33 | 1.60 | 0.060 | 14 | 26 | 20.3 |
| Young Link | 1.20 | 1.80 | 1.60 | 0.080 | 13 | 30 | 19.6 |
| Zelda | 0.70 | 1.10 | 1.10 | 0.100 | 16 | 22 | 16.5 |
<!-- /table -->

## Jumps

A ground jump spends the fighter's jump squat on the ground (`ftCo_KneeBend_Anim`).
Releasing jump during the squat selects the short hop's launch speed, holding it
the full jump's. The takeoff frame moves the fighter by its launch speed alone
(`ftCo_Jump_Phys` skips its first frame); every later frame subtracts gravity
and caps the fall at the fighter's fall speed (`ftCommon_Fall`). An aerial jump
launches at the full jump's speed times the fighter's aerial multiplier and
falls from its first frame (`ftCo_JumpAerial_Enter_Basic`).
<!-- v:ownAerialJump -->Jigglypuff, Kirby, Mewtwo, Ness, Peach and Yoshi<!-- /v -->
have their own aerial jumps, marked "own".

Jump squat runs from <!-- v:squat.min -->3<!-- /v --> frames (<!-- v:squat.minWho -->Fox, Ice Climbers, Kirby, Pichu, Pikachu, Samus and Sheik<!-- /v -->)
to <!-- v:squat.max -->8<!-- /v --> (<!-- v:squat.maxWho -->Bowser<!-- /v -->), median
<!-- v:squat.median -->4<!-- /v -->. Full hops rise from <!-- v:fullHop.min -->20.8<!-- /v -->
(<!-- v:fullHop.minWho -->Jigglypuff<!-- /v -->) to <!-- v:fullHop.max -->51.5<!-- /v -->
(<!-- v:fullHop.maxWho -->Falco<!-- /v -->) and stay in the air from
<!-- v:fullAir.min -->34<!-- /v --> frames (<!-- v:fullAir.minWho -->Fox<!-- /v -->) to
<!-- v:fullAir.max -->74<!-- /v --> (<!-- v:fullAir.maxWho -->Luigi<!-- /v -->). Short hops
rise <!-- v:shortHop.min -->9.1<!-- /v --> to <!-- v:shortHop.max -->22.8<!-- /v -->.
A short hop fast-fallen as soon as it starts descending lands after
<!-- v:shff.min -->15<!-- /v --> frames (<!-- v:shff.minWho -->Fox<!-- /v -->) to
<!-- v:shff.max -->37<!-- /v --> (<!-- v:shff.maxWho -->Samus<!-- /v -->), median
<!-- v:shff.median -->23<!-- /v -->: the window in which a short-hopped aerial must
come out and finish.

Heights are in Melee units above the takeoff point; air times count frames from
takeoff to the frame the fighter is back at the takeoff height.

<!-- table:jumps -->
| Fighter | Jump squat | Full hop | Full hop air | Short hop | Short hop air | Short hop, fast-fallen | Aerial jump |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 8 | 31.6 | 46 | 10.7 | 26 | 19 | 28.8 |
| Captain Falcon | 4 | 38.5 | 49 | 14.9 | 31 | 21 | 28.6 |
| Donkey Kong | 5 | 37.8 | 56 | 13.6 | 33 | 23 | 29.0 |
| Dr. Mario | 4 | 29.0 | 51 | 11.0 | 31 | 21 | 26.7 |
| Falco | 5 | 51.5 | 51 | 11.6 | 24 | 17 | 41.8 |
| Fox | 3 | 31.3 | 34 | 10.6 | 20 | 15 | 40.2 |
| Ganondorf | 6 | 27.3 | 42 | 16.4 | 32 | 24 | 22.2 |
| Ice Climbers | 3 | 35.1 | 57 | 10.5 | 29 | 21 | 32.5 |
| Jigglypuff | 5 | 20.8 | 52 | 9.1 | 34 | 24 | own |
| Kirby | 3 | 26.0 | 52 | 14.8 | 39 | 28 | own |
| Link | 6 | 29.7 | 47 | 11.0 | 29 | 19 | 20.9 |
| Luigi | 4 | 42.9 | 74 | 14.9 | 42 | 30 | 32.7 |
| Mario | 4 | 29.0 | 51 | 11.0 | 31 | 21 | 26.7 |
| Marth | 4 | 35.1 | 58 | 14.0 | 37 | 25 | 25.2 |
| Mewtwo | 5 | 33.4 | 60 | 12.7 | 36 | 25 | own |
| Mr. Game & Watch | 4 | 29.0 | 51 | 11.0 | 31 | 21 | 26.7 |
| Ness | 4 | 36.0 | 59 | 13.3 | 35 | 25 | own |
| Peach | 5 | 31.4 | 59 | 16.8 | 42 | 31 | own |
| Pichu | 3 | 32.0 | 50 | 14.0 | 32 | 23 | 29.4 |
| Pikachu | 3 | 32.0 | 50 | 14.0 | 32 | 23 | 29.4 |
| Roy | 5 | 31.0 | 47 | 10.6 | 28 | 19 | 21.8 |
| Samus | 3 | 34.5 | 68 | 22.8 | 54 | 37 | 26.1 |
| Sheik | 3 | 34.1 | 49 | 20.2 | 37 | 26 | 38.0 |
| Yoshi | 5 | 34.9 | 56 | 18.3 | 40 | 28 | own |
| Young Link | 4 | 32.5 | 50 | 11.0 | 29 | 20 | 23.0 |
| Zelda | 6 | 31.3 | 62 | 18.3 | 46 | 33 | 21.4 |
<!-- /table -->

## Falling and air control

Gravity accelerates a falling fighter up to its fall speed. Fast fall replaces
the fall speed at once with the fighter's fast-fall speed: the check runs when
the fighter is already descending and the stick has newly crossed downward
(`ftCommon_CheckFallFast`). In the air the stick accelerates the fighter by a
base plus a stick-scaled amount up to its air speed; without stick input, or
above air speed, air friction slows it (`ftCommon_CalcSelfAccel`).

Gravity ranges from <!-- v:gravity.min -->0.064<!-- /v --> (<!-- v:gravity.minWho -->Jigglypuff<!-- /v -->)
to <!-- v:gravity.max -->0.230<!-- /v --> (<!-- v:gravity.maxWho -->Fox<!-- /v -->); fall speed
from <!-- v:fall.min -->1.30<!-- /v --> (<!-- v:fall.minWho -->Jigglypuff<!-- /v -->) to
<!-- v:fall.max -->3.10<!-- /v --> (<!-- v:fall.maxWho -->Falco<!-- /v -->); fast-fall speed from
<!-- v:fastFall.min -->1.60<!-- /v --> to <!-- v:fastFall.max -->3.50<!-- /v -->. Gravity and
fall speed rise together (rank correlation <!-- v:rho.gravityFall -->0.81<!-- /v -->), which is
what separates the cast's "fast fallers" from its "floaties". Air speed ranges
from <!-- v:airSpeed.min -->0.68<!-- /v --> (<!-- v:airSpeed.minWho -->Luigi<!-- /v -->) to
<!-- v:airSpeed.max -->1.35<!-- /v --> (<!-- v:airSpeed.maxWho -->Jigglypuff<!-- /v -->); reaching
it from rest takes <!-- v:toFullDrift.min -->5<!-- /v --> to <!-- v:toFullDrift.max -->28<!-- /v -->
frames.

"Fast fall gain" is how much faster the fast fall is than the ordinary fall.
"Drift over a full hop" is the horizontal distance covered from rest, holding
one way, during the fighter's full-hop air time.

<!-- table:air -->
| Fighter | Gravity | Fall speed | Fast fall | Fast fall gain | Air speed | Air acceleration | Air friction | Frames to full drift | Drift over a full hop |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 0.130 | 1.90 | 2.40 | 26% | 0.80 | 0.050 | 0.010 | 17 | 30.8 |
| Captain Falcon | 0.130 | 2.90 | 3.50 | 21% | 1.12 | 0.060 | 0.010 | 19 | 45.0 |
| Donkey Kong | 0.100 | 2.40 | 2.96 | 23% | 1.00 | 0.040 | 0.020 | 26 | 44.0 |
| Dr. Mario | 0.095 | 1.70 | 2.30 | 35% | 0.90 | 0.044 | 0.016 | 21 | 37.1 |
| Falco | 0.170 | 3.10 | 3.50 | 13% | 0.83 | 0.070 | 0.020 | 12 | 37.8 |
| Fox | 0.230 | 2.80 | 3.40 | 21% | 0.83 | 0.080 | 0.020 | 11 | 24.3 |
| Ganondorf | 0.130 | 2.00 | 2.60 | 30% | 0.78 | 0.060 | 0.020 | 13 | 28.1 |
| Ice Climbers | 0.100 | 1.60 | 2.00 | 25% | 0.70 | 0.047 | 0.020 | 15 | 35.0 |
| Jigglypuff | 0.064 | 1.30 | 1.60 | 23% | 1.35 | 0.280 | 0.050 | 5 | 67.6 |
| Kirby | 0.080 | 1.60 | 2.00 | 25% | 0.78 | 0.060 | 0.020 | 13 | 35.9 |
| Link | 0.110 | 2.13 | 3.00 | 41% | 1.00 | 0.060 | 0.005 | 17 | 39.2 |
| Luigi | 0.069 | 1.60 | 2.00 | 25% | 0.68 | 0.040 | 0.010 | 18 | 44.9 |
| Mario | 0.095 | 1.70 | 2.30 | 35% | 0.86 | 0.045 | 0.016 | 20 | 36.1 |
| Marth | 0.085 | 2.20 | 2.50 | 14% | 0.90 | 0.050 | 0.005 | 18 | 44.5 |
| Mewtwo | 0.082 | 1.50 | 2.30 | 53% | 1.20 | 0.050 | 0.016 | 25 | 58.2 |
| Mr. Game & Watch | 0.095 | 1.70 | 2.30 | 35% | 1.00 | 0.050 | 0.016 | 21 | 41.5 |
| Ness | 0.090 | 1.83 | 2.20 | 20% | 0.93 | 0.060 | 0.030 | 16 | 48.1 |
| Peach | 0.080 | 1.50 | 2.00 | 33% | 1.10 | 0.070 | 0.005 | 16 | 56.8 |
| Pichu | 0.110 | 1.90 | 2.50 | 32% | 0.85 | 0.050 | 0.010 | 18 | 35.7 |
| Pikachu | 0.110 | 1.90 | 2.70 | 42% | 0.85 | 0.050 | 0.010 | 18 | 35.7 |
| Roy | 0.114 | 2.40 | 2.90 | 21% | 0.90 | 0.050 | 0.005 | 18 | 34.6 |
| Samus | 0.066 | 1.40 | 2.30 | 64% | 0.89 | 0.032 | 0.010 | 28 | 48.8 |
| Sheik | 0.120 | 2.13 | 3.00 | 41% | 0.80 | 0.060 | 0.040 | 14 | 34.3 |
| Yoshi | 0.093 | 1.93 | 2.93 | 52% | 1.20 | 0.048 | 0.013 | 26 | 52.8 |
| Young Link | 0.110 | 2.13 | 2.20 | 3% | 1.00 | 0.060 | 0.005 | 17 | 42.2 |
| Zelda | 0.073 | 1.40 | 1.85 | 32% | 0.95 | 0.048 | 0.005 | 20 | 50.0 |
<!-- /table -->

## Wavedash and waveland

An air dodge sets the fighter's velocity to <!-- v:airdodge.force -->3.10<!-- /v -->
units per frame in the stick's direction (`ftCo_80099A9C`), then multiplies it by
<!-- v:airdodge.decay -->0.90<!-- /v --> every frame before it moves
(`ftCo_EscapeAir_Phys`), so the first frame already covers
<!-- v:airdodge.firstFrame -->2.79<!-- /v --> units. Touching the ground ends it in a
landing that lasts <!-- v:waveland.lag -->10<!-- /v --> frames
(`ftCo_LandingFallSpecial_Enter`), and the horizontal velocity becomes the
fighter's ground speed, braked by traction as above. The air dodge can be
entered on the very frame a jump leaves the ground (`ftCo_Jump_IASA` checks it
on the frame `ftCo_Jump_Enter` runs), so a dodge angled into the floor lands at
once: a wavedash. The same landing from a dodge above a floor or platform is a
waveland, which skips the jump squat.

The slide is computed at <!-- v:wavedash.degrees -->17.1<!-- /v -->° below horizontal,
the angle SmashWiki gives for the longest [wavedash](https://www.ssbwiki.com/Wavedash);
the stick's <!-- v:deadzone -->0.28<!-- /v --> deadzone is what keeps a dodge from being
shallower. Because the dodge's speed is common to all fighters, traction alone
orders the slides (rank correlation with traction
<!-- v:rho.wavedashTraction -->−0.96<!-- /v -->). The whole slide runs from
<!-- v:wavedash.min -->20.2<!-- /v --> units (<!-- v:wavedash.minWho -->Peach and Zelda<!-- /v -->)
to <!-- v:wavedash.max -->83.8<!-- /v --> (<!-- v:wavedash.maxWho -->Luigi<!-- /v -->); by the time
the landing lets the fighter act it has covered <!-- v:wavedashActionable.min -->18.3<!-- /v -->
to <!-- v:wavedashActionable.max -->26.6<!-- /v -->. The computed order agrees with
meleeframedata.com's wavedash ranking (rank correlation
<!-- v:rho.wavedashRank -->0.99<!-- /v -->). A wavedash lets the fighter act after its jump
squat plus <!-- v:waveland.frames -->11<!-- /v --> frames; a waveland after
<!-- v:waveland.frames -->11<!-- /v -->.

"Slide while landing" includes the landing frame and the landing lag; "Whole
slide" runs until the fighter stops.

<!-- table:wavedash -->
| Fighter | Traction | Walk speed | Slide while landing | Whole slide | Frames to act (wavedash) | meleeframedata.com rank |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Luigi | 0.025 | 1.10 | 26.6 | 83.8 | 15 | 1 |
| Ice Climbers | 0.035 | 0.95 | 25.5 | 58.1 | 14 | 2 |
| Mewtwo | 0.040 | 1.00 | 24.9 | 51.9 | 16 | 3 |
| Marth | 0.060 | 1.60 | 22.8 | 41.5 | 15 | 4 |
| Roy | 0.060 | 1.20 | 22.7 | 36.1 | 16 | 6 |
| Yoshi | 0.060 | 1.15 | 22.7 | 36.1 | 16 | 5 |
| Dr. Mario | 0.060 | 1.10 | 22.7 | 35.0 | 15 | 7 |
| Mario | 0.060 | 1.10 | 22.7 | 35.0 | 15 | 7 |
| Mr. Game & Watch | 0.060 | 1.10 | 22.7 | 35.0 | 15 | 7 |
| Samus | 0.060 | 1.00 | 22.7 | 35.0 | 14 | 10 |
| Ness | 0.060 | 0.84 | 22.7 | 33.3 | 15 | 11 |
| Bowser | 0.060 | 0.65 | 22.7 | 32.6 | 19 | 13 |
| Fox | 0.080 | 1.60 | 21.0 | 31.0 | 14 | 12 |
| Falco | 0.080 | 1.40 | 20.8 | 29.6 | 16 | 14 |
| Ganondorf | 0.070 | 0.73 | 21.6 | 28.5 | 17 | 16 |
| Donkey Kong | 0.080 | 1.20 | 20.5 | 27.1 | 16 | 17 |
| Sheik | 0.080 | 1.20 | 20.5 | 27.1 | 14 | 18 |
| Young Link | 0.080 | 1.20 | 20.5 | 27.1 | 15 | 15 |
| Captain Falcon | 0.080 | 0.85 | 20.5 | 25.3 | 15 | 20 |
| Kirby | 0.080 | 0.85 | 20.5 | 25.3 | 14 | 20 |
| Pikachu | 0.090 | 1.24 | 19.7 | 25.3 | 14 | 19 |
| Jigglypuff | 0.090 | 0.70 | 19.4 | 22.4 | 16 | 23 |
| Link | 0.100 | 1.20 | 18.6 | 22.0 | 17 | 24 |
| Pichu | 0.100 | 1.24 | 18.6 | 22.0 | 14 | 22 |
| Peach | 0.100 | 0.85 | 18.3 | 20.2 | 16 | 25 |
| Zelda | 0.100 | 0.70 | 18.3 | 20.2 | 17 | 25 |
<!-- /table -->

## Rolls and spot dodges

From shield, a stick sideways rolls and a stick down spot-dodges
(`ftCo_8009917C`, `ftCo_8009980C`). Both are animation-driven: the animation's
own translation moves the fighter (`ftAnim_8006EBA4`), so roll distance is a
per-fighter recording rather than a parameter. Intangibility comes from the
action's command stream setting the body's collision state (`ftColl_8007B62C`);
a forward roll turns the fighter around when its stream raises a flag that
`ftCo_Escape_Anim` reads.

Rolls last <!-- v:rollFrames.min -->31<!-- /v --> to <!-- v:rollFrames.max -->44<!-- /v --> frames
(median <!-- v:rollFrames.median -->31<!-- /v -->) and spot dodges
<!-- v:spotFrames.min -->22<!-- /v --> to <!-- v:spotFrames.max -->42<!-- /v -->. A forward roll
travels <!-- v:rollTravel.min -->28.6<!-- /v --> (<!-- v:rollTravel.minWho -->Mr. Game & Watch<!-- /v -->)
to <!-- v:rollTravel.max -->52.0<!-- /v --> units (<!-- v:rollTravel.maxWho -->Mewtwo<!-- /v -->),
median <!-- v:rollTravel.median -->34.5<!-- /v -->. An air dodge is intangible on
<!-- v:airDodge.window -->4–29<!-- /v --> for most of the cast (otherwise
<!-- v:airDodge.windowOthers -->Bowser 3–29, Peach 4–19 and Zelda 4–19<!-- /v -->) and lasts <!-- v:airDodge.frames -->49<!-- /v --> frames
(otherwise <!-- v:airDodge.framesOthers -->Dr. Mario 48, Ice Climbers 48, Luigi 48, Mario 48, Mewtwo 39 and Ness 48<!-- /v -->).

Frame counts are from meleeframedata.com; intangibility from the retail command
streams (frames from the frame the state is set to the frame before it is
cleared); travel from libmelee's recordings, where present.

<!-- table:dodges -->
| Fighter | Spot dodge | Intangible | Roll | Intangible (forward / back) | Forward roll travel | Back roll travel | Air dodge intangible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 42 | 4–24 | 39 | 4–19 / 4–19 | 29.0 | 26.3 | 3–29 |
| Captain Falcon | 32 | 3–20 | 31 | 4–19 / 4–19 | 34.0 | 33.9 | 4–29 |
| Donkey Kong | 37 | 2–23 | 31 | 4–19 / 4–19 | 38.5 | 35.0 | 4–29 |
| Dr. Mario | 22 | 2–15 | 31 | 4–19 / 4–19 | – | – | 4–29 |
| Falco | 22 | 2–15 | 31 | 4–19 / 4–19 | 38.5 | 38.5 | 4–29 |
| Fox | 22 | 2–15 | 31 | 4–19 / 4–19 | 33.6 | 33.6 | 4–29 |
| Ganondorf | 32 | 2–20 | 31 | 4–19 / 4–19 | 37.8 | 37.7 | 4–29 |
| Ice Climbers | 27 | 2–18 | 31 | 4–19 / 4–19 | 34.5 | 34.5 | 4–29 |
| Jigglypuff | 27 | 2–15 | 34 | 2–18 / 4–19 | 32.9 | 32.9 | 4–29 |
| Kirby | 22 | 2–15 | 31 | 4–19 / 4–19 | 32.2 | 32.2 | 4–29 |
| Link | 22 | 2–15 | 37 | 4–19 / 4–19 | 36.7 | 36.6 | 4–29 |
| Luigi | 22 | 2–15 | 31 | 4–19 / 4–19 | 37.5 | 37.5 | 4–29 |
| Mario | 22 | 2–15 | 31 | 4–19 / 4–19 | 33.0 | 33.0 | 4–29 |
| Marth | 27 | 2–18 | 35 | 4–19 / 4–23 | 40.2 | 40.2 | 4–29 |
| Mewtwo | 37 | 2–21 | 37 | 4–21 / 4–19 | 52.0 | 52.0 | 4–29 |
| Mr. Game & Watch | 32 | 2–12 | 35 | 4–19 / 4–19 | 28.6 | 28.6 | 4–29 |
| Ness | 27 | 2–18 | 31 | 4–19 / 4–19 | 30.0 | 35.0 | 4–29 |
| Peach | 27 | 2–18 | 31 | 4–19 / 4–19 | 30.3 | 29.5 | 4–19 |
| Pichu | 22 | 2–15 | 31 | 4–19 / 4–19 | 40.0 | 38.0 | 4–29 |
| Pikachu | 22 | 2–15 | 31 | 4–19 / 4–19 | 36.7 | 33.3 | 4–29 |
| Roy | 27 | 2–18 | 35 | 4–19 / 4–23 | 37.8 | 37.8 | 4–29 |
| Samus | 22 | 2–15 | 44 | 4–23 / 4–23 | 39.6 | 39.6 | 4–29 |
| Sheik | 22 | 2–15 | 31 | 4–19 / 4–19 | 40.0 | 37.7 | 4–29 |
| Yoshi | 22 | 2–15 | 36 | – / – | 31.3 | 31.3 | 4–29 |
| Young Link | 22 | 2–15 | 38 | 4–19 / 4–19 | 28.8 | 28.8 | 4–29 |
| Zelda | 32 | 3–20 | 31 | 4–19 / 4–19 | 33.2 | 32.3 | 4–19 |
<!-- /table -->
