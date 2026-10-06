# Mechanics that later platform fighters added or changed relative to Melee

A descriptive, sourced inventory. It states no preference. Games covered:
Brawl (2008), Smash 4 (2014), Smash Ultimate (2018), Project M and Project+
(Brawl-engine mods), Rivals of Aether (2017) and Rivals of Aether 2 (2024),
Slap City, Brawlhalla, MultiVersus (2022 beta, relaunched 2024, servers closed
30 May 2025) and Nickelodeon All-Star Brawl 1 and 2 (NASB).

Already decided for Smashcraft, so not re-asked here
(smashcraft:docs/gameplay-design.md): no stale-move or freshness mechanics;
L-cancelling removed, aerials always get the L-cancelled landing lag
automatically; non-interactive execution tests are treated as dubious; no
tap-jump.

## How to read the estimates

"Likelihood to embrace" is a neutral estimate of how well the mechanic fits the
decisions above and Smashcraft's Melee physics base. It is reasoning, not a
verdict. Sources are wiki pages (SmashWiki, Dragdown, SuperCombo), press and
forum threads. Wiki pages state rules, not opinions; where reception is thin
the entry says so. Frame counts are as published by those wikis for the named
game and version and have not been re-measured.

---

## 1. Perfect shield on release (the "parry")

- **What:** Ultimate reverses Melee's powershield. In Melee you raise the
  shield as the attack arrives (4 frames for physical attacks, 2 for
  projectiles). In Ultimate you release the shield when the attack connects,
  within the first 5 frames of shield drop lag. Result: no shield damage,
  3 frames of intangibility, extra hitlag, and shield drop lag skipped. Power
  shields no longer reflect projectiles. The community calls it a parry.
  Sources: [SmashWiki Perfect shield](https://www.ssbwiki.com/Perfect_shield),
  [Dragdown SSBU Defense](https://dragdown.wiki/wiki/SSBU/System_Mechanics/Defense).
- **Solved:** accidental perfect shields; shield-tapping spam.
- **Created:** a reaction check against fast projectiles, since the input is
  made on or after the threat's arrival.
- **Reception:** SmashWiki frames it as rewarding prediction over reflex;
  mistiming too early gets you hit, too late costs shield. Forum commentary
  collected in the search results split: some like that it is hard to do by
  accident, others say it penalizes slower reactions, especially against
  projectiles ([GamesFAQs thread](https://gamefaqs.gamespot.com/boards/234547-super-smash-bros-ultimate/76707844),
  [Smashboards poll "Powershield or Parry?"](https://smashboards.com/threads/powershield-or-parry-which-do-you-prefer.479076/)).
  Ultimate pros interviewed after launch asked for a stronger parry,
  particularly against multi-hit attacks (AceStarThe3rd in
  [Inven Global](https://www.invenglobal.com/articles/8054/nearly-5-months-after-release-a-reflection-on-the-successes-and-failures-of-super-smash-bros-ultimate)).
- **Likelihood:** Medium. It is an interaction with an opponent (fits the
  "interactive execution" rule) and Smashcraft already has a 4-sample
  powershield (smashcraft:docs/melee-powershield.md); the cost is replacing
  that input and its projectile reflection.

## 2. Shield drop and shield release lag

- **What:** Two things share the name. (a) Falling through a soft platform
  by tilting down while shielding: present in 64 through Smash 4, removed in
  Ultimate ([SmashWiki Shield drop](https://www.ssbwiki.com/Shield_drop)); Melee
  players use it as a fast bufferable out-of-shield option from platforms.
  (b) Shield release lag: Ultimate has 11 frames after releasing shield
  during which grounded attacks and grabs are unavailable
  ([Dragdown](https://dragdown.wiki/wiki/SSBU/System_Mechanics/Defense)).
- **Solved:** (a) removal limits platform-based safe retaliation; (b) makes
  releasing shield a commitment that the parry window then partly cancels.
- **Reception:** SmashWiki records the removal without commentary. Project+
  keeps shield dropping ([Project+ features](https://projectplusgame.com/features)).
  Rivals 1 has no shields at all (see 11). No sourced competitive opinion
  on the Ultimate removal was found.
- **Likelihood:** Low to medium for (a): it is an out-of-shield interaction
  with platforms, but depends on controller-stick thresholds (SmashWiki notes
  Melee's three-value Y window is controller dependent). (b) is a numeric
  tuning choice.

## 3. Air dodge: direction, count, landing lag

- **What:** Melee: any-direction air dodge, then helpless, momentum halted.
  Brawl: dodges along current movement, no helplessness, repeatable. Smash 4:
  faster dodge, 21 frames of landing lag. Ultimate: one air dodge per airtime
  (reset on hit, landing or ledge); a neutral dodge keeps momentum; a
  directional dodge moves, with more endlag; reported landing lag 12 frames
  neutral, 18 directional; offstage use risks self-destruct; the dodge
  loses intangibility with repeat use. Wavedash returns as a much weaker
  wave-landing. NASB 2 restores a generous wavedash with a small directional
  boost. Rivals 2: 1 air dodge per airtime, intangible frames 3-17.
  Sources: [SmashWiki Air dodge](https://www.ssbwiki.com/Air_dodge),
  [Wavedash](https://www.ssbwiki.com/Wavedash),
  [SuperCombo NASB 2](https://wiki.supercombo.gg/w/Nickelodeon_All-Star_Brawl_2/Universal_Mechanics),
  [Dragdown RoA2](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense).
- **Solved:** Melee-era air-dodge landing (2 frames of lag) made landing too
  easy and recovery from disadvantage too safe (a reasoning cited on a
  [GameFAQs thread](https://gamefaqs.gamespot.com/boards/234547-super-smash-bros-ultimate/76718569),
  not a designer quote). Sakurai disliked wavedashing for widening the gap
  between beginners and experts (SmashWiki Wavedash, citing his statements).
- **Created:** accidental offstage air dodge on buffered input; large
  landing lag after a failed air dodge.
- **Reception:** mixed. Criticism: directional dodge is laggy and once-only.
  Defense: it removes safe, free landing. NASB's wavedash is praised in
  its own previews ([EventHubs](https://www.eventhubs.com/news/2021/sep/08/nickelodeon-brawl-game-mechanic-breakdown/),
  [esports.gg](https://esports.gg/news/fgc/nick-all-star-brawl-mechanic-breakdown/)).
  Project M/Plus restored the Melee air dodge including wavedash and helplessness
  ([SmashWiki Project M](https://www.ssbwiki.com/Project_M)).
- **Likelihood:** Medium. Smashcraft starts from Melee's air dodge; a
  once-per-airtime rule or landing lag is a number change, but the
  directional/wavedash choice shapes movement identity.

## 4. Rage

- **What:** Knockback dealt rises with the attacker's own percent. Smash 4:
  starts at 35%, up to 1.15x; applied to set-knockback moves. Ultimate: up
  to 1.1x, no longer applies to set knockback.
  [SmashWiki Rage](https://www.ssbwiki.com/Rage).
- **Solved:** comeback pressure at high percent.
- **Created:** very early kills from set-knockback moves in Smash 4 (Mario,
  ZSS up-B at near 0%), low-risk comebacks.
  [The Game Haus](https://thegamehaus.com/esports/smash-ultimate-should-rage-be-turned-off-by-default/2018/08/25/).
- **Reception:** Smash 4 criticized; the Ultimate nerf was called necessary,
  but the community remains split on whether any rage belongs. MVD (Inven)
  contrasts Ultimate favorably with Smash 4's reliance on it.
- **Likelihood:** Low. It is a hidden rescaling by state, close in spirit to
  the stale-move rejection ("a bolted-on rule that rescales ... behind the
  player's back").

## 5. Short-hop macro and 3-frame jump squat

- **What:** Ultimate gives all characters a 3-frame jump squat (Kazuya 7),
  so a short hop needs release inside 3 frames. A shortcut: pressing jump and
  attack together performs a short-hop aerial. Full hops also get sped-up
  initial frames; a softhop turns that off.
  [SmashWiki Short hop](https://www.ssbwiki.com/Short_hop),
  [Jump squat](https://www.ssbwiki.com/Jump_squat).
- **Solved:** uniform jump timing; low-effort aerial rushes.
- **Created:** a hard raw short-hop window.
- **Reception:** discussion threads say a 3-frame window is a cumbersome
  skill check and ask for a dedicated button or 4 frames
  ([Smashboards](https://smashboards.com/threads/why-isnt-short-hop-its-own-button.514416/));
  some argue the macro makes inputs more predictable (disputed).
- **Likelihood:** Medium to high for some dedicated short-hop input: the
  existing single-player-execution rule penalizes a difficult non-interactive
  skill check. The jump-squat length remains a fighter-identity lever (Melee
  varies by character).

## 6. Input buffer

- **What:** Melee: little buffering. Brawl: universal 10-frame buffer. Smash 4:
  10 frames with a priority hierarchy (special, shield, attack, jump, stick).
  Ultimate: 9 frames plus holding an input through the end of an animation
  buffers it; full-hop aerial buffering lost.
  [SmashWiki Input buffering](https://www.ssbwiki.com/Input_buffering).
- **Solved:** accessibility, "1/60 s" input demands.
- **Created:** unintended actions (accidental air dodge, self-destruct);
  buffering priority can block simultaneous stick and button inputs.
- **Reception:** most criticized Ultimate mechanic in the Inven pro
  interviews (MVD: precise inputs needed; VikkiKitty: large buffer causes
  unintended self-destructs).
- **Likelihood:** Medium. Smashcraft already runs on an input-clock contract
  (smashcraft:docs/input-clock-contract-20261004.md); a buffer is a
  per-action window. Offstage-safe exceptions are a design question.

## 7. Parry as a dedicated button (Rivals, Rivals 2, NASB, Slap City)

- **What:** Rivals 1: no shield, no grabs; parry has 2 startup, 8 active, 20
  recovery frames ([Fornace, Gameverse 2015](https://gameverse.com/2015/12/01/dan-fornace-talks-rivals-of-aether/)).
  Rivals 2: shield, perfect shield (first 4 frames) and a distinct parry
  (active 6-13 vs. attacks; 74 frames invincible after; attacker stunned
  40-100 frames) ([Dragdown RoA2](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense)).
  Slap City: a parry in the first 4 frames of shield, plus lightshield and
  a "clutch" button ([SlapWiki](https://slapcity.wiki.gg/wiki/Mechanics)).
- **Solved (Fornace):** removes the shield-grab rock-paper-scissors; "once we
  eliminated grabs, we had to remove shields"; also reduces animation scope.
- **Created:** a single strong defensive reply; in Rivals 1 no defensive
  option besides dodge and parry.
- **Reception:** Rivals 1 described as carrying Melee's torch
  ([Smash Cut](https://smashcutsite.wordpress.com/2018/04/15/rivals-of-aether-review-analysis-carrying-the-torch-of-ssb-melee/),
  [Kotaku](https://kotaku.com/rivals-of-aether-makes-the-smash-bros-formula-feel-new-1793727912));
  a reviewer of Rivals 2 found its parry a natural extension and welcomed the
  return of shields ([Kimball](https://davidvkimball.com/posts/my-thoughts-on-rivals-of-aether-ii)).
  A Slap City Steam thread titled "New Parry Mechanic: Not A Fan" exists
  ([thread](https://steamcommunity.com/app/725480/discussions/0/1768133742957295337/)).
- **Likelihood:** Low to medium. Smashcraft keeps Melee's shield, grab and
  powershield; a parry would be an addition, not a replacement.

## 8. Wall jump and wall tech (Rivals, Rivals 2, Brawlhalla)

- **What:** Rivals 1: no ledge grab; each fighter has one jump until it is hit
  or touches ground; wall jump gives an extra jump and a second use of the
  recovery move; wall tech stops momentum with invincibility (extended from
  5 to 12 frames in a patch). Rivals 2: wall jump off horizontal recovery
  moves but not vertical ones; one wall jump reset by landing, ledge, being
  hit or hitting. Brawlhalla: wall-scaling and wall movement.
  [Gameverse](https://gameverse.com/2015/12/01/dan-fornace-talks-rivals-of-aether/),
  [Shoryuken](http://shoryuken.com/2016/02/01/we-tech-those-recent-rivals-of-aether-update-revamps-wall-teching-jab-cancels-and-more/),
  [Rivals 2 feedback](https://rivals-of-aether-ii-patch-140.nolt.io/851).
- **Solved:** removes ledge camping (Fornace saw destructive ledge camping
  in competitive Brawl).
- **Created:** wall-dependent recovery makes stage geometry matter.
- **Reception:** Rivals 2 players discuss the nerf that removed wall jumps
  after up-B: some say it gave speed and identity, others miss the option
  ([Steam thread](https://steamcommunity.com/app/2217000/discussions/0/4692279523718838448/)).
  Kimball calls Rivals 2's every-character walljump a compromise biased
  toward Melee.
- **Likelihood:** Low to medium. It interacts with stage design and ledge
  rules; Smashcraft has Melee ledges.

## 9. Ledge rules: edgehogging, ledge trumping, ledge decay

- **What:** Brawl has edgehogging. Smash 4 adds ledge trumping and removes
  regrab invincibility. Ultimate tones down sweetspots and has a larger tech
  window.
  [SmashWiki Ledge trump](https://www.ssbwiki.com/Ledge_trump).
- **Solved:** edgehogging as a free recovery denial; stalling on ledge.
- **Reception:** SmashWiki's summary reads these as positive for offstage
  play; no direct pro quotes retrieved.
- **Likelihood:** Medium. It is one rule on an existing Melee mechanic,
  and Smashcraft's bots already handle ledges (smashcraft:docs/gameplay-design.md).

## 10. Tripping (Brawl) and random elements

- **What:** Brawl: 1% chance to trip on a dash start, 1.25% on a dash turn.
  Not returned in Smash 4 (Sakurai to Kotaku: "it will not return").
  [Nintendo World Report](http://www.nintendoworldreport.com/news/34639/tripping-will-not-return-in-super-smash-bros-wii-u3ds),
  [GameSpot](https://www.gamespot.com/articles/super-smash-bros-fans-have-been-tripping-over-themselves-for-15-years/1100-6512174/).
- **Reception:** strongly disliked by competitive players; Project M removed
  it; Project+ lists it as excluded.
- **Likelihood:** Very low. It contradicts the predictability principle in
  smashcraft:docs/gameplay-design.md.

## 11. Shield removal (Rivals 1, Brawlhalla, MultiVersus)

- **What:** Rivals 1 has no shield (see 7). Brawlhalla has dodge-only
  defense with a 60-frame ground and 163-frame air cooldown
  ([Brawlhalla combat mechanics](https://brawlhalla-archive.fandom.com/wiki/Combat_mechanics)).
  MultiVersus has a dedicated dodge meter and parry/dodge interplay
  ([MultiVersus Wiki](https://multiversus.wiki.gg/wiki/Perks)).
- **Solved/created:** removes shield pressure; offence leans on mixups.
- **Reception:** Kotaku praises Brawlhalla as feeling good to play; Push Square
  7/10 ("accessibility and challenge", less tightly designed)
  ([Wikipedia](https://en.wikipedia.org/wiki/Brawlhalla)).
- **Likelihood:** Low. Smashcraft's shield and powershield are Melee
  reference behavior.

## 12. Damage-based and no-percent knockback (Brawlhalla)

- **What:** Brawlhalla shows damage as a colour ring that darkens white, red,
  black; more damage means more knockback
  ([Wikipedia](https://en.wikipedia.org/wiki/Brawlhalla)).
- **Reception:** Brawlhalla's core loop is widely played; no sourced criticism
  specific to the display.
- **Likelihood:** Low. Smashcraft already shows percent; this is a
  presentation choice.

## 13. Cooldown specials, perks, 2v2 default, ring-out count (MultiVersus)

- **What:** Specials with cooldown timers and alternate moves during
  cooldown; teammate-passive perks; 2v2 default with a ring-out count instead
  of eliminations ([Warthog Report](https://warthogreport.substack.com/p/multiversus-impressions),
  [Wikipedia](https://en.wikipedia.org/wiki/MultiVersus)).
- **Reception:** open beta praised for team battles; launch condemned for
  monetization; the Warthog Report objected that perks and cosmetic
  currency create unequal footing for new characters. The game ended in
  May 2025.
- **Likelihood:** Low for perks (unequal footing by design); medium for a
  cooldown-gated special as a character-identity tool. Smashcraft has
  no source for the latter beyond MultiVersus.

## 14. Slime meter (NASB)

- **What:** Damage dealt fills a meter spent on enhanced specials, slime
  cancel (cancel end lag), or slime burst (cancel momentum when launched).
  [esports.gg](https://esports.gg/news/fgc/nick-all-star-brawl-mechanic-breakdown/).
- **Solved/created:** gives the attacker or victim a spendable resource;
  burst acts like a combo breaker.
- **Reception:** NASB reviews were mixed (Metacritic 63-71) with praise for
  mechanical depth and online play (Push Square: "the best Super Smash Bros.
  clone we have ever played"; IGN: "mechanical differences and good online
  play") ([Wikipedia](https://en.wikipedia.org/wiki/Nickelodeon_All-Star_Brawl)).
  No sourced opinion on the meter alone.
- **Likelihood:** Low to medium. A resource gated on damage is a
  hidden-state mechanic like rage; burst is an explicit option with a
  cost.

## 15. Landing-lag alternatives to L-cancel

- **What:** Brawl removed L-cancel; Sakurai felt it widened the gap between
  beginners and experts. Ultimate shortens aerial landing lag and widens
  auto-cancel windows. Project M/Plus retains L-cancelling (and shield drop,
  wavedash, dash dancing). Slap City replaces it with
  "dash cancelling" (a directional speed burst on block at landing). NASB 2
  adds slime canceling.
  [SmashWiki L-canceling](https://www.ssbwiki.com/L-canceling),
  [Project+ features](https://projectplusgame.com/features),
  [Slap City design](https://slapcity.se/blogs/design).
- **Reception:** Project M's community describes restoring Melee movement
  (wavedash, wave landing, L-cancel) as the point of the mod
  ([Project+ oral history](https://www.dbltap.com/posts/project-plus-oral-history-part-1-01ganx0vpanc),
  Vicksin, Jason Waterfalls).
- **Likelihood:** Already decided (automatic L-cancelled landing). Slap City's
  optional landing boost is a different mechanic and is not a decision here.

## 16. Tech: window, buffering, hitstun cancel

- **What:** Melee: 20-frame tech window, 40-frame lockout. Brawl adds hitstun
  cancelling that removes edge-of-stage teching. Ultimate: 11-frame window,
  tech buffered in hitlag, footstool jumps techable, a knockback threshold
  makes high-percent stage spikes guaranteed. Rivals: tech by pressing the
  dodge/parry button on a surface; works on walls and floors.
  [SmashWiki Tech](https://www.ssbwiki.com/Tech), [Rivals guide](https://gamefaqs.gamespot.com/pc/180910-rivals-of-aether/faqs/72421).
  Project+ excludes hitstun and momentum cancelling.
- **Tech-chase design:** floor teching and tech-chasing follow from the
  tech window and the stage; the sources collected here describe the
  mechanics but contain no analysis of tech-chase design with platforms
  cancelling. That claim is not sourced; treat as an open research item.
- **Likelihood:** Existing Melee tech input is already documented in
  smashcraft:docs/melee-tech-input.md; changing the window is a number
  change.

## 17. Chaingrab and infinite removal by design (Slap City)

- **What:** Slap City aims to be "fun and silly" with competitive viability
  secondary; designers remove chaingrabs and infinites ("no fun")
  ([Slap City design](https://slapcity.se/blogs/design)).
- **Reception:** [Esports Talk](https://www.esportstalk.com/blog/can-indie-gaming-esports-like-slap-city-be-successful-5708/)
  argues it shows memes and competition can coexist.
- **Likelihood:** Medium. The "no infinites by design" rule matches
  the "diversity by construction" decision.

---

## Open design questions for the owner

One line per mechanic. No stance is taken.

- Perfect shield: keep Melee's raise-timed powershield with projectile reflection, or release-timed parry (1)?
- Platform shield drop: keep (Melee, P+) or remove (Ultimate) (2)?
- Shield release lag: any fixed number of frames before grounded actions (2)?
- Air dodge: unlimited and helpless (Melee), or once per airtime with landing lag (Ultimate, Rivals 2) (3)?
- Wavedash/wave-landing: keep Melee's full effect, or nerf (Ultimate) (3)?
- Offstage buffered air dodge: allow, or suppress (3, 6)?
- Rage: any state-dependent knockback scaling, or none (4)?
- Short hop: raw release window, a dedicated input, or jump+attack macro (5)?
- Jump squat: per-fighter variation or uniform (5)?
- Input buffer: window length and per-action priority (6)?
- Parry: add a dedicated parry alongside the shield (7)?
- Wall jump and wall tech: any wall movement (8)?
- Ledge: edgehog, trump or limited regrab (9)?
- Dedicated meter resource (slime meter style): any (14)?
- Cooldown-gated specials (13): any?
- Tech-chase design: confirm how platforms should interact with floor tech, once sourced (16).
