# Archetypes and trade-offs

How Melee's cast spreads across weight, speed and frame data, and which
groupings the numbers support. Players use names for some of these groups:
[fast fallers](https://www.ssbwiki.com/Fast_faller),
[floaties](https://www.ssbwiki.com/Floaty),
[heavyweights](https://www.ssbwiki.com/Heavyweight) and the
[spacies](https://www.ssbwiki.com/Spacies), Fox and Falco. Conventions and
sources are in the [case study's README](README.md).

## What each measure does

- **Weight** divides the percent-driven part of knockback
  ([SmashWiki Knockback](https://www.ssbwiki.com/Knockback)), so heavier fighters
  are launched later. It runs from <!-- v:weight.min -->55<!-- /v -->
  (<!-- v:weight.minWho -->Pichu<!-- /v -->) to <!-- v:weight.max -->117<!-- /v -->
  (<!-- v:weight.maxWho -->Bowser<!-- /v -->); at the same percent, the percent-driven part
  of knockback on the lightest is <!-- v:weight.knockbackRatio -->1.40<!-- /v --> times that on
  the heaviest.
- **Fall speed and gravity** set how long a fighter stays in the air after a
  hit, how quickly it can land and act, and how fast its short-hopped aerials
  come down. A fast fall leaves less time in hitstun's air for a follow-up to
  miss, and lands the fighter where a regrab or a ground attack can meet it.
- **Ground and air speed** set how fast a fighter closes or opens distance.
- **Frame data**: the fastest ground move, the best aerial on shield and the
  fastest out-of-shield option ([Attacks](attacks.md)).

## The cast by these measures

Sorted by weight. "Fastest ground move" is the earliest first active frame of a
grounded normal; "Best aerial on shield" the best late, L-cancelled advantage;
"Fastest out of shield" as in [Attacks](attacks.md#punish-windows-out-of-shield).

<!-- table:profiles -->
| Fighter | Weight | Run | Air speed | Fall speed | Gravity | Fastest ground move | Best aerial on shield | Fastest out of shield |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 117 | 1.50 | 0.80 | 1.90 | 0.130 | 7 | +1 | 9 |
| Donkey Kong | 114 | 1.60 | 1.00 | 2.40 | 0.100 | 5 | 0 | 7 |
| Samus | 110 | 1.40 | 0.89 | 1.40 | 0.066 | 3 | +2 | 7 |
| Ganondorf | 109 | 1.35 | 0.78 | 2.00 | 0.130 | 3 | −3 | 6 |
| Yoshi | 108 | 1.60 | 1.20 | 1.93 | 0.093 | 3 | +1 | 8 |
| Captain Falcon | 104 | 2.30 | 1.12 | 2.90 | 0.130 | 3 | +1 | 6 |
| Link | 104 | 1.30 | 1.00 | 2.13 | 0.110 | 6 | 0 | 10 |
| Dr. Mario | 100 | 1.50 | 0.90 | 1.70 | 0.095 | 2 | −1 | 6 |
| Luigi | 100 | 1.34 | 0.68 | 1.60 | 0.069 | 2 | +1 | 6 |
| Mario | 100 | 1.50 | 0.86 | 1.70 | 0.095 | 2 | −1 | 6 |
| Ness | 94 | 1.40 | 0.93 | 1.83 | 0.090 | 3 | 0 | 7 |
| Peach | 90 | 1.30 | 1.10 | 1.50 | 0.080 | 2 | +1 | 6 |
| Sheik | 90 | 1.80 | 0.80 | 2.13 | 0.120 | 2 | 0 | 6 |
| Zelda | 90 | 1.10 | 0.95 | 1.40 | 0.073 | 4 | +1 | 6 |
| Ice Climbers | 88 | 1.40 | 0.70 | 1.60 | 0.100 | 4 | −3 | 6 |
| Marth | 87 | 1.80 | 0.90 | 2.20 | 0.085 | 4 | 0 | 6 |
| Mewtwo | 85 | 1.40 | 1.20 | 1.50 | 0.082 | 5 | −2 | 6 |
| Roy | 85 | 1.61 | 0.90 | 2.40 | 0.114 | 4 | −3 | 6 |
| Young Link | 85 | 1.60 | 1.00 | 2.13 | 0.110 | 6 | 0 | 8 |
| Falco | 80 | 1.50 | 0.83 | 3.10 | 0.170 | 2 | 0 | 6 |
| Pikachu | 80 | 1.80 | 0.85 | 1.90 | 0.110 | 2 | 0 | 6 |
| Fox | 75 | 2.20 | 0.83 | 2.80 | 0.230 | 2 | 0 | 6 |
| Kirby | 70 | 1.40 | 0.78 | 1.60 | 0.080 | 3 | +1 | 6 |
| Jigglypuff | 60 | 1.10 | 1.35 | 1.30 | 0.064 | 4 | −3 | 6 |
| Mr. Game & Watch | 60 | 1.50 | 1.00 | 1.70 | 0.095 | 4 | +2 | 6 |
| Pichu | 55 | 1.72 | 0.85 | 1.90 | 0.110 | 2 | +1 | 6 |
<!-- /table -->

## Groups

Each group is the quarter of the cast at one end of a measure.

- Heaviest (weight <!-- v:group.heavyCut -->103<!-- /v --> or more):
  <!-- v:group.heavy -->Bowser, Captain Falcon, Donkey Kong, Ganondorf, Link, Samus and Yoshi<!-- /v -->.
- Lightest (<!-- v:group.lightCut -->81<!-- /v --> or less): <!-- v:group.light -->Falco, Fox, Jigglypuff, Kirby, Mr. Game & Watch, Pichu and Pikachu<!-- /v -->.
- Fastest falling (fall speed <!-- v:group.fastFallCut -->2.13<!-- /v --> or more):
  <!-- v:group.fastFall -->Captain Falcon, Donkey Kong, Falco, Fox, Link, Marth, Roy, Sheik and Young Link<!-- /v -->.
- Floatiest (<!-- v:group.floatyCut -->1.60<!-- /v --> or less): <!-- v:group.floaty -->Ice Climbers, Jigglypuff, Kirby, Luigi, Mewtwo, Peach, Samus and Zelda<!-- /v -->.
- Fastest running (<!-- v:group.fastRunCut -->1.61<!-- /v --> or more): <!-- v:group.fastRun -->Captain Falcon, Fox, Marth, Pichu, Pikachu, Roy and Sheik<!-- /v -->.
- Fastest in the air (<!-- v:group.fastAirCut -->1.00<!-- /v --> or more): <!-- v:group.fastAir -->Captain Falcon, Donkey Kong, Jigglypuff, Link, Mewtwo, Mr. Game & Watch, Peach, Yoshi and Young Link<!-- /v -->.

## Trade-offs

Rank correlations across the cast (1 means the two measures rise together, −1
that one falls as the other rises, 0 no relation):

| Pair | Rank correlation |
| --- | ---: |
| Weight and run speed | <!-- v:rho.weightRun -->−0.13<!-- /v --> |
| Weight and air speed | <!-- v:rho.weightAir -->0.00<!-- /v --> |
| Weight and fall speed | <!-- v:rho.weightFall -->0.08<!-- /v --> |
| Weight and fastest ground move's startup | <!-- v:rho.weightGroundStartup -->0.17<!-- /v --> |
| Weight and fastest out-of-shield option | <!-- v:rho.weightOos -->0.55<!-- /v --> |
| Run speed and air speed | <!-- v:rho.runAir -->−0.07<!-- /v --> |
| Fall speed and best aerial on shield | <!-- v:rho.fallAerialSafety -->−0.13<!-- /v --> |

Melee does not tie weight to slowness. Weight predicts neither ground nor air
speed, nor fall speed, and heavy fighters are as likely as light ones to have a
fast normal. The one measure that tracks weight is the out-of-shield option:
heavier fighters tend to have slower grabs and slower aerials after their
longer jump squats. Fall speed is its own axis. The fast fallers include heavy
fighters (Captain Falcon, Donkey Kong) and light ones (Fox, Falco), and fast
fallers of any weight land sooner after a hit and are the usual targets of
[chain grabs](techniques.md#chain-grabs). The spacies sit in the light, fast-falling
corner with the quickest jabs. The floaty fighters span the weights too, from
Jigglypuff and Kirby to Samus and Luigi.
