import { impactModel } from "../../src/game/presentation/hitPresentation";
import { HIDDEN_EFFECT_DEPTH } from "../../src/game/render/effects";
import { IMPACT_KIND_COUNT } from "../../src/game/presentation/impactState";
// What a player must see in a Smashcraft match (wisp:docs/player-view.md):
// each kind of effect the map draws, with its models and the longest a player
// should see one, what those models draw and where the arena camera looks,
// and the stage in its band of the arena camera's frame.
import { homedir } from "node:os";
import { join } from "node:path";
import { type FrameFeature, colorRows, pixelShare } from "wisp/scripts/wisp/frameProbe";
import type { PlayerViewExpectations } from "wisp/scripts/wisp/playerView";
import type { SceneExpectations } from "wisp/scripts/wisp/scene";
import type { CameraView } from "wisp/scripts/wisp/visibility";
import { originalClip, originalClipCount, originalLightPath } from "../../src/game/assets/fighterOriginalClipInfo";
import { FROST_ICE_MODEL, FROST_TRAP_MODEL } from "../../src/game/assets/frostAssetInfo";
import {
  IMPACT_DUST_MODEL, IMPACT_ELECTRIC_MODEL, IMPACT_HIT_MODEL, IMPACT_JUMP_MODEL, IMPACT_KO_MODEL,
  IMPACT_MISS_MODEL, IMPACT_RESPAWN_MODEL, IMPACT_ROLL_MODEL, IMPACT_SHIELD_MODEL, IMPACT_TECH_MODEL,
} from "../../src/game/assets/impactAssetInfo";
import { SHIELD_P1_MODEL, SHIELD_P2_MODEL, SHIELD_P3_MODEL, SHIELD_P4_MODEL } from "../../src/game/assets/shieldAssetInfo";
import { STAGE_DECK_MODELS } from "../../src/game/assets/stageAssetInfo";
import { STOCK_PLATFORM_MODELS } from "../../src/game/presentation/stockPlatforms";
import { STAGE_EDGE_LIGHT_MODEL } from "../../src/game/presentation/stageEdgeLights";
import { STAGE_DECK_PALETTES } from "../../src/game/assets/stagePalette";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { RIFLEMAN_MODEL_FILE } from "../../src/game/presentation/fighterAssetInfo";
import { ARENA_CAMERA, FLOOR_HEIGHT, arenaFraming } from "../../src/game/presentation/arenaCamera";
import { SUMMON_BEAR, summonClip, summonClipCount } from "../../src/game/presentation/summonClipInfo";
import { CANNON_MODEL, HYDRA_CREST_MODEL, HYDRA_RING_MODEL } from "../../src/game/presentation/stageHazards";
import { allProjectileModels, SPECIAL_SLOTS } from "../../src/game/presentation/projectileArt";
import { ELEMENTS, elementLook } from "../../src/game/presentation/elementLooks";
import { allCueModels } from "../../src/game/presentation/specialCues";
import { allAttackCueModels } from "../../src/game/presentation/attackCues";
import { Character } from "../../src/game/sim/codes";
import type { AuthoredSpecial } from "../../src/game/sim/heroSpecials";
import { HERO_ROSTER } from "../../src/game/sim/heroes/registry";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { stageBounds } from "../../src/game/sim/stageBounds";
import { STAGE_LAVA_MODEL } from "../../src/game/assets/terrainAssetInfo";
import { placedPieces } from "../../src/game/presentation/stageScenery";
import { MODEL_FACTS } from "./modelFacts";
import { WHITE_MODEL_FACTS } from "./whiteModelFacts";
import { WHITE_FIGHTER_MODELS } from "../../src/game/assets/whiteFighterModels";
import { STAGE_SKIES, stageSkyTexture } from "../stageSky";

const FRAMES_PER_SECOND = 60;
const seconds = (value: number) => value * FRAMES_PER_SECOND;
const CHARACTERS = Object.values(Character);
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Each pooled fighter's clip models and its light, which follow the fighter all match; heroes included. */
const fighterModels = CHARACTERS.flatMap((character) => [
  ...range(originalClipCount(character)).flatMap((index) => originalClip(character, index)?.modelPath ?? []),
  ...[originalLightPath(character) ?? []].flat(),
]);

const WARD_MODEL = "Units\\Orc\\SerpentWard\\SerpentWard.mdx";
const placedModels = new Map<string, number>([[WARD_MODEL, 240]]);
function recordPlacement(special: AuthoredSpecial | undefined, fallback: string): void {
  const placement = special?.placement;
  if (placement !== undefined) {
    const path = placement.model?.path ?? fallback;
    placedModels.set(path, Math.max(placedModels.get(path) ?? 0, placement.life));
  }
  for (const followUp of special?.followUps ?? []) recordPlacement(followUp.special, fallback);
}
for (const hero of HERO_ROSTER) {
  if (hero.specials === undefined) continue;
  for (const slot of SPECIAL_SLOTS) {
    const kit = hero.specials[slot];
    for (const form of [kit.ground, kit.air, kit.recall, kit.marked?.special]) {
      recordPlacement(form, hero.presentation.placedModel?.path ?? WARD_MODEL);
    }
  }
}

/** Every value from `low` to `high` in quarters, each paired with every one at or above it. */
const spans = (low: number, high: number) => {
  const steps = range(5).map((step) => low + ((high - low) * step) / 4);
  return steps.flatMap((from, index) => steps.slice(index).map((to) => [from, to] as const));
};

/**
 * The arena camera on every span of live fighters inside the blast zones, in
 * quarters of each zone, in arena coordinates: the stage center at floor
 * height. Warcraft spreads the field of view across the frame's width: in the
 * 1280x720 four-fighter recording, world x 0 sat at screen x 283 with the
 * camera 592 to its right (05266a3), where 70 degrees across the width
 * predicts 274 and 70 degrees down its height 434. The clients run 16:9.
 */
const ARENA_CAMERAS: readonly CameraView[] = spans(stageBounds(0).blast.left, stageBounds(0).blast.right).flatMap(([left, right]) =>
  spans(stageBounds(0).blast.bottom, stageBounds(0).blast.top).map(([bottom, top]) => {
    const { x, z, distance, fieldOfView } = arenaFraming(left, right, bottom, top);
    return { target: [x, 0, z], distance, angleOfAttack: ARENA_CAMERA.angleOfAttack, rotation: ARENA_CAMERA.rotation, fieldOfView, aspect: 16 / 9, farZ: ARENA_CAMERA.farZ };
  }));

/**
 * Lifetimes are what a player should see, not what the code that hides an
 * effect happens to do: the longest a legitimate use keeps one effect in
 * view, with room for a pool slot reused while shown.
 */
export const SMASHCRAFT_SCENE: SceneExpectations & { readonly settledFrame: number } = {
  framesPerSecond: FRAMES_PER_SECOND,
  stage: { kind: "stage deck", pieces: 1 },
  // hideEffect keeps even tall stock emitters below every arena camera.
  visibility: { models: { ...MODEL_FACTS, ...WHITE_MODEL_FACTS }, cameras: ARENA_CAMERAS, parking: [[0, 0, -FLOOR_HEIGHT - HIDDEN_EFFECT_DEPTH]] },
  // Half a second into the match the decks are drawn and the camera has framed the fighters.
  settledFrame: 30,
  kinds: [
    { name: "stage deck", models: [...Object.values(STAGE_DECK_MODELS).flatMap(({ main, slab, alternate }) => alternate === undefined ? [main, slab] : [main, slab, alternate]), ...STOCK_PLATFORM_MODELS] },
    { name: "stage cannon", models: [CANNON_MODEL] },
    { name: "stage hydra", models: [HYDRA_CREST_MODEL, HYDRA_RING_MODEL] },
    { name: "stage lava", models: [STAGE_LAVA_MODEL] },
    { name: "stage scenery", models: [...new Set(STAGE_CATALOG.flatMap(({ id }) => placedPieces(id).map(({ model }) => model))), STAGE_EDGE_LIGHT_MODEL] },
    { name: "pooled fighter", models: fighterModels },
    { name: "body flash", models: Object.values(WHITE_FIGHTER_MODELS) },
    // Heroes draw with their fighter unit, shown while the hero is in play.
    { name: "hero body", models: HERO_ROSTER.map(({ presentation }) => presentation.model) },
    // Sparks and dust last under half a second; a star-KO sparkle, about two.
    {
      name: "hit spark", lifetime: seconds(3), models: [
        IMPACT_HIT_MODEL, IMPACT_TECH_MODEL, IMPACT_MISS_MODEL, IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL,
        IMPACT_ELECTRIC_MODEL, IMPACT_SHIELD_MODEL, IMPACT_JUMP_MODEL, IMPACT_KO_MODEL, IMPACT_RESPAWN_MODEL,
        ...Array.from({ length: IMPACT_KIND_COUNT }, (_, kind) => impactModel(kind)),
      ],
    },
    // A star KO flies the fighter off for under two seconds.
    { name: "KO body", lifetime: seconds(3), models: [RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE, ...HERO_ROSTER.map(({ presentation }) => presentation.model)] },
    // The lightest press drains a full shield in about 72 s.
    { name: "shield bubble", lifetime: seconds(75), models: [SHIELD_P1_MODEL, SHIELD_P2_MODEL, SHIELD_P3_MODEL, SHIELD_P4_MODEL] },
    // An unsprung trap waits 30 s; a frozen fighter thaws within 5 s.
    { name: "freeze trap", lifetime: seconds(31), models: [FROST_TRAP_MODEL] },
    { name: "ice shell", lifetime: seconds(6), models: [FROST_ICE_MODEL] },
    ...[...placedModels].map(([model, lifetime]) => ({
      name: model === WARD_MODEL ? "placed ward" : `placed ${model.split("\\").at(-1)}`,
      lifetime: lifetime + seconds(1), models: [model],
    })),
    { name: "agency marker", models: ["Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl"] },
    // Every move's stock missile (presentation/projectileArt.ts).
    {
      name: "projectile", lifetime: seconds(4), models: [...allProjectileModels()],
    },
    // Each special's startup and active spell, shown while the special runs (presentation/specialCues.ts).
    { name: "special cue", lifetime: seconds(3), models: [...new Set([...allCueModels(), ...allAttackCueModels()])] },
    // A hit's element on its victim through hitlag and hitstun, a few seconds at most (presentation/elementLooks.ts).
    { name: "hit element", lifetime: seconds(5), models: ELEMENTS.flatMap((element) => elementLook(element).victim ?? []) },
    // Stock game models (render/effects.ts STOCK_MODELS, shell/fighterBody.ts); the host can't load those modules' natives.
    { name: "Illidan's flames", lifetime: seconds(3), models: ["Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx"] },
    { name: "silence mark", lifetime: seconds(2), models: ["Abilities\\Spells\\Other\\Silence\\SilenceTarget.mdx"] },
    { name: "bear", lifetime: seconds(3), models: range(summonClipCount(SUMMON_BEAR)).map((index) => summonClip(SUMMON_BEAR, index).modelPath) },
    // A shield break stuns for at most about eight seconds.
    { name: "dizzy mark", lifetime: seconds(10), models: ["Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx"] },
  ],
};

/** The arena's sky fills the top of every match frame and no menu's. */
const SKY = { top: 0, bottom: 0.4, left: 0, right: 1 };
/**
 * Rows from the fighters' feet to the HUD: the deck sits here at match start
 * whatever the camera's field of view, and no HUD panel reaches into it.
 */
const STAGE_BAND = { top: 0.45, bottom: 0.71, left: 0, right: 1 };
/** The deck's front faces; its slate top is too close to the sky and clouds to tell apart. */
const DECK_COLORS = STAGE_DECK_PALETTES.flatMap(({ palette }) => [palette.body, palette.underside, palette.lip]);
const DECK_TOLERANCE = 40;
/** A deck run spans at least a fifth of the frame; fighters, effects and HUD text are narrower. */
const DECK_RUN = 0.2;
/** One hundredth of the frame's height, 14 rows at 1440: the deck's front shows several times that. */
const DECK_ROWS = 0.01;

// Texture filtering can interpolate neighbouring texels. Quantised palette
// neighbours recognise those colours while a missing sky remains black.
const skyColorKey = (red: number, green: number, blue: number) => ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
const SKY_COLORS = new Set<number>();
for (const sky of STAGE_SKIES) {
  const bytes = stageSkyTexture(sky).bytes;
  for (let index = 18; index < bytes.length; index += 4) {
    const red = (bytes[index + 2] ?? 0) >> 3, green = (bytes[index + 1] ?? 0) >> 3, blue = (bytes[index] ?? 0) >> 3;
    for (const dr of [-1, 0, 1]) for (const dg of [-1, 0, 1]) for (const db of [-1, 0, 1]) {
      const r = red + dr, g = green + dg, b = blue + db;
      if (r >= 0 && r < 32 && g >= 0 && g < 32 && b >= 0 && b < 32) SKY_COLORS.add((r << 10) | (g << 5) | b);
    }
  }
}

/** Current atmospheric textures and Nordrassil's preserved green aurora. */
export const isArenaSkyColor = (red: number, green: number, blue: number): boolean =>
  SKY_COLORS.has(skyColorKey(red, green, blue)) || (red <= 16 && green >= 20 && blue >= 8 && green >= blue);

export const SMASHCRAFT_FRAME: readonly FrameFeature[] = [
  {
    name: "arena sky",
    absent: "no match on screen: the frame shows no sky",
    measure: (frame) => {
      const share = pixelShare(frame, SKY, isArenaSkyColor);
      return { present: share >= 0.5, measured: `${(share * 100).toFixed(1)}% of the top band is sky, needs 50%` };
    },
  },
  {
    name: "stage in the stage band",
    absent: "no stage under the fighters",
    measure: (frame) => {
      const rows = colorRows(frame, STAGE_BAND, DECK_COLORS, DECK_TOLERANCE, DECK_RUN);
      const needed = Math.ceil(DECK_ROWS * frame.height);
      return { present: rows >= needed, measured: `${rows} rows hold a deck-coloured run of at least ${DECK_RUN * 100}% of the width, needs ${needed}` };
    },
  },
];

/** The checks to run: a captured frame, and the scene report of a build that starts the recorder. */
export const smashcraftPlayerView = ({ frame, scene }: { readonly frame: boolean; readonly scene: boolean }): PlayerViewExpectations => ({
  filePrefix: "smashcraft",
  ...(frame ? { frame: SMASHCRAFT_FRAME } : {}),
  ...(scene ? { scene: SMASHCRAFT_SCENE } : {}),
});

/** Where fresh matches keep each client's captured frame. */
export const freshFrames = join(homedir(), ".local/state/smashcraft/frames");
