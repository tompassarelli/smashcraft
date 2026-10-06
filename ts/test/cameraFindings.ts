// Aggregate camera acceptance used by the soak and player-view journeys.
import type { HeadlessClient } from "wisp/src/headless/client";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { cameraPoint } from "../src/game/presentation/arenaCamera";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { shell } from "../src/platform/shell/state";

export class CameraFindings {
  private readonly out = new Map<HeadlessClient, Map<number, boolean>>();
  offscreenFrames = 0;
  stockLosses = 0;

  observe(client: HeadlessClient): { readonly detector: string; readonly text: string }[] {
    const s = shell();
    if (s.game.phase !== Phase.match && s.game.phase !== Phase.result) return [];
    const height = BlzGetLocalClientHeight();
    const aspect = height > 0 ? BlzGetLocalClientWidth() / height : 16 / 9;
    const previous = this.out.get(client) ?? new Map<number, boolean>();
    this.out.set(client, previous);
    const findings: { detector: string; text: string }[] = [];
    const world = s.build.presentation === "pool-predicted" && s.rollback?.active && s.game.phase === Phase.match ? s.rollback.speculative.world : s.world;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(s.world, slot)) continue;
      const confirmed = fighterAt(s.world, slot);
      const before = previous.get(slot) ?? false;
      previous.set(slot, confirmed.status.out);
      if (!before && confirmed.status.out) {
        this.stockLosses++;
        // Check the whole drawn fighter, not just its camera bone: the top
        // of a body below the bottom blast plane must also be out of view.
        const bodyVisible = [0, 60, 150].some((above) => {
          const point = cameraPoint(s.camera, aspect, confirmed.motion.x, confirmed.motion.z + above);
          return point.column >= 0 && point.column <= 1 && point.row >= 0 && point.row <= 0.77;
        });
        if (bodyVisible) findings.push({ detector: "visible-ko", text: `Player ${slot + 1} lost a stock while drawn in the fighting view` });
      }
      const fighter = isActive(world, slot) ? fighterAt(world, slot) : undefined;
      const point = cameraPoint(s.camera, aspect, fighter?.motion.x ?? 0, (fighter?.motion.z ?? 0) + 60);
      const outside = point.column < 0 || point.column > 1 || point.row < 0 || point.row > 1;
      const needsBubble = s.game.phase === Phase.match && fighter !== undefined && !fighter.status.out && outside;
      if (needsBubble) this.offscreenFrames++;
      for (const [name, context] of [[`OffscreenPortrait${slot}`, 920 + slot * 2], [`OffscreenArrow${slot}`, 921 + slot * 2]] as const) {
        const frame = client.frames.named(name, context);
        if (frame === undefined || client.frames.shown(frame) !== needsBubble) findings.push({ detector: "offscreen-bubble", text: `Player ${slot + 1} ${name} ${needsBubble ? "missing outside the view" : "shown inside the view or out of play"}` });
        if (needsBubble && frame !== undefined) {
          const at = frame.points.get(FRAMEPOINT_CENTER);
          if (frame.enabled || at === undefined || at.y - frame.height / 2 < 0.139 || at.y + frame.height / 2 > 0.6 || Math.abs(at.x - 0.4) + frame.width / 2 > aspect * 0.3) findings.push({ detector: "offscreen-bubble", text: `Player ${slot + 1} ${name} outside the safe view or takes input` });
        }
      }
    }
    return findings;
  }
}
