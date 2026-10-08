// Stock texture sources and tint targets for each deck face and raised platform.
// tools/stage/package.ts authors the models; the frame probe uses these targets.
// Themes and value rules: smashcraft:docs/design/stage-art.md, rule 10.
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, STRATHOLME_STAGE, TIMED_TEST_STAGE, TOMB_OF_SARGERAS_STAGE, WIND_TEST_STAGE } from "../sim/stage";

type Rgb = readonly [red: number, green: number, blue: number];

export interface StageMaterial {
  readonly texture: string;
  readonly crop?: readonly [u0: number, v0: number, u1: number, v1: number];
}

export interface PlatformMaterialSet {
  readonly top: StageMaterial;
  readonly lip: StageMaterial;
  readonly body: StageMaterial;
  readonly underside: StageMaterial;
  readonly tint?: Rgb;
}

export interface StageMaterialSet {
  readonly top: StageMaterial;
  readonly lip: StageMaterial;
  readonly body: StageMaterial;
  readonly underside: StageMaterial;
  readonly platform: PlatformMaterialSet;
  readonly alternatePlatform?: PlatformMaterialSet;
}

/** Sky Deck's neutral palette, which every other theme departs from. */
export const STAGE_PALETTE = {
  slate: [136, 151, 157],
  brass: [222, 196, 122],
  charcoal: [52, 62, 72],
  steel: [77, 91, 103],
} as const satisfies Record<string, Rgb>;

/** A deck's materials: walking surface, lip, body and recessed underside. */
export interface DeckPalette {
  readonly top: Rgb;
  readonly lip: Rgb;
  readonly body: Rgb;
  readonly underside: Rgb;
}

/** Sky Deck's deck materials. */
export const NEUTRAL_DECK_PALETTE: DeckPalette = { top: STAGE_PALETTE.slate, lip: STAGE_PALETTE.brass, body: STAGE_PALETTE.charcoal, underside: STAGE_PALETTE.steel };

/** Each selectable stage's deck palette; the first is the neutral one. */
export const STAGE_DECK_PALETTES: readonly { readonly stage: number; readonly theme: string; readonly palette: DeckPalette; readonly materials?: StageMaterialSet }[] = [
  { stage: 0, theme: "Sky", palette: NEUTRAL_DECK_PALETTE, materials: {"top":{"texture":"TerrainArt\\Dalaran\\Dalaran_SquareTiles.blp"},"lip":{"texture":"TerrainArt\\Dalaran\\Dalaran_BrickTiles.blp"},"body":{"texture":"TerrainArt\\Dalaran\\Dalaran_BlackMarble.blp"},"underside":{"texture":"TerrainArt\\Dalaran\\Dalaran_BlackMarble.blp"},"platform":{"top":{"texture":"TerrainArt\\Dalaran\\Dalaran_SquareTiles.blp"},"lip":{"texture":"TerrainArt\\Dalaran\\Dalaran_BrickTiles.blp"},"body":{"texture":"TerrainArt\\Dalaran\\Dalaran_BlackMarble.blp"},"underside":{"texture":"TerrainArt\\Dalaran\\Dalaran_BlackMarble.blp"}}} },
  // Icecrown ice over dark saronite.
  { stage: FROZEN_THRONE_STAGE, theme: "Icecrown", palette: { top: [200, 226, 240], lip: [220, 240, 252], body: [50, 62, 84], underside: [70, 86, 108] }, materials: {"top":{"texture":"TerrainArt\\Icecrown\\Ice_RuneBricks.blp"},"lip":{"texture":"TerrainArt\\Icecrown\\Ice_Ice.blp"},"body":{"texture":"TerrainArt\\Icecrown\\Ice_BlackSquares.blp"},"underside":{"texture":"Textures\\Ice_Natural01.blp"},"platform":{"top":{"texture":"TerrainArt\\Icecrown\\Ice_TiledBricks.blp"},"lip":{"texture":"TerrainArt\\Icecrown\\Ice_Ice.blp"},"body":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"underside":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"tint":[180,208,224]}} },
  // Ashenvale grass over roots with a moonwell-teal lip.
  { stage: WIND_TEST_STAGE, theme: "Nordrassil", palette: { top: [142, 182, 104], lip: [110, 170, 160], body: [78, 60, 54], underside: [100, 84, 76] }, materials: {
    top: { texture: "TerrainArt\\Ashenvale\\Ashen_GrassLumpy.blp" },
    lip: { texture: "TerrainArt\\Ashenvale\\Ashen_Vines.blp" },
    body: { texture: "TerrainArt\\Ashenvale\\Ashen_Rock.blp" },
    underside: { texture: "TerrainArt\\Ashenvale\\Ashen_DirtRough.blp" },
    platform: {
      top: { texture: "TerrainArt\\Ashenvale\\Ashen_leaves.blp" },
      lip: { texture: "TerrainArt\\Ashenvale\\Ashen_Vines.blp" },
      body: { texture: "TerrainArt\\Ashenvale\\Ashen_Vines.blp" },
      underside: { texture: "TerrainArt\\Ashenvale\\Ashen_Vines.blp" },
      tint: [172, 188, 128],
    },
  } },
  // Dwarven granite, Alliance gold and blue.
  { stage: CARRIED_TEST_STAGE, theme: "Aerie", palette: { top: [216, 224, 232], lip: [255, 230, 96], body: [110, 116, 128], underside: [100, 112, 128] }, materials: {
    top: { texture: "TerrainArt\\Cityscape\\City_SquareTiles.blp" },
    lip: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
    body: { texture: "TerrainArt\\LordaeronWinter\\Lordw_Rock.blp", crop: [0, 0, 0.125, 0.25] },
    underside: { texture: "TerrainArt\\Village\\Village_Rocks.blp", crop: [0, 0, 0.125, 0.25] },
    platform: {
      top: { texture: "TerrainArt\\Cityscape\\City_RoundTiles.blp" },
      lip: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
      body: { texture: "TerrainArt\\LordaeronWinter\\Lordw_Rock.blp", crop: [0, 0, 0.125, 0.25] },
      underside: { texture: "TerrainArt\\Village\\Village_Rocks.blp", crop: [0, 0, 0.125, 0.25] },
      tint: [154, 166, 192],
    },
    alternatePlatform: {
      top: { texture: "Buildings\\Human\\GryphonAviary\\GriffonAviary.blp", crop: [0, 0.4375, 0.5625, 0.625] },
      lip: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
      body: { texture: "Buildings\\Human\\GryphonAviary\\GriffonAviary.blp", crop: [0, 0.4375, 0.5625, 0.625] },
      underside: { texture: "TerrainArt\\Village\\Village_Rocks.blp", crop: [0, 0, 0.125, 0.25] },
      tint: [202, 158, 94],
    },
  } },
  // Orc hide planks over dark wood, rust-iron lip.
  { stage: DRIFTING_DECK_STAGE, theme: "Durotar", palette: { top: [214, 180, 130], lip: [140, 62, 40], body: [70, 46, 34], underside: [96, 66, 46] }, materials: {"top":{"texture":"TerrainArt\\Barrens\\Barrens_Dirt.blp"},"lip":{"texture":"Textures\\Watchtower.blp","crop":[0.09375,0.3125,0.3125,0.41015625]},"body":{"texture":"TerrainArt\\Barrens\\Barrens_Rock.blp"},"underside":{"texture":"Textures\\BarrensNatural02.blp"},"platform":{"top":{"texture":"Textures\\Watchtower.blp","crop":[0.09375,0.3125,0.3125,0.41015625]},"lip":{"texture":"Textures\\Watchtower.blp","crop":[0.09375,0.3125,0.3125,0.41015625]},"body":{"texture":"TerrainArt\\Barrens\\Barrens_DirtRough.blp"},"underside":{"texture":"TerrainArt\\Barrens\\Barrens_DirtRough.blp"},"tint":[218,166,100]}} },
  // Scourge stone over black iron, plague-green lip.
  { stage: PATTERNED_DECKS_STAGE, theme: "Scourge", palette: { top: [160, 168, 176], lip: [100, 170, 110], body: [54, 60, 74], underside: [76, 84, 100] }, materials: {"top":{"texture":"TerrainArt\\Icecrown\\Ice_BlackSquares.blp"},"lip":{"texture":"TerrainArt\\Icecrown\\Ice_RuneBricks.blp"},"body":{"texture":"Textures\\NewZigguratscarycreepytex.blp","crop":[0,0,0.5,0.5]},"underside":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"platform":{"top":{"texture":"Textures\\CreepyNecropolis.blp","crop":[0,0,0.5,0.5]},"lip":{"texture":"TerrainArt\\Icecrown\\Ice_RuneBricks.blp"},"body":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"underside":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"tint":[136,202,154]},"alternatePlatform":{"top":{"texture":"Textures\\CreepyNecropolis.blp","crop":[0,0,0.5,0.5]},"lip":{"texture":"TerrainArt\\Icecrown\\Ice_RuneBricks.blp"},"body":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"underside":{"texture":"TerrainArt\\Icecrown\\Ice_BlackBricks.blp"},"tint":[146,168,216]}} },
  // HF-1/HF-2: light red stone preserves texture detail; white stock runes take the fel-green tint.
  { stage: HELLFIRE_STAGE, theme: "Fel", palette: { top: [255, 240, 216], lip: [96, 255, 40], body: [180, 136, 116], underside: [106, 68, 60] }, materials: {
    top: { texture: "TerrainArt\\Outland\\Outland_FlatStonesLight.blp", crop: [0, 0, 0.125, 0.25] },
    lip: { texture: "Textures\\DemonRune1.blp" },
    body: { texture: "TerrainArt\\Outland\\Outland_Rock.blp" },
    underside: { texture: "TerrainArt\\Outland\\Outland_Abyss.blp" },
    platform: {
      top: { texture: "TerrainArt\\BlackCitadel\\Citadel_LargeBricks.blp" },
      lip: { texture: "Textures\\DemonRune1.blp" },
      body: { texture: "TerrainArt\\Outland\\Outland_Rock.blp" },
      underside: { texture: "TerrainArt\\Outland\\Outland_Abyss.blp" },
      tint: [240, 204, 180],
    },
  } },
  // Basalt over black rock, molten lip.
  { stage: CANNON_TEST_STAGE, theme: "Blackrock", palette: { top: [132, 126, 122], lip: [255, 255, 255], body: [72, 64, 60], underside: [90, 80, 74] }, materials: {
    top: { texture: "TerrainArt\\Dungeon\\Cave_SquareTiles.blp" },
    lip: { texture: "TerrainArt\\Dungeon\\Cave_LavaCracks.blp", crop: [0, 0, 0.125, 0.25] },
    body: { texture: "TerrainArt\\Dungeon\\Cave_DarkRocks.blp" },
    underside: { texture: "TerrainArt\\Dungeon\\Cave_DarkRocks.blp" },
    platform: {
      top: { texture: "TerrainArt\\Dungeon\\Cave_Brick.blp", crop: [0, 0, 0.125, 0.25] },
      lip: { texture: "Textures\\Minecart.blp", crop: [0, 0, 1, 0.5] },
      body: { texture: "TerrainArt\\Dungeon\\Cave_DarkRocks.blp" },
      underside: { texture: "TerrainArt\\Dungeon\\Cave_DarkRocks.blp" },
      tint: [255, 240, 216],
    },
  } },
  // Pale sandstone, scarab-gold lip.
  // Lordaeron cobbles over scorched brick, Alliance-blue lip.
  { stage: STRATHOLME_STAGE, theme: "Stratholme", palette: { top: [168, 160, 150], lip: [70, 110, 180], body: [96, 62, 52], underside: [120, 82, 68] }, materials: {
    top: { texture: "TerrainArt\\Village\\Village_CobblePath.blp" },
    lip: { texture: "TerrainArt\\Village\\Village_StonePath.blp" },
    body: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
    underside: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
    platform: {
      top: { texture: "Textures\\CityBuildingsRuin.blp", crop: [0.21875, 0.5, 0.390625, 1] },
      lip: { texture: "TerrainArt\\Village\\Village_StonePath.blp" },
      body: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
      underside: { texture: "TerrainArt\\Cityscape\\City_BrickTiles.blp" },
      tint: [126, 144, 182],
    },
  } },
  // Shallow tide over sunken stone, Naga coral-gold lip.
  { stage: TOMB_OF_SARGERAS_STAGE, theme: "Sargeras", palette: { top: [144, 224, 208], lip: [224, 152, 104], body: [104, 152, 140], underside: [112, 156, 144] }, materials: {
    top: { texture: "TerrainArt\\Ruins\\Ruins_RoundTiles.blp" },
    lip: { texture: "TerrainArt\\Ruins\\Ruins_SmallBricks.blp" },
    // Opaque 128x128 rock cell in the stock 512x512 atlas.
    body: { texture: "Textures\\RuinsNatural.blp", crop: [0, 0, 0.25, 0.25] },
    underside: { texture: "Textures\\RuinsVines.blp", crop: [0.40625, 0, 0.59375, 1] },
    platform: {
      // One 64x64 tile from the stock 512x256 brick atlas.
      top: { texture: "TerrainArt\\Ruins\\Ruins_LargeBricks.blp", crop: [0, 0, 0.125, 0.25] },
      lip: { texture: "TerrainArt\\Ruins\\Ruins_SmallBricks.blp" },
      body: { texture: "Textures\\RuinsNatural.blp", crop: [0, 0, 0.25, 0.25] },
      underside: { texture: "Textures\\RuinsVines.blp", crop: [0.40625, 0, 0.59375, 1] },
      tint: [224, 184, 126],
    },
  } },
  { stage: TIMED_TEST_STAGE, theme: "Qiraji", palette: { top: [224, 204, 160], lip: [170, 130, 50], body: [110, 84, 56], underside: [138, 108, 74] }, materials: {
    top: { texture: "TerrainArt\\Ruins\\Ruins_Sand.blp" },
    lip: { texture: "TerrainArt\\Ruins\\Ruins_SmallBricks.blp" },
    body: { texture: "TerrainArt\\Ruins\\Ruins_LargeBricks.blp" },
    underside: { texture: "Textures\\Ruins_Rock.blp", crop: [0, 0, 0.40625, 0.1875] },
    platform: {
      top: { texture: "TerrainArt\\Ruins\\Ruins_RoundTiles.blp" },
      lip: { texture: "Textures\\RuinsDoodads1.blp", crop: [0.0625, 0.078125, 0.15625, 0.34375] },
      body: { texture: "TerrainArt\\Ruins\\Ruins_LargeBricks.blp" },
      underside: { texture: "Textures\\Ruins_Rock.blp", crop: [0, 0, 0.40625, 0.1875] },
      tint: [190, 162, 106],
    },
  } },
];

/** Rec. 601 luma, 0 to 255, in integers so the emitted Lua agrees. */
export const luma = ([red, green, blue]: Rgb): number => (299 * red + 587 * green + 114 * blue) / 1000;
