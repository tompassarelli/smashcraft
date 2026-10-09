import { Character } from "../src/game/sim/codes";
import { SpecialForm, SpecialSlot, specialForm, specialKit } from "../src/game/sim/heroSpecials";
import { SELECTABLE_CHARACTERS, fighterName, heroDefinition } from "../src/game/sim/heroes/registry";
import { fighterKit } from "../src/game/sim/moveNames";
import { upSpecialRoute } from "../src/game/match/recoveryEnvelope";
import { EDGE_GUARD_SCENARIOS, EdgeGuardTool, MIXED_PLANS, OPENING_MIN, edgeGuardTool, guardedReturn, playScenario, recoveryProfile } from "../src/game/match/edgeGuardScenarios";

const PROJECTILE_SPEED_MAX = 30;

function routeControl(character: Character): string {
  if (character === Character.rifleman) return "aimed (8-way, 4 frames), second shot re-aims";
  if (character === Character.demonHunter) return "guided, glide branch";
  const specials = heroDefinition(character)?.specials;
  if (specials === undefined) return "fixed";
  const move = specialForm(specialKit(specials, SpecialSlot.up), SpecialForm.air);
  if (move.aimFrames !== undefined) return `aimed (8-way, ${move.aimFrames} frames)`;
  return "guided";
}

export function recoveryTableMarkdown(): string {
  const lines = [
    "| Fighter | Up special | Startup | Intangible | Top speed | Rise / reach | Route control | Opening | Beaten by | Mixed returns |",
    "|---|---|---:|---:|---:|---:|---|---:|---|---:|",
  ];
  for (const character of SELECTABLE_CHARACTERS) {
    const profile = recoveryProfile(character);
    const route = upSpecialRoute(character, 100);
    const scenario = EDGE_GUARD_SCENARIOS[character];
    if (scenario === undefined) throw new Error(`${fighterName(character)} has no recorded edge-guard`);
    const gimp = playScenario(character, scenario, true);
    const tool = edgeGuardTool(scenario.guarder) === EdgeGuardTool.forwardAir ? "forward air" : "down air";
    const options = [`read ${tool} (${gimp.spiked ? "spike" : "offstage launch"}, KO at 40%)`];
    if (profile.opening >= OPENING_MIN) options.push("reaction aerial");
    if (profile.speed <= PROJECTILE_SPEED_MAX) options.push("projectile");
    let returned = 0;
    for (const guarder of SELECTABLE_CHARACTERS) for (let seed = 0; seed < MIXED_PLANS.length; seed++) if (guardedReturn(character, guarder, seed, "expert").recovered) returned++;
    const name = fighterKit(character).specials[SpecialSlot.up]?.name ?? "";
    const speed = profile.speed > 200 ? `${profile.speed} (teleport)` : `${profile.speed}`;
    lines.push(`| ${fighterName(character)} | ${name} | ${profile.startup} | ${profile.intangible} | ${speed} | ${route.rise} / ${route.reach} | ${routeControl(character)} | ${profile.opening} | ${options.join(", ")} | ${returned}/${SELECTABLE_CHARACTERS.length * MIXED_PLANS.length} |`);
  }
  return lines.join("\n");
}

if (import.meta.main) console.log(recoveryTableMarkdown());
