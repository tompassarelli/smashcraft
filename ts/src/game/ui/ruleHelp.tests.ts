import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { createMatchState } from "../match/rules";
import { RULE_BUTTONS } from "./ruleButtons";
import { type RuleName, hoveredRule, ruleHelp, visibleRuleGroups } from "./ruleHelp";

test("every selection-screen option in every mode names itself and says what it does when pointed at [invariant]", () => {
  for (const mode of ["versus", "items", "training", "classic", "lore"]) {
    const game = createMatchState();
    game.items.on = mode === "items";
    game.training = mode === "training";
    game.classic = mode === "classic";
    game.lore = mode === "lore";
    const groups = visibleRuleGroups(game);
    let seen = 0;
    for (const name of Object.keys(RULE_BUTTONS) as RuleName[]) {
      const box = RULE_BUTTONS[name];
      if (hoveredRule(groups, box.x + box.width / 2, box.y - box.height / 2) !== name) continue;
      seen++;
      const help = ruleHelp(name, game);
      assertTrue(/^[A-Z][\w ]+: .{20,}/.test(help), `${mode} ${name}: ${help}`);
    }
    assertEquals(seen, mode === "versus" ? 9 : mode === "items" ? 11 : mode === "training" ? 11 : 3, mode);
  }
});
