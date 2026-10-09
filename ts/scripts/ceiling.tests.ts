import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CPU_OPPONENT_IDS } from "../src/game/match/cpuProfiles";
import { cpuSkill } from "../src/game/match/cpuSkill";
import { ceilingSkill } from "../src/game/match/cpuCeilingProfiles";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { Character } from "../src/game/sim/codes";
import { CEILING_SPEC } from "./balance";
import { ceilingVerdicts, readCeilingPlans, type CeilingRow } from "./ceiling";
import { playCpuMatch } from "./cpuField";

const field = (): CeilingRow[] => Array.from({length:12},(_,index)=>({fighter:`fighter-${index}`,path:"execution",panel:Object.fromEntries(CPU_OPPONENT_IDS.map((id,k)=>[id,k===index%6?0.51:0.498])) as CeilingRow["panel"],expertVsBasic:0.6,expert:0.5,execution:0.6,judgment:0.52,ceilingVsExpert:0.65,advancedVsExpert:0.45,ceilingVsCeiling:0.5,complete:true}));
const verdict = (patch: Partial<CeilingRow>) => {const rows=field();rows[0]={...rows[0]!,...patch};return ceilingVerdicts(rows).rows[0]!;};

test("panel mean and individual personality bands reject outlying field rows [spec #358]",()=>{
  expect(verdict({}).panel).toBe(true);
  const panel=field()[0]!.panel;
  expect(verdict({panel:{...panel,rook:0.61}}).panel).toBe(false);
  expect(verdict({panel:Object.fromEntries(CPU_OPPONENT_IDS.map(id=>[id,0.56])) as CeilingRow["panel"]}).panel).toBe(false);
});
test("diversity rejects a field with no best fit or one dominant personality [spec #358]",()=>{
  expect(ceilingVerdicts(field()).diversity).toBe(true);
  expect(ceilingVerdicts(field().map(r=>({...r,panel:{...r.panel,rook:0.6}}))).diversity).toBe(false);
});
test("each fighter needs the same expert-over-basic depth margin [spec #358]",()=>{
  expect(verdict({expertVsBasic:0.55}).depth).toBe(true);
  expect(verdict({expertVsBasic:0.54}).depth).toBe(false);
});
test("declared paths reject the wrong gain axis and mixed paths need both [spec #358]",()=>{
  expect(verdict({}).path).toBe(true);
  expect(verdict({path:"decision"}).path).toBe(false);
  expect(verdict({path:"mixed",judgment:0.5}).path).toBe(false);
  expect(verdict({path:"mixed"}).path).toBe(true);
});
test("every fighter needs the ceiling field win band [spec #358]",()=>{
  expect(verdict({ceilingVsCeiling:0.5}).ceiling).toBe(true);
  expect(verdict({ceilingVsCeiling:0.56}).ceiling).toBe(false);
});
test("headroom rejects a fighter too far from the median or with no gain [spec #358]",()=>{
  expect(verdict({}).headroom).toBe(true);
  expect(verdict({ceilingVsExpert:0.76}).headroom).toBe(false);
  expect(verdict({ceilingVsExpert:0.4}).headroom).toBe(false);
  expect(verdict({complete:false})).toMatchObject({panel:false,depth:false,path:false,ceiling:false,headroom:false});
});
test("all 26 fighters have draft paths and basic plans; rule constants match the declared spec [spec #358]",()=>{
  expect(SELECTABLE_CHARACTERS.map(fighterSlug).filter(slug=>!readCeilingPlans().has(slug))).toEqual([]);
  expect(CEILING_SPEC).toEqual({panelLow:0.45,panelHigh:0.55,personalityLow:0.4,personalityHigh:0.6,bestFitMin:1,bestFitMaxShare:0.5,depthMargin:0.05,axisMajority:0.6,mixedGainMin:0,ceilingLow:0.45,ceilingHigh:0.55,headroomTolerance:0.1,wrenPerPair:400,panelPerPair:100,finalPerPair:25,depthMatches:100});
  expect(readFileSync(`${import.meta.dir}/../../docs/design/balance.md`,"utf8")).toContain("60% of the positive single-axis gains");
});
test("basic and ceiling profiles play the production match with the declared move subset [spec #358]",()=>{
  const plan=readCeilingPlans().get("illidan")!;
  const basic=ceilingSkill(cpuSkill("wren","expert"),"basic",plan.basicMoves);
  const ceiling=ceilingSkill(cpuSkill("wren","expert"),"ceiling");
  const row=playCpuMatch(Character.demonHunter,Character.demonHunter,"sky-deck",0,{stocks:1,minutes:1,skills:[ceiling,basic]},358)!;
  expect(row.frames).toBeGreaterThan(1);
  expect(ceiling.executionMistakes).toBe(false);
  expect(ceiling.decision.executionPercent).toBe(100);
  expect(ceiling.decision.judgmentPercent).toBe(100);
  expect(Object.keys(row.sides[1].moves).map(Number).filter(move=>!plan.basicMoves.includes(move)&&move!==32)).toEqual([]);
});
