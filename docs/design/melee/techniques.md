# Techniques and jank

Much of how Melee is played comes from techniques its players found rather than
ones the game teaches. Each one below is described with the engine behaviour
that makes it possible. The last group are the ones the community itself has
treated as broken or contested. Conventions and sources are in the
[case study's README](README.md); function names are from the decompilation.

## Movement techniques

### Wavedash and waveland

An air dodge sets a fixed-speed velocity in the stick's direction and, on
touching the ground, ends in a landing that keeps the horizontal part of that
velocity as ground speed (`ftCo_80099A9C`, `ftCo_EscapeAir_Phys`,
`ftCo_LandingFallSpecial_Enter`). Because the air dodge can start on the very
frame a jump leaves the ground (`ftCo_Jump_IASA`), a dodge angled into the floor
lands at once and the fighter slides along the ground in a standing pose,
able to act once the landing ends: a wavedash. Landing on a floor or platform
from an air dodge already in the air is a waveland. The slide's length is set
by traction ([Movement](movement.md#wavedash-and-waveland)). Players first
described it in January 2002 ([SmashWiki](https://www.ssbwiki.com/Wavedash));
the developers had noticed it during development and left it in
([Nintendo Power 228](https://www.sourcegaming.info/2015/09/06/nintendopower228/)).

### Dash dance and moonwalk

During the initial dash, a fresh smash of the stick the other way turns the
fighter into a new dash in that direction (`ftCo_Dash_IASA` →
`ftCo_Turn_Enter_Smash`); repeating it makes the fighter flicker back and forth
in place, threatening both directions: the [dash dance](https://www.ssbwiki.com/Dash_dance).
Holding the stick backward without the smash accelerates the dash backward
while the fighter keeps facing forward: the [moonwalk](https://www.ssbwiki.com/Moonwalk).
How long each fighter's dash dance can be is its initial dash
([Movement](movement.md#ground-movement)).

### Short hop, fast fall, L-cancel

A short hop (jump released during the squat), a fast fall as soon as the hop
starts descending, and an L-cancel on landing combine into the
[SHFFL](https://www.ssbwiki.com/SHFFL): an aerial that comes out and lands in
the shortest time the fighter allows. The L-cancel is an L, R or Z press shortly
before landing that divides the aerial's landing lag (`ftCo_LandingAir_EnterWithLag`;
[Attacks](attacks.md#reading-the-numbers) has the window). It existed in the
first game as the Z-cancel and was removed from Brawl onward
([SmashWiki L-cancel](https://www.ssbwiki.com/L-cancel)).

### Shield drop, jump-cancelled grab and up smash

Holding shield on a platform and pressing the stick down drops through the
platform with no shield-release lag (`ftCo_8009A080`): the
[shield drop](https://www.ssbwiki.com/Shield_drop), an out-of-shield option from
a platform. The jump squat accepts a grab or an up smash (`ftCo_KneeBend_IASA`),
so jumping first and grabbing or up-smashing during the squat gives a running
or shielding fighter a grab or up smash it could not otherwise start from that
state ([jump-canceling](https://www.ssbwiki.com/Jump-canceling)).

### Multishine and waveshine

Fox's and Falco's reflector hits on its first frame and can be cancelled into a
jump a few frames later. Jumping and reflecting again, repeatedly, is the
[multishine](https://www.ssbwiki.com/Multishine); jump-cancelling the reflector
into a wavedash is the [waveshine](https://www.ssbwiki.com/Waveshine), which can
hit a shielding or grounded opponent and then follow it with another attack.
Falco's longer jump squat makes his version slower.

### Edge cancel and ledgedash

An aerial landing near the edge of a platform can slide the fighter off the edge
during its landing lag, which ends the lag at once
([edge cancel](https://www.ssbwiki.com/Edge_cancel)). From a ledge, dropping,
jumping and air-dodging onto the stage puts the fighter on stage while some of
the ledge's intangibility remains: the [ledgedash](https://www.ssbwiki.com/Ledgedash)
([Defence](defense.md#ledges)).

### Crouch cancel and tech chasing

A crouching fighter takes less knockback and hitlag; holding down for the
automatic SDI keeps it grounded, so it can answer a light hit with its own
attack ([crouch cancel](https://www.ssbwiki.com/Crouch_cancel)). A fighter
that misses a tech must lie down and then get up, roll or attack, each with
fixed timing, so an attacker who reads or reacts to the choice can follow it:
[tech chasing](https://www.ssbwiki.com/Tech-chasing).

## Jank

### Wobbling

The Ice Climbers' leader grabs and pummels while Nana attacks the same victim on
an alternating rhythm. Each hit puts the grabbed victim into a damage state.
That state keeps counting the escape timer down and accepting mash input
(`fn_800DB8A4`), but only the ordinary held state can release the victim
(`ftCo_CaptureWaitHi_Anim`), so hits arriving before each damage animation ends
keep the victim from ever reaching the release
([SmashWiki Wobbling](https://www.ssbwiki.com/Wobbling)). Nothing the victim
does changes the outcome; the Ice Climbers player decides when to end it.
Wobbling was legal at most tournaments from 2013 to early 2019; from 2019
major events began banning it, starting with Get On My Level 2019, and it is
now banned at most tournaments ([SmashWiki](https://www.ssbwiki.com/Wobbling);
[Smashboards](https://smashboards.com/threads/the-wobbling-ban-what-you-need-to-know.479881/)).

### Chain grabs

A throw that launches its victim too little for the victim to act before
landing lets the thrower grab again; repeated, that is a chain grab. Whether it
works depends on the victim: fast fallers and heavy fighters land soonest, so
Sheik's down throw chains many of the cast from low percents, Marth's and Roy's
up throws chain Fox and Falco, and Peach chains the fast fallers. The Ice
Climbers hand the victim from one climber to the other, which can run from no
damage to a KO ([SmashWiki Chain grab](https://www.ssbwiki.com/Chain_grab)).
The same throw angle that allows Sheik's chain in NTSC sends victims more
horizontally in the PAL version, which removes it beyond low percents (same
source). The victim's only input is directional influence, which shortens some
chains and not others.

### SDI teleports

SDI moves the fighter's position directly, not its velocity
(`ftCo_Damage_OnEveryHitlag` adds the stick times a fixed step to the
position), once per fresh stick movement and as often as every frame of
hitlag. Long hitlag therefore lets a defender jump sideways by tens of units
while frozen, up to <!-- v:sdi.maxDistance -->123<!-- /v --> units at the hitlag cap
([Defence](defense.md#influence-on-knockback)). Multi-hit moves give a hitlag
freeze per hit, so the defender can leave them before their final hit; SDI can
also move a fighter onto a platform to tech or away from a follow-up. SmashWiki
describes Melee's SDI as making many multi-hit moves easy to escape and as
stronger than in later games
([SmashWiki SDI](https://www.ssbwiki.com/Smash_directional_influence)).

### Invisible ceiling

A grounded attacker that hits a shield and then leaves the ground before its
shield recoil has decayed can lose all of its vertical knockback in the air
later, as if it hit an invisible ceiling. The airborne recoil decay clears the
fighter's vertical knockback instead of the recoil's vertical part: the
decompilation marks the line as the bug (melee:src/melee/ft/fighter.c), and
smashcraft:docs/melee-air-cutoff.md records the retail behaviour
([SmashWiki](https://www.ssbwiki.com/Invisible_ceiling_glitch)).
