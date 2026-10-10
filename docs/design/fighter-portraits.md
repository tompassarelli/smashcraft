# Fighter portraits

Every selectable fighter uses cut-out 3D renders of its match model with the shared Rifleman camera and crops; cards, HUD busts and round stock icons come from the same pose (#323).

Character select, the player cards, the HUD plates and the off-screen bubble
show each fighter as a render of its own model, like Smash Ultimate's select
screen: a head-and-shoulders crop on one shared background for the grid, and
the full body for the cards and HUD.

## Why renders, not command icons

Warcraft III's frame space is 0.6 units tall at every resolution, so a unit
covers `height / 0.6` pixels: 1800 at 1080p, 3200 on a 2880x1920 display. In
classic graphics (`hd=0` in War3Preferences.txt) a command-button icon
(`ReplaceableTextures\CommandButtons\BTN*.blp`) is 64x64. Warcraft's own
command card draws it at about 0.039 units, roughly 2x. The selection frames
drew it at 3.7x on grid tiles and 6x on cards and HUD plates on that display,
so the icons came out blurry. Frames are square (one size for both sides), so
they were never stretched.

The installed storage also holds 256x256 Reforged icons
(`war3.w3mod:_hd.w3mod:replaceabletextures/commandbuttons/*.dds`). A map gets
them from the stock path only in HD graphics. A classic-graphics game needs
imported copies.

## Sizes

smashcraft:ts/src/game/ui/portraitFrames.ts sizes each frame from the texture
pixels it draws on a 1920-tall display. A portrait is drawn at its texture's
own size or smaller, never stretched past it:

| frame | texture | drawn on 2880x1920 |
|---|---|---|
| player card, HUD plate | 384 px card render | 384 px (0.12 units) |
| grid tile | 256 px tile render | at most 256 px (scales down with roster size) |
| off-screen bubble | 256 px tile render | 128 px |

## Generating

`bun scripts/fighterPortraits.ts PRIVATE_OUTPUT` (from ts/, through the
capacity helper) draws every fighter in `RENDERED_FIGHTERS` with Wisp's
headless renderer, once in Classic and once in Definitive, from the body the
match draws in each mode: its timeline body, whose `_de.w3mod` alias is the
Definitive body ([#363](https://github.com/tompassarelli/smashcraft/issues/363)).
Use `--graphics classic` or `--graphics definitive` to refresh only that set,
and `--only NAME,...` to limit the fighters.
Both sets share one rule for pose, light and camera, so only the graphics
mode differs. Each body is posed at the frame of its Stand clip whose face
joints (nose, else eyes, else the head attachment) stand highest above its
head bone, so an idle that bows the head still shows the face, and turned
about the vertical so its face points at the camera, 20 degrees toward image
left so the weapon hand and near pauldron sit behind it. The face's heading
comes from the posed pair of eyeballs on Definitive rigs (square to the line
across them; their bind poses aren't all level), else from the bind pose's
level head-bone-to-nose (else eyes, else the head mesh's forward-most tenth)
direction turned by the bone carrying most of the head mesh. On Definitive
bind rigs whose `bone_head` carries no face joints, the sibling joint that
does is the head. Bodies whose head mesh has under 50 vertices (Classic
Murloc, Kobold and Peon) face the camera as their body does. Only the yaw
turns: tilting a body to level a bowed face lays the whole card render over.
The camera looks level through a narrow lens fitted to the silhouette, so the
face is seen from within 4 degrees of its own height. Where that still hides
the face, `CORRECTIONS` in smashcraft:ts/scripts/fighterPortraits.ts adds a
per-fighter turn, Stand time, camera angle or crop zoom; `level` poses at the
Stand frame whose face is closest to level and tilts the camera (at most 35
degrees) to meet what tilt remains. Wisp draws the same pose the script
evaluates: a Definitive Mountain King judged as a back view faces the camera,
with his face a thin strip between helmet brim and beard. Definitive Murloc
has no correction yet: across his Stand clips the posed eyes sit about 15
units above the ground and spread apart, so no turn, time or angle frames a
face. The portrait is lit in four passes summed after rendering (Classic in display
values, Definitive in linear light, where each shader adds its lights): the
neutral stage light's ambient alone, a key from the camera's side (25 degrees
toward image left, 30 above), a low fill from 40 degrees toward image right and
a rim from behind, image right and 35 above, so no face falls half into
shadow (#363). Definitive sums get a 1.4 gamma lift. Three weightings
(`LIGHT_VARIANTS`) are each exposed so the P1 bust's mean luma reaches 110; the
one lighting the largest share of the bust above luma 50 lights all five outfits.
`bun scripts/portraitLight.ts [FIGHTER_RENDERS]` (default: the stored family) checks
every fighter in both looks: bust mean luma within 85-150, roster max/min at
most 1.6, lit share at least the calibrated floor, the card render's box
centred and filling 90-96% of its texture, the chip's mass near its centre line,
and the player preview's frame centred in its card's preview area (below the
tag, above the name box, or above the CPU summary). The generator fails when a
head mesh's centre falls below its silhouette's middle. Definitive Kobold's
every Stand clip bows his face under his pack, so his portrait holds his rig's
bind pose. The hero glow under the feet is
hidden by pointing its additive texture at stock black. Each fighter is drawn
in Warcraft's Coal team colour (`NEUTRAL_TEAM_COLOR`) for the neutral grid
tile, and in red, blue, teal and purple for its slot outfits; files append
`P1` through `P4`. Tiles and busts frame head and shoulders around the head mesh: the posed vertices bound to the
head bone or its direct children, evaluated with Wisp's vendored war3-model
(its version-1800 skin reader), not the body's bounds; stock icons frame the
head alone.
The custom-game preview uses the red and blue player cards.

Jaina and Illidan's #363 weapon corrections keep head and shoulders plus the
held signature weapon in the tile and bust crop. In 0.0.112, Jaina's staff
was present in both timeline bodies but outside the head-centred crop;
Definitive's smaller head mesh made its 1.2x crop especially narrow. Her
portrait uses the existing Stand frame at 3.433 s, turned 25 degrees, with a
wider crop shifted toward the staff. Classic uses zoom 0.85 and Definitive
0.45, so the grip and staff crown can fit beside her face.

Definitive Illidan's Combat Idle at 18.809 s raised a glaive vertically across
his face, and the 1.5x crop emphasized his topknot. His portrait instead uses
the existing Stand 4 frame at 139.173 s, turn 45 degrees, a level camera and
zoom 0.8 with the crop lowered by 0.4 head sizes. 

It writes `PRIVATE_OUTPUT/fighter-renders/` (Classic) with its `de/` folder
(Definitive); store that folder with `bun wisp inputs add fighter-renders`.
The map build imports each Classic portrait at its path and each Definitive one
at the same path under `_de.w3mod`, which Definitive reads first and Classic
ignores, so the same UI code shows the right one in each mode. The renders are
proprietary derived art and stay outside the repository.

Classic Murloc and Kobold keep the 3.0 stock models, which hang the old mesh
bones, every pivot collapsed to one point, under a second `Bone_*` rig. Posed
through that rig, war3-model's evaluator (Wisp's renderer and the earlier
Blender importer alike) scatters the mesh into texture noise, so their Classic
portraits hold that rig's rest pose. Definitive Murloc's every Stand clip hunches his head
into his fins, so his Definitive portrait holds his rig's bind pose with the
head lifted 20 degrees; his match animation is unchanged. The earlier Blender set drew Forsaken
Paladin black: Blender's MDX reader lost the textures of his version-1800
skinned body.

Picked cards, HUD busts, stock icons and off-screen portraits use the fighter
slot's variant; the roster grid keeps its neutral portrait.

The results pose and the star-KO body play their clips on the timeline body
too, so every place a fighter is drawn follows the graphics mode.

## Match HUD plate

The plate follows the damage HUDs of Melee, Ultimate and Rivals 2 in the
selection screen's art (gold edge, bevelled metal, navy). One 544x192 plate
(smashcraft:tools/selection/art/HudPlate.svg) per fighter is drawn 1:1 on the
reference display, whatever the player count. A player-colour band sits behind
the fighter's head-and-shoulders render (`Bust`, 256 px, clear background),
which breaks out of the plate's top as Ultimate's does. The whole damage
percent is large, with the tenth and percent sign smaller beside it. Its
colour ramps continuously white → yellow → orange → red → dark red from 0% to
200%, and it shakes for 14 rendered frames on each hit, harder for bigger hits
(local presentation only). Stocks are 64 px renders of the fighter's head above
the plate: up to five, then one icon and the count. The mana bar fills the
track under the percent. smashcraft:ts/src/game/ui/plateLayout.ts holds every
box in plate pixels.

## Slot colours

A fighter's model shows its slot's Warcraft player colour in a match
(`BlzSetSpecialEffectColorByPlayer` with `Player(slot)`): red, blue, teal and
purple for slots 1 to 4. smashcraft:ts/src/game/ui/slotColors.ts holds those
colours, and smashcraft:tools/selection/build-art.ts paints each slot's chip,
selection card and HUD plate band from them. The portraits themselves are
neutral, so a fighter's colour appears only on its own slot's card and plate,
the same on every client.

## Selection cursor

While a chip is dragged on the fighter select screen, the Warcraft cursor is
hidden (`BlzEnableCursor`) and the local client draws a pinching steel gauntlet
instead, the chip's top rim between thumb and fingertip; otherwise the stock
cursor shows. The pointing pose is painted but not displayed yet. Both 128x128 TGAs (`SelectionHandPoint`, `SelectionHandPinch`) are
original art painted by smashcraft:tools/selection/build-art.ts from
smashcraft:tools/selection/art/SelectionHand.svg, inspired by Super Smash Bros.
Ultimate's gauntlet cursor; no Nintendo or Blizzard pixels are used. The pinching
hotspot is the point between thumb and fingertip, as fractions of the image in
smashcraft:ts/src/game/menu/selectionDrag.ts. The stock cursor returns on drop,
when a panel opens over the roster or when the screen closes. Warcraft has no
per-render Lua callback (smashcraft:docs/high-refresh.md), so hand and chip move
together once per 60 Hz tick from one mouse sample.
