# Sound design

How every move sounds (#391): what platform fighters do, the model Smashcraft
uses, its mixing and variation rules, and what Warcraft III's own sound library
offers. The per-fighter, per-move table is generated from the code in
[sound-table.md](sound-table.md). Earlier work this builds on: Melee's hit event
language with Warcraft assets (#82), small, medium and large tiers by move class
(#163, [tilts.md](tilts.md)), and the strong-hit slot (#389).

## What platform fighters do

**A move is a set of sound slots tied to frames.** Rivals of Aether gives each
attack window an optional sound and the frame in that window it plays on
(`AG_WINDOW_SFX`, `AG_WINDOW_SFX_FRAME`), and each hitbox its own sound for
when it hits (`HG_HIT_SFX`) [1][2]. Smash's data does the same per hitbox: each
hitbox lists an effect and a sound separately. Captain Falcon's clean knee is
Electric with "L Kick"; the late hit is Normal with "S Kick" [3]. Some hitboxes
have no sound at all [4]. Shield hits have their own blocking sound, and hitlag
applies on shield too [5]. So a typical move has:

- one swing or cast sound per startup or active window;
- one hit sound per hitbox, graded by strength;
- a shield-hit sound;
- sometimes a voice.

A whiff is the swing alone: no source shows a separate whiff sound.

**Timing is a frame-level craft.** Sakurai flagged a Melee sound that was "two
frames too long" for its motion. Melee has over 4,000 sound effects, made in
about six months from his spoken onomatopoeia ("how you attack the note, and
how you end it is crucial") [6]. The Bourne Conspiracy team placed impact,
exertion and Foley sounds as animation timeline events [7].

**Strength is graded, and sweetspots move up a grade or get a signature.**
Smash grades its sounds S, M and L within a type. Robin's Thunder tomes go S, M,
L as the spell grows; Arcthunder plays M on its first hit, S on the loop hits
and L on the finisher [11]. Pikachu's Melee down smash plays M Shock for hits
1–6 and L Shock for hit 7 [12]. A sweetspot gets a higher grade plus an element
(Falcon's knee [3]) or a character signature: Marth's tipper plays "L Marth
Sword" where the rest of the move plays generic "L Slash" [8]. Hitstop scales
with damage and per hitbox, with more on Marth's tip [13][18]. Very powerful
hits add the "ping", a sharp rising sound with a trailing impact [14]. Ultimate's
Finish Zoom plays a fixed ping-and-swords sound when the game predicts a
game-winning KO [15].

**Element is a separate field from sound.** In Smash "sound effects are not
tied to attack effects" [9]. Heavy swords get a slower, deeper slash set, and
weak swords use punch sounds [9]. Magic moves can reuse slash sounds [17].
Electric was very loud in 64, Melee and Brawl and became a quieter buzz from
Smash 4 on; Electric also multiplies hitlag by 1.5 [16].

**Specials get signature sounds.** These are character-specific sound IDs for
key hitboxes [8], and new material per character. Melee's sounds were authored
new, not pulled from a library [6]. The Killer Instinct GDC talk lists mix
choices and "designing around 60fps" [10].

**Voice.** Super SF4 holds about 10,000 pieces of character voice, cut to fit
the animation ("Sho" "ryu" "ken") [19]. Bourne gave every attack an exertion
with a tunable chance of playing, and still found some attacks repetitive [7].
Melee recorded each voice three times: normal, giant and tiny [6]. No source
was found for which Smash or SF6 moves voice, or how often.

**Mixing.** Super SF4 rebalanced volume so hits are easier to hear. SF2's hits
were heavy and Alpha's much lighter [19]. Bourne cleared ambience and
high-passed the music under slow-motion impacts [7]. Voice limits count voices
and drop the lowest priority first [20].

**Repetition.** Bourne settled on 4–5 layers per impact, each playing random
variants [7]. Every play pitch-shifts by a small amount [21], and about 8
different sounds between repeats hides repetition [22]. Keep the pitch range
small where pitch carries the tier.

**Rollback.** Audio is "a particularly difficult problem in rollback games"
[23]; SFxT lost sounds whose trigger frames were skipped [24]. Skullgirls writes
only a desired sound state and syncs real playback on non-rollback frames [25].
Smashcraft is simpler: presentation plays sounds only from confirmed frames, so
a rollback never replays or loses one (smashcraft:ts/src/game/render/combatEffects.ts,
`presentConfirmed`).

Not verified: per-element sound allocation by tier in Melee, SF6 and Rivals 2
sound or rollback-audio specifics, stereo panning rules, and loudness numbers
for hit versus swing.

## Smashcraft's model

Every move has five slots
(smashcraft:ts/src/game/presentation/moveSounds.ts). Each slot is one or more
layers, and each layer is a native sound with alternatives:

| Slot | When it plays | What it is |
| --- | --- | --- |
| Perform | A normal's first active frame; a special's first frame and each new form | The whoosh, pitched by tier. Medium and large normals layer the model's own attack sound. A special plays its signature cast or launch. |
| Weak hit | The frame the hit lands (its hitlag starts) | The fighter's weapon striking flesh at the move's tier. A special plays its signature hit. A fire, electric, ice, dark, holy, poison or arcane hit layers that element's sound. |
| Strong hit | As weak, when the hit is strong | The heavy weapon sound plus the fighter's strong sweetener. |
| Shield hit | The frame a raised shield takes the hit | The weapon striking metal at the move's tier, over the shield's own Defend sound. |
| Voice | With perform, on two of three uses | The model's effort grunt on smash attacks only. Battle cries and other unit voice lines never play on moves; they belong to character select and results (Tom, 10 Oct: voice on every special is noise). |

- **Whiff** is perform alone, as in Smash.
- **Weapon families** come from the game's combat table: blade (metal slice),
  axe (metal chop), hammer (metal bash), blunt (wood bash: staves, fists and
  rifle butts), claw (light slice to medium chop) and rock (rock bash).
- **Tiers** stay #163's: jab small, tilt medium, smash large, with named
  departures.
- **Strong hit, #389's slot.** The flag is `ImpactEvents.strong`. It is set
  from launch strength 2 (knockback of at least 180, or hammer hitlag) until
  #389 lands its sweetspot flag. #389 then sets the same field, and the table
  needs no change.
- **Attribution.** A hit sounds the move that landed it. That is, in order:
  - a normal the attacker is still in, matched by attack serial;
  - a special whose hit list holds the victim;
  - the special that fired the projectile nearest the victim, found by the
    projectile's kind or its authored spec.

  Anything else keeps #82's element and tier sound: a placed object, a
  summon, a freeze.
- **Model-keyed sounds stay.** The original Rifleman and Illidan models play
  their own attack sounds from their animation keys
  (smashcraft:ts/src/game/assets/modelSoundInfo.ts): the rifle shot, and
  Illidan's glaive swings. The table does not layer those again.
- **Kits in flux.** Kael'thas (#381) and Illidan (#379) are being reworked.
  Sounds key on the special slot and the normal's input, not on a kit's
  internals, so the new kits inherit them:
  - Kael'thas's new Flamestrike bolt and pillar keep the Fireball launch and
    Flame Strike hit.
  - His Drain Mana tether keeps Siphon Mana and Mana Burn.
  - His Phoenix charge and flight keep the Phoenix launch with his battle cry.
  - Banish keeps Banish and Feedback.
  - Illidan's lunging forward smash plays the blade swing and heavy slice, and
    Eye Blast as his EX neutral plays his neutral special's sounds.
- **Native first.** Every sound is a stock Warcraft III sound, so the map
  carries no audio bytes. `tools/presentation/stock-sounds.ts` resolves each
  label to its files in the installed game. `moveSounds.tests.ts` fails any
  move of any fighter missing a perform, weak, strong or shield sound, or
  naming a sound the game lacks.

## Mixing

Volumes are Warcraft's 0–127:

| Layer | Volume |
| --- | --- |
| Whoosh | 45 / 65 / 90 (small / medium / large) |
| Model swing | 80 / 100 (medium / large) |
| Special perform | 110 |
| Weapon hit | 110 / 118 / 127 |
| Strong hit | 127 + sweetener 100 |
| Element sweetener | 100 |
| Shield | 100, over Defend at 90 |
| Voice | 100 |

Hits are always louder than swings, following SF4's rebalance [19]. A frame
plays at most four move layers:

- **perform:** whoosh, model swing and voice;
- **strong hit:** body, strong sweetener and element.

Sounds are 3D at the fighter (`CombatSoundsEAX`, 600 to 3500 units), so the
camera's stereo places them. Engine voice limits are the game's.

## Deterministic variation

- **Variant.** Each layer picks its label among alternatives, then the file
  among the label's variants, by the event's serial. That serial is the hit
  counter for hits, the shield counter for shield hits, and the attack serial
  for swings. Most combat labels have three files.
- **Pitch.** It moves by 31/32, 63/64, 1, 65/64 or 33/32 (about half a
  semitone either way) by `serial * 3 + layer`. That is smaller than a tier's
  pitch steps, so the tier stays readable [21].
- **Determinism.** Nothing reads a random source, so the same confirmed frame
  sounds the same in every client and every replay. The test checks that three
  jabs in a row never sound alike and that a repeated hit is identical.
- **Voice takes.** Voice is silent on every third use, a silent take as a
  variant [7].

## Warcraft III's native library

Inventory from the installed game's sound tables
(`war3.w3mod:ui\soundinfo\*.slk`, read with the CASC tooling in
smashcraft:tools/animations/). No audio is copied into the repository.

| Category | Table | Count | Use here |
| --- | --- | --- | --- |
| Weapon on armor | UnitCombatSounds | 60 labels × 3 files | Weak, strong and shield hits. Metal slice, chop and bash in light, medium and heavy, plus wood bash, rock bash and axe-on-wood, against flesh, metal, wood, stone and ethereal. |
| Model attack sounds | AnimSounds | 63 `*Attack*` labels | Medium and large swings, e.g. HeroBladeMasterAttack1/2, HeroPaladinAttack1/2, PitLordAttack1–3. |
| Effort grunts | AnimSounds | 9 `*Effort*` labels | Voice on smashes: Crypt Lord, Lich, Beastmaster, Brewmaster, Warden, goblin. |
| Missile launch and hit | AnimSounds | about 58 launch, 55 hit | Projectile specials' perform and hit. |
| Spell cast and target | AnimSounds, AbilitySounds | about 150 | Specials' signature sounds: Storm Bolt, Thunder Clap, Impale, Blink, Fan of Knives, Mirror Image, Wind Walk, Rain of Fire, Banish. |
| Footsteps, bodyfall, water steps | AnimSounds | 15 | Already used for movement (#82); water steps for Murloc's Tidal Rush. |
| Deaths | AnimSounds | 283 | Hurt cries come from the models' own Death sequence ([hurtVoice.ts](../../ts/src/game/presentation/hurtVoice.ts)). |
| Unit voices | UnitAckSounds | 1,452 | What 354, Yes 254, YesAttack 240, Ready 226, Pissed 203, Warcry 175. Ready and Warcry already play at selection and results; Warcry is the signature-special voice. |
| Interface and cinematic | UISounds, AmbienceSounds | about 300 | Match cues (#361), not moves. |

Gaps a custom sound would fill, each still needing a reason and a map-size
budget:

- a true "ping" or kill sound;
- wing flaps for the flying recoveries (they use Gargoyle and Banshee launches);
- effort voices for the fighters without one.

None is added in this pass.

## Listening

Headless Wisp records every map sound call with its frame, volume and pitch.
`bun wisp headless ... --sound-cues FILE --json` checks that each move's
sounds fire on their frames, but it cannot judge how they sound. The listening
check is a later native batch: one clip per fighter in both looks, each a jab
chain, a forward tilt, a forward smash and each special against a target and a
shield, for Tom to spot-check. Labels whose sound was chosen from its name
alone are first in line: the model attack sounds and the specials' casts.

## Sources

1. Attack Data – Rivals of Aether — https://rivalsofaether.com/attack-grid-indexes/
2. Hitbox Grid Indexes – Rivals of Aether — https://rivalsofaether.com/?p=157
3. Captain Falcon (SSBU)/Forward aerial – SmashWiki — https://www.ssbwiki.com/Captain_Falcon_(SSBU)/Forward_aerial
4. Mr. Game & Watch (SSBU)/Forward smash – SmashWiki — https://www.ssbwiki.com/Mr._Game_&_Watch_(SSBU)/Forward_smash
5. Shield – SmashWiki — https://www.ssbwiki.com/Shield
6. How Melee's Sound Effects Were Made – Source Gaming — https://sourcegaming.info/2016/05/19/soundeffects/
7. Rodney Gates: Hand-to-Hand Combat Audio for The Bourne Conspiracy – Designing Sound — https://designingsound.org/2011/04/22/rodney-gates-special-creating-hand-to-hand-combat-audio-for-robert-ludlums-the-bourne-conspiracy/
8. Marth (SSBU)/Forward smash – SmashWiki — https://www.ssbwiki.com/Marth_(SSBU)/Forward_smash
9. Slash – SmashWiki — https://ssbwiki.com/Slash
10. Next-Gen Audio in Killer Instinct – GDC Vault 2014 — https://gdcvault.com/play/1020402/Next-Gen-Audio-in-Killer
11. Robin (SSB4)/Neutral special – SmashWiki — https://www.ssbwiki.com/Robin_(SSB4)/Neutral_special
12. Pikachu (SSBM)/Down smash – SmashWiki — https://www.ssbwiki.com/Pikachu_(SSBM)/Down_smash
13. Thinking About Hitstop – Sakurai, Famitsu vol. 490 – Source Gaming — https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
14. Ping – SmashWiki — https://www.ssbwiki.com/Ping
15. Special Zoom – SmashWiki — https://www.ssbwiki.com/Finish_Zoom
16. Electric – SmashWiki — https://www.ssbwiki.com/Electric
17. Hero (SSBU)/Up special – SmashWiki — https://www.ssbwiki.com/Hero_(SSBU)/Up_special
18. Hitlag – SmashWiki — https://www.ssbwiki.com/Hitlag
19. Developers discuss voice acting, sound effects in Super Street Fighter 4 – EventHubs — https://www.eventhubs.com/news/2010/jan/19/developers-discuss-voice-acting-ssf4
20. Audiokinetic Q&A, voice priority — https://audiokinetic.com/qa/61/how-to-make-two-sounds-work-as-one-voice-in-the-priority-system
21. The Power of Pitch Shifting – Game Developer — https://www.gamedeveloper.com/audio/the-power-of-pitch-shifting
22. Stephan Shutze demonstrates FMOD Studio – MCV — https://www.mcvuk.com/stephan-shutze-demonstrates-fmod-studio/
23. Netcode p5: Fightin' Words – Infil — https://words.infil.net/w02-netcode-p5.html
24. Seth covers SFxT online sound issue – EventHubs — https://eventhubs.com/news/2012/mar/31/seth-covers-street-fighter-x-tekkens-online-sound-issue-explains-how-rollback-netcode-works-was-implemented-players-outside-japan
25. "How I Didn't Clip the Sound Effects" Redux – Mike Z — http://mikezsez.blogspot.com/2020/05/how-i-didnt-clip-sound-effects-redux.html
