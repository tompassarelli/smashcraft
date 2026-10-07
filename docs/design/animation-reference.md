# Fighter animation reference library

Public sources for authoring Smashcraft fighter animation: silhouettes,
anticipation/contact/recovery, drills, defensive movement, grabs and throws,
and the nine damage reactions. Use them for study. Smashcraft motion is
authored originally on licensed Warcraft rigs. The authoring standard and
procedure are in the `smashcraft-animation` skill
(nixos-config:dotfiles/agents/skills/smashcraft-animation/SKILL.md, whose
references/library.md records the Sakurai hitstop article in detail). The
tools and checks are in [fighter animation work](../fighter-animation-work.md).

## Provenance and rights

- Every source was fetched on 2026-10-07. Video title, channel, channel ID,
  duration and publish date come from the video page's player metadata.
- **Timestamps** are chapter starts from the page's own chapter list. Rows
  marked *creator chapters* use the uploader's description. Rows marked
  *page chapters* use YouTube's generated chapter list, whose labels are
  paraphrased here. A source without chapters is cited without a timestamp:
  none of the Sakurai videos has a caption track (their English subtitles
  are burned into the picture), so no position inside them is claimed.
- **SmashWiki** text is CC BY-SA 4.0. Rows cite an exact revision, and this
  page summarises facts in its own words. Embedded game images and GIFs are
  Nintendo's and have no redistribution licence.
- **Videos, game footage, frame-data GIFs and thumbnails** are copyrighted by
  their owners. Link to them; never commit them.
- **Private pixels.** Downloaded stills, GIFs and recordings stay in
  `~/.local/share/smashcraft-animation-reference/`, outside every Git tree.
  Record each one's source URL, frame or timestamp and purpose next to the
  file. Never commit frames, contact sheets or traced poses from these
  sources, and never import Nintendo models, animation data or decompiled
  code.

## Silhouettes and readability

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| Masahiro Sakurai, [Establishing Characters Through Their Design](https://www.youtube.com/watch?v=PDjdquhVHU4) (Creating Games, 2:40, 2024-08-16) | whole video | Description: a well-established character has a well-established silhouette; check the design in black and white. | Judge each pose as a filled silhouette with effects hidden, in both facings. |
| Sakurai, [Exaggerate to Make Up for Information Loss](https://www.youtube.com/watch?v=Ivwt37x-2EU) (2:28, 2023-04-03) | whole video | Exaggerating game animation to make up for visual information lost on screen. | Exaggerate gestures enough to survive the gameplay camera's distance. |
| New Frame Plus, [The Bizarre Animation of Mr. Game & Watch](https://www.youtube.com/watch?v=HX7jgSQb27Y) (8:37, 2018-11-28) | whole video | Description: how Smash drew on old technology to animate a flat, LCD-styled fighter. | A held, flat pose can read clearly with few in-betweens. |
| Daniel Floyd for New Frame Plus, [The Animation of Guilty Gear Xrd & Dragon Ball FighterZ](https://www.youtube.com/watch?v=kZsboyfs-L4) (17:20, 2019-07-30) | whole video | How Arc System Works makes 3D fighters read as 2D key poses. | Posing 3D rigs for a fixed side camera. |
| Junya C. Motomura, [Guilty Gear Xrd's Art Style: The X Factor Between 2D and 3D](https://www.youtube.com/watch?v=yhGjCzxJV3E) (GDC, 58:59, uploaded 2015-05-21) | page chapters: 29:03 limited animation style; 31:46 achieving the 2D look; 33:44 animation comparison | The primary talk behind the video above: held key frames on a 3D rig, compared with full interpolation. | Primary source for stepped key poses on a 3D rig. |

## Anticipation, contact and recovery

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| Sakurai, [Breaking Down Attack Animations](https://www.youtube.com/watch?v=LewXWM7HDd8) (3:34, 2022-11-11) | whole video | Description: lead-ins, attacks and follow-throughs are the fundamentals of attack animation. | Block preparation, contact and recovery as three separate silhouettes. |
| Sakurai, [Follow-Throughs Make the Impact](https://www.youtube.com/watch?v=cIB0BUe6Ihk) (4:18, 2023-02-22) | whole video | Description: follow-through is the recovery after an action, and it can last a long time. | Fill each move's existing recovery frames with visible follow-through. |
| Sakurai, [Always Keep Attack Collision in Mind](https://www.youtube.com/watch?v=rwwF_4blK-o) (2:41, 2024-06-14) | whole video | Description: hit regions placed on an animation exactly as drawn rarely work well. | Match the striking limb to the authored hit region on its active frames. |
| Mariel Cartwright, [Making Fluid and Powerful Animations for Skullgirls](https://www.youtube.com/watch?v=Mw0h9WmBlsw) (GDC 2014 Animation Bootcamp, 21:06) | page chapters: 1:46 core principles; 3:52 game motion; 6:33 power and impact; 12:41 gameplay considerations; 17:11 timing | Strong key frames, anticipation and timing within designer frame limits ("six frames to deliver a punch"). | Keep a move's startup unchanged; spend its few frames on key poses. |
| Daniel Floyd for New Frame Plus, [The Animation of Punch-Out!!](https://www.youtube.com/watch?v=M_zhvfBbvaA) (17:02, 2018-06-25) | creator chapters: 0:21 game animation 101; 5:27 how the animation affects gameplay; 11:22 NES animations in 3D | Chapters cover animation fundamentals and how the animation shapes gameplay. | Anticipation that warns the opponent; reaction poses that read. |
| Sakurai, [Eight Hit Stop Techniques](https://www.youtube.com/watch?v=tycbMSjDDLg) (5:32, 2022-12-09) | whole video | Description: the hit stop techniques used in Smash Bros. Ultimate. | Contact-frame presentation during hitstop. |
| Sakurai, [Hit Marks](https://www.youtube.com/watch?v=B-P4ysHSjCg) (4:49, 2023-07-25) | whole video | Hit effects at the moment of contact. | Contact effects (#82); keep the body pose readable under them. |

## Drills and multi-hit aerials

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| [Fox (SSBM)/Down aerial, SmashWiki rev. 1940996](https://www.ssbwiki.com/index.php?title=Fox_(SSBM)/Down_aerial&oldid=1940996) | Overview, Timing | An airborne drill with the feet leading and the body spinning. Seven hit pulses at frames 5–6, 8–9, …, 23–24. | Body turn with a leading limb across a repeated active window. Smashcraft keeps its own frames. |
| [Ultimate Frame Data: Fox](https://ultimateframedata.com/fox) | down air and down air landing entries (GIFs) | Down air with hits starting on frames 5/8/11/14/17/20/23 of 49, shown as hitbox GIFs. | The drill's phases frame by frame. GIFs are reference only. |

## Defensive movement

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| [Roll, SmashWiki rev. 2047810](https://www.ssbwiki.com/index.php?title=Roll&oldid=2047810) | introduction | Rolls (EscapeF/EscapeB) move left or right on the ground while intangible. Most fighters somersault; non-acrobatic fighters step, slide or teleport; some cartwheel. | Roll direction must read from the body's own motion, suited to the fighter's build. |
| [Spot dodge, rev. 1969338](https://www.ssbwiki.com/index.php?title=Spot_dodge&oldid=1969338) | introduction | EscapeN is the shortest dodge and stays in place; the fighter leans toward the background or foreground. | The spot dodge reads as a lean toward or away from the camera, not travel. |
| [Air dodge, rev. 2020596](https://www.ssbwiki.com/index.php?title=Air_dodge&oldid=2020596) | introduction | EscapeAir: intangibility in the air, described as a spot dodge in midair. | Give the air dodge its own pose, not the spot dodge's. |
| [Tech, rev. 2028146](https://www.ssbwiki.com/index.php?title=Tech&oldid=2028146) | introduction | Teching on hitting the floor, a wall or the ceiling while tumbling, versus a missed tech; techs are intangible except for the last few frames. | Missed tech, tech in place and tech rolls need different silhouettes. |
| [Floor attack, rev. 1916120](https://www.ssbwiki.com/index.php?title=Floor_attack&oldid=1916120) | introduction | The get-up attack stands up and strikes both sides; it differs for lying face up, face down and sitting. | Get-up attacks strike visibly on both sides, then stand. |
| Wahay, [Fox Techs – Frame by Frame](https://www.youtube.com/watch?v=iRzkGnvHnUc) (2:22, 2016-05-12) | whole video; the description lists frame data | Melee missed tech, tech in place and tech rolls slowed to single frames. | Tech poses frame by frame. |
| [Ultimate Frame Data: Fox](https://ultimateframedata.com/fox) | Dodges / Rolls | Spot dodge, forward roll, back roll and air dodge lengths and intangible frames. | Pace the poses inside each dodge's existing duration. |

## Grabs and throws

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| [Grab, SmashWiki rev. 2062344](https://www.ssbwiki.com/index.php?title=Grab&oldid=2062344) | introduction | A grab holds the opponent in place; from the hold come a pummel or four throws. | The family: reach, hold, pummel, four releases. |
| [Pummel, rev. 2062540](https://www.ssbwiki.com/index.php?title=Pummel&oldid=2062540) | introduction | CatchAttack: most pummels are knee strikes or headbutts because the arms are busy holding. | A small strike with the knee, head or a free limb while the grip stays put. |
| [Throw, rev. 2063583](https://www.ssbwiki.com/index.php?title=Throw&oldid=2063583) | introduction | A throw damages the held opponent and ends the grab, in four directions since Melee. | Each direction gets its own holder and victim release. |
| [Ultimate Frame Data: Fox](https://ultimateframedata.com/fox) | Grabs / Throws (grab, dash and pivot grab, four throw GIFs) | Grab reach and the frame each throw releases the victim, for example the back throw at frame 10 of 49. | Line up the release pose with the release frame. |
| SSBM Tutorials, [3 Types of Grabs in Smash Bros. Melee](https://www.youtube.com/watch?v=jkPgYehKVY8) (1:23, 2015-05-13) | creator chapters: 0:08 jump-cancel grab; 0:27 dash grab; 0:43 boost grab | Melee standing and dash grab reaches. | Reach poses for standing and dash grabs. |
| John Piel and Camille Chu, [Middle-earth: Shadow of War: Creating Multi-Character Combat Animations](https://www.youtube.com/watch?v=j0Bl_nBonos) (GDC 2018 Animation Bootcamp, 57:54) | page chapters: 2:23 sync action goals; 24:42 animating the sync actions; 43:20 integration and runtime | Authoring and running paired attacker/victim animations. | Author holder and victim together, aligned to one contact time. |

## Damage reactions

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| [Flinch, SmashWiki rev. 1885379](https://www.ssbwiki.com/index.php?title=Flinch&oldid=1885379) | introduction; the paragraph on flinching animations | Grounded flinches come in three heights (high, central, low) by the hurtbox struck and three strengths by knockback: nine animations named DamageHi1–3, DamageN1–3 and DamageLw1–3. A high hit rears the head back and a low hit kneels. Airborne hits use three strength-only animations; launches use separate flying animations. | The primary reference for Smashcraft's 3×3 grid. Smashcraft's height and strength thresholds are its own (see [Contact pain poses](../fighter-animation-work.md#contact-pain-poses)). |
| Sakurai, [Damage Animations](https://www.youtube.com/watch?v=0xHE3ypX96U) (4:11, 2023-08-29) | whole video | Description: damage animations are feedback to the player, and each body type needs its own. Tom picked the Captain Falcon high/mid/low × small/medium/large comparison in this video as the nine-pose brief. | Author per fighter; do not use one generic flinch. |
| Mike Jungbluth, [Anatomy of a Hit Reaction](https://www.youtube.com/watch?v=PSm4MZsDgJA) (Konsoll talk, 57:35, uploaded 2017-03-22) | whole video | Ways to convey impact through animation, effects, sound and UI, for synced and unsynced combat (Shadow of Mordor, Elder Scrolls Online). | The reaction pose as one part of impact feedback. |
| GDC 2017 Animation Bootcamp, [Tricks of the Trade](https://www.youtube.com/watch?v=VIgHW4ddHLc) (38:34) | page chapters: 16:28 hit reactions and body mechanics | A micro-talk on hit reactions and body mechanics. | Reacting through the whole body, not one joint. |
| [Sakurai's Famitsu hitstop column, Source Gaming translation](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/) | sections "Making Damage Look Painful", "Grounded = Horizontal, Aerial = Vertical" | Flinch into a pain pose during hitstop; shake directions. A fan translation. | Pain pose shown during hitstop; see the skill's library for details. |

## Warcraft III rig and sequence boundary

| Source | Where | What it shows | Use |
| --- | --- | --- | --- |
| Hive Workshop, [animation tags](https://www.hiveworkshop.com/threads/animation-tags.331110/) (thread, March 2021) | solved answer | Sequence names are chosen by lowercase, comma-separated tags (for example `spell,alternate,1`). | How appended sequences are named and picked. |
| Warcraft 3 Model Tutorials, [Rigging & Animating for Warcraft 3](https://www.youtube.com/watch?v=8Ko1JyZdGhM) (11:14, 2021-03-09) | page chapters: 3:10 rigging the armature; 6:04 creating animations; 9:02 exporting | A Blender rig-to-MDX workflow. | Background for the Lich King's Blender authoring. |
| MasterWarlord, [Warcraft 3 Model Ripping, Conversion, and Animation Transfer Process](https://www.youtube.com/watch?v=EWexatHhd6M) (35:11, 2024-11-26) | page chapters: 17:34 animation transfer; 26:18 automating animations | Moving animations between Warcraft rigs. | Background for reusing donor motion on another rig. |
| Retera, [How to Mirror Animations](https://www.youtube.com/watch?v=-r9Q5VYLpXI) (1:27, 2018-05-26) | whole video | Mirroring a Warcraft animation. | Checking both facings. |

## Smashcraft's own numbers

Timings come from Smashcraft's existing data, not from the videos:
smashcraft:references/melee-frame-data/records.jsonl and
smashcraft:docs/smash-melee-reference/. In particular,
smashcraft:docs/smash-melee-reference/slippi-ntsc-grounded-damage.json records
measured grounded damage. An animation repair never changes action timing,
hit regions or balance.
