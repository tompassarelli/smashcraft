import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { VERIFIED_STOCK_SOUNDS } from "../assets/stockSoundInfo";
import { HitElement } from "../sim/hitRegions";
import { moveSound, playHit, soundFiles, soundedMoves } from "./moveSounds";

test("every move of every fighter has a perform, weak, strong and shield sound, each in the installed game [k4 reference native]", () => {
  assertEquals(SELECTABLE_CHARACTERS.length, 26, "roster");
  const missing: string[] = [];
  for (const character of SELECTABLE_CHARACTERS) {
    for (const move of soundedMoves(character)) {
      const row = moveSound(character, move);
      const name = `${fighterName(character)} ${move}`;
      if (row === undefined) {
        missing.push(`${name}: no sounds`);
        continue;
      }
      for (const [slot, layers] of [["perform", row.perform], ["hit", row.hit], ["strong", row.strong], ["shield", row.shield]] as const) {
        if (layers.length === 0) missing.push(`${name}: no ${slot}`);
        for (const layer of [...layers, ...(row.voice === undefined ? [] : [row.voice])]) {
          for (const sound of layer.sounds) {
            const files = soundFiles(sound);
            if (files.length === 0) missing.push(`${name}: ${slot} ${sound} is no stock label`);
            for (const file of files) if (VERIFIED_STOCK_SOUNDS[file] === undefined) missing.push(`${name}: ${file} not in the game`);
          }
        }
      }
    }
  }
  assertEquals(missing.join("\n"), "");
});

test("three jabs in a row never sound alike, and the same hit always sounds the same [k2 property]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const takes: string[] = [];
    for (let serial = 1; serial <= 3; serial++) {
      const played: string[] = [];
      playHit(character, AttackStyle.jab, false, HitElement.normal, serial, (file, volume, pitch) => played.push(`${file}@${volume}@${pitch}`));
      const again: string[] = [];
      playHit(character, AttackStyle.jab, false, HitElement.normal, serial, (file, volume, pitch) => again.push(`${file}@${volume}@${pitch}`));
      assertEquals(again.join(","), played.join(","), `${fighterName(character)} jab ${serial} repeats exactly`);
      takes.push(played.join(","));
    }
    assertEquals(new Set(takes).size, 3, `${fighterName(character)} jab takes ${takes.join(" | ")}`);
  }
});
