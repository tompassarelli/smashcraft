# Hero passives (#148)

Owner direction (Tom, 7 Oct 2026): every fighter gets one passive in the
manner of a League of Legends champion passive, drawn from its hero's
Warcraft III passive or aura. Orchestrator rules for the design: one passive
per fighter; **nothing random** (a visible, deterministic counter, never a
dice roll); each passive sharpens the fighter's #105 gameplan without making
the fighters alike, and states its counterplay.

This decision amends the roster contract
(smashcraft:docs/design/roster.md, "Knockback and hitstun"), which forbade
"critical-hit RNG, random evasion, chance-on-hit stuns, passive lifesteal".
Randomness stays forbidden. Critical strikes, bashes and lifesteal return
only as counted, capped procs that both players can see coming.

Numbers are provisional authoring values, not measured balance. #105 measures
them after they land, and Tom can veto any of them. Frames are simulation
frames (60 a second); percents are Smash damage percent.

## What League of Legends teaches about passives

- **Clarity before power.** Riot's clarity rules: players must "quickly
  identify and react to" what happens, the most important thing on screen
  draws the most attention ("always preserve hierarchy"), and "noise should
  be kept minimal" ([Clarity in League](https://www.leagueoflegends.com/en-gb/news/dev/clarity-in-league/)).
  A passive's charge-up is low-key; only the ready state and the proc
  draw attention.
- **No dice.** Riot removed Dodge because random avoidance had no
  counterplay and "much more potential to remove satisfaction in a
  noticeable way … due to its random nature"
  ([Dodge is Dead, 2011](https://www.surrenderat20.net/2011/11/dodge-is-dead.html)),
  and has since moved champions off chance-based crits
  ([2021 crit changes](https://www.ggrecon.com/articles/riot-explains-critical-strike-changes-coming-to-league-2021-preseason)).
- **Counted procs both players can read.** The best-known proc passives are
  counters that both players can see: Vayne's Silver Bolts rings on the
  target, with every third consecutive hit dealing bonus damage
  ([LoL Wiki](https://wiki.leagueoflegends.com/en-us/Vayne)); Jhin's fourth
  shot always crits, and his ammo shows it
  ([LoL Wiki](https://wiki.leagueoflegends.com/en-us/Jhin)); Caitlyn's
  Headshot counts attacks to a stronger one
  ([LoL Wiki](https://wiki.leagueoflegends.com/en-us/Caitlyn)). Because the
  opponent knows when the strong hit is coming, they can play around it.
  Counting is what turns a passive into interaction.
- **Low APM, high identity.** A passive adds no button. It changes which
  existing buttons are worth pressing and when, so it expresses the
  character's pattern (Vayne duels, Jhin's rhythm) instead of adding more to
  execute.

Platform-fighter prior art agrees: Little Mac's Power Meter and Cloud's Limit
Gauge are visible, deterministic charges both players read
([SmashWiki: Power Meter](https://www.ssbwiki.com/Power_Meter),
[Limit Gauge](https://www.ssbwiki.com/Limit_Gauge)), and Rivals of Aether
gives each character one rule-changing mechanic of its own.

## Shared rules

These are the engine contract (one module, smashcraft:ts/src/game/sim/passives.ts,
when built). Each fighter's section names only its differences.

1. **One counter.** Each fighter has one passive state: `stacks` (0 to its
   maximum), `window` (frames left before the stacks clear) and a proc
   `serial` for presentation. All three are fighter state, snapshotted,
   in the canonical checksum and restored by rollback. Stock loss and
   rematch clear them.
2. **A landed hit is a body hit.** Unless a passive says otherwise, a hit
   counts only when it reaches the body: not on shield, not on an
   intangible or parrying fighter. A multi-hit move counts once per target
   per attack, using the hit registry's attack serial, so a fast jab cannot
   fill a counter. Each projectile counts once. Pummels never count; throws
   count as one landed hit where the passive counts melee hits.
3. **Ready, then spent.** When the stacks reach the maximum, the passive is
   **ready** and the next qualifying hit procs. A ready proc that meets a
   **shield is spent with no bonus**: one rule, learned once, which makes
   shielding the ready hit the general answer. A whiff does not spend it.
4. **Window.** Each counted event refreshes the window. When the window
   runs out, the stacks clear. A ready proc keeps the window too, so it can't
   be banked forever.
5. **Whole numbers.** Bonus damage is whole percent. It is added to the
   contact's damage before knockback, so the launch reads the boosted damage
   (smashcraft:ts/src/game/sim/contacts.ts totals the frame). Knockback
   multipliers are binary32 constants that Lua32 reproduces.
6. **Visible.** Above the mana bar sits a row of small pips, one per stack.
   They are dim while charging. In the ready state they are lit and the
   fighter carries the stock Warcraft effect named below; the proc plays its
   stock effect once, keyed by the proc serial so replay never duplicates
   it. Every path below exists in the game data (checked by the #144
   legibility lane); the per-special cues of #144 stay off these models.
7. **Mana is separate.** Passives neither spend nor grant mana. The mana
   gained from a hit (smashcraft:docs/design/mana.md, when it lands) is the
   hit's ordinary gain, proc or not.

## Summary

| Fighter | Passive (Warcraft source) | Counter | Proc | Answer |
| --- | --- | --- | --- | --- |
| Blademaster | Critical Strike | 3 landed sword hits, 180-frame window | 4th sword hit: ×1.5 damage, at most +6 | Shield the glowing blade; whiffs don't spend it |
| Mountain King | Bash | 2 landed hits, 120-frame window | 3rd hit: +10 hitstun frames | Get out after two hits, or shield the third |
| Warden | Shadow Step (Blink) | 1 pip, once per airtime | An aerial body hit in the air restores one aerial jump | Shield her off-stage aerials; edge-guard when the pip is dark |
| Archer | Trueshot Aura | 2 landed arrows, 240-frame window | 3rd arrow: double damage, still no hitstun | Shield or jump the glowing arrow; arrows still don't stop an approach |
| Rifleman | Long Rifles | 3 blaster shots fired | 4th shot: 1.5× range, a POKE launch instead of the flinch | Count to four; shield or jump the Long Rifle shot |
| Illidan | none: his attacks drain mana on hit | (Illidan lane) | | |
| Lich | Frost Aura (Frost Armor) | 2 melee hits taken, 180-frame window | 3rd melee hit on him chills the striker | Use projectiles or grabs, or space the third hit out |
| Forsaken Paladin | Devotion Aura | 3 hits blocked by his shield | The next launch he takes: knockback ×0.80 | Grab him (throws ignore it), or spend it with a jab |
| Dreadlord | Vampiric Aura | 2 landed melee hits or throws, 240-frame window | 3rd: heals him 2%, at most 8% a stock | Shield and space; projectiles and shields give no pips |
| Shadow Hunter | Voodoo crossfire (Big Bad Voodoo) | Glaive and ward body hits, up to 2, 240-frame window | His next landed melee hit: +2% per pip | Break the ward, shield shots, shield his normals while lit |
| Pit Lord | Cleaving Attack | 2 cleaver contacts, hit or blocked, 180-frame window | 3rd: double shield damage on a shield; +3% on a body | Don't shield the third swing: dodge, roll or jump it |
| Beastmaster | Pack Hunt (Summon Bear) | One pair window, 40 frames | Owner and bear hitting the same target within 40 frames: the second hit +3% | Don't stand between them; break the bear |
| Lich King | Frostmourne Hungers (#167) | Landed Frostmourne normals and Harvest Soul, up to 3, no window | Not a proc: Howling Blast and Val'kyr Shadowguard spend one for their soul form | Shield his normals; read the pips before his specials |

## Blademaster: Critical Strike

**Rule.** Each of his sword hits that lands (normals, aerials, Wind Walk
Backstab, the Mirror Image swap slash, Rising Blade; not Wind Cutter, throws
or pummels) adds a pip, up to 3, and refreshes a 180-frame window. With 3
pips his blade glows. The next sword hit that lands is a **Critical
Strike**: ×1.5 damage, at most +6%, launching from the boosted damage. The
pips clear.

**Shows.** Three pips, bright when ready. Proc: Cleave's slash spray
(`Abilities\Spells\Other\Cleave\CleaveDamageTarget.mdx`) on the target.

**Counterplay.** The glow is the cue: shield it (spent, no bonus), or stay
out of his reach until the window runs out. Whiffing doesn't spend it, so
baiting a swing alone isn't enough.

**Why.** Kit review 1 calls his tip sweetspots "the deliberate Critical
Strike". The passive adds the rhythm: a fighter who keeps landing spaced hits
is paid on the fourth. Wind Cutter gives no pips, so his weak ranged pressure
stays weak. A crit forward smash is a kill-percent threat both players count
toward.

## Mountain King: Bash

**Rule.** Each of his hits that lands (normals, aerials, throws, Storm Bolt,
Thunder Clap, Hammerfall) adds a pip, up to 2, and refreshes a 120-frame
window. With 2 pips his hammer crackles. The next hit that lands **Bashes**:
10 more hitstun frames on top of the hit's own. The pips clear. A Bash is
hitstun, not a separate stun, so it uses no status immunity group and
cannot stack with Storm Bolt's or Mana Burn's statuses.

**Shows.** Two pips, bright when ready. Proc: Warcraft's stun stars
(`Abilities\Spells\Human\Thunderclap\ThunderclapTarget.mdx`) over the target.

**Counterplay.** Two hits are the warning. Leave, shield the third (spent),
or let 120 frames pass. A Bash adds no damage or knockback, so DI still
decides where the victim lands.

**Why.** His weakness is a poor chase. The Bash gives his third close read a
guaranteed follow-up, at the range where he already wins, without improving
his air drift or reach.

## Warden: Shadow Step

**Rule.** The first time in an airtime that one of her aerials lands a body
hit while she is airborne, she gets back one aerial jump (up to her
maximum). That happens once per airtime, and landing, a ledge catch or a
new stock renews it. The pip is lit while the restore is still available
this airtime.

Her Blink (up special) and Shadow Pursuit both end helpless, so restoring
Blink itself would give her nothing. The jump is what keeps an off-stage
chase going, and Blink stays her last resort, as Warcraft's Blink is the
escape after the hunt.

**Shows.** One pip: lit while the restore is available, dark once she has
used it. Proc: `Abilities\Spells\NightElf\Blink\BlinkTarget.mdx` at her feet
(the legibility lane's per-special cues use only BlinkCaster).

**Counterplay.** Shield her off-stage aerials or stay out of them, and the
jump never comes back. Once the pip is dark she has spent her extra jump,
so that is the moment to edge-guard her. Blink's endpoint stays punishable.

**Why.** Her gameplan is edge pressure: "she spends her jump first and Blinks
last". The passive pays the hunter who chases off-stage and lands the hit,
and the pip tells the edge-guarder exactly when she is out of extra jumps.

## Archer: Trueshot Aura

**Rule.** Each arrow (neutral special, running arrow, homing arrow) that
lands a body hit adds a pip, up to 2, and refreshes a 240-frame window. With
2 pips her bow glows. The next arrow that lands deals **double damage**.
Arrows still deal no hitstun, hitlag or knockback (Tom's owner correction,
smashcraft:docs/gameplay-design.md "Archer's arrows"), so this is chip, not
a wall. The pips clear.

**Shows.** Two pips. Ready: `Abilities\Spells\NightElf\TrueshotAura\TrueshotAura.mdx`
at her feet while ready; the doubled damage is the proc.

**Counterplay.** Shield or jump the glowing arrow, which spends it. Her
arrows never stop an approach, so running through the chip is still
the answer.

**Why.** She chips from range and wins by running in. A landed third arrow
moves the target's percent toward her up smash and forward smash kill
percents, without arrows stopping anyone. Rejected: a third arrow that
flinches. It reverses the owner correction and copies Rifleman's blaster.

## Rifleman: Long Rifles

**Rule.** Counts **shots fired**, not landed: every blaster shot adds a pip,
up to 3, with no window. The fourth shot is a **Long Rifle** shot: it flies
1.5× as far (life 60 → 90 frames) and launches with POKE knockback where the
blaster normally flinches. The pips clear when it fires, hit or miss.

**Shows.** Three pips, bright when ready. Proc: a bolt flash
(`Abilities\Weapons\Bolt\BoltImpact.mdx`) on him as the Long Rifle shot fires.

**Counterplay.** It is fully countable, like Jhin's fourth shot: after three
shots the opponent knows the next one launches. Jump it, shield it (it is
spent), or approach between shots. Firing it into nothing spends it.

**Why.** He holds ground and never chases. The Long Rifle shot is the one
shot that pushes an approacher back out, at a rhythm the approacher can
count. It is not another flinch, and Archer's arrows never stop anyone.

## Illidan: none

Tom's decision (7 Oct 2026): Illidan's attacks drain the target's mana on
hit, as a per-move property of his kit data (`HitEffect.manaDrain`, larger on
combo enders and big hits; the Illidan lane owns it). That is his Warcraft
identity (Mana Break and Mana Burn standing in for Evasion), and he gets
no other passive. Warcraft's Evasion is random avoidance, which these rules
forbid.

## Lich: Frost Aura

**Rule.** Each melee hit (a strike from the attacker's body, not a
projectile, placed object or throw) that reaches Lich's body adds a frost
pip, up to 2, and refreshes a 180-frame window. With 2 pips a frost shell
shows on him. The third melee hit to reach him **chills the striker** with
the existing Chill status (75 frames at 60% top ground and air speed, its
immunity group and 120 frames of immunity). The pips clear. The hit still
lands in full. This is the striker's slow, not armor.

**Shows.** Two pips. Ready: `Abilities\Spells\Undead\FrostArmor\FrostArmorTarget.mdx`
on Lich while ready; the proc is the striker's Chill.

**Counterplay.** Grabs, throws and projectiles add nothing. Space the third
hit out past the window, or make the third hit a kill move so the slow comes
too late. Chill never touches jumps, shield, dodges or recovery.

**Why.** He is a frail caster whose short normals lose close. Rushing him
down stays the right plan, but a long string costs the rusher the speed to
chase him back out to his range. Down B's Frost Armor shell and its Dark
Ritual stay the deliberate version; the passive chill doesn't stack with the
shell's (one condition at a time).

## Forsaken Paladin: Devotion Aura

**Rule.** Each hit his shield blocks adds a pip, up to 3, with no window.
With 3 pips Devotion Aura shows under him. The next hit that **launches**
him has knockback ×0.80. The pips clear. Throws ignore it and leave it in
place, as armor ignores grabs. A non-launching hit (a flinch, damage-only
arrows) does not spend it.

**Shows.** Three pips. Ready: `Abilities\Spells\Human\DevotionAura\DevotionAura.mdx`
under him while ready; it goes out with the launch it softens.

**Counterplay.** Grab him, since grabs beat his shield anyway. Or spend it
on purpose with a weak launching hit (a jab) before the kill move. The pips
only fill from attacks the opponent chose to throw into his shield.

**Why.** He is a defensive paladin who reads approaches. Blocking is his
read, and Devotion turns three good blocks into surviving one more kill move,
without passive armor and without a zone to camp in. Kit review 2 rejected a
placed Devotion zone for exactly that camping risk.

## Dreadlord: Vampiric Aura

**Rule.** Each of his melee hits or throws that lands (not Carrion Swarm,
Sleep or pummels) adds a pip, up to 2, and refreshes a 240-frame window. The
third heals him **2%**, at most 8% a stock. Vampiric Pounce's bite keeps its
own 4% heal and 12% cap. The pips clear.

**Shows.** Two pips, bright when ready. Proc:
`Abilities\Spells\Undead\VampiricAura\VampiricAuraTarget.mdx` on him.

**Counterplay.** Projectiles and shields give no pips. Shield his close
pressure and space him out. The cap is visible: when four procs have healed
him this stock, the pips go grey.

**Why.** Air movement, grabs and close pressure are his identity. The
passive pays for staying in, and a throw counts as a hit. The roster
forbade "passive lifesteal"; this is lifesteal made a count with a cap,
which the amendment above allows.

## Shadow Hunter: Voodoo Crossfire

Warcraft's Shadow Hunter has no passive. His identity is that his wards and
glaive do the work, and Big Bad Voodoo is his aura-like ultimate, so the
passive cashes in what his placed objects land.

**Rule.** Each Spirit Glaive or Serpent Ward shot that lands a body hit adds a
voodoo pip, up to 2, and refreshes a 240-frame window. His next melee hit
that lands spends the pips: **+2% per pip**. A blocked melee hit spends them
with no bonus.

**Shows.** Two pips. Ready (two pips): `Abilities\Spells\Orc\Voodoo\VoodooAura.mdx`
at his feet; the bonus damage is the proc.

**Counterplay.** Break the ward (12 durability), shield the shots and the
glaive (no pips), and shield or whiff-punish his normals while the pips are
lit. He has to come in to cash them.

**Why.** Angles from placed objects, then his functional normals. The
glaive's return pull into a forward tilt is already his best route, and the
passive pays it. Rejected: Healing Wave on the glaive (Forsaken Paladin owns the
returning heal) and a mark on the target (Warden owns marks).

## Pit Lord: Cleaving Attack

**Rule.** Counts **melee contacts, hit or blocked** (his normals, aerials and
strikes such as Ruin Charge): each adds a pip, up to 2, and refreshes a
180-frame window. The third contact **cleaves**. On a shield it deals
double shield damage; on a body it deals +3%. The pips clear. Warcraft's
splash to everything beside the target is left out: in a duel it would
only ever strike placed objects, and the shield count is the decision.

**Shows.** Two pips, bright when ready. Proc:
`Abilities\Spells\Other\Incinerate\FireLordDeathExplode.mdx` (fel fire) on
the target, apart from Blademaster's Cleave spray.

**Counterplay.** It is the one passive that counts shielded contacts,
because he is slow and shields are how fighters hold him off. On the third
swing, spot dodge, roll or jump instead of shielding. His huge startup makes
that read fair.

**Why.** The largest heavy with long, slow reach. Turtling against him gets
punished on a count the defender can see. No passive armor, as the
roster requires.

## Beastmaster: Pack Hunt

Warcraft's Beastmaster has no passive. His identity is the summoned pack,
and the roster calls bear timing his primary complexity, so the passive
rewards exactly that.

**Rule.** When Beastmaster's own hit and his bear's bite land on the same
target within 40 frames of each other (either order), the second of the two
deals **+3%**. One proc per pair: the window closes on the proc.

**Shows.** One pip: lit for the 40 frames after the first hit of a possible
pair, so both players see the window. Proc: Stampede's burst
(`Abilities\Spells\Other\Stampede\StampedeMissileDeath.mdx`) on the target.

**Counterplay.** Don't stand between Beastmaster and his bear. Break the bear
(22 durability) or separate them. A shielded hit or bite opens no window.

**Why.** He is a puppet fighter, and the skill is timing two bodies on one
target. The bonus goes to the sandwich, never to the bear alone. The bear
still has no autonomous attack.

## What the computer should exploit

For the bot-new-kits lane (#146). Every passive's state is plain fighter
state, so the computer reads it directly:

- **Own ready proc:** favour the gameplan's landing move: Blademaster's tip
  forward smash, Mountain King's follow-up string, Archer's arrow, Shadow
  Hunter's forward tilt, Pit Lord's swing (into a body, or into a shield on
  the third contact), Rifleman's fourth shot at mid range.
- **Opponent's ready proc:** shield the ready hit (it is spent on shield),
  except against Pit Lord's third swing (dodge or jump) and Forsaken Paladin's Devotion
  (grab, or jab first).
- **Counters to deny:** don't melee Lich a third time inside 180 frames;
  stop attacking Forsaken Paladin's shield at two blocks; edge-guard Warden when her
  Blink pip is dark; don't stand between Beastmaster and his bear.

## Presentation

One pip row sits above each fighter's mana bar: 3 pips for Blademaster,
Rifleman and Forsaken Paladin, 1 for Warden and Beastmaster, 2 for everyone else. The
ready-state effect is attached to the fighter, and the proc effect plays
once per proc serial. Hierarchy: the proc is louder than the ready state,
and the ready state is louder than the charging pips.
