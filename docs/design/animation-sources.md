# Animation sources: stock sequences versus authored clips

Which of each fighter's moves plays a sequence its Warcraft model already has
("stock") and which plays a clip authored for Smashcraft, with the verdict of
the #309 audit (8 Oct 2026). Prefer the stock sequence where it does the job
as well or better (smashcraft:docs/design/map-size.md); keep an authored clip
where Smash timing, reach or a pose the model lacks needs it.

## How a move plays a stock sequence

A swap changes only the move-to-sequence mapping, in
smashcraft:ts/src/game/presentation/stockClipSwaps.ts, applied over every
generated clip table so regenerating those leaves it in place. Frame data
never changes:

- A hero's sequence plays by its measured strike moment: `bun wisp view
  strikes --assets DIR` measures where the drawn model reaches farthest
  toward the move's first hit region, and pose selection lands that moment on
  the first active frame (heroStrikeMomentInfo.ts, #144). Then `bun wisp view
  reach --assets DIR --character ID` re-measures the drawn reach test.
- Rifleman and Illidan have no measured moments: the entry is
  `aligned` with seconds = strike × total frames ÷ first active frame, the
  same retime as `strikeClip` (smashcraft:ts/src/game/sim/heroes/groundNormals.ts).

Each candidate was judged on a side-by-side silhouette render of the same
move frames (start, mid startup, first and last active, mid recovery, end),
the authored clip above the stock sequence, with the hit regions drawn, on
the build's private models. The rubric: it reads as the move; on the hit
frame the pose points where the hit region is; no foot sliding and no snap
from the fighter's stance or into recovery. A wind-up retimed faster than 4×
(the hero swing limit in fighterPose.ts) counts as a snap.

Today every sequence of a model is pooled whether or not a move plays it, so
a swap leaves its authored clip in the map until the pool drops unplayed
sequences (#308 stores each fighter on one timeline).

## Audit

"(stock)" marks a sequence the stock model already has.

### Rifleman

Stock attack and cast sequences: "Attack", "Spell".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack jab; jab2: attack jab | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: forward tilt; f-tilt up: forward tilt up; f-tilt down: forward tilt down; u-tilt: up tilt; d-tilt: down tilt | Keep: "Attack" fires the rifle; melee tilts need bayonet and stock swings |
| Dash attack, smashes | dash: forward tilt | Keep: same reason |
| Aerials | nair: aerial neutral; fair: aerial forward; bair: aerial back; uair: aerial up; dair: aerial down | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: grab; pummel: pummel; f-throw: throw forward; b-throw: throw back; u-throw: throw up; d-throw: throw down | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: get up attack; ledge: get up attack | Keep: they start lying down or hanging; no stock sequence does |

### Illidan

Stock attack and cast sequences: "Attack", "Attack 2", "Spell Throw", "Spell", "Attack Alternate", "Spell Alternate".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack jab; jab2: attack jab; jab3: attack (stock) | **Swapped jab3 to stock "Attack"** (glaive in the region on frames 5-7; the authored gesture never reached it), wind-up 4× like a hero swing. jab/jab2 keep the short slice (#163) |
| Tilts | f-tilt: forward tilt; f-tilt up: forward tilt up; f-tilt down: forward tilt down; u-tilt: up tilt; d-tilt: down tilt | Keep: "Attack" reaches the f-tilt region but lifts overhead and breaks the up/down family; "Attack 2" leaves the ground |
| Dash attack, smashes | dash: dash attack; f-smash: forward smash; u-smash: up smash; d-smash: down smash | Keep: "Attack 2" reads as a lunging spin but its 0.62 s wind-up in 4 startup frames is a 9× snap |
| Aerials | nair: aerial neutral; fair: aerial forward; bair: aerial back; uair: aerial up; dair: aerial down | Keep: "Attack 2" spins in place but its reach is centred and has no strike frame for nair/uair |
| Grab, pummel, throws | grab: grab; pummel: pummel; f-throw: throw forward; b-throw: throw back; u-throw: throw up; d-throw: throw down | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: get up attack; ledge: ledge attack | Keep: they start lying down or hanging; no stock sequence does |

### Blademaster

Stock attack and cast sequences: "Attack", "Attack Slam", "Attack 2", "Attack Walk Stand Spin".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: sword gesture jab quick cut; jab2: sword gesture jab returning cut | Keep: authored sword gestures, one per move (smashcraft:docs/fighter-animation-work.md); stock "Attack"/"Attack 2" already carry Wind Walk |
| Tilts | f-tilt: sword gesture tilt level cut; f-tilt up: sword gesture tilt rising cut; f-tilt down: sword gesture tilt falling cut; u-tilt: sword gesture tilt overhead arc; d-tilt: sword gesture tilt low poke | Keep: same reason |
| Dash attack, smashes | dash: sword gesture dash lunging cut; f-smash: sword gesture smash shoulder cleave; u-smash: sword gesture smash sky splitter; d-smash: sword gesture smash front rear sweep | Keep: same reason |
| Aerials | nair: sword gesture air crescent slash; fair: sword gesture air forward cleave; bair: sword gesture air turning back cut; uair: sword gesture air upward pierce; dair: down air sword plunge | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: sword gesture throw back heave; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: attack (stock); N air: attack (stock); S: walk (stock); S air: walk (stock); U: attack walk stand spin (stock); U air: attack walk stand spin (stock); D: stand - 4 (stock); D air: stand - 4 (stock) | Already stock |

### Mountain King

Stock attack and cast sequences: "Attack -1", "Attack -2", "Spell Throw", "Spell Slam", "Attack Slam", "Alternate Attack -1", "Alternate Attack -2", "Alternate Spell Throw", "Alternate Spell Slam", "Attack Slam Alternate".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack gesture jab; jab2: attack gesture jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: attack -2 (stock); f-tilt up: spell throw (stock); f-tilt down: attack -2 (stock); u-tilt: attack gesture uptilt; d-tilt: attack slam alternate (stock) | Already stock for f-tilt, f-tilt up/down, d-tilt; u-tilt keeps its own gesture (#242: one clip per move) |
| Dash attack, smashes | dash: attack gesture dashattack; f-smash: attack slam (stock); u-smash: attack gesture upsmash; d-smash: spell slam (stock) | Already stock for f-smash, d-smash; dash and u-smash keep distinct gestures (#242) |
| Aerials | nair: attack gesture neutralair; fair: attack gesture forwardair; bair: attack gesture backair; uair: attack gesture upair; dair: down air boot stomp | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: spell throw (stock); N air: spell throw (stock); S: attack -1 (stock); S air: attack -1 (stock); U: attack slam (stock); U air: attack slam (stock); D: spell slam (stock); D air: attack -1 (stock) | Already stock |

### Warden

Stock attack and cast sequences: "Attack - 2", "Spell Slam", "Spell", "Spell Throw", "Attack - 1".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack - 1 (stock); jab2: attack - 1 (stock); jab3: fan of knives ground | Already stock for jab/jab2; jab3 is the Fan of Knives cast |
| Tilts | f-tilt: attack - 2 (stock); f-tilt up: spell slam (stock); f-tilt down: fan of knives air; u-tilt: spell (stock); d-tilt: attack gesture jab3 | Already stock except f-tilt down and d-tilt, which keep distinct gestures (#242) |
| Dash attack, smashes | dash: attack gesture backair; f-smash: spell slam (stock); u-smash: attack gesture dashattack; d-smash: attack gesture neutralair | f-smash already stock; others keep distinct gestures (#242): the stock attacks already carry other moves |
| Aerials | nair: attack gesture forwardtiltdown; fair: attack gesture downsmash; bair: attack gesture downtilt; uair: attack gesture forwardair; dair: drill down air | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: spell throw (stock); N air: spell throw (stock); S: attack - 2 (stock); S air: attack - 2 (stock); U: dissipate (stock); U air: dissipate (stock); D: fan of knives ground; D air: fan of knives air | Already stock except Fan of Knives (authored, smashcraft:docs/design/warden-fan-of-knives.md) |

### Lich

Stock attack and cast sequences: "Attack", "Spell".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack (stock); jab2: attack (stock) | Already stock |
| Tilts | f-tilt: attack gesture forwardtilt; f-tilt up: attack gesture forwardtiltup; f-tilt down: attack gesture forwardtiltdown; u-tilt: attack gesture uptilt; d-tilt: attack gesture downtilt | Keep: his one stock "Attack" carries the jab; tilts need distinct gestures (#242) |
| Dash attack, smashes | dash: attack gesture dashattack; f-smash: attack gesture forwardsmash; u-smash: attack gesture upsmash; d-smash: attack gesture downsmash | Keep: same reason |
| Aerials | nair: stand channel (stock); fair: attack gesture forwardair; bair: attack gesture backair; uair: attack gesture upair; dair: down air frost press | nair already stock "Stand Channel"; others keep |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: spell (stock); N air: spell (stock); S: spell (stock); S air: spell (stock); U: stand channel (stock); U air: stand channel (stock); D: attack gesture downspecial; D air: attack gesture downspecial | Already stock except down special (no stock pose for it) |

### Forsaken Paladin

Stock attack and cast sequences: "Attack 1", "Attack 2", "Attack Slam", "Spell", "Spell Slam", "Spell Fast".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: forsaken paladin jab; jab2: forsaken paladin jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: forsaken paladin forwardtilt; f-tilt up: forsaken paladin forwardtiltup; f-tilt down: forsaken paladin forwardtiltdown; u-tilt: forsaken paladin uptilt; d-tilt: forsaken paladin downtilt | Keep: "Attack 1" reaches the region but starts from the model's hunched stance, a snap from his upright idle |
| Dash attack, smashes | dash: forsaken paladin dashattack; f-smash: forsaken paladin forwardsmash; u-smash: forsaken paladin upsmash; d-smash: forsaken paladin downsmash | Keep: "Attack Slam" same stance snap |
| Aerials | nair: forsaken paladin neutralair; fair: forsaken paladin forwardair; bair: forsaken paladin backair; uair: forsaken paladin upair; dair: down air hammer drop | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: forsaken paladin grab; pummel: forsaken paladin pummel; f-throw: forsaken paladin throwforward; b-throw: forsaken paladin throwback; u-throw: forsaken paladin throwup; d-throw: forsaken paladin throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: forsaken paladin getupattack; ledge: forsaken paladin ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: forsaken paladin neutralspecial; N air: forsaken paladin neutralspecialair; S: forsaken paladin sidespecial; S air: forsaken paladin sidespecialair; U: forsaken paladin upspecial; U air: forsaken paladin upspecialair; D: forsaken paladin downspecial; D air: forsaken paladin downspecialair | Keep: authored with the attached hammer |

### Dreadlord

Stock attack and cast sequences: "Spell", "Spell Slam", "Attack - 1", "Attack - 2".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack - 2 (stock); jab2: attack gesture jab2; jab3: attack gesture jab3 | jab already stock; jab2/jab3 keep distinct gestures (#242) |
| Tilts | f-tilt: attack - 1 (stock); f-tilt up: stand - 3 (stock); f-tilt down: spell slam (stock); u-tilt: attack gesture uptilt; d-tilt: attack gesture downtilt | Already stock for f-tilt family; u-tilt, d-tilt keep distinct gestures |
| Dash attack, smashes | dash: attack - 1 (stock); f-smash: attack gesture forwardsmash; u-smash: stand - 3 (stock); d-smash: spell slam (stock) | Already stock except f-smash (distinct gesture, #242) |
| Aerials | nair: attack gesture neutralair; fair: attack gesture forwardair; bair: attack gesture backair; uair: attack gesture upair; dair: down air claw dive | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: spell (stock); N air: spell (stock); S: attack - 2 (stock); S air: attack - 2 (stock); U: stand - 2 (stock); U air: stand - 2 (stock); D: spell (stock); D air: spell (stock) | Already stock |

### Shadow Hunter

Stock attack and cast sequences: "Spell Throw", "Spell", "Attack".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack (stock); jab2: attack (stock); jab3: attack gesture jab3 | Already stock for jab/jab2; jab3 keeps a distinct gesture |
| Tilts | f-tilt: attack gesture forwardtilt; f-tilt up: attack gesture forwardtiltup; f-tilt down: spell (stock); u-tilt: attack gesture uptilt; d-tilt: spell throw (stock) | Stock where it fits (f-tilt down, d-tilt); "Attack" already carries the jab |
| Dash attack, smashes | dash: attack gesture dashattack; f-smash: attack gesture forwardsmash; u-smash: attack gesture upsmash; d-smash: stand channel (stock) | d-smash already stock; others keep distinct gestures |
| Aerials | nair: stand -2 (stock); fair: attack gesture forwardair; bair: stand -2 (stock); uair: attack gesture upair; dair: drill down air | nair/bair already stock; others keep |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: spell throw (stock); N air: spell throw (stock); S: stand channel (stock); S air: stand channel (stock); U: stand  victory (stock); U air: stand  victory (stock); D: spell (stock); D air: spell (stock) | Already stock |

### Pit Lord

Stock attack and cast sequences: "Attack Slam - 1", "Spell Slam", "Attack", "Attack Slam - 2", "Spell", "attack - 2", "attack - 3".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack (stock); jab2: attack (stock) | Already stock |
| Tilts | f-tilt: attack gesture forwardtilt; f-tilt up: attack slam - 1 (stock); f-tilt down: attack - 3 (stock); u-tilt: spell (stock); d-tilt: attack - 3 (stock) | Already stock except f-tilt (distinct gesture) |
| Dash attack, smashes | dash: attack slam - 2 (stock); f-smash: attack slam - 1 (stock); u-smash: spell slam (stock); d-smash: attack - 2 (stock) | Already stock |
| Aerials | nair: attack gesture neutralair; fair: attack gesture forwardair; bair: attack - 2 (stock); uair: attack gesture upair; dair: down air four hooves | bair already stock; others keep |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: special howl of terror; N air: special howl of terror; S: special ruin charge; S air: special ruin charge; U: special abyssal leap; U air: special abyssal leap; D: special rain of fire; D air: special rain of fire | Keep: authored Howl, Ruin Charge, Abyssal Leap and Rain of Fire (smashcraft:docs/design/pit-lord.md) |

### Beastmaster

Stock attack and cast sequences: "Spell Slam", "Attack", "Spell", "Attack -2".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack (stock); jab2: attack gesture jab2; jab3: attack gesture jab3 | jab already stock; jab2/jab3 keep distinct gestures |
| Tilts | f-tilt: attack gesture forwardtilt; f-tilt up: attack -2 (stock); f-tilt down: attack gesture forwardtiltdown; u-tilt: attack -2 (stock); d-tilt: attack gesture downtilt | f-tilt up and u-tilt already stock; others keep distinct gestures |
| Dash attack, smashes | dash: attack gesture dashattack; f-smash: spell slam (stock); u-smash: attack gesture upsmash; d-smash: spell slam (stock) | f-smash and d-smash already stock; others keep |
| Aerials | nair: attack gesture neutralair; fair: attack gesture forwardair; bair: attack gesture backair; uair: attack gesture upair; dair: down air twin axe drop | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: recovery getupattack; ledge: recovery ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: attack (stock); N air: attack (stock); S: spell (stock); S air: spell (stock); U: spell (stock); U air: spell (stock); D: attack gesture downspecial; D air: attack gesture downspecial | Already stock except down special |

### Lich King

Stock attack and cast sequences: "Attack - 1", "Attack - 2", "Spell Throw", "Spell", "Spell Channel".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: attack jab; jab2: attack jab 2; jab3: attack jab 3 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: forward tilt; f-tilt up: forward tilt; f-tilt down: attack gesture forwardtiltdown; u-tilt: up tilt; d-tilt: down tilt | Keep: "Attack - 1" ties the authored sweep; no gain |
| Dash attack, smashes | dash: dash attack; f-smash: attack - 2; u-smash: up smash; d-smash: down smash | **Swapped f-smash to "Attack - 2"**: the sword rises into the upper region on the first active frame and cuts down into the lower one, where the authored thrust stays level. Others keep |
| Aerials | nair: aerial neutral; fair: aerial forward; bair: aerial back; uair: aerial up; dair: aerial down | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: paired grab grab; pummel: paired grab pummel; f-throw: paired grab throwforward; b-throw: paired grab throwback; u-throw: paired grab throwup; d-throw: paired grab throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: get up attack; ledge: ledge attack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: special neutral; N air: special neutral; S: special side; S air: special side; U: special up; U air: special up; D: special down; D air: special down | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |

### Thrall

Stock attack and cast sequences: "Attack - 1", "Spell".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: thrall jab; jab2: thrall jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: thrall forwardtilt; f-tilt up: thrall forwardtiltup; f-tilt down: thrall forwardtiltdown; u-tilt: thrall uptilt; d-tilt: thrall downtilt | Keep: "Attack - 1" lifts the hammer overhead on the first active frame; the authored strike is in the region |
| Dash attack, smashes | dash: thrall dashattack; f-smash: thrall forwardsmash; u-smash: thrall upsmash; d-smash: thrall downsmash | Keep: the model's one or two stock attacks are full-speed swings without a smash's charge, wind-up or reach; the tilt verdict covers them |
| Aerials | nair: thrall neutralair; fair: thrall forwardair; bair: thrall backair; uair: thrall upair; dair: thrall downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: thrall grab; pummel: thrall pummel; f-throw: thrall throwforward; b-throw: thrall throwback; u-throw: thrall throwup; d-throw: thrall throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: thrall getupattack; ledge: thrall ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: thrall neutralspecial; N air: thrall neutralspecialair; S: thrall sidespecial; S air: thrall sidespecialair; U: thrall upspecial; U air: thrall upspecialair; D: thrall downspecial; D air: thrall downspecialair | Keep: "Spell" (2.7 s) is one generic cast |

### Jaina Proudmoore

Stock attack and cast sequences: "Attack -1", "Spell".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: jaina jab; jab2: jaina jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: jaina forwardtilt; f-tilt up: jaina forwardtiltup; f-tilt down: jaina forwardtiltdown; u-tilt: jaina uptilt; d-tilt: jaina downtilt | Keep: "Attack -1" ties the authored thrust, then spins the staff through recovery with no hit |
| Dash attack, smashes | dash: jaina dashattack; f-smash: jaina forwardsmash; u-smash: jaina upsmash; d-smash: jaina downsmash | Keep: the model's one or two stock attacks are full-speed swings without a smash's charge, wind-up or reach; the tilt verdict covers them |
| Aerials | nair: jaina neutralair; fair: jaina forwardair; bair: jaina backair; uair: jaina upair; dair: jaina downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: jaina grab; pummel: jaina pummel; f-throw: jaina throwforward; b-throw: jaina throwback; u-throw: jaina throwup; d-throw: jaina throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: jaina getupattack; ledge: jaina ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: jaina neutralspecial; N air: jaina neutralspecialair; S: jaina sidespecial; S air: jaina sidespecialair; U: jaina upspecial; U air: jaina upspecialair; D: jaina downspecial; D air: jaina downspecialair | Keep: "Spell" (2.7 s) is one generic cast |

### Sylvanas Windrunner

Stock attack and cast sequences: "Spell", "Attack - 1", "Attack - 2".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: sylvanas jab; jab2: sylvanas jab2; jab3: sylvanas jab3 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: sylvanas forwardtilt; f-tilt up: sylvanas forwardtiltup; f-tilt down: sylvanas forwardtiltdown; u-tilt: sylvanas uptilt; d-tilt: sylvanas downtilt | Keep: "Attack - 1" draws the bow; the bow never reaches the melee region |
| Dash attack, smashes | dash: sylvanas dashattack; f-smash: sylvanas forwardsmash; u-smash: sylvanas upsmash; d-smash: sylvanas downsmash | Keep: the model's one or two stock attacks are full-speed swings without a smash's charge, wind-up or reach; the tilt verdict covers them |
| Aerials | nair: sylvanas neutralair; fair: sylvanas forwardair; bair: sylvanas backair; uair: sylvanas upair; dair: sylvanas downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: sylvanas grab; pummel: sylvanas pummel; f-throw: sylvanas throwforward; b-throw: sylvanas throwback; u-throw: sylvanas throwup; d-throw: sylvanas throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: sylvanas getupattack; ledge: sylvanas ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: sylvanas neutralspecial; N air: sylvanas neutralspecial; S: sylvanas sidespecial; S air: sylvanas sidespecial; U: sylvanas upspecial; U air: sylvanas upspecial; D: sylvanas downspecial; D air: sylvanas downspecial | Keep: one generic "Spell" |

### Cairne Bloodhoof

Stock attack and cast sequences: "Attack - 1", "Attack - 2", "Spell Slam", "Attack Slam".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: cairne jab; jab2: cairne jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: cairne forwardtilt; f-tilt up: cairne forwardtiltup; f-tilt down: cairne forwardtiltdown; u-tilt: cairne uptilt; d-tilt: cairne downtilt | Keep: "Attack - 1" thrusts level below the region the authored strike fills |
| Dash attack, smashes | dash: cairne dashattack; f-smash: cairne forwardsmash; u-smash: cairne upsmash; d-smash: cairne downsmash | Keep: "Attack Slam" stays overhead and misses the low region; "Spell Slam" stays at chest height for d-smash |
| Aerials | nair: cairne neutralair; fair: cairne forwardair; bair: cairne backair; uair: cairne upair; dair: cairne downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: cairne grab; pummel: cairne pummel; f-throw: cairne throwforward; b-throw: cairne throwback; u-throw: cairne throwup; d-throw: cairne throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: cairne getupattack; ledge: cairne ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: cairne neutralspecial; N air: cairne neutralspecialair; S: cairne sidespecial; S air: cairne sidespecialair; U: cairne upspecial; U air: cairne upspecialair; D: cairne downspecial; D air: cairne downspecialair | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |

### Chen Stormstout

Stock attack and cast sequences: "Spell Slam", "Spell", "Attack", "Attack -2", "Spell Throw".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: chen jab; jab2: chen jab2; jab3: chen jab3 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: chen forwardtilt; f-tilt up: chen forwardtiltup; f-tilt down: chen forwardtiltdown; u-tilt: chen uptilt; d-tilt: chen downtilt | Keep: "Attack" ties the authored staff strike |
| Dash attack, smashes | dash: chen dashattack; f-smash: chen forwardsmash; u-smash: chen upsmash; d-smash: chen downsmash | Keep: "Spell Slam" does not reach the floor regions the authored sweep fills |
| Aerials | nair: chen neutralair; fair: chen forwardair; bair: chen backair; uair: chen upair; dair: chen downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: chen grab; pummel: chen pummel; f-throw: chen throwforward; b-throw: chen throwback; u-throw: chen throwup; d-throw: chen throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: chen getupattack; ledge: chen ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: chen neutralspecial; N air: chen neutralspecialair; S: chen sidespecial; S air: chen sidespecialair; U: chen upspecial; U air: chen upspecialair; D: chen downspecial; D air: chen downspecialair | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |

### Peon

Stock attack and cast sequences: "Attack", "attack gold", "Attack Lumber", "Attack - 2".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: peon jab; jab2: peon jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: attack (stock); f-tilt up: peon forwardtiltup; f-tilt down: peon forwardtiltdown; u-tilt: peon uptilt; d-tilt: peon downtilt | **Swapped f-tilt to stock "Attack"**: the pick swings out into the region at chest height, where the authored clip held it high. Up/down angles keep their aimed clips |
| Dash attack, smashes | dash: peon dashattack; f-smash: peon forwardsmash; u-smash: peon upsmash; d-smash: peon downsmash | Keep: "Attack - 2" is the same chop as "Attack"; the smashes need their charge and reach |
| Aerials | nair: peon neutralair; fair: peon forwardair; bair: peon backair; uair: peon upair; dair: peon downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: peon grab; pummel: peon pummel; f-throw: peon throwforward; b-throw: peon throwback; u-throw: peon throwup; d-throw: peon throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: peon getupattack; ledge: peon ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: peon neutralspecial; N air: peon neutralspecial; S: peon sidespecial; S air: peon sidespecial; U: peon upspecial; U air: peon upspecial; D: peon downspecial; D air: peon downspecial | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |

### Goblin Tinker

Stock attack and cast sequences: "Attack - 1", "Spell One", "Spell Two", "Spell Three", "Spell Slam", "Attack Alternate - 1", "Spell One Alternate", "Spell Two Alternate", "Spell Three Alternate", "Spell Slam Alternate".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: tinker jab; jab2: tinker jab2; jab3: tinker jab3 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: tinker forwardtilt; f-tilt up: tinker forwardtiltup; f-tilt down: tinker forwardtiltdown; u-tilt: tinker uptilt; d-tilt: tinker downtilt | Keep: "Attack - 1" ties the claw arm; no gain |
| Dash attack, smashes | dash: tinker dashattack; f-smash: tinker forwardsmash; u-smash: tinker upsmash; d-smash: tinker downsmash | Keep: "Spell Slam" ties the authored d-smash; neither gains |
| Aerials | nair: tinker neutralair; fair: tinker forwardair; bair: tinker backair; uair: tinker upair; dair: tinker downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: tinker grab; pummel: tinker pummel; f-throw: tinker throwforward; b-throw: tinker throwback; u-throw: tinker throwup; d-throw: tinker throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: tinker getupattack; ledge: tinker ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: tinker neutralspecial; N air: tinker neutralspecial; S: tinker sidespecial; S air: tinker sidespecial; U: tinker upspecial; U air: tinker upspecial; D: tinker downspecial; D air: tinker downspecial | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |

### Kael'thas Sunstrider

Stock attack and cast sequences: "Attack", "Attack - 1", "Spell", "Attack - 3", "Spell Channel".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: kaelthas jab; jab2: kaelthas jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: kaelthas forwardtilt; f-tilt up: kaelthas forwardtiltup; f-tilt down: kaelthas forwardtiltdown; u-tilt: kaelthas uptilt; d-tilt: kaelthas downtilt | Keep: "Attack - 1" ties the authored strike with a wide wind-up |
| Dash attack, smashes | dash: kaelthas dashattack; f-smash: kaelthas forwardsmash; u-smash: kaelthas upsmash; d-smash: kaelthas downsmash | Keep: the model's one or two stock attacks are full-speed swings without a smash's charge, wind-up or reach; the tilt verdict covers them |
| Aerials | nair: kaelthas neutralair; fair: kaelthas forwardair; bair: kaelthas backair; uair: kaelthas upair; dair: kaelthas downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: kaelthas grab; pummel: kaelthas pummel; f-throw: kaelthas throwforward; b-throw: kaelthas throwback; u-throw: kaelthas throwup; d-throw: kaelthas throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: kaelthas getupattack; ledge: kaelthas ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: kaelthas neutralspecial; N air: kaelthas neutralspecialair; S: kaelthas sidespecial; S air: kaelthas sidespecialair; U: kaelthas upspecial; U air: kaelthas upspecialair; D: kaelthas downspecial; D air: kaelthas downspecialair | Keep: "Spell"/"Spell Channel" are generic casts |

### Murloc

Stock attack and cast sequences: "Attack Spell", "Attack - 1".

| Moves | Clip in use | Verdict |
| --- | --- | --- |
| Jabs | jab: murloc jab; jab2: murloc jab2 | Keep: a jab strikes short and close (#163, `test/drawn-reach.test.ts`); every stock attack is a full swing |
| Tilts | f-tilt: murloc forwardtilt; f-tilt up: murloc forwardtiltup; f-tilt down: murloc forwardtiltdown; u-tilt: murloc uptilt; d-tilt: murloc downtilt | Keep: "Attack - 1" starts from a crouched hop, a snap from his idle |
| Dash attack, smashes | dash: murloc dashattack; f-smash: murloc forwardsmash; u-smash: murloc upsmash; d-smash: murloc downsmash | Keep: the model's one or two stock attacks are full-speed swings without a smash's charge, wind-up or reach; the tilt verdict covers them |
| Aerials | nair: murloc neutralair; fair: murloc forwardair; bair: murloc backair; uair: murloc upair; dair: murloc downair | Keep: every stock sequence stands on the ground; aerials need airborne legs |
| Grab, pummel, throws | grab: murloc grab; pummel: murloc pummel; f-throw: murloc throwforward; b-throw: murloc throwback; u-throw: murloc throwup; d-throw: murloc throwdown | Keep: paired holder and victim gestures meet on a contact frame; no stock sequence holds a victim |
| Get-up, ledge attacks | get-up: murloc getupattack; ledge: murloc ledgeattack | Keep: they start lying down or hanging; no stock sequence does |
| Specials | N: murloc neutralspecial; N air: murloc neutralspecialair; S: murloc sidespecial; S air: murloc sidespecialair; U: murloc upspecial; U air: murloc upspecialair; D: murloc downspecial; D air: murloc downspecialair | Keep: each special has its own authored gesture; the model has one generic cast ("Spell" or "Spell Slam"), not one per special |
