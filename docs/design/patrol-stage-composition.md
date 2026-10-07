# Durotar, Naxxramas and Hellfire scenery

The compositions in smashcraft:ts/src/game/presentation/patrolStageScenery.ts
give each stage one recognizable landmark and a quieter approach beneath it.
The fighting deck owns the central silhouette. Scenery remains presentation;
collision, patrol paths, lighting and fog belong to their existing owners.
The shared principles are in smashcraft:docs/design/stage-art.md.

## Visual references and rights

Reference images were downloaded on 7 October 2026 into private storage at
~/.local/share/smashcraft-stage-design-178/references/. They are copyrighted
game screenshots, retained for visual research only; neither SmashWiki's text
license nor public availability grants a license to incorporate their art.
No screenshot pixels, textures, models, code or recognizable architectural
designs are copied into Smashcraft. These compositions use the existing
Warcraft buildings, rocks and props with measured model bounds. The borrowed
ideas are depth separation, relative scale and allocation of empty space.

| Reference | Private filename | Observation used |
| --- | --- | --- |
| [Ultimate Battlefield, SmashWiki revision 2046026](https://www.ssbwiki.com/index.php?title=Battlefield_(SSBU)&oldid=2046026), [image](https://ssb.wiki.gallery/images/8/86/SSBU-Battlefield.png) | battlefield-ultimate.png | The floating fighting island has a distinct edge; distant shelves and waterfalls establish a world without becoming another fighting platform. |
| [Melee Fountain of Dreams, SmashWiki revision 2057267](https://www.ssbwiki.com/index.php?title=Fountain_of_Dreams&oldid=2057267), [image](https://ssb.wiki.gallery/images/3/32/DREAM-NRML-SSBM.png) | fountain-melee.png | Recessed towers frame a small fighting stage; architecture above and below the deck supplies identity rather than filling every gap. |
| [Rivals of Aether, official Steam screenshot 92d7032](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/383980/ss_92d70324955ed75a306661f37691c56bb09eae00.1920x1080.jpg?t=1721063075) | rivals-steam-01.jpg | The Fire Capital skyline sits behind the bright walking surface; buildings occupy different heights and the upper central sky remains open. |
| [Rivals of Aether, official Steam screenshot 288e39f](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/383980/ss_288e39faad2ce79b46deb2df22e80e48aebc6a9d.1920x1080.jpg?t=1721063075) | rivals-steam-02.jpg | A dark recessed backdrop lets moving platforms and fighters remain the first readable shapes. This informs Hellfire's sparse rock placement, without adopting the depicted figures. |

The Steam source is application 383980, its screenshot list obtained from
https://store.steampowered.com/api/appdetails?appids=383980. The private source
response is rivals-steam.json. SmashWiki source pages are retained privately
as battlefield-ultimate-page.html and fountain-melee-page.html. The official
Rivals site image rivals-action.png was also consulted, but its cropped action
view does not establish a whole-stage composition.

## Durotar Skies: a watchpost over the canyon

One watchtower, at scale 1.25 on the left distant mesa, names the Orc outpost.
Its base meets the mesa's top rather than floating independently. Removing
the second tower makes the outpost a destination, rather than two competing
buildings. The nearer rock at x -2150, y 2600 frames the underside; the
smaller right shelf lies farther back at y 3300. A low right mesa at y 6200
continues the canyon across the horizon. Repeated rocks differ in size,
orientation and depth. Their scales range from 2.0 to 3.5 instead of 3.0 to
6.0, so the stage reads as a deck suspended over terrain rather than a deck
wedged among enormous boulders.

## Naxxramas: the floating citadel and its ruined approach

The Necropolis remains the sole focal building on the right, at x 1450,
y 6200 and scale 1.5. Its suspended silhouette identifies Naxxramas while
leaving the middle of the sky clear. On the left, one scale-0.75 Ziggurat
and a scale-2.0 obelisk describe a receding Scourge approach. A low glacier
on the near right provides terrain rather than a second tower. The citadel
and Ziggurat previously used scales 3.0 and 3.25; the smaller forms make
their architecture an environment behind the match. No figure-shaped model
or additional ambient effect is introduced.

## Hellfire: a portal across fractured ground

The Demon Gate remains on the left third, at x -1450, y 6500 and scale
1.25. Its existing glow supplies the ambient motion. Two low rock shelves
frame the underside at y 2600 and 3700. Two smaller detached fragments
rise farther back on the right, at y 5400 and 6200, progressing from scale
1.5 to 0.75. This makes a directional broken landscape rather than a pair
of looming rocks above the deck. The near fire trap is removed: its broad
particle plume competed with the portal and the moving platforms. The gate
itself already carries the stage's magical activity.

## Composition constraints

The camera looks along +y and down ten degrees: increasing depth also raises
an object's apparent horizon position. Scenery height is therefore chosen
together with depth, rather than from z alone. Near pieces sit low and outside
the deck's centre, while landmarks occupy the far band. Model meshes and
particle reaches must stay behind the complete fighting volume in every
declared camera, as enforced by smashcraft:ts/test/player-view.test.ts.
The figure ban and asymmetry constraints are enforced by
smashcraft:ts/src/game/presentation/stageScenery.tests.ts.

All selected models already have measured facts in
smashcraft:ts/scripts/wisp/modelFacts.ts. These changes require no new model
imports or generated textures. Stage fog remains at its declared settings;
lighting and fog tuning are separate from this composition.
