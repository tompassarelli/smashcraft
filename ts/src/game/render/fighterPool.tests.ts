import { assertEquals, test } from "wisp/src/runtime/testing";
import { originalClip, originalClipCount, originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { characterClips, namedClips } from "../presentation/fighterClips";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName, heroDefinition } from "../sim/heroes/registry";

// The playable build draws every fighter from its clip pool; a fighter
// without one can't be played. Regenerate the pools with
// tools/animations/export-original-clips.ts when a hero joins selection.
test("every selectable fighter has a clip pool covering its clip table", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    const count = originalClipCount(character);
    assertEquals(count > 0, true, `${name} has no clip pool`);
    for (let index = 0; index < count; index++) assertEquals(originalClip(character, index) !== undefined, true, `${name} clip ${index} is missing`);
    const table = characterClips(character);
    const fallback = heroDefinition(character)?.presentation.fallback;
    const clips = namedClips(table);
    if (fallback !== undefined) clips.push(fallback);
    for (const clip of clips) assertEquals(clip.index >= 0 && clip.index < count, true, `${name}'s clip table names sequence ${clip.index}, which its pool lacks`);
    // Poses that select a clip by name when the table leaves the state out;
    // Illidan has his own grab escape and shield break clips.
    const own = character === Character.demonHunter;
    if (!own && table.idle === undefined) assertEquals(originalClipNamed(character, "stand ready") !== undefined, true, `${name}'s pool has no "stand ready" for a grab escape`);
    if (table.idle === undefined) assertEquals(originalClipNamed(character, "stand") !== undefined, true, `${name}'s pool has no "stand"`);
    if (!own && table.dizzy === undefined) assertEquals(originalClipNamed(character, "stand hit") !== undefined, true, `${name}'s pool has no "stand hit" for a broken shield`);
    if (table.walk === undefined) assertEquals(originalClipNamed(character, "walk") !== undefined, true, `${name}'s pool has no "walk"`);
  }
});
