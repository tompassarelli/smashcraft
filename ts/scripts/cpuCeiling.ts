import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { cpuSkill } from "../src/game/match/cpuSkill";
import { ceilingSkill, type CeilingMode } from "../src/game/match/cpuCeilingProfiles";
import { CPU_OPPONENT_IDS } from "../src/game/match/cpuProfiles";
import { SELECTABLE_CHARACTERS, fighterSlug, selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { CEILING_SPEC } from "./balance";
import { ceilingTable, readCeilingPlans, type CeilingRow } from "./ceiling";
import { FIELD_STAGES, playCpuField, playCpuMatch } from "./cpuField";
import { runAdmitted } from "./heavyCapacity";

const Count = Schema.Struct({ wins: Schema.Number, losses: Schema.Number, ties: Schema.Number, played: Schema.Number });
const Data = Schema.Struct({ cpuSeconds: Schema.Number, counts: Schema.Record(Schema.String, Count), pairs: Schema.Record(Schema.String, Schema.Number) });
interface Data { cpuSeconds: number; counts: Record<string, { wins: number; losses: number; ties: number; played: number }>; pairs: Record<string,number> }
const RecordInput = Schema.Struct({ records: Schema.Array(Schema.Struct({ fighters: Schema.Array(Schema.String), winner: Schema.NullOr(Schema.Number), opponents: Schema.Array(Schema.String), tiers: Schema.Array(Schema.String), skillOverrides: Schema.optional(Schema.Unknown) })) });
class CeilingFailure extends Schema.TaggedError<CeilingFailure>()("CeilingFailure", { problem: Schema.String }) {}
const getData = (file: string) => Schema.decodeUnknownSync(Data)(JSON.parse(readFileSync(file,"utf8")));
const fresh = (): Data => ({cpuSeconds:0,counts:{},pairs:{}});
const countMatch = (data: Data, kind: string, fighter: string, opponent: string, won: boolean, lost: boolean) => {
  const key = `${kind}/${fighter}`;
  const c = data.counts[key] ?? {wins:0,losses:0,ties:0,played:0};
  data.counts[key] = {wins:c.wins+Number(won),losses:c.losses+Number(lost),ties:c.ties+Number(!won&&!lost),played:c.played+1};
  const pair = `${kind}/${fighter}/${opponent}`;
  data.pairs[pair] = (data.pairs[pair] ?? 0)+1;
};
const add = (data: Data, records: readonly { readonly fighters: readonly string[]; readonly winner: number|null }[], kind: string, slot?: 0|1) => {
  for (const r of records) for (const side of [0,1] as const) {
    if (slot !== undefined && side !== slot) continue;
    const fighter = r.fighters[side], opponent = r.fighters[1-side];
    if (fighter === undefined || opponent === undefined) throw new Error("Incomplete match record");
    countMatch(data,kind,fighter,opponent,r.winner===side,r.winner!==null&&r.winner!==side);
  }
};
const rate = (data: Data, key: string) => {const c=data.counts[key];return c===undefined||c.wins+c.losses===0?NaN:c.wins/(c.wins+c.losses);};
export function ceilingRows(data: Data): CeilingRow[] {
  const plans = readCeilingPlans();
  const slugs=SELECTABLE_CHARACTERS.map(fighterSlug);
  return slugs.map(fighter => {
    const plan=plans.get(fighter); if(plan===undefined)throw new Error(`${fighter}: no ceiling plan`);
    const kinds=[...CPU_OPPONENT_IDS,"execution","judgment","ceiling-expert","advanced","ceiling-field"];
    const complete=kinds.every(kind=>slugs.filter(s=>s!==fighter).every(opponent=>(data.pairs[`${kind}/${fighter}/${opponent}`]??0)>=(kind==="wren"?CEILING_SPEC.wrenPerPair:CPU_OPPONENT_IDS.some(id=>id===kind)?CEILING_SPEC.panelPerPair:kind==="ceiling-field"?CEILING_SPEC.finalPerPair:CEILING_SPEC.finalPerPair)))
      && (data.counts[`depth/${fighter}`]?.played??0)>=CEILING_SPEC.depthMatches;
    const panel = { rook: rate(data,`rook/${fighter}`), ember: rate(data,`ember/${fighter}`), flint: rate(data,`flint/${fighter}`), vale: rate(data,`vale/${fighter}`), kite: rate(data,`kite/${fighter}`), wren: rate(data,`wren/${fighter}`) };
    return {fighter,path:plan.path,panel,
      expertVsBasic:rate(data,`depth/${fighter}`),expert:rate(data,`wren/${fighter}`),execution:rate(data,`execution/${fighter}`),judgment:rate(data,`judgment/${fighter}`),
      ceilingVsExpert:rate(data,`ceiling-expert/${fighter}`),advancedVsExpert:rate(data,`advanced/${fighter}`),ceilingVsCeiling:rate(data,`ceiling-field/${fighter}`),complete};
  });
}

if (import.meta.main) await Effect.runPromise(Effect.gen(function*() {
  const {values}=yield* Effect.try({try:()=>parseArgs({args:process.argv.slice(2),options:{pairs:{type:"string"},json:{type:"string"},merge:{type:"string"},baseline:{type:"string"},report:{type:"string"},depth:{type:"string"}}}),catch:cause=>new CeilingFailure({problem:String(cause)})});
  const data=fresh();
  const merge = values.merge;
  if(merge!==undefined){
    yield* Effect.try({try:()=>{
      for(const file of merge.split(",")) {const shard=getData(file);data.cpuSeconds+=shard.cpuSeconds;
        for(const [key,c] of Object.entries(shard.counts)){const before=data.counts[key]??{wins:0,losses:0,ties:0,played:0};data.counts[key]={wins:before.wins+c.wins,losses:before.losses+c.losses,ties:before.ties+c.ties,played:before.played+c.played};}
        for(const [key,n] of Object.entries(shard.pairs))data.pairs[key]=(data.pairs[key]??0)+n;
      }
      if(values.baseline===undefined)throw new Error("--merge needs the frozen Wren --baseline field");
      const baseline=Schema.decodeUnknownSync(RecordInput)(JSON.parse(readFileSync(values.baseline,"utf8")));
      if(!baseline.records.every(r=>r.opponents.length===2&&r.opponents.every(id=>id==="wren")&&r.tiers.length===2&&r.tiers.every(tier=>tier==="expert")&&r.skillOverrides===undefined))throw new Error("Baseline must be unmodified Wren Expert on both sides");
      add(data,baseline.records,"wren");
      const table=ceilingTable(ceilingRows(data),data.cpuSeconds);console.log(table);if(values.report!==undefined)writeFileSync(values.report,table+"\n");
    },catch:cause=>new CeilingFailure({problem:String(cause)})});
  } else {
    yield* Effect.promise(()=>runAdmitted("moderate","smashcraft:cpuCeiling",3600));
    yield* Effect.try({try:()=>{
      const before=process.cpuUsage();
      const plans=readCeilingPlans();
      const named=(slug:string)=>{const c=selectableCharacterBySlug(slug);if(c===undefined)throw Error(`Unknown fighter ${slug}`);return c;};
      const pairs=(values.pairs??"").split(",").filter(Boolean).map(pair=>{const [a,b]=pair.split(":");if(a===undefined||b===undefined)throw Error(pair);return [named(a),named(b)] as const;});
      for(const pair of pairs){
        for(const id of CPU_OPPONENT_IDS.filter(id=>id!=="wren"))add(data,playCpuField({pairs:[pair],opponents:[id,id],perPair:CEILING_SPEC.panelPerPair,seeds:100}),id);
        const expert=cpuSkill("wren","expert");
        const modes: readonly [string,CeilingMode][]=[["execution","execution"],["judgment","judgment"],["ceiling-expert","ceiling"],["advanced","expert"]];
        for(const [kind,mode] of modes)for(const slot of [0,1] as const){
          const skill=kind==="advanced"?cpuSkill("wren","advanced"):ceilingSkill(expert,mode);
          const records=playCpuField({pairs:[pair],skills:slot===0?[skill,undefined]:[undefined,skill],perPair:CEILING_SPEC.finalPerPair,seeds:100});
          add(data,records,kind,slot);
        }
        const ceiling=ceilingSkill(expert,"ceiling");add(data,playCpuField({pairs:[pair],skills:[ceiling,ceiling],perPair:CEILING_SPEC.finalPerPair,seeds:100}),"ceiling-field");
        console.error(`Measured ${pair.map(fighterSlug).join(":")}`);
      }
      for(const slug of (values.depth??"").split(",").filter(Boolean)){
        const c=named(slug),plan=plans.get(slug);if(plan===undefined)throw Error(slug);
        const basic=ceilingSkill(cpuSkill("wren","expert"),"basic",plan.basicMoves);
        const stages=Object.keys(FIELD_STAGES);
        for(let trial=0;trial<CEILING_SPEC.depthMatches;trial++){
          const slot=trial%2===0?0:1;
          const stage=stages[Math.floor(trial/2)%stages.length];
          if(stage===undefined)throw Error("No ceiling stages");
          const record=playCpuMatch(c,c,stage,0,{skills:slot===0?[undefined,basic]:[basic,undefined]},trial);
          if(record===undefined)throw Error(`${slug}: refused mirror ${trial}`);
          add(data,[record],"depth",slot);
        }
      }
      const cpu=process.cpuUsage(before);data.cpuSeconds=(cpu.user+cpu.system)/1e6;
    },catch:cause=>new CeilingFailure({problem:String(cause)})});
  }
  const destination=values.json;
  if(destination!==undefined)yield* Effect.try({try:()=>writeFileSync(destination,JSON.stringify(data)+"\n"),catch:cause=>new CeilingFailure({problem:String(cause)})});
}));
