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
its first `Stand Ready` frame. Heroes come from the game's storage, and the
original fighters from their generated models. The renders are proprietary
derived art: they go to `ASSETS/fighter-renders/` outside the repository, and
the map build imports them from there. A fighter missing from
`RENDERED_FIGHTERS` shows its command icon. Add it there after its renders
exist.
