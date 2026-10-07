# Fighter portraits

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

`bun tools/selection/render-fighters.ts --extract CASC_EXTRACT --assets ASSETS`
renders every fighter in `RENDERED_FIGHTERS`
(smashcraft:ts/src/game/sim/heroes/registry.ts) with
smashcraft:tools/selection/render-fighter.py in Blender. Every fighter gets the
same three-quarter camera, lights and background, framed to its silhouette at
its first `Stand Ready` frame. Fighters render in Warcraft's Coal team colour
(`NEUTRAL_TEAM_COLOR`, a dark grey no slot uses), so the grid shows no
player's colour. Each new render also writes `work/NAME-team.png`: an unlit
pass through the same material blend graph, with the painted textures' RGB
removed and their alpha retained. This isolates the team layer even where it
blends through skin or trim. The pass disables denoising, which otherwise
changes faint edge colours, and retains `work/NAME-team.blend` for direct pixel
diagnostics without importing the clip pool again. `--check RED_WORK` checks that pass for the twelve
player colours (including Gray) and compares the render's silhouette with the
same fighter rendered with `--team 0`. Cached renders without the isolated
pass use their red comparison to find team-colour pixels. Heroes come from the game's storage, and the
original fighters from their generated models. The renders are proprietary
derived art: they go to `ASSETS/fighter-renders/` outside the repository, and
the map build imports them from there. A fighter missing from
`RENDERED_FIGHTERS` shows its command icon. Add it there after its renders
exist.

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
