# Defence

What a Melee fighter can do against an attack: block it, avoid it, change where
it sends them, recover from the landing, and hold the ledge. Every option here
is common to the cast; per-fighter dodge frames and distances are in
[Movement](movement.md#rolls-and-spot-dodges). Conventions and sources are in
the [case study's README](README.md).

## Shield

The shield starts at <!-- v:shield.max -->60<!-- /v --> health. Held, it drains
<!-- v:shield.drain -->0.28<!-- /v --> per frame, emptying in
<!-- v:shield.drainSeconds -->3.6<!-- /v --> seconds; released, it regains
<!-- v:shield.regen -->0.07<!-- /v --> per frame, refilling from empty in
<!-- v:shield.regenSeconds -->14.3<!-- /v --> seconds. A hit removes its damage from the
shield and freezes the defender in shieldstun, during which the shield can do
nothing (`ftCo_GuardSetOff_IASA` is empty). A broken shield launches the fighter
upward, leaves it dizzy for longer the lower its percent, and restores the
shield to <!-- v:shield.afterBreak -->30<!-- /v --> (smashcraft:docs/physics.md,
"Shield-break recovery", has the timing). The shield shrinks as its health
drops, so an attack can reach a part of the body it no longer covers: a shield
poke.

A lightly pressed trigger gives a weaker shield: it takes less shieldstun and
more pushback (`ftCo_80092F2C` interpolates both by trigger pressure;
smashcraft:docs/melee-analog-shield.md has the observed values). A full press
within <!-- v:shield.powershield -->2<!-- /v --> frames of the trigger first moving
starts a powershield, which reflects projectiles and, against attacks, keeps
the shield's health and pushes the defender back harder. Shieldstun is
unchanged (`ftCo_80092F2C`); the reward is a 4-frame counter (`ftCo_80094138`,
common `+0x2B8`) that lets an attack or grab cut the shield drop short
(`ftCo_GuardOff_IASA`) (smashcraft:docs/melee-powershield.md).

From a held shield the fighter can grab, jump, roll, spot-dodge or drop through
a platform it stands on (`ftCo_Guard_IASA`; the platform drop is
`ftCo_8009A080`, shield held with the stick pressed down). Jumping enters the
jump squat, which can still grab, up-smash or start a rapid jab
(`ftCo_KneeBend_IASA`), and leaves the ground into any aerial. Letting go of
the shield plays a release of <!-- v:shield.release -->15<!-- /v --> frames (otherwise
<!-- v:shield.releaseOthers -->Bowser 16, Captain Falcon 16, Ganondorf 16, Jigglypuff 14, Marth 16, Mewtwo 16, Mr. Game & Watch 16, Peach 14, Roy 16, Samus 16, Yoshi 16 and Zelda 14<!-- /v -->) during which
only a jump or a spot dodge is accepted (`ftCo_GuardOff_IASA`), unless a
powershield has just landed. Which of these punishes what is in
[Attacks](attacks.md#punish-windows-out-of-shield).

## Dodges

Rolls and spot dodges start from shield and are intangible for most of their
length; the per-fighter windows are in [Movement](movement.md#rolls-and-spot-dodges).
An air dodge is intangible on <!-- v:airDodge.window -->4–29<!-- /v --> for most
fighters and then leaves
the fighter helpless until it lands, unable to jump, attack or dodge again; a
landing from an air dodge takes <!-- v:waveland.lag -->10<!-- /v --> frames. The air
dodge's travel is the basis of the wavedash
([Techniques](techniques.md#wavedash-and-waveland)).

## Influence on knockback

A hit freezes both fighters in hitlag: the defender's lasts
the whole part of (damage × <!-- v:hitlag.perDamage -->0.33<!-- /v --> + <!-- v:hitlag.base -->3<!-- /v -->) frames, times <!-- v:hitlag.electric -->1.5<!-- /v --> for
electric hits and <!-- v:hitlag.crouch -->0.67<!-- /v --> for a crouching defender,
at most <!-- v:hitlag.cap -->20<!-- /v --> (`ftCommon_CalcHitlag`). The defender has
three ways to change the outcome during and at the end of that freeze:

- **Directional influence (DI).** When hitlag ends, the stick rotates the launch
  by up to <!-- v:di.degrees -->18<!-- /v -->°, most when held perpendicular to it and
  not at all when parallel (`ftCo_8008E5A4`).
- **Smash directional influence (SDI).** On each frame of hitlag, a stick held
  at least <!-- v:sdi.stick -->0.70<!-- /v --> from centre that has newly moved within the
  last <!-- v:sdi.window -->4<!-- /v --> frames moves the fighter
  <!-- v:sdi.step -->6<!-- /v --> units times the stick
  (`ftCo_Damage_OnEveryHitlag`). Each shift resets the stick's timers, so every
  shift needs a fresh stick movement; alternating the stick can give one on
  every frame.
- **Automatic SDI (ASDI).** When hitlag ends, a stick or C-stick held at least
  <!-- v:sdi.stick -->0.70<!-- /v --> moves the fighter <!-- v:asdi.step -->3<!-- /v --> units
  times it once (`ftCo_Damage_OnExitHitlag`).

SDI's reach grows with hitlag, so the strongest and the electric hits let the
defender travel farthest. With one fresh input on every frame and the ASDI at
the end:

<!-- table:sdi -->
| Damage | Hitlag | Most SDI (one input a frame) | Electric hitlag | Most SDI, electric |
| ---: | ---: | ---: | ---: | ---: |
| 3 | 4 | 27 | 6 | 39 |
| 6 | 5 | 33 | 7 | 45 |
| 9 | 6 | 39 | 9 | 57 |
| 12 | 7 | 45 | 10 | 63 |
| 15 | 8 | 51 | 12 | 75 |
| 18 | 9 | 57 | 13 | 81 |
| 24 | 11 | 69 | 16 | 99 |
| 30 | 13 | 81 | 19 | 117 |
<!-- /table -->

At the <!-- v:hitlag.cap -->20<!-- /v -->-frame cap that is <!-- v:sdi.maxDistance -->123<!-- /v -->
units, about <!-- v:sdi.maxInFullHops -->3.8<!-- /v --> times the median full-hop height.
[Techniques](techniques.md#sdi-teleports) describes what that does to multi-hit moves.

A crouching defender takes <!-- v:crouch.knockback -->0.67<!-- /v --> of the knockback
(`ftCo_Damage`, common `kb_squat_mul`) as well as less hitlag; with ASDI down
to stay on the ground, this is the crouch cancel.

## Techs and knockdown

A tumbling fighter that hits the floor, a wall or a ceiling techs if its
shield button was pressed within the last <!-- v:tech.window -->20<!-- /v --> frames;
after a press, the button is refused for <!-- v:tech.lockout -->40<!-- /v --> frames, so
pressing early or repeatedly fails (smashcraft:docs/melee-tech-input.md has
the exact frame rule). A tech either stays in place or rolls forward or back,
all intangible. A missed tech knocks the fighter down; it may lie for up to
<!-- v:knockdown.wait -->220<!-- /v --> frames, then get up in place, roll either
way or attack. Hits totalling less than <!-- v:jabReset.damage -->7<!-- /v --> damage
on a downed fighter replay a short damage animation instead of launching it
(`ftCo_DownDamage`): the jab reset, which forces a get-up.

## Ledges

A falling fighter near the edge of the main stage catches the ledge and is
briefly intangible; it can then climb, roll, jump or attack from it, or drop.
A fighter that lets go cannot catch a ledge again for
<!-- v:ledge.regrab -->30<!-- /v --> frames (common `ledge_cooldown`).
smashcraft:docs/physics.md, "Outer ledge recovery", has the catch box and the
options. One fighter holding a ledge keeps it from another, which is the
basis of edge-hogging ([SmashWiki](https://www.ssbwiki.com/Edge-hogging)).
Dropping from the ledge, jumping and air-dodging onto the stage keeps some of
the ledge's intangibility on the stage: the ledgedash. meleeframedata.com lists
the intangible frames a perfect ledgedash keeps, from
<!-- v:pla.min -->0<!-- /v --> (<!-- v:pla.minWho -->Peach<!-- /v -->) to
<!-- v:pla.max -->15<!-- /v --> (<!-- v:pla.maxWho -->Fox and Pichu<!-- /v -->).

## Grabs

A grab ignores the shield. The grabbed fighter's escape timer starts higher the
more damage it has, by <!-- v:grab.perPercent -->1.6<!-- /v --> frames per percent, and
falls by <!-- v:grab.decrement -->1<!-- /v --> each frame plus <!-- v:grab.mash -->6<!-- /v --> for each mash input
(`ftCo_CaptureWait`). The release itself happens only in the held state
(`ftCo_CaptureWaitHi_Anim`): a hit during the hold puts the victim in a damage
state that keeps counting the timer down but cannot release it. Wobbling and
some chain grabs follow from that ([Techniques](techniques.md#wobbling)).
