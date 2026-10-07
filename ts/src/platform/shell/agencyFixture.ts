import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase, stageClock } from "../../game/match/rules";
import { Character } from "../../game/sim/codes";
import { fighterAt, isActive } from "../../game/sim/roster";
import { startMatch } from "./matchStart";
import type { ShellState } from "./state";
import { views } from "./ui";
import { pauseMatchPresentation, renderPersistentPresentation } from "./view";
import { writeLines } from "wisp/src/platform/fileio";

/** Paused native samples use real state gates; thaw runs for the control-return capture. */
export function startAgencyFixture(s: ShellState, message: string): string | undefined {
  const words = message.split(" ");
  if (words.length !== 4 || words[0] !== "-dev" || words[1] !== "agency") return undefined;
  const character = words[2] === "archer" ? Character.archer
    : words[2] === "rifleman" ? Character.rifleman
    : words[2] === "illidan" ? Character.demonHunter : undefined;
  const scenario = words[3] === "none" ? "agency-none" : words[3] === "di" ? "agency-di"
    : words[3] === "act" ? "agency-act" : words[3] === "thaw" ? "agency-thaw" : undefined;
  if (character === undefined || scenario === undefined) return "dev: agency needs archer, rifleman or illidan, then none, di, act or thaw";
  if (s.game.phase !== Phase.match) return "dev: start a quick match before agency";
  for (const slot of PARTICIPANT_SLOTS) s.game.characterChoices[slot] = character;
  startMatch(s, scenario);
  s.session.paused = scenario !== "agency-thaw";
  pauseMatchPresentation(s, s.session.paused);
  renderPersistentPresentation(s);
  const markers: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const renderer = views(s).fighters[slot];
    const fighter = fighterAt(s.world, slot);
    const agency = renderer?.agency.forecast.classify(s.world, slot, s.game.stageChoice, stageClock(s.game), s.controls.commands[slot].graceFrames);
    markers.push(`p${slot}=${agency},ice=${fighter.status.frozenFrames},hitlag=${fighter.launch.hitlag}`);
  }
  const receipt = `dev: agency ${words[2]} ${words[3]} ${s.session.paused ? "paused" : "running"} ${markers.join(" ")}`;
  writeLines(`smashcraft-agency-p${GetPlayerId(GetLocalPlayer())}.txt`, [receipt]);
  return receipt;
}
