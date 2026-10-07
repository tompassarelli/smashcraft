import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { clipFor, attackPose } from "./fighterClips";
import { AttackStyle } from "../sim/codes";
const DOWNWARD_CLIPS: readonly string[] = [
  "Aerial Down", "Aerial Down", "Aerial Down", "Down Air Sword Plunge", "Down Air Boot Stomp", "Drill Down Air",
  "Down Air Frost Press", "Down Air Hammer Drop", "Down Air Claw Dive", "Drill Down Air", "Down Air Four Hooves",
  "Down Air Twin Axe Drop", "Aerial Down",
];
for(const character of SELECTABLE_CHARACTERS){
  const name=DOWNWARD_CLIPS[character]??"missing downward clip";
  test(`${fighterName(character)} down air selects ${name}`,()=>{
    const expected=originalClipNamed(character,name.toLowerCase()),actual=clipFor(character,"downAir");
    assertTrue(expected!==undefined);
    assertEquals(actual.index,expected);
    assertEquals(clipFor(character,attackPose(AttackStyle.downAir) ?? "idle").index,expected);
    assertTrue(actual.index!==clipFor(character,"forwardAir").index);
  });
}
