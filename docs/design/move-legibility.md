# Move legibility: every special shows its Warcraft spell

How platform fighters make a special readable to both players, and how
Smashcraft maps each fighter's specials onto Warcraft III's own spell art
(#144). Retrieved 2026-10-07.

## What other games do

- **The character stays the subject.** Masahiro Sakurai's *Creating Games*
  episode on effects and character prominence: effects must land with impact
  without outshining the fighter; overly flashy effects hide who is doing what
  ([GoNintendo summary](https://www.gonintendo.com/contents/12076-sakurai-discusses-visual-effects-and-character-prominence-in-his-latest-video)).
  Smashcraft keeps cues small and anchored to the body (hand, body, feet, just
  ahead), scaled with the fighter's model.
- **Colour per element, chosen for tracking.** Rivals of Aether recoloured its
  fire across every palette after players reported fire effects hard to track
  in multiplayer, and its developers name readability as a reason for the art
  style; Rivals 2 reports the same pressure in 3D
  ([developer update](https://rivalsofaether.com/developer-update-july-2014/),
  [Rivals 2 announcement](https://www.gematsu.com/2022/04/rivals-of-aether-2-announced)).
- **Melee shows a hit's element on the victim.** A hitbox carries an element;
  the hit spawns that element's spark, runs an element colour program on the
  victim (fire, electric, ice and dark each have their own), and electric
  hits shake 1.5 times harder through hitlag
  ([Melee hit effects](melee/hit-effects.md)).
- **Phases read separately.** Startup is the warning, active frames are the
  danger; both games give the strike frames the loudest visual (the hitbox's
  own flash and trail) and the startup a smaller, character-coloured tell.

## Smashcraft's mapping

Source: smashcraft:ts/src/game/presentation/specialCues.ts (cues),
projectileArt.ts (missiles) and elementLooks.ts (elements). All models and
sounds are stock Warcraft III content: classic models need no import.

- **Startup cue.** From the special's first frame to the frame before it
  becomes active, a cast flash at the hand or body. Each hero casts in one
  colour (Blademaster's Bloodlust red, Mountain King's storm sparks, Warden's
  shadow, Lich's frost, Uther's holy light, Dreadlord's unholy frenzy, Shadow
  Hunter's troll berserk), with a signature tell where the spell has one
  (Mirror Image, Wind Walk, War Stomp before Thunder Leap).
- **Active cue.** The move's own Warcraft spell over its active frames: every
  frame the kit strikes, moves, releases, places, grabs, guards or arms,
  at least 18 frames so a one-frame release still plays. Windows come from the
  kit's authored frames, so a redesigned move keeps its timing.
- **Missile per move.** Every projectile names its spell's missile (Storm Bolt,
  Holy Bolt, Carrion Swarm, Frost Bolt, Shadow Strike, the Witch Doctor's hex
  orb, the Serpent Ward's spit); no two moves share one.
- **Element on the victim.** A hit's element (fire, lightning, frost, dark,
  holy, poison, arcane; normal and slash keep the spark alone) shows its stock
  effect on the victim's body through hitlag and hitstun, tints the hitlag and
  plays its own sound. The element never changes an outcome.
- **Distinctness.** No two moves share a startup/active pair or an active
  spell; passives (#148) keep their own models.

The per-move table, its scores and the native look are tracked in #144.
