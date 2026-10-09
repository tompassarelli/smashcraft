import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SpecialCueEffects } from "../src/game/render/specialCueEffects";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { heroDefinition } from "../src/game/sim/heroes/registry";
import { HERO_CUES, MISSING_CUE_MODEL, heroCueWindows } from "../src/game/presentation/specialCues";
import { pollModelFailures, startModelFailures } from "wisp/src/platform/modelFailures";
import { modelFailureFile, modelFailureRequestFile } from "wisp/src/runtime/gameFiles";
import { configureRuntime } from "wisp/src/runtime/config";

test("a missing Chen flame model shows a debug marker and fighter/cue/path error without local handle births [spec #365]", () => {
  const cue = HERO_CUES[Character.chen]?.neutral.active;
  const move = heroDefinition(Character.chen)?.specials?.neutral.ground;
  if (cue === undefined || move === undefined) throw new Error("missing Chen cue");
  const original = cue.model;
  const missing = "war3mapImported\\ForcedMissingChenFlame365.mdx";
  Object.assign(cue, { model: missing });
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0, 1]);
    const births: number[] = [];
    for (const client of clients.clients) client.run(() => {
      configureRuntime({ filePrefix: "smashcraft", globalPrefix: "__smashcraft", readyPrefix: "SC_HRR" });
      startModelFailures();
      const token = client.files.get(modelFailureRequestFile(client.slot, "smashcraft"))?.[0];
      if (token === undefined) throw new Error("missing failure request");
      const fighter = createFighter(Character.chen, 0, 1);
      fighter.special.action = SpecialAction.heroNeutral;
      fighter.special.frame = heroCueWindows(move).active.first;
      const renderer = new SpecialCueEffects(Character.chen, { x: 0, y: 0, z: 0 });
      renderer.confirm(fighter, true, 0);
      renderer.present(fighter, true, false);
      births.push(client.log.filter(call => call.name === "AddSpecialEffect").length);
      expect(client.effectPoses().find(pose => pose.model === MISSING_CUE_MODEL)?.scale).toBe(0);
      const begin = client.log.length;
      if (client.slot === 0) client.published.set(modelFailureFile(token, 1, "smashcraft"), [missing.split("\\").join("/")]);
      for (let tick = 0; tick < 32; tick++) pollModelFailures();
      renderer.present(fighter, true, false);
      renderer.present(fighter, true, false);
      const shown = client.effectPoses().filter(pose => pose.scale > 0 && pose.alpha > 0);
      expect(shown.some(pose => pose.model === MISSING_CUE_MODEL)).toBe(client.slot === 0);
      expect(shown.some(pose => pose.model === missing)).toBe(client.slot !== 0);
      expect(client.log.slice(begin).filter(call => call.name === "AddSpecialEffect" || call.name === "DestroyEffect")).toHaveLength(0);
      const errors = client.log.slice(begin).filter(call => call.name === "DisplayTimedTextToPlayer");
      expect(errors).toHaveLength(client.slot === 0 ? 1 : 0);
      if (client.slot === 0) {
        expect(errors[0]?.args[4]).toContain("Chen Stormstout / Breath of Fire active");
        expect(errors[0]?.args[4]).toContain(missing);
      }
      renderer.destroy();
    });
    expect(births[0]).toBe(births[1]);
  } finally {
    Object.assign(cue, { model: original });
    runtime.restore();
  }
});




test("Definitive Popcorn cues start on confirmed casts, run without clock controls and survive their first spawn; Classic cues skip the stock lead-in on their visible sequence [spec #144]", () => {
  const runtime = installHeadless({ ...SMASHCRAFT_HEADLESS, natives: client => ({
    ...SMASHCRAFT_HEADLESS.natives?.(client),
    GetLocalizedString: (key: string) => key === "SMASHCRAFT_CUE_GRAPHICS" ? client.slot === 0 ? "classic" : "definitive" : key,
  }) });
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0, 1]);
    clients.start();
    const move = heroDefinition(Character.lichKing)?.specials?.down.ground;
    const defile = HERO_CUES[Character.lichKing]?.down;
    if (move === undefined || defile === undefined) throw new Error("missing Defile");
    const handles: unknown[][] = [];
    for (const client of clients.clients) client.run(() => {
      const renderer = new SpecialCueEffects(Character.lichKing, { x: 0, y: 0, z: 0 });
      const fighter = createFighter(Character.lichKing, 0, 1);
      const begin = client.log.length;
      const cast = (frame: number, now: number) => {
        fighter.special.action = SpecialAction.heroDown;
        fighter.special.frame = frame;
        renderer.confirm(fighter, true, now);
        renderer.present(fighter, true, false);
        renderer.present(fighter, true, true);
        renderer.setPaused(true);
        renderer.setPaused(false);
      };

      cast(1, 0);
      cast(heroCueWindows(move).active.first, 0.2);
      const births = client.log.slice(begin).filter(call => call.name === "AddSpecialEffect");
      expect(births).toHaveLength(2);
      const ids = client.effectPoses().filter(pose => pose.model.includes("DarkRitualCaster") || pose.model.includes("DeathAndDecayTarget")).map(pose => pose.handle);
      handles.push(ids);
      const clocks = client.log.slice(begin).filter(call => ids.includes(call.args[0]) && ["BlzSetSpecialEffectTime", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectAnimation"].includes(call.name));
      if (client.slot === 1) expect(clocks).toHaveLength(0);
      else {
        const { startup, active } = defile;
        expect(clocks.filter(call => call.name === "BlzSetSpecialEffectTime").map(call => call.args[1])).toEqual([startup.seconds, startup.seconds, active.seconds, active.seconds]);
        for (const cue of [startup, active]) expect(client.effectPoses().find(pose => pose.model === cue.model)?.animation?.toLowerCase()).toBe(cue.sequence);
      }

      fighter.special.frame = 1;
      renderer.present(fighter, true, false);
      expect(client.log.slice(begin).filter(call => call.name === "AddSpecialEffect")).toHaveLength(2);
      fighter.special.action = SpecialAction.none;
      renderer.confirm(fighter, true, 0.99);
      expect(client.log.slice(begin).filter(call => call.name === "DestroyEffect")).toHaveLength(0);
      renderer.confirm(fighter, true, 1);
      expect(client.log.slice(begin).filter(call => call.name === "DestroyEffect").map(call => call.args[0])).toEqual([ids[0]]);
      renderer.confirm(fighter, true, 1.21);
      expect(client.log.slice(begin).filter(call => call.name === "DestroyEffect").map(call => call.args[0])).toEqual(ids);
      renderer.destroy();
    });
    expect(handles[0]).toEqual(handles[1]);
  } finally { runtime.restore(); }
});
