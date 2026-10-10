



import "../../test/host-natives";
import { adaptInput } from "../../src/game/input/adapter";
import { ACTION_COUNT, Action, bit } from "../../src/game/input/actions";
import { type AttackBuffer, attackBuffer } from "../../src/game/input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../../src/game/input/keyboardCapture";
import { actionFor, keyLabel, presetBindings } from "../../src/game/input/keyBindings";
import { TAPE_HEADER, decodeTape } from "../../src/game/replay/tape";
import { type TapeSession, createTapeSession, performTapeOperation } from "../../src/game/replay/tapeRunner";
import { Character } from "../../src/game/sim/codes";
import { type Controls, fighterAt, isActive, neutralControls } from "../../src/game/sim/roster";
import { surfaceShiftX, surfaceShiftZ } from "../../src/game/sim/stage";
import { windPush } from "../../src/game/sim/stageHazards";
import { stageClock } from "../../src/game/match/rules";

const bindings = presetBindings("standard");

const SOURCES = new Map<string, Action>();
for (const key of bindings.keys) {
  const action = actionFor(bindings, key);
  if (key !== 0 && action !== undefined) SOURCES.set(keyLabel(key), action);
}
const STICK_JUMP = "stick-up";
SOURCES.set(STICK_JUMP, Action.jump);

const LEFT = "W", RIGHT = "R", DOWN = "E", UP = "SPACE", JUMP = "I", JUMP_ALT = "8", ATTACK = "N", SPECIAL = "U",
  GRAB = "O", SHIELD_LEFT = "Q", SHIELD_RIGHT = "7", LIGHT_SHIELD = "9", LIGHT_SHIELD_ALT = "T", C_LEFT = "B", C_LEFT_ALT = "/", C_RIGHT = "M", C_UP = "J",
  C_DOWN = "H", WALK = "P", SHORT_HOP = "Z", METER = "X";


const TOWARD = "toward", AWAY = "away";


type Hold = readonly [at: number, frames: number, ...sources: string[]];




type Approach = readonly [at: number, within: number];
const APPROACH_FRAMES = 40;
const WALK_RANGE = 120;

interface MatchScript {
  readonly placement?: string;
  /** Both fighters' super meter right after the start (#382). */
  readonly meter?: number;
  readonly characters: readonly [Character, Character];
  readonly stage: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frames: number;
  readonly holds: readonly [readonly Hold[], readonly Hold[]];
  readonly approaches: readonly [readonly Approach[], readonly Approach[]];

  readonly rollbacks: readonly (readonly [number, number])[];




  readonly predictions?: readonly (readonly [number, number])[];

  readonly computer?: boolean;

  readonly hazardsOff?: boolean;

  readonly exercise?: "pushed" | "carried" | "shieldPush" | "edgeCancel" | "shieldSlide";

  readonly dropPickups?: number;
}


interface EdgeMemory {
  grounded: boolean;
  lag: number;
  guarding: boolean;
}

function exercised(session: TapeSession, exercise: "pushed" | "carried" | "shieldPush" | "edgeCancel" | "shieldSlide", memory: EdgeMemory[]): boolean {
  const { world, match } = session.live;
  const frame = stageClock(match);
  let edge = false;
  for (const slot of [0, 1]) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const { motion } = fighter;
    const before = memory[slot];
    const lag = fighter.landing.lag + fighter.attack.cooldown;
    const guarding = fighter.shield.raised || fighter.shield.stun > 0;
    if (before !== undefined && before.grounded && !motion.grounded) {
      if (exercise === "edgeCancel" && before.lag > 0 && !before.guarding && lag === 0) edge = true;
      if (exercise === "shieldSlide" && before.guarding && fighter.special.fall && !fighter.shield.raised) edge = true;
    }
    memory[slot] = { grounded: motion.grounded, lag, guarding };
    if (exercise === "shieldPush" && fighterAt(world, slot).shield.pushbackX !== 0) return true;
    if (!motion.grounded) continue;
    if (exercise === "pushed" && windPush(match.stageChoice, frame, motion.x, motion.z) !== 0) return true;
    const deck = motion.surface;
    if (exercise === "carried" && deck !== undefined && deck > 0 && (surfaceShiftX(match.stageChoice, deck, frame) !== 0 || surfaceShiftZ(match.stageChoice, deck, frame) !== 0)) return true;
  }
  return edge;
}

const NEUTRAL = Object.entries(neutralControls());

function formatControls(controls: Controls, attacks: AttackBuffer): string {
  const words: string[] = [];
  for (const [index, [field, value]] of Object.entries(controls).entries()) {
    if (value === NEUTRAL[index]?.[1]) continue;
    words.push(`${field}=${typeof value === "boolean" ? (value ? 1 : 0) : value}`);
  }
  const attack = attacks.pending;
  if (attack !== undefined) words.push(`attack=${attack.style},${attack.facing},${attack.frame},${attack.mayCharge ? 1 : 0}`);
  return words.join(" ");
}

function menuLines(script: MatchScript): string[] {
  return [
    `character 0 ${script.characters[0]}`, `character 1 ${script.characters[1]}`, `stocks 0 ${script.stocks}`, `time 0 ${script.minutes}`, "stage-select 0",
    ...(script.stage > 1 ? [`test-stage ${script.stage}`] : [`stage 0 ${script.stage}`]), ...(script.hazardsOff === true ? ["hazards 0 0"] : []), "start 0", ...(script.placement === undefined ? [] : [script.placement]),
    ...(script.meter === undefined ? [] : [`test-meter 0 ${script.meter}`, `test-meter 1 ${script.meter}`]),
  ];
}







function playMatch(script: MatchScript, session: TapeSession, play: (...lines: string[]) => void, pressed: Set<string>[]): void {
  const players = (script.computer === true ? [0] as const : [0, 1] as const).map(slot => ({
    slot, capture: keyboardCapture(), controls: neutralControls(), attacks: attackBuffer(0), held: new Set<string>(),
    approaches: script.approaches[slot].map(([at, within]) => ({ at, within, done: false })), holds: script.holds[slot],
  }));
  const rollbacks = new Map(script.rollbacks.map(([first, last]) => [last, first]));

  const actual: string[][] = [];

  const hold = session.live.match.startHold;
  let moved = false;
  const memory: EdgeMemory[] = [];
  for (let at = 1; at <= hold; at++) play(`frame ${at}`);
  for (let frame = 1; frame <= script.frames; frame++) {
    const at = frame + hold;
    const inputs = players.map(player => {
      const self = fighterAt(session.live.world, player.slot);
      const dx = fighterAt(session.live.world, 1 - player.slot).motion.x - self.motion.x;
      const toward = dx < 0 ? LEFT : RIGHT;
      const resolve = (source: string) => source === TOWARD ? toward : source === AWAY ? (toward === LEFT ? RIGHT : LEFT) : source;
      const held = new Set<string>();
      for (const [at, frames, ...sources] of player.holds) {
        if (frame >= at && frame < at + frames) for (const source of sources) held.add(resolve(source));
      }
      for (const approach of player.approaches) {
        if (approach.done || frame < approach.at) continue;
        if (Math.abs(dx) <= approach.within || frame >= approach.at + APPROACH_FRAMES) approach.done = true;
        else {
          held.add(toward);
          if (Math.abs(dx) <= approach.within + WALK_RANGE) held.add(WALK);
        }
      }
      let mask = 0;
      for (const source of held) {
        const action = SOURCES.get(source);
        if (action === undefined) throw new Error(`unbound source ${source}`);
        mask |= bit(action);
        if (!player.held.has(source)) pressed[player.slot]?.add(source);
      }
      player.held = held;
      sampleKeys(player.capture, mask);
      adaptInput(player.capture.row, self, at, player.controls, player.attacks);
      commitEdges(player.capture);
      return `input ${player.slot} ${formatControls(player.controls, player.attacks)}`.trimEnd();
    });
    const first = rollbacks.get(frame);
    const prediction = script.predictions?.find(([from, to]) => frame >= from && frame <= to);
    if (prediction === undefined) play(...inputs, `frame ${at}`);
    else {
      actual.push(inputs);
      play(...inputs.slice(0, 1), "input 1", `predict ${at}`);
      if (frame === prediction[1]) actual.splice(0).forEach((recorded, index) => play(...recorded, `correct ${prediction[0] + hold + index}`));
    }
    if (first !== undefined) play(`rollback ${first + hold} ${at}`);
    if (script.exercise !== undefined && !moved) moved = exercised(session, script.exercise, memory);
  }
  if (script.exercise !== undefined && !moved) throw new Error(`no fighter was ${script.exercise} by the stage on stage ${script.stage}`);
  const { drops } = session.live.match;
  if (script.dropPickups !== undefined && (drops.spawnSerial < script.dropPickups || drops.pickupSerial < script.dropPickups)) {
    throw new Error(`${drops.spawnSerial} meter drops spawned and ${drops.pickupSerial} taken; the script needs ${script.dropPickups}`);
  }
}


function recordTape(title: string, scripts: readonly MatchScript[], pressed: Set<string>[] = []): string {
  const session = createTapeSession();
  const lines = [TAPE_HEADER, `# ${title}`];
  let replayedCorrections = 0;
  const checkCorrection = (record: string) => {
    const result = record.split(" ", 3)[2];
    if (result === "rejected") throw new Error(`${title}: the history rejected a correction`);
    if (result !== "unchanged") replayedCorrections++;
  };
  const play = (...added: string[]) => {
    const decoded = decodeTape([TAPE_HEADER, ...added].join("\n"));
    if (!decoded.ok) throw new Error(`generated "${added[decoded.line - 2]}": ${decoded.message}`);
    for (const operation of decoded.value) {
      const refused = performTapeOperation(session, operation, operation.kind === "correct" ? checkCorrection : undefined);
      if (refused !== undefined) throw new Error(`${title}: ${refused}`);
    }
    lines.push(...added);
  };
  play(scripts.some(script => script.computer === true) ? "participants 1 2" : "participants 3 0");
  scripts.forEach((script, index) => {
    if (index > 0) play("rematch 0", "rematch 1");
    play(...menuLines(script));
    playMatch(script, session, play, pressed);
  });
  if (scripts.some(script => (script.predictions?.length ?? 0) > 0) && replayedCorrections === 0) throw new Error(`${title}: no correction changed a prediction`);
  return [...lines, ""].join("\n");
}

const every = (from: number, to: number, stride: number, length: number) => {
  const windows: [number, number][] = [];
  for (let last = from; last <= to; last += stride) windows.push([last - length + 1, last]);
  return windows;
};


const ACTIONS: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 410,
  holds: [[
    [1, 20, SHORT_HOP],
    [30, 2, ATTACK], [40, 10, DOWN], [42, 2, ATTACK], [70, 6, WALK, TOWARD], [72, 2, ATTACK], [86, 4, UP],
    [87, 2, ATTACK], [100, 3, JUMP], [106, 2, ATTACK], [130, 14, JUMP_ALT], [134, 16, STICK_JUMP], [140, 2, ATTACK],
    [144, 2, DOWN], [165, 2, SPECIAL], [190, 2, GRAB], [200, 2, TOWARD], [215, 8, TOWARD], [217, 2, SPECIAL],
    [235, 20, SHIELD_LEFT], [241, 2, AWAY], [270, 12, SHIELD_RIGHT], [274, 2, DOWN], [290, 3, JUMP], [296, 6, UP],
    [298, 2, SHIELD_RIGHT], [315, 2, C_LEFT], [328, 2, C_RIGHT], [340, 2, C_LEFT_ALT], [352, 2, C_UP],
    [364, 2, C_DOWN], [378, 16, ATTACK], [380, 2, TOWARD], [396, 6, UP], [398, 2, SPECIAL], [402, 2, LIGHT_SHIELD], [406, 2, LIGHT_SHIELD_ALT], [408, 2, METER],
  ], [
    [1, 1, SHORT_HOP],
    [20, 24, SHIELD_RIGHT], [50, 2, ATTACK], [60, 2, GRAB], [84, 2, SHIELD_LEFT], [95, 4, JUMP], [101, 2, C_DOWN],
    [112, 2, SPECIAL], [126, 2, C_RIGHT], [150, 16, SHIELD_LEFT, SHIELD_RIGHT], [168, 14, STICK_JUMP],
    [170, 8, JUMP_ALT], [174, 2, ATTACK], [186, 2, UP], [192, 2, ATTACK], [194, 2, SPECIAL], [196, 2, JUMP],
    [210, 10, DOWN], [212, 2, SPECIAL], [230, 10, WALK, TOWARD], [232, 2, ATTACK], [250, 2, C_LEFT],
    [262, 2, WALK, C_LEFT_ALT], [274, 2, C_UP], [286, 10, TOWARD], [288, 2, GRAB], [300, 6, AWAY], [320, 6, SHIELD_LEFT],
    [322, 2, DOWN], [334, 3, JUMP], [338, 2, SHIELD_LEFT], [350, 2, C_RIGHT], [372, 2, UP], [402, 2, LIGHT_SHIELD], [406, 2, LIGHT_SHIELD_ALT], [408, 2, METER],
  ]],
  approaches: [
    [[1, 45], [56, 45], [118, 50], [175, 35], [258, 45], [305, 50], [370, 45]],
    [[1, 60], [120, 40], [182, 40], [245, 50]],
  ],
  rollbacks: [...every(40, 400, 40, 6), [347, 410]],
};


const ROLLBACK: MatchScript = {
  characters: [Character.rifleman, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 220,
  holds: [[
    [20, 2, ATTACK], [48, 2, GRAB], [56, 2, TOWARD], [78, 2, ATTACK], [86, 8, DOWN], [88, 2, ATTACK], [108, 3, JUMP],
    [112, 2, ATTACK], [138, 2, SPECIAL], [168, 8, TOWARD], [170, 2, SPECIAL], [198, 2, ATTACK],
  ], [
    [26, 14, SHIELD_RIGHT], [52, 2, ATTACK], [64, 2, ATTACK], [82, 2, GRAB], [92, 2, AWAY], [118, 2, C_DOWN],
    [146, 2, ATTACK], [176, 16, SHIELD_LEFT], [200, 2, SPECIAL], [210, 2, ATTACK],
  ]],
  approaches: [
    [[1, 45], [30, 45], [60, 45], [90, 45], [120, 45], [150, 45], [180, 45]],
    [[10, 45], [40, 45], [70, 45], [100, 45], [130, 45], [160, 45], [190, 45]],
  ],
  rollbacks: [...every(60, 90, 1, 1), ...every(97, 130, 7, 6), [73, 136], [157, 220]],
  predictions: [[24, 45], [140, 151], [196, 214]],
};


const FIRST_MATCH: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 1, minutes: 0, frames: 110,
  holds: [[[20, 2, ATTACK], [40, 3, JUMP], [60, 2, SPECIAL]], [[1, 110, RIGHT]]],
  approaches: [[], []],
  rollbacks: [[80, 100]],
};


const SECOND_MATCH: MatchScript = {
  characters: [Character.demonHunter, Character.demonHunter], stage: 1, stocks: 2, minutes: 1, frames: 140,
  holds: [[
    [20, 2, ATTACK], [30, 3, JUMP_ALT], [36, 2, DOWN], [60, 2, GRAB], [68, 2, UP], [86, 2, SPECIAL],
    [100, 14, SHIELD_LEFT], [126, 2, C_RIGHT],
  ], [
    [24, 2, ATTACK], [40, 4, JUMP], [46, 6, DOWN], [72, 2, ATTACK], [90, 2, C_LEFT], [104, 2, ATTACK], [118, 2, GRAB],
  ]],
  approaches: [[[1, 45], [45, 45], [116, 45]], [[1, 60], [95, 45]]],
  rollbacks: [[30, 34], [77, 140]],
};





const COMPUTER: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 1, stocks: 3, minutes: 0, frames: 900, computer: true,
  holds: [[
    [30, 2, ATTACK], [60, 3, JUMP], [64, 2, ATTACK], [100, 20, SHIELD_LEFT], [140, 2, SPECIAL], [180, 2, GRAB],
    [220, 8, TOWARD], [224, 2, C_RIGHT], [300, 3, JUMP], [303, 3, JUMP_ALT], [310, 2, ATTACK], [360, 30, SHIELD_RIGHT],
    [420, 2, C_DOWN], [470, 12, AWAY], [500, 2, SPECIAL], [560, 2, ATTACK], [600, 6, DOWN], [640, 2, C_UP],
    [700, 24, SHIELD_LEFT], [760, 3, JUMP], [764, 2, ATTACK], [820, 2, GRAB], [860, 2, SPECIAL],
  ], []],
  approaches: [[[1, 60], [150, 60], [250, 45], [400, 60], [540, 45], [680, 60], [800, 45]], []],
  rollbacks: [...every(120, 840, 120, 8), [837, 900]],
};


const METER_DROPS: MatchScript = {
  characters: [Character.rifleman, Character.demonHunter], stage: 0, stocks: 5, minutes: 0, frames: 2700, computer: true, dropPickups: 2,
  holds: [[
    [100, 2, ATTACK], [300, 20, SHIELD_LEFT], [500, 2, SPECIAL], [700, 3, JUMP], [704, 2, ATTACK], [880, 2, GRAB],
    [1100, 2, ATTACK], [1205, 20, RIGHT], [1400, 24, SHIELD_RIGHT], [1700, 2, SPECIAL], [2000, 3, JUMP], [2004, 2, ATTACK], [2300, 2, GRAB],
  ], []],
  approaches: [[[1, 60], [200, 60], [400, 60], [600, 45], [760, 40], [840, 40], [1000, 60], [1200, 60], [1500, 45], [1800, 60], [2100, 45], [2400, 60]], []],
  rollbacks: [...every(180, 2700, 180, 8), ...every(840, 2700, 300, 60), [1270, 1320], [2230, 2280]],
};


const LICH: MatchScript = {
  characters: [Character.lich, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 480,
  holds: [[
    [20, 2, SPECIAL], [80, 4, TOWARD], [81, 2, SPECIAL], [150, 4, AWAY], [151, 2, SPECIAL], [220, 4, DOWN],
    [221, 2, SPECIAL], [280, 3, JUMP], [292, 4, UP], [293, 2, SPECIAL], [360, 2, ATTACK], [380, 8, DOWN],
    [382, 2, ATTACK], [400, 2, GRAB], [404, 4, TOWARD], [430, 2, C_RIGHT], [450, 3, JUMP], [456, 2, C_DOWN],
  ], [
    [40, 2, ATTACK], [100, 12, SHIELD_LEFT], [170, 2, ATTACK], [240, 2, ATTACK], [250, 2, ATTACK], [330, 2, GRAB],
    [370, 10, SHIELD_RIGHT], [420, 2, ATTACK],
  ]],
  approaches: [[[340, 45]], [[1, 60], [130, 60], [200, 45], [310, 45], [410, 45]]],
  rollbacks: [[24, 50], [84, 112], [228, 260], [296, 330], [452, 480]],
  predictions: [[150, 162], [380, 392]],
};


const MOUNTAIN_KING: MatchScript = {
  characters: [Character.mountainKing, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 600,
  holds: [[
    [20, 2, SPECIAL], [80, 4, DOWN], [81, 2, SPECIAL], [150, 4, TOWARD], [151, 2, SPECIAL], [210, 4, DOWN],
    [211, 2, SPECIAL], [275, 4, TOWARD], [276, 2, SPECIAL], [335, 2, SPECIAL], [395, 3, JUMP], [407, 4, UP],
    [408, 2, SPECIAL], [480, 2, ATTACK], [500, 8, DOWN], [502, 2, ATTACK], [530, 2, GRAB], [534, 4, TOWARD],
    [570, 3, JUMP], [576, 2, C_DOWN],
  ], [
    [40, 2, ATTACK], [100, 12, SHIELD_LEFT], [170, 2, ATTACK], [240, 2, ATTACK], [300, 10, SHIELD_RIGHT],
    [360, 2, GRAB], [450, 2, ATTACK],
  ]],
  approaches: [[[460, 45]], [[1, 60], [130, 60], [200, 45], [320, 45], [430, 45]]],
  rollbacks: [[24, 50], [84, 112], [154, 190], [279, 320], [410, 440], [532, 570]],
  predictions: [[150, 162], [400, 412]],
};


const SHADOW_HUNTER: MatchScript = {
  characters: [Character.shadowHunter, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 540,
  holds: [[
    [20, 2, SPECIAL], [70, 4, TOWARD], [71, 2, SPECIAL], [140, 4, DOWN], [141, 2, SPECIAL], [210, 2, ATTACK],
    [230, 8, DOWN], [232, 2, ATTACK], [260, 4, TOWARD], [261, 2, SPECIAL], [330, 3, JUMP], [342, 4, UP],
    [343, 2, SPECIAL], [430, 2, GRAB], [434, 4, TOWARD], [480, 3, JUMP], [486, 2, C_DOWN], [515, 2, C_RIGHT],
  ], [
    [130, 2, ATTACK], [150, 2, ATTACK], [190, 12, SHIELD_LEFT], [250, 2, ATTACK], [300, 2, ATTACK], [400, 2, ATTACK],
    [460, 10, SHIELD_RIGHT],
  ]],
  approaches: [[[400, 45]], [[100, 90], [240, 60], [380, 45]]],
  rollbacks: [[24, 50], [96, 130], [150, 175], [262, 320], [344, 372], [500, 540]],
  predictions: [[140, 152], [430, 442]],
};






const BEASTMASTER: MatchScript = {
  characters: [Character.beastmaster, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 640,
  holds: [[
    [20, 4, TOWARD], [21, 2, SPECIAL], [100, 4, TOWARD], [101, 2, SPECIAL], [180, 4, DOWN], [181, 2, SPECIAL],
    [240, 2, SPECIAL], [290, 2, ATTACK], [320, 8, DOWN], [322, 2, ATTACK], [360, 3, JUMP], [372, 4, UP], [373, 2, SPECIAL],
    [460, 2, GRAB], [464, 4, TOWARD], [520, 3, JUMP], [526, 2, C_DOWN], [580, 4, TOWARD], [581, 2, SPECIAL],
  ], [
    [130, 2, ATTACK], [150, 12, SHIELD_LEFT], [200, 2, ATTACK], [270, 2, ATTACK], [300, 2, ATTACK], [420, 2, ATTACK],
    [490, 10, SHIELD_RIGHT], [600, 2, ATTACK],
  ]],
  approaches: [[[280, 60], [450, 45], [515, 50]], [[80, 90], [190, 60], [260, 60], [410, 60], [590, 60]]],
  rollbacks: [[24, 60], [96, 140], [176, 210], [244, 300], [374, 420], [462, 500], [528, 560], [582, 630]],
  predictions: [[100, 112], [580, 592]],
};






const LICH_KING: MatchScript = {
  characters: [Character.lichKing, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 640,
  holds: [[
    [20, 2, SPECIAL], [90, 2, ATTACK], [98, 2, ATTACK], [106, 2, ATTACK], [150, 4, TOWARD], [151, 2, SPECIAL],
    [260, 4, DOWN], [261, 2, SPECIAL], [380, 3, JUMP], [390, 4, UP], [391, 2, SPECIAL], [480, 2, GRAB],
    [486, 4, DOWN], [560, 2, C_DOWN],
  ], [
    [60, 2, ATTACK], [170, 2, ATTACK], [174, 2, ATTACK], [178, 2, ATTACK], [182, 2, ATTACK], [186, 2, ATTACK],
    [200, 2, JUMP], [300, 10, SHIELD_LEFT], [420, 2, ATTACK], [530, 2, ATTACK],
  ]],
  approaches: [[[70, 60], [130, 120], [440, 45], [540, 50]], [[40, 200], [280, 40], [400, 60]]],
  rollbacks: [[24, 60], [92, 120], [152, 200], [262, 320], [392, 440], [482, 530], [562, 610]],
  predictions: [[150, 162], [480, 492]],
};






const PIT_LORD: MatchScript = {
  characters: [Character.pitLord, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 600,
  holds: [[
    [20, 2, SPECIAL], [90, 4, TOWARD], [91, 2, SPECIAL], [170, 4, DOWN], [171, 2, SPECIAL], [250, 2, ATTACK],
    [280, 8, DOWN], [282, 2, ATTACK], [320, 3, JUMP], [332, 4, UP], [333, 2, SPECIAL], [440, 2, GRAB],
    [446, 4, AWAY], [500, 3, JUMP], [506, 2, C_DOWN], [550, 2, C_RIGHT],
  ], [
    [60, 2, ATTACK], [110, 2, ATTACK], [200, 2, ATTACK], [215, 2, ATTACK], [260, 12, SHIELD_LEFT], [400, 2, ATTACK],
    [470, 10, SHIELD_RIGHT],
  ]],
  approaches: [[[240, 60], [430, 45], [495, 50]], [[60, 120], [150, 60], [195, 60], [390, 60]]],
  rollbacks: [[24, 55], [92, 130], [172, 210], [252, 300], [334, 380], [442, 490], [508, 560]],
  predictions: [[90, 102], [440, 452]],
};






const DREADLORD: MatchScript = {
  characters: [Character.dreadlord, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 640,
  holds: [[
    [20, 2, SPECIAL], [80, 4, DOWN], [81, 2, SPECIAL], [150, 4, TOWARD], [151, 2, SPECIAL], [235, 4, DOWN],
    [236, 2, SPECIAL], [300, 4, TOWARD], [301, 2, SPECIAL], [370, 3, JUMP], [381, 4, UP], [382, 2, SPECIAL],
    [386, 20, TOWARD], [480, 2, ATTACK], [500, 8, DOWN], [502, 2, ATTACK], [530, 2, GRAB], [534, 4, AWAY],
    [590, 3, JUMP], [596, 2, C_DOWN],
  ], [
    [40, 2, ATTACK], [100, 12, SHIELD_LEFT], [170, 2, ATTACK], [305, 16, SHIELD_RIGHT],
    [420, 2, GRAB], [450, 2, ATTACK],
  ]],
  approaches: [[[460, 45]], [[1, 60], [130, 60], [200, 45], [280, 45], [430, 45]]],
  rollbacks: [[24, 50], [84, 112], [154, 200], [240, 290], [304, 345], [384, 420], [532, 580]],
  predictions: [[150, 162], [384, 396]],
};


const FORSAKEN_PALADIN: MatchScript = {
  characters: [Character.forsakenPaladin, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 540,
  holds: [[
    [20, 2, SPECIAL], [80, 4, TOWARD], [81, 2, SPECIAL], [140, 4, DOWN], [141, 2, SPECIAL], [200, 4, TOWARD],
    [201, 2, SPECIAL], [260, 4, AWAY], [261, 2, SPECIAL], [320, 3, JUMP], [332, 4, UP], [333, 2, SPECIAL],
    [420, 2, ATTACK], [440, 8, DOWN], [442, 2, ATTACK], [460, 2, GRAB], [464, 4, TOWARD], [500, 2, C_RIGHT],
  ], [
    [40, 2, ATTACK], [90, 12, SHIELD_LEFT], [144, 2, ATTACK], [210, 2, ATTACK], [270, 2, ATTACK], [380, 2, GRAB],
    [480, 10, SHIELD_RIGHT], [505, 2, ATTACK],
  ]],
  approaches: [[[400, 45]], [[1, 60], [120, 50], [190, 45], [360, 45], [470, 45]]],
  rollbacks: [[24, 50], [84, 112], [140, 170], [330, 370], [500, 540]],
  predictions: [[140, 152], [440, 452]],
};


const WARDEN: MatchScript = {
  characters: [Character.warden, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 540,
  holds: [[
    [20, 2, SPECIAL], [80, 4, TOWARD], [81, 2, SPECIAL], [150, 4, DOWN], [151, 2, SPECIAL], [220, 3, JUMP],
    [232, 4, UP], [233, 2, SPECIAL], [236, 6, TOWARD], [320, 2, ATTACK], [340, 8, DOWN], [342, 2, ATTACK],
    [370, 2, GRAB], [374, 4, AWAY], [420, 2, C_RIGHT], [450, 3, JUMP], [456, 2, C_DOWN], [490, 2, C_UP],
  ], [
    [40, 2, ATTACK], [100, 12, SHIELD_LEFT], [170, 2, ATTACK], [260, 2, ATTACK], [300, 2, GRAB],
    [400, 10, SHIELD_RIGHT], [470, 2, ATTACK],
  ]],
  approaches: [[[300, 45], [360, 45]], [[1, 60], [130, 60], [200, 45], [280, 45], [380, 45]]],
  rollbacks: [[24, 50], [84, 112], [154, 190], [236, 270], [372, 400], [452, 480]],
  predictions: [[150, 162], [340, 352]],
};


const ULTIMATE_PAIRS: readonly (readonly [keyof typeof Character, keyof typeof Character])[] = [
  ["murloc", "grom"], ["cairne", "pitLord"], ["lichKing", "sylvanas"], ["tinker", "kaelthas"], ["shadowHunter", "warden"], ["mountainKing", "demonHunter"],
  ["rifleman", "blademaster"], ["lich", "forsakenPaladin"], ["dreadlord", "beastmaster"], ["thrall", "jaina"], ["chen", "peon"], ["anubarak", "malfurion"], ["medivh", "kobold"],
];

export function generateTapes(): Map<string, string> {
  const pressed = [new Set<string>(), new Set<string>()];
  const tapes = new Map([
    ["edge-cancel-turnaround", recordTape("An aerial lands at the edge, the fighter slides off, the landing lag ends at once and the fighter turns back to catch the ledge, with predictions and rollback.", [{
      placement: "test-air 0 480 0",
      characters: [Character.rifleman, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 120,
      holds: [[[1, 1, LEFT, WALK], [3, 3, JUMP], [3, 26, RIGHT], [20, 2, ATTACK]], [[1, 120, SHIELD_LEFT]]],
      approaches: [[], []], rollbacks: [[30, 60]], predictions: [[22, 28]], exercise: "edgeCancel",
    }])],
    ["edge-cancel-back-air", recordTape("An aerial lands at the edge, the cancel frees the fighter at once and a back air follows, with rollback.", [{
      placement: "test-air 0 480 0",
      characters: [Character.rifleman, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 120,
      holds: [[[1, 3, JUMP], [1, 36, RIGHT], [20, 2, ATTACK], [32, 2, C_LEFT]], [[1, 120, SHIELD_LEFT]]],
      approaches: [[], []], rollbacks: [[30, 60]], exercise: "edgeCancel",
    }])],
    ["shield-slide-off", recordTape("A shielding fighter at the edge is pushed off by repeated hits and falls helpless, with rollback.", [{
      placement: "test-air 0 592 0",
      characters: [Character.rifleman, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 240,
      holds: [[[1, 240, SHIELD_LEFT]], [[1, 6, RIGHT, WALK], [20, 2, ATTACK], [50, 2, ATTACK], [80, 2, ATTACK], [110, 2, ATTACK], [140, 2, ATTACK], [170, 2, ATTACK]]],
      approaches: [[], [[1, 40]]], rollbacks: [[30, 60]], exercise: "shieldSlide",
    }])],
    ["push-physics", recordTape("Walking overlapping bodies and striking a held shield, with predictions and rollback.", [{
      placement: "test-air 1 -215 0",
      characters: [Character.rifleman, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 180,
      holds: [[[10, 8, RIGHT, WALK], [24, 1, ATTACK], [70, 1, ATTACK], [100, 8, RIGHT, WALK], [120, 1, ATTACK]], [[1, 180, SHIELD_RIGHT]]],
      approaches: [[], []], rollbacks: [[1, 60], [65, 90], [95, 140]], predictions: [[10, 18], [24, 32]],
      exercise: "shieldPush",
    }])],
    ["short-hop", recordTape("Z short and long holds with late input corrections and rollback.", [{
      characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 180,
      holds: [[[1, 1, SHORT_HOP], [60, 60, SHORT_HOP, JUMP]], [[1, 60, SHORT_HOP], [100, 3, SHORT_HOP]]],
      approaches: [[], []], rollbacks: [[1, 30], [65, 120]], predictions: [[1, 10], [98, 110]],
    }])],
    ["actions", recordTape("Every bound source pressed by both players, with short replays.", [ACTIONS], pressed)],
    ["rollback", recordTape("Combat replayed from one frame up to the whole retained history.", [ROLLBACK])],
    ["rematch", recordTape("A one-stock match ends, both players confirm the rematch, a new match runs.", [FIRST_MATCH, SECOND_MATCH])],
    ["blademaster", recordTape("Blademaster's specials, follow-up, smashes, aerials and throws against Illidan, with replays and corrected predictions.", [{
      characters: [Character.blademaster, Character.demonHunter], stage: 0, stocks: 3, minutes: 0, frames: 480,
      holds: [[
        [20, 2, SPECIAL], [70, 2, DOWN, SPECIAL], [82, 2, SPECIAL], [130, 2, TOWARD, SPECIAL], [190, 2, GRAB], [198, 2, UP],
        [240, 3, JUMP], [246, 2, UP, SPECIAL], [300, 2, C_RIGHT], [330, 2, GRAB], [338, 2, DOWN], [370, 3, JUMP], [374, 2, ATTACK],
        [410, 2, C_LEFT], [440, 2, UP, SPECIAL],
      ], [
        [40, 14, SHIELD_RIGHT], [100, 2, ATTACK], [150, 2, GRAB], [210, 2, SPECIAL], [260, 16, SHIELD_LEFT], [320, 2, ATTACK], [400, 2, SPECIAL],
      ]],
      approaches: [[[1, 60], [60, 70], [120, 140], [180, 45], [290, 60], [325, 45], [360, 60], [430, 60]], [[1, 80], [90, 50], [140, 45]]],
      rollbacks: [...every(30, 470, 40, 8), [76, 100], [244, 290]], predictions: [[70, 86], [126, 140], [436, 450]],
    }])],
    ...ULTIMATE_PAIRS.map(([first, second]): [string, string] => [`ultimate-${first}`, recordTape(`${first} and ${second} ultimates bought with a full bar, shielded, struck and rolled back (#382).`, [{
      characters: [Character[first], Character[second]], stage: 0, stocks: 3, minutes: 0, frames: 360, meter: 100,
      holds: [[[40, 2, ATTACK, SPECIAL], [150, 2, ATTACK], [300, 2, ATTACK, SPECIAL]], [[20, 30, SHIELD_LEFT], [70, 2, ATTACK], [200, 2, ATTACK, SPECIAL], [260, 2, ATTACK]]],
      approaches: [[[120, 60], [280, 80]], [[60, 80], [180, 120]]],
      rollbacks: [[44, 70], [204, 230], [302, 330]], predictions: [[60, 72], [210, 222]],
    }])]),
    ["computer", recordTape("A player against the computer on the raised decks, with replays.", [COMPUTER])],
    ["meter-drops", recordTape("Two meter drops telegraph, spawn and are fought over and taken by a player and the computer, with replays across the pickups (#385).", [METER_DROPS])],
    ["lich", recordTape("Lich's specials, free recovery and normals against the Illidan, with replays.", [LICH])],
    ["dreadlord", recordTape("Dreadlord's specials, sleep, a command grab, free Bat Ascension, normals and a throw against the Illidan, with replays.", [DREADLORD])],
    ["mountain-king", recordTape("Mountain King's specials, free Thunder Leap, normals and a throw against the Illidan, with replays.", [MOUNTAIN_KING])],
    ["shadow-hunter", recordTape("Shadow Hunter's glaive, ward, Hex, recall, vault and normals against the Illidan, with replays.", [SHADOW_HUNTER])],
    ["pit-lord", recordTape("Pit Lord's arcing spit, armored charge, Terror, leap, cleaver normals and a throw against the Illidan, with replays.", [PIT_LORD])],
    ["lich-king", recordTape("The Lich King's blast, soul-banking jabs, a Val'kyr carry mashed against, Defile, Ascension, Harvest Soul and Quake against the Illidan, with replays.", [LICH_KING])],
    ["beastmaster", recordTape("Beastmaster's bear summoned, commanded, recalled and followed, his axe, Hawk Lift, normals and a throw against the Illidan, with replays.", [BEASTMASTER])],
    ["warden", recordTape("Warden's specials with poison and an aimed Blink, normals and a throw against the Illidan, with replays.", [WARDEN])],
    ["forsaken-paladin", recordTape("Forsaken Paladin's specials, guard, free recovery and normals against the Illidan, with replays.", [FORSAKEN_PALADIN])],
    ["moving-platforms", recordTape("Moving decks, jumping, dropping through, predictions and rollback over complete path cycles.", [{
      characters: [Character.demonHunter, Character.rifleman], stage: 3, stocks: 3, minutes: 0, frames: 620,
      holds: [[[1, 20, RIGHT, WALK], [30, 10, JUMP], [180, 3, DOWN], [240, 10, JUMP], [400, 10, JUMP]], [[1, 10, JUMP], [140, 3, DOWN], [300, 10, JUMP]]],
      approaches: [[], []], rollbacks: [[57, 120], [357, 420], [537, 600]], predictions: [[250, 260]],
    }])],
    ["patterned-platforms", recordTape("Two independently patterned platforms through full loops and lifts with rollback.", [{
      characters: [Character.demonHunter, Character.demonHunter], stage: 4, stocks: 3, minutes: 0, frames: 520,
      holds: [[[1, 10, JUMP], [140, 3, DOWN], [220, 10, JUMP]], [[1, 10, JUMP], [100, 3, DOWN], [180, 10, JUMP]]],
      approaches: [[], []], rollbacks: [[147, 210], [437, 500]], predictions: [[240, 250]],
    }])],
    ["slopes", recordTape("Running, walking, jumping and landing on Yoshi's Story's sloped main deck, a tech and a fight on the slope, with predictions and rollback.", [{
      characters: [Character.demonHunter, Character.rifleman], stage: 6, stocks: 3, minutes: 0, frames: 760,
      holds: [[
        [185, 40, LEFT, WALK], [228, 3, JUMP], [260, 36, RIGHT, WALK], [300, 3, JUMP], [330, 20, LEFT, WALK], [360, 2, ATTACK],
        [400, 18, RIGHT], [430, 2, ATTACK], [470, 2, GRAB], [520, 3, JUMP], [526, 2, C_DOWN], [600, 2, DOWN, ATTACK],
      ], [
        [185, 60, RIGHT, WALK], [250, 3, JUMP], [256, 6, LEFT], [290, 24, LEFT], [330, 2, ATTACK], [380, 14, SHIELD_LEFT],
        [440, 2, ATTACK], [500, 2, SPECIAL],
      ]],
      approaches: [[[560, 45], [640, 45]], [[420, 45], [540, 45], [660, 45]]],
      rollbacks: [[195, 240], [300, 360], [420, 480], [560, 620], [700, 750]], predictions: [[205, 217], [330, 342]],
    }])],
    ...([
      ["wind", 10, 1900, undefined, "pushed"],
      ["carried", 11, 940, "test-air 0 -420 125", "carried"],
      ["cannon", 12, 650, "test-air 0 -760 -350", undefined],
      ["timed-lift", 13, 440, "test-air 0 -330 125", "carried"],
    ] as const).map(([name, stage, frames, placement, exercise]) => [name, recordTape(`Deterministic ${name} hazard, controller presses, corrected predictions and rollback.`, [{
      characters: [Character.demonHunter, Character.rifleman], stage, stocks: 3, minutes: 0, frames,
      ...(placement === undefined ? {} : { placement }), ...(exercise === undefined ? {} : { exercise }),

      holds: [[[30, 1, ATTACK], [300, 1, SPECIAL]], []], approaches: [[], []],
      rollbacks: [[37, 100], [337, 400]], predictions: [[120, 130]],
    }])] as const),

    ...([
      ["hazards-off-carried", 11, 500, "test-air 0 0 125"],
      ["hazards-off-wind", 10, 700, undefined],
      ["hazards-off-cannon", 12, 300, "test-air 0 -760 -350"],
    ] as const).map(([name, stage, frames, placement]) => [name, recordTape(`Stage ${stage} with hazards off, controller presses, corrected predictions and rollback.`, [{
      characters: [Character.demonHunter, Character.rifleman], stage, stocks: 3, minutes: 0, frames, hazardsOff: true,
      ...(placement === undefined ? {} : { placement }),
      holds: [[[30, 1, ATTACK], [200, 1, SPECIAL]], []], approaches: [[], []],
      rollbacks: [[37, 100], [237, 280]], predictions: [[120, 130]],
    }])] as const),
  ]);
  pressed.forEach((sources, slot) => {
    const missing = [...SOURCES.keys()].filter(source => !sources.has(source));
    if (missing.length > 0) throw new Error(`the actions tape never presses ${missing.join(", ")} for slot ${slot}`);
  });
  if (new Set(SOURCES.values()).size !== ACTION_COUNT) throw new Error("the script layout no longer binds the sources the tapes press");
  return tapes;
}
