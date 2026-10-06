import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Key } from "../src/platform/shell/keyEvents";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { AttackStyle, GrabAction } from "../src/game/sim/codes";
import { resolveGrabs } from "../src/game/sim/grabs";
import { GRAB_HOLD_FRAMES, PUMMEL_CONTACT_FRAME, attackStartupFrames } from "../src/game/sim/moves";
import { fighterAt } from "../src/game/sim/roster";
import { ESCAPE_METER_SEGMENT_FRAMES } from "../src/game/presentation/escapeMeter";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

function grab(clients: ReturnType<typeof headless.clients>): void {
  for (const client of clients.clients) {
    client.run(() => {
      const { world } = shell();
      const owner = fighterAt(world, 0);
      const target = fighterAt(world, 1);
      owner.facing = 1;
      target.facing = -1;
      target.motion.x = owner.motion.x + 50.0;
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
      resolveAttacks(world);
      resolveGrabs(world);
      expect(target.grab.owner).toBe(0);
    });
  }
}

/** Each frame, both clients' meters against the simulation; one `held:remaining:pummel` entry per client and frame held. */
function watch(clients: ReturnType<typeof headless.clients>, frames: number, press?: number): string[] {
  const seen: string[] = [];
  for (let frame = 0; frame < frames; frame++) {
    if (frame === press) clients.press(0, Key.n);
    clients.frames(1);
    for (const client of clients.clients) {
      let remaining = 0;
      let pummel = -1;
      client.run(() => {
        const { world } = shell();
        const target = fighterAt(world, 1);
        const owner = fighterAt(world, 0);
        const holding = target.grab.owner === 0 && (owner.grab.action === GrabAction.hold || owner.grab.action === GrabAction.pummel);
        remaining = holding ? target.grab.grabbedFrames : 0;
        pummel = !holding ? -1 : owner.grab.action === GrabAction.pummel ? owner.grab.frame < PUMMEL_CONTACT_FRAME ? PUMMEL_CONTACT_FRAME - owner.grab.frame : -1 : owner.grab.pummels < 1 ? PUMMEL_CONTACT_FRAME : -1;
      });
      const back = client.frames.named("EscapeMeterBack1", 1120);
      const fill = client.frames.named("EscapeMeterFill1", 1121);
      const mark = client.frames.named(`EscapeMeterMark1`, 1121 + Math.floor(GRAB_HOLD_FRAMES / ESCAPE_METER_SEGMENT_FRAMES));
      expect(back && fill && mark).toBeTruthy();
      if (back === undefined || fill === undefined || mark === undefined) return seen;
      expect(client.frames.shown(fill)).toBe(remaining > 0);
      if (remaining === 0) continue;
      const left = [...back.points.values()][0]!.x - back.width / 2;
      expect(fill.width).toBeCloseTo(Math.max(0.0006, (0.07 * remaining) / GRAB_HOLD_FRAMES), 4);
      expect(client.frames.shown(mark)).toBe(pummel >= 0);
      if (pummel >= 0) expect([...mark.points.values()][0]!.x).toBeCloseTo(left + 0.0015 + (0.07 * Math.min(1, pummel / GRAB_HOLD_FRAMES)), 4);
      seen.push(`${client.slot}:${remaining}:${pummel}`);
    }
  }
  return seen;
}

test("both players see the held fighter's escape meter drain with the simulation's hold and mark the pummel", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(1);
  clients.chat(0, "-dev quick");
  clients.frames(5);
  grab(clients);
  const idle = watch(clients, GRAB_HOLD_FRAMES + 5);
  // Both clients, every held frame, from full to its last frame.
  expect(idle.length).toBe(2 * (GRAB_HOLD_FRAMES - 1));
  clients.frames(30);
  grab(clients);
  const pummelled = watch(clients, GRAB_HOLD_FRAMES + 5, 0);
  // The mark closes on the bar's empty end as the pummel winds up, then goes.
  expect(pummelled.some((entry) => Number(entry.split(":")[2]) > 0 && Number(entry.split(":")[2]) < PUMMEL_CONTACT_FRAME)).toBe(true);
  expect(pummelled.some((entry) => entry.endsWith(":-1"))).toBe(true);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
