import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { FrameSnapshot } from "wisp/src/headless/frames";
import { captureScene } from "wisp/scripts/wisp/headlessRender";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Phase, setParticipants } from "../src/game/match/rules";
import { Character } from "../src/game/sim/codes";
import { PLAYABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";

const overlaps = (a: FrameSnapshot, b: FrameSnapshot) => {
  if (!a.rectangle || !b.rectangle) return false;
  const [al, at, ar, ab] = a.rectangle, [bl, bt, br, bb] = b.rectangle;
  return al < br - 0.000001 && bl < ar - 0.000001 && ab < bt - 0.000001 && bb < at - 0.000001;
};

for (const width of [1920, 1620]) test(`both selection screens at ${width}: text and buttons fit their frames and keep apart [spec #221]`, async () => {
  const fonts = new Map<number, number>();
  const runtime = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: client => ({ ...SMASHCRAFT_HEADLESS.natives?.(client),
    BlzGetLocalClientWidth: () => width,
    BlzFrameSetFont: (frame: { id: number }, _file: string, size: number) => { fonts.set(frame.id, size); },
  }) });
  try {
    const clients = runtime.clients({ start: () => startBuild(PLAYABLE_BUILD), install }, [0]);
    clients.start(); clients.frames(3);

    expect(clients.click(0, 0.41 + 0.16 / 2, 0.315 - 0.035 / 2)).toBe(true);
    clients.frames(2);
    clients.everywhere(() => {
      const game = shell().game;
      setParticipants(game, 1, 2);
      game.characterChoices[0] = Character.blademaster;
      game.characterChoices[1] = Character.beastmaster;
      game.characterReadiness[0] = true; game.characterReadiness[1] = true;
    });
    clients.frames(3);
    for (const [phase, training] of [[Phase.characterMenu, false], [Phase.characterMenu, true], [Phase.stageMenu, false]] as const) {
      clients.everywhere(() => { shell().game.phase = phase; shell().game.training = training; }); clients.frames(2);
      const scene = captureScene(clients.client(0));
      const text = scene.ui.filter(frame => frame.visible && frame.alpha > 0 && frame.text !== "" && frame.rectangle);
      expect(text.length).toBeGreaterThan(10);
      for (const frame of text) {
        const [left, top, right, bottom] = frame.rectangle!;
        expect(left, frame.name).toBeGreaterThanOrEqual(0);
        expect(right, frame.name).toBeLessThanOrEqual(0.8);
        expect(top, frame.name).toBeLessThanOrEqual(0.6);
        expect(bottom, frame.name).toBeGreaterThanOrEqual(0);
        const size = fonts.get(frame.handle.id) ?? 0.009;
        for (const line of frame.text.split("\n")) expect(line.length * size * 0.65, `${frame.name}: ${line}`).toBeLessThanOrEqual(right - left);
        expect(frame.text.split("\n").length * size, frame.name).toBeLessThanOrEqual(top - bottom + 0.000001);
      }
      for (let a = 0; a < text.length; a++) for (let b = a + 1; b < text.length; b++) expect(overlaps(text[a]!, text[b]!), `${text[a]!.name} overlaps ${text[b]!.name}`).toBe(false);
      if (phase === Phase.characterMenu) {
        for (const character of PLAYABLE_CHARACTERS) expect(text.some(frame => frame.name.startsWith("MeleeTileName") && frame.text === fighterName(character))).toBe(true);
        for (const label of ["Player", "CPU", "Empty", "Start (Y)", "Moves", "Controls (F1)"]) expect(text.some(frame => frame.text === label), label).toBe(true);
        if (!training) for (const label of ["Items: Off", "Ultimates: On", "Endless play: Off", "Automatic rematch: Off", "Mode: Versus"]) expect(text.some(frame => frame.text === label), label).toBe(true);
        expect(text.some(frame => frame.text === "MATCH RULES" || frame.text === "HMN")).toBe(false);
        const title = text.find(frame => frame.name.startsWith("MeleeGameTitle"))!;
        const mode = text.find(frame => frame.name.startsWith("MeleeModeLabel"))!;
        expect(title.rectangle![2]).toBeLessThan(0.38);
        expect(mode.rectangle![2]).toBeLessThan(0.38);
        for (const frame of text) {
          const [, top, , bottom] = frame.rectangle!;
          expect(bottom >= 0.49 - 0.000001 || top <= 0.4823, `${frame.name} crosses header bars`).toBe(true);
          expect(bottom >= 0.05 - 0.000001 || top <= 0.0433, `${frame.name} crosses bottom bars`).toBe(true);
          if (frame.name.startsWith("MeleeCpuSummary") || frame.name.startsWith("MeleeName") || frame.name.startsWith("MeleeTag") || frame.text.includes("Opponent settings")) {
            expect(top, frame.name).toBeLessThanOrEqual(0.275);
            expect(bottom, frame.name).toBeGreaterThanOrEqual(0.055);
          }
        }
      } else {
        expect(text.find(frame => frame.text === "Random Stage" && frame.name.includes("TileName"))!.rectangle![1]).toBeLessThan(0.46);

        const card = (name: string) => /^MeleeStageTile(\d+)/.exec(name)?.[1];
        const tiles = scene.ui.filter(frame => frame.visible && /^MeleeStageTile\d+(Panel)?$/.test(frame.name));
        for (const frame of text) for (const tile of tiles) if (!(/^MeleeStageTile\d+Name$/.test(frame.name) && card(frame.name) === card(tile.name))) expect(overlaps(frame, tile), `${frame.name} overlaps ${tile.name}`).toBe(false);
      }
      const output = process.env.SELECT_CAPTURE_DIR;
      if (output && width === 1620 && !training) { mkdirSync(output, { recursive: true }); await Bun.write(join(output, `${phase === Phase.characterMenu ? "fighters" : "stages"}.json`), JSON.stringify({ scene, fonts: Object.fromEntries(fonts), width, height: 1080 })); }
    }
    expect(clients.client(0).errors).toEqual([]);
  } finally { runtime.restore(); }
});
