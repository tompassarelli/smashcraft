// Community models and textures the map imports. Their files stay in private
// build inputs (never Git): the map build reads each from --assets's
// imported-models folder under its archive path's last part. Archive paths are
// the ones each author's readme names; the model's textures must sit where the
// model looks for them. Credits: smashcraft:docs/design/roster.md "Credits".

/** The Lich King's body, by Kwaliti (Hive Workshop). */
export const LICH_KING_MODEL = "war3mapImported\\LichKing2.mdx";
/** The Forsaken Paladin rig with Uther's authored hammer actions. */
export const UTHER_FORSAKEN_MODEL = "war3mapImported\\UtherForsakenPaladin.mdx";
/** His command icon, by Kwaliti. */
export const LICH_KING_ICON = "ReplaceableTextures\\CommandButtons\\BTNLichKing.blp";
/**
 * His model is not a Warcraft unit's, so it has no unit model scale: it is
 * drawn at 1.0 times the shared factor (#162, presentation/modelScale.ts).
 */
export const LICH_KING_STOCK_SCALE = { unit: "LichKing2", scale: 1.0 } as const;

/** Neutral special Howling Blast: the frost wyrm's breath, a travelling blast of frost. */
export const HOWLING_BLAST_MODEL = "Abilities\\Weapons\\FrostWyrmMissile\\FrostWyrmMissile.mdx";
/** Side special Val'kyr Shadowguard: a winged spirit of the dead that seizes and carries. */
export const VALKYR_MODEL = "Units\\Undead\\Banshee\\Banshee.mdx";
/** Down special Defile: a dark pool swirling on the ground. */
export const DEFILE_MODEL = "Abilities\\Spells\\Demon\\DarkPortal\\DarkPortalTarget.mdx";

/** Every imported file: its archive path and the file under imported-models. */
export const IMPORTED_MODEL_FILES: readonly { readonly entry: string; readonly file: string }[] = [
  { entry: UTHER_FORSAKEN_MODEL, file: "UtherForsakenPaladin.mdx" },
  { entry: LICH_KING_MODEL, file: "LichKing2.mdx" },
  // Warcraft draws a unit's portrait from the model path with "_Portrait".
  { entry: "war3mapImported\\LichKing2_Portrait.mdx", file: "LichKing2_Portrait.mdx" },
  { entry: "LichKing.BLP", file: "LichKing.BLP" },
  { entry: "HelmOfDom.BLP", file: "HelmOfDom.BLP" },
  { entry: "FrostmourneNew.blp", file: "FrostmourneNew.blp" },
  { entry: LICH_KING_ICON, file: "BTNLichKing.blp" },
  { entry: "ReplaceableTextures\\CommandButtonsDisabled\\DISBTNLichKing.blp", file: "DISBTNLichKing.blp" },
  { entry: "ReplaceableTextures\\SSCscorescreen-hero-lichking.blp", file: "SSCscorescreen-hero-lichking.blp" },
];
