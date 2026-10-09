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

const S = CEILING_SPEC;
test("ceiling verdicts reject a row just outside each band: panel, personality, diversity, depth, path, ceiling and headroom [spec #358]",()=>{
  expect(verdict({})).toMatchObject({panel:true,depth:true,path:true,ceiling:true,headroom:true});
  const panel=field()[0]!.panel;
  expect(verdict({panel:{...panel,rook:S.personalityHigh+0.01}}).panel).toBe(false);
  expect(verdict({panel:Object.fromEntries(CPU_OPPONENT_IDS.map(id=>[id,S.panelHigh+0.01])) as CeilingRow["panel"]}).panel).toBe(false);
  expect(ceilingVerdicts(field()).diversity).toBe(true);
  expect(ceilingVerdicts(field().map(r=>({...r,panel:{...r.panel,rook:S.personalityHigh}}))).diversity).toBe(false);
  expect(verdict({expertVsBasic:0.5+S.depthMargin}).depth).toBe(true);
  expect(verdict({expertVsBasic:0.5+S.depthMargin-0.01}).depth).toBe(false);
  expect(verdict({path:"decision"}).path).toBe(false);
  expect(verdict({path:"mixed",judgment:0.5}).path).toBe(false);
  expect(verdict({path:"mixed"}).path).toBe(true);
  expect(verdict({ceilingVsCeiling:S.ceilingHigh+0.01}).ceiling).toBe(false);
  const gain=field()[0]!.ceilingVsExpert-field()[0]!.advancedVsExpert;
  expect(verdict({ceilingVsExpert:field()[0]!.ceilingVsExpert+S.headroomTolerance+0.01}).headroom).toBe(false);
  expect(verdict({ceilingVsExpert:field()[0]!.ceilingVsExpert-gain-0.05}).headroom).toBe(false);
  expect(verdict({complete:false})).toMatchObject({panel:false,depth:false,path:false,ceiling:false,headroom:false});
});
test("all 26 fighters have draft paths and basic plans, and balance.md states the path majority [spec #358]",()=>{
  expect(SELECTABLE_CHARACTERS.map(fighterSlug).filter(slug=>!readCeilingPlans().has(slug))).toEqual([]);
  expect(readFileSync(`${import.meta.dir}/../../docs/design/balance.md`,"utf8")).toContain(`${Math.round(100*S.axisMajority)}% of the positive single-axis gains`);
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
