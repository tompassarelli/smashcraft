








import { lineTokens, parseRecord, recordTokens, tokenLines } from "wisp/src/runtime/recordText";
import { type AttackBuffer, clearAttackBuffer, copyAttackBuffer } from "../src/game/input/attackBuffer";
import { createBotMemory } from "../src/game/match/botPerception";
import { scheduleMatchItems } from "../src/game/match/centreItem";
import { type FrameControls, createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { scheduleMeterDrops } from "../src/game/match/meterDrops";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { produceComputerInput } from "../src/game/match/botPlay";
import { Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { KEYED_BY_ACTION, savedState, savedView } from "../src/game/replay/moment";
import { type ReplayState, captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { Character } from "../src/game/sim/codes";
import { canStartAttack } from "../src/game/sim/conditions";
import { createFighter } from "../src/game/sim/fighter";
import { type Controls, copyControls, createRoster, fighterAt } from "../src/game/sim/roster";
import type { ComboSetup } from "../src/game/match/comboRoute";
import { Sim } from "./comboExplorer";

export const FIXTURE = new URL("../test/fixtures/combo-explorer-follow-up.txt", import.meta.url);

export interface FollowUpFixture {
  readonly seed: number;
  readonly setup: ComboSetup;

  readonly rootFrame: number;
  readonly state: ReplayState;

  readonly frames: readonly { readonly inputs: readonly Controls[]; readonly commands: readonly AttackBuffer[] }[];

  readonly actual: number;
}

const SETUP: ComboSetup = { stage: 0, attacker: Character.blademaster, defender: Character.rifleman, attackerX: 0.0, defenderX: 0.0, facing: 1, attackerZ: 0.0, defenderZ: 0.0, percent: 0.0 };


function record(seed: number): string[] | undefined {
  const game = createMatchState();
  setParticipants(game, 0, 3);
  game.characterChoices[0] = SETUP.attacker;
  game.characterChoices[1] = SETUP.defender;
  game.phase = Phase.match;
  game.stageChoice = SETUP.stage;
  game.timeLimitMinutes = 0;
  game.matchSeed = seed;
  for (const slot of [0, 1] as const) {
    game.cpuOpponents[slot] = "wren";
    game.cpuResolvedOpponents[slot] = "wren";
    game.cpuTiers[slot] = "expert";
  }
  scheduleMatchItems(game);
  scheduleMeterDrops(game);
  const world = createRoster(3, [createFighter(SETUP.attacker, matchSpawnX(0), 1), createFighter(SETUP.defender, matchSpawnX(1), -1)]);
  initializeMatchFighters(game, world);
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const snapshot = createReplaySnapshot();
  const attacker = fighterAt(world, 0);
  const defender = fighterAt(world, 1);
  let root: { frame: number; damage: number; hits: number; stocks: number; serial: number; lines: string[] } | undefined;
  const frames: { inputs: Controls[]; commands: AttackBuffer[] }[] = [];
  for (let n = 1; n <= 1800; n++) {
    const beforeLag = defender.launch.hitlag;
    for (const slot of [0, 1] as const) {
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(game, world, runtime, slot, n, produced.inputs[slot], produced.commands[slot]);
    }
    if (root !== undefined) frames.push(copied(produced));
    if (!captureFrame(row, n, world.mask, produced, runtime) || !executeMatchFrame(row, game, world, controls, runtime, n)) throw new Error(`frame ${n} did not run`);
    if (root !== undefined && (canStartAttack(defender, true) || defender.status.stocks !== root.stocks)) root = undefined;
    if (root !== undefined && defender.visuals.hit > root.hits && defender.status.damage > root.damage && attacker.attack.serial !== root.serial) {

      const setup = { ...SETUP, percent: root.damage };
      const actual = defender.status.damage - root.damage;
      if (idleDamage(setup, snapshot) >= actual) {
        root = undefined;
        continue;
      }
      const tokens = recordTokens({ seed, setup, rootFrame: root.frame, frames, actual }, KEYED_BY_ACTION);
      if (tokens === undefined) throw new Error("the recorded frames have no record text");
      return [...tokenLines(tokens, 200).map(line => `play ${line}`), ...root.lines];
    }
    if (beforeLag > 0 && defender.launch.hitlag === 0 && defender.launch.hitstun > 0 && root === undefined) {
      captureReplaySnapshot(snapshot, world, game, controls, runtime);

      const view = savedView(snapshot);
      const state = recordTokens({ ...view, runtime: { ...view.runtime, botMemory: createBotMemory() } }, KEYED_BY_ACTION);
      if (state === undefined) throw new Error("the saved state has no record text");
      root = { frame: n, damage: defender.status.damage, hits: defender.visuals.hit, stocks: defender.status.stocks, serial: attacker.attack.serial, lines: tokenLines(state, 200).map(line => `state ${line}`) };
      frames.length = 0;
    }
  }
  return undefined;
}


export function idleDamage(setup: ComboSetup, state: Readonly<ReplayState>): number {
  const sim = new Sim(setup, state);
  const start = sim.b.status.damage;
  for (let n = 0; n < 300 && !canStartAttack(sim.b); n++) sim.step(0, 0);
  return sim.b.status.damage - start;
}

function copied(source: Readonly<FrameControls>): { inputs: Controls[]; commands: AttackBuffer[] } {
  const target = createFrameControls();
  for (const slot of [0, 1] as const) {
    copyControls(target.inputs[slot], source.inputs[slot]);
    copyAttackBuffer(target.commands[slot], source.commands[slot]);
  }
  return { inputs: [target.inputs[0], target.inputs[1]], commands: [target.commands[0], target.commands[1]] };
}

export function parseFollowUpFixture(text: string): FollowUpFixture {
  const play: string[] = [];
  const state: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("play ")) play.push(line.substring(5));
    else if (line.startsWith("state ")) state.push(line.substring(6));
  }
  const recorded = parseRecord(lineTokens(play));
  const saved = parseRecord(lineTokens(state));
  const restored = saved === undefined ? undefined : savedState(saved);
  if (recorded === undefined || restored === undefined) throw new Error("the follow-up fixture is malformed");
  const { seed, setup, rootFrame, frames, actual } = recorded;
  if (typeof seed !== "number" || !isSetup(setup) || typeof rootFrame !== "number" || !isRecord(frames) || typeof actual !== "number") throw new Error("the follow-up fixture is malformed");
  const played = Object.values(frames).map((frame) => {
    const inputs = isRecord(frame) && isRecord(frame.inputs) ? Object.values(frame.inputs).filter(isControls) : [];
    const commands = isRecord(frame) && isRecord(frame.commands) ? Object.values(frame.commands).filter(isAttackBuffer) : [];
    if (inputs.length !== 2 || commands.length !== 2) throw new Error("a recorded frame is malformed");
    return { inputs, commands };
  });
  return { seed, setup, rootFrame, frames: played, actual, state: restored };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isSetup = (value: unknown): value is ComboSetup =>
  isRecord(value) && ["stage", "attacker", "defender", "attackerX", "defenderX", "facing", "attackerZ", "defenderZ", "percent"].every((field) => typeof value[field] === "number");
const isControls = (value: unknown): value is Controls => isRecord(value) && typeof value.direction === "number" && typeof value.diStickValid === "boolean";
const isAttackBuffer = (value: unknown): value is AttackBuffer => isRecord(value) && typeof value.graceFrames === "number" && isRecord(value.queued);

if (import.meta.main) {
  const first = Number(process.argv[2] ?? 1);
  for (let seed = first; seed < first + 100; seed++) {
    const lines = record(seed);
    if (lines === undefined) continue;
    await Bun.write(FIXTURE, `${lines.join("\n")}\n`);
    console.log(`seed ${seed}: wrote ${FIXTURE.pathname}`);
    break;
  }
}
