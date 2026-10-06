import { impactModel } from "../../src/game/presentation/hitPresentation";
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
import { STAGE_DECK_MODEL, STAGE_MAIN_DECK_MODEL } from "../../src/game/assets/stageAssetInfo";
import { STAGE_PALETTE } from "../../src/game/assets/stagePalette";
import { DEMON_HUNTER_MODEL_FILE } from "../../src/game/presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../../src/game/presentation/fighterAssetInfo";
import { ARENA_CAMERA, FLOOR_HEIGHT, arenaFraming } from "../../src/game/presentation/arenaCamera";
import { SUMMON_BEAR, summonClip, summonClipCount } from "../../src/game/presentation/summonClipInfo";
import { Character } from "../../src/game/sim/codes";
import { BLAST_ZONE_BOTTOM, BLAST_ZONE_SIDE, BLAST_ZONE_TOP } from "../../src/game/sim/stocks";
import { MODEL_FACTS } from "./modelFacts";

const FRAMES_PER_SECOND = 60;
const seconds = (value: number) => value * FRAMES_PER_SECOND;
const CHARACTERS = [Character.archer, Character.rifleman, Character.demonHunter];
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** Each pooled fighter's clip models and its light, which follow the fighter all match. */
const fighterModels = CHARACTERS.flatMap((character) => [
  ...range(originalClipCount(character)).flatMap((index) => originalClip(character, index)?.modelPath ?? []),
  ...[originalLightPath(character) ?? []].flat(),
]);

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
const ARENA_CAMERAS: readonly CameraView[] = spans(-BLAST_ZONE_SIDE, BLAST_ZONE_SIDE).flatMap(([left, right]) =>
  spans(BLAST_ZONE_BOTTOM, BLAST_ZONE_TOP).map(([bottom, top]) => {
    const { x, z, distance } = arenaFraming(left, right, bottom, top);
    return { target: [x, 0, z], distance, angleOfAttack: ARENA_CAMERA.angleOfAttack, rotation: ARENA_CAMERA.rotation, fieldOfView: ARENA_CAMERA.fieldOfView, aspect: 16 / 9, farZ: ARENA_CAMERA.farZ };
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
  visibility: { models: MODEL_FACTS, cameras: ARENA_CAMERAS, parking: [[0, 0, -FLOOR_HEIGHT - 4096]] },
  // Half a second into the match the decks are drawn and the camera has framed the fighters.
  settledFrame: 30,
  kinds: [
    { name: "stage deck", models: [STAGE_MAIN_DECK_MODEL, STAGE_DECK_MODEL] },
    { name: "pooled fighter", models: fighterModels },
    // Sparks and dust last under half a second; a star-KO sparkle, about two.
    {
      name: "hit spark", lifetime: seconds(3), models: [
        IMPACT_HIT_MODEL, IMPACT_TECH_MODEL, IMPACT_MISS_MODEL, IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL,
        IMPACT_ELECTRIC_MODEL, IMPACT_SHIELD_MODEL, IMPACT_JUMP_MODEL, IMPACT_KO_MODEL, IMPACT_RESPAWN_MODEL,
        ...Array.from({ length: IMPACT_KIND_COUNT }, (_, kind) => impactModel(kind)),
      ],
    },
    // A star KO flies the fighter off for under two seconds.
    { name: "KO body", lifetime: seconds(3), models: [ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE, DEMON_HUNTER_MODEL_FILE] },
    // The lightest press drains a full shield in about 72 s.
    { name: "shield bubble", lifetime: seconds(75), models: [SHIELD_P1_MODEL, SHIELD_P2_MODEL, SHIELD_P3_MODEL, SHIELD_P4_MODEL] },
    // An unsprung trap waits 30 s; a frozen fighter thaws within 5 s.
    { name: "freeze trap", lifetime: seconds(31), models: [FROST_TRAP_MODEL] },
    { name: "ice shell", lifetime: seconds(6), models: [FROST_ICE_MODEL] },
    // Stock game models (render/effects.ts STOCK_MODELS, shell/fighterBody.ts); the host can't load those modules' natives.
    {
      name: "projectile", lifetime: seconds(4), models: [
        "Abilities\\Weapons\\Arrow\\ArrowMissile.mdx",
        "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",
        "Abilities\\Spells\\Human\\ManaFlare\\ManaFlareMissile.mdx",
      ],
    },
    { name: "hippogryph", lifetime: seconds(3), models: ["Units\\NightElf\\HippoGryph\\HippoGryph.mdx"] },
    { name: "Illidan's flames", lifetime: seconds(3), models: ["Abilities\\Spells\\NightElf\\Immolation\\ImmolationTarget.mdx", "Abilities\\Spells\\NightElf\\ManaBurn\\ManaBurnTarget.mdx"] },
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
const DECK_COLORS = [STAGE_PALETTE.charcoal, STAGE_PALETTE.steel, STAGE_PALETTE.brass];
const DECK_TOLERANCE = 40;
/** A deck run spans at least a fifth of the frame; fighters, effects and HUD text are narrower. */
const DECK_RUN = 0.2;
/** One hundredth of the frame's height, 14 rows at 1440: the deck's front shows several times that. */
const DECK_ROWS = 0.01;

export const SMASHCRAFT_FRAME: readonly FrameFeature[] = [
  {
    name: "arena sky",
    absent: "no match on screen: the frame shows no sky",
    measure: (frame) => {
      const share = pixelShare(frame, SKY, (red, _green, blue) => blue >= 170 && blue - red >= 25);
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
