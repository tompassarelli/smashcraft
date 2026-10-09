# Tomb of Sargeras showcase

The mood is a drowned sanctuary still breathing beneath the sea: turquoise
light, coral-gold masonry and one immense, dark Naga temple. The fighters stand
on the brightest strip of stone. The ruin behind them feels ancient and alive,
without competing with their silhouettes. Classic and Definitive share this
composition and the same match clock.

## The first ten seconds

1. **A luminous tide floor inside a dark sanctuary.** The deck's round tiles,
   gold rim and carved end platforms read before the backdrop. This follows
   TS-1's Merchant Port palette and TS-2's Kalos floor-to-hall contrast.
2. **The broken temple and falling water frame an open centre.** The Temple
   of Tides occupies the right third; a waterfall and broken arch answer it
   on the left. Near coral and a mid-distance ruin lead the eye into the
   temple rather than making another wall. This follows TS-1 and TS-3's
   Hollow Bastion ruin silhouette.
3. **The sea pauses before it changes its mind.** At the first slack, the
   scenery's current stops and the rune accents brighten; then the current
   reverses. The moment uses the existing deterministic tide timetable,
   including with hazards off. Technique 2 and technique 4 from the
   [creative tricks survey](creative-tricks.md) provide the vocabulary.

## Each lever's role

| Lever | Role and reference | Constraint |
| --- | --- | --- |
| Stock ruin dressing | Temple, broken arch, coral and descending rocks create three readable depth bands; TS-1, TS-3; survey technique 9 | Keep the centre open and hide every base below the far camera's frame |
| Deck materials | Round tiles, coral-gold small-brick edge, vine-covered natural-rock body and large-brick platforms; TS-1, TS-3 | Walking edge stays the strongest horizontal line; collision layout is unchanged |
| Water | Existing tide surface supplies the bright teal plane; survey technique 2 | Reverse visual flow with the match clock, never random animation timing |
| Height fog | Teal haze joins the low ruins to the sea; survey technique 5 | Haze stays below the fighting plane and does not draw over the sky |
| Day/night lighting | Cool sea key and teal fill retain fighter colour; the tide can breathe through a scheduled lighting model; survey technique 3 | Stage lighting must preserve the existing fighter-contrast budget |
| Point lights | Small coral-gold accents guide the eye to the temple and bracket ends; TS-2 | Light is an accent, never a bright field behind a fighter |
| Glyph flare | Stock Naga rune states make the one-second slack readable; survey technique 4, Blizzard's nightelfx03 Tomb | A fixed function of match frame, with no new gameplay effect |
| Temple animation | Keep the temple visible in Stand first; survey technique 1 proposes a later clock-scrubbed rise | Its stock 60-second Birth hides the body; a rise requires a capture before adopting it |
| Light shafts | Sparse, soft stock Rays of Light in the far band; survey technique 7 | Quieter than the deck and absent from the fighting lane |
| Bloom and ambient occlusion | Restrained bloom on water and gold accents; occlusion separates carved brackets; TS-2 and survey technique 20 | Add after the renderer controls land; Classic remains deliberate without them |
| Point-light shadows | Soft depth under the ruin brackets; TS-3 | Use the renderer's existing shadow controls and retain frame budget |
| Music and KO flash | Music holds the underwater mood; a KO briefly punctuates it | Use the existing stage music and combat flash rather than another stage effect |

The current Classic pass uses existing stock assets, existing height fog and
the shipped light models. It begins with composition at actual gameplay zoom.
Each further lever earns its place through the same TS-a through TS-d and
S1 through S3 rubric in [stage boards](stage-boards.md), with Classic and
Definitive captures at both camera extremes. The showcase becomes the bar for
other stages after those captures have been judged and their gaps resolved.
