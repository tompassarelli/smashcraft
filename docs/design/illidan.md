# Illidan: the Demon Hunter kit

Owner direction (Tom, 7 Oct 2026, after playtesting): "I don't really know
what his side/forward B does at all. Look at how Demon Hunters work in modern
World of Warcraft and how Illidan works as a raid boss, and come up with
interesting design improvements to how he plays and functions." Same day,
through the orchestrator: keep Mana Burn and make draining mana the core of
his identity, with mana now a real resource for every fighter (the mana lane,
smashcraft:docs/design/mana.md once it lands). Tom refined it: no separate
passive; Illidan's attacks simply drain the target's mana on hit, scaled per
move, so his big combos drain a lot and that is what limits the opponent's
options, and Mana Burn's stun grows as the target's mana empties. His
gameplan: whittle mana, then stun.

Numbers are provisional authoring values, not measured balance. Frames follow
the roster notation (smashcraft:docs/design/roster.md): the press is frame 1,
windows are inclusive. H is 132 units. The bar is
[Archer's specials](archer-specials.md) and [kit review 1](kit-review-1.md): a
second decision after the press, a visible setup the opponent can answer, a
cost, and a guess in the safest route.

## What the old side special was

Parry Step moved Illidan 9 units a frame toward the stick for 22 frames and,
on its frames 4–9 only, cancelled any strike that touched him and stunned the
attacker. Nothing told either player which of the two it was: a counter that
travels looks like a dash, the window showed a faint aura for 6 frames, and a
whiff looked identical to a successful step. Kit review 1 scored it 11 on
paper; in play its decision was invisible. A counter is legible when the
fighter stops and poses (Marth's and Roy's Counter); a counter folded into a
dash is not.

## Research

### Demon Hunters in modern World of Warcraft

| Ability | What it does | What a platform fighter can take |
| --- | --- | --- |
| Fel Rush | Rush forward, incinerating anything in the path; 15–20 yards, 10 s cooldown, two charges; on the ground he stays grounded, in the air he flies level, ignoring gravity ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Fel_Rush); [Method](https://method.gg/guides/havoc-demon-hunter/playstyle-and-rotation)) | A fast, straight, readable dash that strikes what it passes and doubles as a level air recovery |
| Vengeful Retreat | Vault away from enemies, damaging and (talented) slowing those nearby; 25 s cooldown ([Wowhead](https://www.wowhead.com/cn/spell=198813/vengeful-retreat)) | The backflip out: the dash's bail-out, the "rush in, flip out" loop Havoc players weave |
| Chaos Strike / Annihilation | The Fury spender; becomes Annihilation in Metamorphosis ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_hunter)) | A committed two-glaive slash that cashes the approach |
| Eye Beam | 2 s channel, 20 yards, in front; he can't move while channelling but can turn; Fel Rush cancels it ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Eye_Beam)) | A committed beam: reach paid for with a rooted channel |
| Blade Dance / Death Sweep | Strike nearby enemies; Death Sweep in Metamorphosis ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Blade_Dance)) | An evasive multi-hit around him |
| Metamorphosis (Havoc) | Leap, land with force for an 8-yard stun, then demon form for 20 s: Annihilation, Death Sweep, 20% haste ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Metamorphosis_(Havoc))) | A temporary form; the landing is a smash-like burst |
| The Hunt | 1 s cast, charge up to 50 yards, root 1.5 s, damage over time ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/The_Hunt)) | A long telegraphed lunge that marks |
| Sigil of Flame | A placed sigil that activates 2 s later ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Sigil_of_Flame)) | A delayed, visible zone |
| Soul Fragments (Vengeance) | Shattered souls left on the ground for 20 s, consumed by walking near; at most 5 ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Shattered_Souls_(Vengeance))) | A pickup resource on the stage |
| Glide, double jump, Spectral Sight, Demon Spikes | Class mobility and defence ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_hunter)) | Glide already lives in Wing Ascent (#128); the double jump is every fighter's |

### Illidan as a raid boss (Black Temple)

From the encounter's tactics ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Illidan_Stormrage_(tactics));
[Warcraft Tavern](https://warcrafttavern.com/tbc/guides/illidan-stormrage)):
Shear (a tank-buster), Draw Soul (a frontal cone that heals him), Flame Crash
(a fire hit that leaves a blaze on the ground), Parasitic Shadowfiend (a
spreading damage-over-time), the Warglaives thrown down to become the Flames
of Azzinoth while he flies and casts Fireball and Dark Barrage, Eye Blast (an
eye beam swept across the floor), Agonizing Flames, and Demon Form (Shadow
Blast, Flame Burst, Shadow Demons that stun and pursue). Maiev's Cage Trap
stuns him. The fight's language is telegraphed area denial: everything that
hurts announces where it will land.

### Warcraft III Illidan

The Demon Hunter hero ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Demon_Hunter_(Warcraft_III))):
Mana Burn (a bolt that burns 50/100/150 of the target's mana), Immolation (a
damaging aura), Evasion (10/20/30% chance to dodge) and Metamorphosis (45 s,
+500 hit points, a 600-range chaos attack). The Warcraft III Demon Hunter is,
above all, the hero who empties casters: Mana Burn is why he is picked.

### Making a dash special legible

- Street Fighter's dash specials with follow-ups (Akuma's Demon Flip, Ryu's
  Hashogeki-era rush moves) read because the travel and each branch have
  different silhouettes: the defender sees the commitment, then guesses the
  branch ([fighting-game language](fighting-games.md)).
- Fox's and Falco's Illusion and Phantasm leave an afterimage line along
  the dash: the path is visible after the fact, so the move teaches itself.
- Blademaster's Wind Walk ([kit review 1](kit-review-1.md#side-b-wind-walk-picked))
  shows the house pattern: a tell, travel that stops at a raised shield, and
  attack and special branches.
- #97's legibility rule (smashcraft:docs/gameplay-design.md, "Legible
  hurtboxes"): what the player sees must agree with what the simulation does.

## Side special: Fel Rush

**Alternative A, Fel Rush with Vengeful Retreat and Chaos Strike (picked).**
Ground or air, any facing (the stick picks the side).

- **Frames 1–5, the tell:** Illidan crouches and his fel aura flares green.
  Any hit stops it; no armor.
- **Frames 6–15, the rush:** 20 units a frame (200 in all, 1.5H) in a
  straight line, leaving a fel trail. In the air he flies level (gravity off),
  as Fel Rush does in WoW. The rush passes through bodies, striking each once:
  6% fire at 80°, base 45, growth 40, a pop-up he can follow. It stops just
  short of a raised shield, and the strike meets the shield.
- **Frames 16–29:** recovery; he acts on frame 30.
- **Branches, a press in frames 10–24:** the press replaces the rest of the
  rush:
  - **Special: Vengeful Retreat.** He backflips away from the way he faces:
    16 units a frame back on its frames 1–10 (about 160), rising 16 a frame
    at the start and 1.2 less each frame (a vault about 100 high), then
    drifting back. It ends on frame 16: from frame 17 he is airborne with his
    aerials, air dodge and jump. No hitbox and no intangibility: an escape,
    not a counter.
  - **Attack: Chaos Strike.** A two-glaive slash toward the held stick
    (held back turns him, the cross-up after passing through): active on its
    frames 5–8, 10% fire at 40°, base 30, growth 95; ends on frame 30. In the
    air, landing ends it with 12 frames of landing lag.
- **Limits:** once per airtime (landing, a ledge catch or a hit refreshes it);
  40-frame cooldown from the press; a recovery tool that never ends helpless.
- **Cost:** the mana lane's side-special cost (12); the branches are free.

**Counterplay.** The tell is 5 frames, so up close the rush is a read, not a
reaction; from its full 200 units it arrives on frame 15. A raised shield
stops it, and a rush that branches into nothing sits at the shield until frame
29: punishable. A jump over the low rush leaves him in recovery below. Against
Vengeful Retreat the defender chases: he is airborne and unable to act on its
frames 1–16, in range of a jump-out-of-shield aerial, a dash attack or a shot.
Chaos Strike is punishable on shield. The defender's guess after a rush into
shield: stay shielded (beats Chaos Strike), or let go and chase (beats the
Retreat), while Illidan guesses which.

**Reward.** A pop-up from the rush, a cross-up Chaos Strike, a level air
recovery under an edge-guarder (Wing Ascent covers high), and a way to
drain mana on the way in.

**Alternative B, The Hunt (rejected).** A 20-frame cast, then a 3H lunge that
marks for a damage-over-time and roots for 30 frames on a hit. Rejected: it
duplicates Warden's mark-and-pursue (#126), and a root beside Mana Burn's stun
gives him two lockdowns.

**Alternative C, a legible counter stance, Blur (rejected).** Keep a counter,
but make it stand still with a fel shimmer on frames 4–12 and answer a strike
with a slash behind the attacker. Rejected: counters ask Illidan to stand
still when his identity is air speed and glaive reach, and Forsaken Paladin's Divine
Shield (#131) already owns the defensive-special slot in the roster.

## Drain on hit: what his attacks do

Every attack Illidan lands drains the target's mana as part of the hit, as the
Warcraft III Demon Hunter empties casters. The drain is a property of each
move in his kit data (`manaDrain` on the move's hit effect,
smashcraft:ts/src/game/sim/hitRegions.ts and specials.ts), scaled so combo
enders and big hits drain more:

| Move | Drain | Move | Drain |
| --- | ---: | --- | ---: |
| Jab | 3 | Forward, up, down tilt | 4 |
| Dash attack | 5 | Neutral, forward, up air | 4 |
| Back air | 5 | Down air (the spike) | 8 |
| Forward smash | 10 | Up, down smash | 8 |
| Each throw | 6 | Fel Rush pass | 4 |
| Chaos Strike | 10 | Immolate | 6 |
| Glide wing slash | 5 | Mana Burn orb | the mana lane's drain |

A shielded hit drains nothing; pummels, get-up and ledge attacks drain
nothing; mana never goes below 0 and Illidan gains none. Each drain flashes
the victim's mana readout fel purple, so the meter visibly drops with the
hit (the flash rises over the drained fighter's head). A forward air into forward smash drains 14; a throw into an up air
string about 14–18.

Counterplay: drain needs a landed hit, so the answer is the ordinary one,
not getting hit; a fighter who spends mana freely arrives at Illidan's Mana
Burn with less to lose, and a fighter who keeps its mana gives up specials.

**Alternative B, a separate Mana Break passive at a flat 3 per hit
(superseded).** Tom's refinement: drain is what his hits do, not a passive,
and it scales with the move. **Alternative C, drain proportional to damage
dealt (rejected).** It ties drain to his light damage, so his identity
(many light hits) would drain little; per-move authoring lets a combo ender
drain more than its damage implies.

**Hero passives.** Drain on hit is not a passive; it fills Illidan's slot in
the roster-wide hero-passives system (the passives lane was told). It lives
on the hit effect, so any future fighter can author drain on a move the same
way.

## Neutral special: Mana Burn (kept; drain owned by the mana lane)

The slow orb of #116 stays: cast 16 frames, recovery 30, speed 12, one out.
The mana lane rebuilds its hit around mana: it burns the target's mana and the
stun grows as the target's mana empties, keeping the 300-frame window in which
a stunned fighter can't be stunned again. Every landed attack feeds it: less mana, a
longer next stun. Source of truth for
the formula: smashcraft:docs/design/mana.md and
smashcraft:ts/src/game/sim/projectiles.ts.

## Up and down specials (kept)

- **Wing Ascent with the glide** (#128): the Demon Hunter's Glide already
  lives here, and with Fel Rush in the air his recovery now has a high route
  (ascent and glide) and a level one (rush, then ascent).
- **Immolate on the ground, jump-cancellable** (#128): the Warcraft III
  Immolation as a shine, which Tom asked for. Kept. In the air it becomes
  Flame Crash (below).

## The raid boss across his normals (owner direction)

Tom's direction (7 Oct, through the orchestrator): the primary reference for
the rest of the kit is Illidan the raid boss, with Warcraft III's Immolation
and Mana Burn kept and the modern class filling gaps. Each change keeps the
shared action timing (startup and total; the clip plays over the total) and
uses the per-fighter active-frame seam, so no clip changes length.

### Forward tilt: Shear (picked)

Black Temple's Shear cut the tank's maximum health. Illidan's forward tilt
(all three angles) keeps its reach (135), startup 5 and total 28, and
becomes the mana cutter: 9% (was 8), a low 25° launch (base 20, growth 80),
and the largest drain of any quick move, **12**. The poke that empties a
mana bar; it is the setup for Mana Burn, not a kill move.

Counterplay: unchanged reach and timing, so the same spacing beats it; the
drain needs a body hit. Alternatives: **B, Shear as the jab finisher**
(rejected: Illidan has a single jab, and a finisher needs a multi-hit jab
seam); **C, Shear shrinks the target's shield** (rejected: shield health is a
shared system with its own owner decisions, #102).

### Down smash: Flames of Azzinoth (picked)

In Black Temple he throws both Warglaives into the floor and each becomes a
Flame of Azzinoth. Startup 8 and total 42 as before; active frames 3 → 9:

- Frames 1–3 of the active window: the glaives strike both sides out to
  190 (was 105), 14% at 75°, base 22, growth 95, drain 8.
- Frames 4–9: fel fire fills the space between the glaives, ±190 and up to
  170 high: 3% at 85°, base 30, growth 20, drain 2. Glaives and fire share
  one contact, so only a fighter the glaives missed burns.

Counterplay: the total is unchanged, so after the flames he still has 26
frames of recovery: a shield holds both parts and drops with more than 10
frames of the smash left; a full jump clears the
flames' height; a roll through ends past the glaives. Alternatives: **B, the
glaives thrown as two returning projectiles** (rejected: a smash that
becomes two projectiles breaks the 3-projectile cap's spirit and duplicates
Mountain King's returning Storm Bolt); **C, the flames as persistent stage
hazards** (rejected: a lingering zone after a smash outlives his
commitment).

### Forward smash: Eye Blast (picked)

Black Temple's Eye Blast is a beam swept along the floor. Startup 6 and
total 36 as before; active 3 → 10. **The charge decides:** released with
under 20 frames of charge it is the glaive swing it was (10% after #105 pass 3, was 12%; reach 195, on
active frames 1–3). Held 20 frames or more (his eyes glow fel green while
charging, the read), the beam sweeps out along the floor: active frames
1–10, reaching 195 on frame 1 and 50 further each frame to 645 on frame 10,
low (from 60 below his feet to 45 above), 10% at 30° (base 24, growth 90)
before charge scaling, drain 10, one hit per target.

Counterplay: the charge is 20 frames of visible glow; the beam is low, so a
short hop over it, or a jump at the charge, beats it; the whole move is
still his 36-frame commitment, so up close a shield wins, and at range the
beam is blocked like a projectile. Alternatives: **B, Eye Blast as the
neutral special** (rejected: Mana Burn is kept and is his drain identity);
**C, a beam on every forward smash** (rejected: a 645-unit smash with no
added commitment is free stage control).

### Down special in the air: Flame Crash (picked)

Black Temple's Flame Crash leaves a blaze where he lands. On the ground,
down special stays Immolate; in the air it is Flame Crash:

- Frames 1–4: he hangs (the tell, his fel aura flaring).
- From frame 5: he plunges straight down at 24 a frame for up to 30 frames,
  striking what he passes once: 9%, a spike (-80°) against airborne
  targets, a 60° launch against grounded ones, drain 6.
- Landing: a fel burst around him on its frames 1–3 (±150 wide, 120 high),
  8% at 65°, drain 6; he recovers until frame 24 after landing (a shield
  that blocked the burst still drops with more frames left than a jab's
  startup).
- Not landing by frame 34 leaves him helpless. No jump cancel.

Counterplay: the plunge is straight down, so a fighter not under him is
safe and punishes the 24-frame landing; offstage it is a self-destruct; the
4-frame hang is the cue. Alternatives: **B, keep the aerial Immolate spike
with its jump cancel** (rejected by the owner's direction: Flame Crash is his
down special in the air); **C, Agonizing Flames: a thrown fireball that
burns over time** (rejected: a second ranged option beside Mana Burn, and
damage over time without hitstun is Warden's poison, #126).

### Forward air: twin-glaive cross slash (picked, owner direction)

Tom (7 Oct): forward air multi-hits. Startup 5 and total 31 as before;
active 2 → 6. Active frames 1–2: the **link**, both glaives crossing out to
175: 2%, a fixed small knockback pulling slightly in and up (105°, base 30,
growth 10), drain 1. Frames 5–6: the **launcher**, the cross opening to 150:
3% at 40° (base 18, growth 85), drain 4. 5% in all after #105's bounded retune. The link's
knockback barely grows, so both hits connect at 0, 50 and 100%.

Counterplay: the launcher reaches 25 less than the link, so a fighter caught
at the tip who SDIs away during the link's freeze slips the launcher
(bounded SDI, smashcraft:docs/gameplay-design.md); shields take both hits.
Alternatives: **B, a three-hit drill** (rejected: Archer and the drills
lane own multi-hit drills, and a third hit adds lock without a decision);
**C, a single sweet-spotted slash** (rejected by the owner's direction).
Neutral air stays single-hit: it is his out-of-shield and landing poke, and a
multi-hit there would crowd the forward air's role.

## Ultimate: Metamorphosis (design only)

Tom's direction: an ultimate is earned by skill and switchable off in the
match rules (the ultimate rules in smashcraft:docs/design/mana.md). Illidan's
is **Metamorphosis**, Black Temple's Demon Form and Warcraft III's
ultimate:

- **Earned:** by the mana he drains (his skill measure); the meter and its
  threshold follow the shared ultimate rule.
- **Entry:** he leaps and lands with force (Havoc's Metamorphosis): a
  ±1.2H burst, 12% at 70°, no stun (Mana Burn owns his stun).
- **Demon Form, 600 frames:** weight +15 (Warcraft III's +500 hit points);
  Mana Burn becomes **Shadow Blast**, a fast fel bolt (speed 20, 8%, no
  stun), Warcraft III's 600-range chaos attack; Immolate becomes **Flame
  Burst**, a wider ring; an **Aura of Dread** drains 1 mana every 30 frames
  from fighters within 1.5H; Fel Rush can be used twice per airtime.
- **Ends** at 600 frames or on losing the stock; off in the rules, it does
  not exist.

Counterplay: the entry leap is telegraphed and punishable on whiff; Demon
Form trades his stun for range, so shields and powershields (Shadow Blast is
reflectable) hold it off; staying out of the aura's 1.5H keeps mana.
Alternatives: **B, a Fury meter** (rejected: mana is the one resource);
**C, Soul Fragments on the stage** (rejected: a pickup chore, and healing
works against stock pressure).

## What changes for the computer

The computer presses side special as before; the gameplan names the
Fel Rush branches only once a bot lane authors them (#105 is paused). Its
old defence through Parry Step is gone: Illidan's planned stance answers fall
back to shield and spot dodge.

## Presentation (stock Warcraft assets)

Each option shows a stock Warcraft effect (smashcraft:ts/src/game/presentation/specialCues.ts,
attackCues.ts and elementLooks.ts):

| Option | Effect |
| --- | --- |
| Fel Rush tell (frames 1–5), and every branch's startup | Death Coil special art |
| Fel Rush (frames 6–15) | Illidan's Metamorphosis missile trail |
| Vengeful Retreat | Possession missile trailing the vault |
| Chaos Strike (ground and air) | Moon Glaive whirl |
| Flame Crash hang and plunge / landing burst | Breath of Fire missile / Volcano death |
| Shear (forward tilt, all angles) | Demon Bolt impact where the glaive cuts |
| Eye Blast charge / beam | Drain caster over his eyes / green dragon fire |
| Flames of Azzinoth glaives / fire wall | Demon Hunter glaive / Flame Strike |
| Twin-glaive forward air | Illidan's missile trail |
| Drain on hit (any victim) | Mana Burn target over the victim's head through that hit's hitlag and hitstun |

Stock effects that a pool shows late draw nothing at their start, so each
of these names the sequence it starts and starts where its model already
draws, read from the model's keys (game archives, 7 Oct): Death Coil special
art's only Stand bursts 0.3–0.6 s, so the tell starts at 0.3 s; Flame Strike's
Birth reaches its full fire at 1.3 s and its Stand draws nothing, so the fire
wall starts at 1.3 s into Birth; Demon Bolt impact and Mana Burn target draw
nothing before 0.23 s and start at 0.3 s; Breath of Fire missile and Volcano
death have only a Birth, drawn 0–0.5 s; the missiles and Moon Glaive draw
from 0 s. smashcraft:ts/src/game/presentation/illidanCues.tests.ts holds the
measured windows.

Source: smashcraft:ts/src/game/sim/specials.ts (Fel Rush),
smashcraft:ts/src/game/sim/hitRegions.ts (drain on hit), contract tests in
smashcraft:ts/src/game/sim/felRush.tests.ts.
