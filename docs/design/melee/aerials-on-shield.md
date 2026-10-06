# Aerials on shield

How safe a Melee aerial is against a shield is not a property of the move. It
is arithmetic on the hit's shieldstun, the frames the attacker still has to
fall, its landing lag, the defender's fastest out-of-shield option, and the
spacing that decides whether that option reaches. This page derives each term
from the decompilation (melee revision 0296f009f, NTSC 1.02) and works
examples. Per-move frame data, the cast-wide tables and pushback are in
[Attacks](attacks.md#aerials-on-shield-by-timing-spacing-and-drift);
conventions and sources are in the [README](README.md).

## The terms

An aerial meets the shield on hop frame *c*; the hop lands on frame *T*; the
aerial's landing lag is *L*. Both fighters then freeze in the same hitlag, so
hitlag moves no advantage and is left out. The defender leaves shieldstun *s*
frames later; the attacker falls for the *T* − 1 − *c* frames still left, then
lands and spends *L*. The attacker's frame advantage is

> *s* − (*T* − 1 − *c*) − *L*

Negative means the defender acts first. A defender's option whose hitbox
(or grab) comes out on its own frame *k* lands before the attacker can act when
the advantage is at most −*k*, if it reaches.

### Shieldstun

A hit on a shield sends the defender into GuardSetOff (`ftCo_80092F2C`). Its
animation is rescaled to last 1.5 × power × (1 − (light × (0.7 − 0.05) + 0.05)) + 2
frames, where power is the hit's truncated damage (`x19A4`, the largest hit
that frame) and light the trigger's light-shield amount (common `x28C`,
`x2E4`, `x2E8`, `x290`). For a full press that is
<!-- v:aos.stunFactor -->0.45<!-- /v --> × damage + <!-- v:aos.stunBase -->2<!-- /v -->;
for the lightest shield <!-- v:aos.lightFactor -->1.425<!-- /v --> × damage + 2,
much more stun but more pushback and a smaller bubble
(smashcraft:docs/melee-analog-shield.md). The animation counts out as
⌊(0.45 × damage + 2) × 200/201⌋ action frames (smashcraft:docs/physics.md,
"Shield-break recovery"), which reproduces meleeframedata.com's shieldstun for
<!-- v:aos.agree -->398 of 412<!-- /v --> attacks
(<!-- v:aos.agreeOffByOne -->6<!-- /v --> of the rest differ by one frame).
Nothing can be done during it: `ftCo_GuardSetOff_IASA` is empty, so a press
made then is not kept, and when the animation ends the fighter is back in
Guard, whose interrupts (`ftCo_Guard_IASA`) read that frame's input.

Shieldstun grows with damage only. It is the same for ground and aerial
attacks, and nothing about the hit's knockback, angle or element enters it.

<!-- table:aosStun -->
| Damage | Shieldstun | Hitlag, both fighters | Defender's initial slide |
| ---: | ---: | ---: | ---: |
| 3 | 3 | 4 | 0.40 |
| 6 | 4 | 5 | 0.56 |
| 9 | 6 | 6 | 0.73 |
| 12 | 7 | 7 | 0.89 |
| 15 | 8 | 8 | 1.05 |
| 18 | 10 | 9 | 1.21 |
| 24 | 12 | 11 | 1.54 |
<!-- /table -->

### Hitlag on shield

Both fighters take hitlag from a shield hit. The defender's shield callback
records the hit's integer damage (`x19A4`), the attacker's records the same
damage (`dmg.x1924`), and both reach the ordinary hitlag routine
(`ftCommon_CalcHitlag` from the hit dispatch in fighter.c): ⌊damage/3 + 3⌋,
at most 20, the crouch multiplier applying only to a crouching state. The
attacker's fall stops for those frames as well, so hitlag shifts both
timelines together. During it the defender can shift its shield along the
floor with a fresh stick press (shield SDI, `ftCo_80093240`) and once more on
release (`ftCo_800932DC`); the attacker cannot act on the hit until it ends.

### Landing lag and fast fall

Landing during an aerial enters `ftCo_LandingAir_EnterWithLag`: the move's own
landing lag from the fighter's attributes (`landingairn_lag` and so on), or,
if the aerial's flag (`cmd_vars[0]`) is clear, an ordinary landing of the
fighter's `normal_landing_lag` (<!-- v:knee.normalLanding -->4<!-- /v --> for
Captain Falcon): the autocancel. An L, R or Z press within
<!-- v:lcancel.window -->7<!-- /v --> frames before landing divides the lag by
<!-- v:lcancel.divisor -->2<!-- /v -->, truncated, at least 1: the L-cancel.

Fast fall (`ftCommon_FallFast`) replaces the fall speed with the fighter's
fast-fall speed once the hop is past its apex. It shortens *T*, so the same
contact leaves fewer frames to fall. A short hop pressed with the aerial on its
takeoff frame and fast-fallen at once is how an aerial hits as low as it can
early in a hop; a late press without fast fall hits low the other way.

### Out-of-shield options

From a held shield (`ftCo_Guard_IASA`) a fighter can grab, jump, roll, spot
dodge or drop through a platform; dropping the shield costs the release lag in
[Defence](defense.md#shield). The options that punish an aerial:

- **Shield grab.** Shield held and A pressed (`ftCo_Catch_CheckInput`: the
  shield in held buttons, A in this frame's presses). There is no input
  buffer: the press has to land on the first frame the shield is back in
  Guard, and a press during shieldstun is lost. Players hold the shield and
  press A on that frame; a grab pressed too early comes out as nothing.
- **Jump out of shield.** A jump enters the jump squat (KneeBend), which can
  still grab or up-smash (`ftCo_KneeBend_IASA`), and an aerial can start on the
  takeoff frame. The aerial's hitbox therefore comes out on jump squat plus its
  startup. Fox's neutral air comes out on frame
  <!-- v:fox.oosNair -->7<!-- /v -->, one behind his grab on
  <!-- v:fox.grab -->6<!-- /v -->.
- **Up smash from jump squat**, rolls and spot dodge, in
  [Attacks](attacks.md#punish-windows-out-of-shield).

Each fighter's grab and jump-out-of-shield aerials, the frame each hitbox comes
out counted from the first actionable frame:

<!-- table:oosAerials -->
| Fighter | Shield grab | Jump squat | Neutral air | Forward air | Back air | Up air | Down air |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bowser | 9 | 8 | 16 | 16 | 17 | 30 | 22 |
| Captain Falcon | 6 | 4 | 11 | 18 | 14 | 10 | 20 |
| Donkey Kong | 7 | 5 | 15 | 30 | 12 | 11 | 23 |
| Dr. Mario | 6 | 4 | 7 | 22 | 10 | 8 | 14 |
| Falco | 6 | 5 | 9 | 11 | 9 | 13 | 10 |
| Fox | 6 | 3 | 7 | 9 | 7 | 11 | 8 |
| Ganondorf | 6 | 6 | 13 | 20 | 16 | 12 | 22 |
| Ice Climbers | 7 | 3 | 9 | 22 | 11 | 9 | 6 |
| Jigglypuff | 6 | 5 | 11 | 12 | 14 | 14 | 10 |
| Kirby | 6 | 3 | 13 | 13 | 9 | 14 | 21 |
| Link | 10 | 6 | 10 | 20 | 12 | 11 | 19 |
| Luigi | 6 | 4 | 7 | 11 | 10 | 9 | 14 |
| Mario | 6 | 4 | 7 | 22 | 10 | 8 | 14 |
| Marth | 6 | 4 | 10 | 8 | 11 | 9 | 10 |
| Mewtwo | 6 | 5 | 10 | 10 | 17 | 14 | 23 |
| Mr. Game & Watch | 6 | 4 | 24 | 14 | 14 | 11 | 16 |
| Ness | 7 | 4 | 9 | 12 | 14 | 12 | 24 |
| Peach | 6 | 5 | 8 | 21 | 11 | 12 | 17 |
| Pichu | 6 | 3 | 6 | 13 | 7 | 7 | 17 |
| Pikachu | 6 | 3 | 6 | 13 | 7 | 6 | 17 |
| Roy | 6 | 5 | 12 | 10 | 13 | 10 | 12 |
| Samus | 17 | 3 | 8 | 7 | 12 | 8 | 21 |
| Sheik | 7 | 3 | 6 | 8 | 7 | 8 | 18 |
| Yoshi | 17 | 5 | 8 | 24 | 15 | 10 | 23 |
| Young Link | 10 | 4 | 8 | 18 | 10 | 9 | 17 |
| Zelda | 11 | 6 | 12 | 14 | 11 | 20 | 20 |
<!-- /table -->

A grab reaches only in front of the defender and only its grab range; a
jump-out-of-shield aerial can reach behind (a back air) or above, and drifts.

## What changes the advantage

- **Timing in the fall.** Every frame between contact and landing is a frame
  the defender gets back. The same hit is safest on the last frame before
  landing and worst at the top of a slow fall.
- **Hit strength.** Shieldstun rises 0.45 frames per damage, so a strong
  hitbox earns frames a weak one of the same move does not. Moves with an
  early strong hit and a long weak tail (Captain Falcon's knee) and multi-hit
  moves of small hits (Fox's drill) are the extremes.
- **Hitbox timing.** A lingering, early-active hitbox covers more space and
  more of the fall, so it meets shields more often, but usually with the weak
  tail and with fall left over: it chips and concedes frames. A committed hit
  timed late with the strong hitbox risks a whiff and rewards more.
- **Spacing.** The advantage says when the defender can act; spacing says
  whether its option reaches. Pushback slides the defender away
  ([Attacks](attacks.md#aerials-on-shield-by-timing-spacing-and-drift)), a
  spaced aerial lands outside grab range, and a fade-back lands farther still.
  A negative aerial can be safe because nothing reaches.
- **Side.** An aerial that carries the attacker through to land behind the
  shield (a cross-up) can't be shield-grabbed, since the grab reaches only in
  front, and the defender's answer becomes a back air or a turned-around
  option, which for most of the cast comes out later than the grab (table
  above). Mixing the front, spaced and cross-up landings is what makes the
  defender guess.

## Worked examples

### Captain Falcon's knee, strong and weak

Captain Falcon's forward air comes out on frame
<!-- v:knee.start -->14<!-- /v -->. SmashWiki lists its strong hit on frames
14–16 at <!-- v:knee.strong -->18<!-- /v -->% and its weak hit on frames
<!-- v:knee.sour -->17<!-- /v -->–30 at <!-- v:knee.weak -->6<!-- /v -->%
([SmashWiki](https://www.ssbwiki.com/Captain_Falcon_(SSBM)/Forward_aerial)).
On a full shield the strong hit gives <!-- v:knee.strongStun -->10<!-- /v -->
frames of shieldstun and the weak one <!-- v:knee.weakStun -->4<!-- /v -->.
Its landing lag is <!-- v:knee.lag -->19<!-- /v -->,
<!-- v:knee.cancelled -->9<!-- /v --> L-cancelled. His short hop lasts
<!-- v:knee.hopAir -->31<!-- /v --> frames, <!-- v:knee.hopAirFast -->21<!-- /v -->
fast-fallen; his full hop <!-- v:knee.fullAir -->49<!-- /v -->
(<!-- v:knee.fullAirFast -->36<!-- /v --> fast-fallen).

- Strong knee on the last frame before landing, L-cancelled:
  <!-- v:knee.strongLate -->+1<!-- /v -->. The attacker acts first.
  Without the L-cancel: <!-- v:knee.strongLateUncancelled -->−9<!-- /v -->.
- Weak knee on the last frame before landing, L-cancelled:
  <!-- v:knee.weakLate -->−5<!-- /v -->, one frame short of a 6-frame shield
  grab on frames alone.
- Strong knee from a short hop pressed on takeoff and fast-fallen at once:
  contact on frame 14, <!-- v:knee.strongFastHopFall -->6<!-- /v --> frames of
  fall left, <!-- v:knee.strongFastHop -->−5<!-- /v -->.
- Weak knee high: pressed on the takeoff of a short hop without fast fall, the
  first weak frame meets the shield with
  <!-- v:knee.weakHighHopFall -->13<!-- /v --> frames of fall left:
  <!-- v:knee.weakHighHop -->−18<!-- /v -->. Any defender with a
  <!-- v:knee.grab -->6<!-- /v -->-frame grab, standing in reach, grabs him
  before he lands.

The same move spans 19 frames of advantage by timing and strength alone.

### Fox's drill and shine

Fox's down air (the drill) is a string of small hits, active on frames
<!-- v:drill.active -->5–27<!-- /v -->, each <!-- v:drill.damage -->3<!-- /v -->% or
<!-- v:drill.weak -->2<!-- /v -->%. Each hit's shieldstun is only
<!-- v:drill.stun -->3<!-- /v --> frames, and a later hit renews it rather than
adding to it. Its landing lag is <!-- v:drill.lag -->18<!-- /v -->,
<!-- v:drill.cancelled -->9<!-- /v --> L-cancelled, so the last drill hit just
before landing leaves Fox at <!-- v:drill.late -->−6<!-- /v -->: exactly a
frame-perfect 6-frame shield grab, with no buffer to help.

His grounded down special (the shine) hits on frame
<!-- v:shine.hit -->1<!-- /v --> for <!-- v:shine.damage -->5<!-- /v -->% and can be
jump-cancelled from frame <!-- v:shine.acts -->4<!-- /v -->. With
<!-- v:shine.stun -->4<!-- /v --> frames of shieldstun by the formula
(meleeframedata.com lists <!-- v:shine.corpusStun -->5<!-- /v -->) it is
<!-- v:shine.onShield -->+2<!-- /v --> on shield: Fox acts before the defender.
That is why a drill landing at −6 is followed by a shine: a defender who
doesn't punish on its first frames meets a frame-1 hit that leaves Fox ahead
again, and his jump out of the shine starts the next aerial or a waveshine.
