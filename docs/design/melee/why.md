# Why Melee is shaped this way

What Melee's director and its players have said about why the game plays as it
does, and which of its patterns follow from its rules rather than from a stated
intent. Quotations are from the sources linked; interviews in Japanese are
quoted from published translations. Conventions are in the
[case study's README](README.md).

## The designer's intent

- **A game for experienced players.** Masahiro Sakurai has said he aimed Melee
  "squarely toward people well-versed in video games", having made the series
  as his answer to how exclusive fighting games had become, and that "Melee was
  just too difficult" (Famitsu column vol. 360, translated by
  [Source Gaming](https://sourcegaming.info/2015/08/10/sakuraimelee/)).
  He told EDGE that Melee's controls "were, however, quite complicated and
  tiring if the player really got into it in a serious way" and that it "ended
  up becoming a Smash Bros. game for hardcore fighting fans. I personally regret
  that" (EDGE 271, August 2014, same source).
- **Advanced techniques left in on purpose, then taken out.** Sakurai encouraged
  players to explore the air dodge's directional movement
  ([Inven Global](https://www.invenglobal.com/articles/15809/sakurai-super-smash-bros-melee)).
  Of the wavedash, he said: "Of course, we noticed that you could do that during
  the development period." Brawl removed it because "there was a growing gap
  between beginners and advanced players, and taking that out helps to level the
  playing field" (Nintendo Power 228, May 2008, via
  [Source Gaming](https://www.sourcegaming.info/2015/09/06/nintendopower228/)).
  L-cancelling, carried over from the first game, was removed from Brawl for
  the same gap ([SmashWiki L-cancel](https://www.ssbwiki.com/L-cancel)).
- **A short, hard schedule.** Sakurai worked on Melee for 13 months without a
  day off (Nintendo Dream 064, January 2002, translated by
  [Source Gaming](https://sourcegaming.info/2015/10/30/nintendodreamssbm1/)).
  The interviews do not tie individual mechanics to that schedule.

## Patterns the rules produce

These follow from the mechanics in the other pages, whatever their designers
intended.

- **Speed and fall speed set the pace.** The fastest fallers land a fast-fallen
  short hop after <!-- v:shff.min -->15<!-- /v --> frames, the floatiest after up to
  <!-- v:shff.max -->37<!-- /v --> ([Movement](movement.md#jumps)), so their pressure on shield is tighter and
  they are easier to combo and chain-grab
  ([Archetypes](archetypes.md)).
- **Shield is strong but grounded moves lose to it.** Almost every grounded
  normal leaves the attacker behind on shield, so ground pressure relies on
  spacing and on aerials hit late and L-cancelled
  ([Attacks](attacks.md#safety-on-shield)). The defender's fast out-of-shield
  grab is what punishes a move that ends too close.
- **Movement options multiply through cancels.** Most of the movement
  techniques are one action cut short by another: an air dodge cut by landing,
  a dash cut by a reversed dash, a jump squat cut by a grab, a landing cut by an
  edge ([Techniques](techniques.md)). The game exposes these interrupt windows
  generally rather than per technique, so players found the combinations.
- **The defender always has input, but not always a choice.** Directional
  influence, SDI and teching give the hit fighter a decision on most hits
  ([Defence](defense.md#influence-on-knockback)). Wobbling and some chain grabs
  are the exceptions in which the victim's input changes nothing, and they are
  what the community has argued over most
  ([Techniques](techniques.md#jank)).

## How the community kept the game

Melee's competitive scene outlived its successors' changes: players kept the
techniques Brawl removed, settled tournament rules among themselves, and
argued for years about which emergent techniques to allow, as the wobbling ban
shows ([SmashWiki Wobbling](https://www.ssbwiki.com/Wobbling)). The frame data
used in these pages exists because the community extracted and published it
(meleeframedata.com, credited in smashcraft:references/melee-frame-data/README.md;
libmelee, [altf4/libmelee](https://github.com/altf4/libmelee)).
