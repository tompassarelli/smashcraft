import { expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SpecialCueEffects } from "../src/game/render/specialCueEffects";
import { Character, SpecialAction } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { heroDefinition } from "../src/game/sim/heroes/registry";
import { heroCueWindows } from "../src/game/presentation/specialCues";
import { ProjectilePresentation } from "../src/game/render/projectilePresentation";
import { heroProjectileArt } from "../src/game/presentation/projectileArt";
import { mutableProjectile } from "../src/game/sim/fighterProjectiles";
import { ProjectileKind } from "../src/game/sim/codes";

// Classic model sequences, extracted from Warcraft 3.0.1 on 8 Oct.
// Defend's first sequence is Nothing; Clap's is nothing; the other burst
// effects here have Birth but no Stand. The native judge saw none in #144.
test("short specials select the stock spell's visible sequence on their first shown frame [repro #144]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    client.run(() => {
      for (const [character, slot, phase, animation] of [
        [Character.mountainKing, "side", "startup", "birth"],
        [Character.mountainKing, "down", "active", "stand"],
        [Character.warden, "down", "active", "birth"],
        [Character.lich, "down", "active", "birth"],
        [Character.dreadlord, "down", "active", "birth"],
        [Character.lichKing, "up", "active", "birth"],
        [Character.pitLord, "down", "active", "birth"],
      ] as const) {
        const fighter = createFighter(character, 0.0, 1);
        const move = heroDefinition(character)?.specials?.[slot].ground;
        if (move === undefined) throw new Error("missing move");
        fighter.special.action = slot === "side" ? SpecialAction.heroSide : slot === "up" ? SpecialAction.heroUp : SpecialAction.heroDown;
        fighter.special.frame = phase === "startup" ? 1 : heroCueWindows(move).active.first;
        const renderer = new SpecialCueEffects(character, { x: 0.0, y: 0.0, z: 0.0 });
        renderer.present(fighter, true, false);
        const shown = client.effectPoses().filter(effect => effect.scale > 0 && effect.alpha > 0);
        expect(shown.some(effect => effect.animation?.toLowerCase() === animation)).toBe(true);
        renderer.destroy();
      }
    });
  } finally { runtime.restore(); }
});

test("frost, quill and glaive missiles enter their flying sequence without the extra frost shrink [repro #144]", () => {
  const runtime = installHeadless(SMASHCRAFT_HEADLESS);
  try {
    const clients = runtime.clients({ install() {}, start() {} }, [0]);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    client.run(() => {
      for (const [character, fragment] of [[Character.lich, "FrostBoltMissile"], [Character.beastmaster, "QuillSprayMissile"], [Character.shadowHunter, "ShadowHunterMissile"]] as const) {
        const fighter = createFighter(character, 0.0, 1);
        const kit = heroDefinition(character)?.specials;
        const spec = kit === undefined ? undefined : heroProjectileArt(kit).find(({ spec }) => spec.model?.includes(fragment))?.spec;
        if (spec === undefined) throw new Error(`missing ${fragment}`);
        const projectile = mutableProjectile(fighter, 0);
        projectile.kind = ProjectileKind.hero;
        projectile.spec = spec;
        projectile.life = spec.life;
        projectile.serial = 1;
        projectile.velocityX = spec.velocityX;
        const renderer = new ProjectilePresentation(character, { x: 0.0, y: 0.0, z: 0.0 });
        renderer.present(fighter, true, false);
        const missile = client.effectPoses().find(effect => effect.model.includes(fragment) && effect.scale > 0);
        expect(missile?.animation).toBe("stand");
        expect(missile?.scale).toBeGreaterThanOrEqual(1);
        renderer.destroy();
      }
    });
  } finally { runtime.restore(); }
});
