import type { CpuSkill } from "./cpuSkill";
import { AttackStyle } from "../sim/codes";

export type CeilingMode = "expert" | "basic" | "execution" | "judgment" | "ceiling";


export function ceilingSkill(skill: CpuSkill, mode: CeilingMode, basicMoves: readonly number[] = []): CpuSkill {
  if (mode === "expert") return skill;
  if (mode === "basic") return { ...skill, basicMoves, kitTenths: 0, mixesUp: false, grabsShields: basicMoves.includes(AttackStyle.grab) };
  const execution = mode === "execution" || mode === "ceiling";
  const judgment = mode === "judgment" || mode === "ceiling";
  return {
    ...skill,
    decision: { ...skill.decision,
      executionPercent: execution ? 100 : skill.decision.executionPercent,
      judgmentPercent: judgment ? 100 : skill.decision.judgmentPercent,
      spacingPercent: judgment ? 100 : skill.decision.spacingPercent,
      guessPercent: judgment ? 0 : skill.decision.guessPercent,
      repeatPercent: judgment ? 0 : skill.decision.repeatPercent,
    },
    ...(execution ? { executionMistakes: false, techMiss: 0, kitTenths: 10 } : {}),
    ...(judgment ? { misplay: 0, idle: 0, defendTenths: 10, punishTenths: 10, punishMisjudge: 0 } : {}),
  };
}
