// The acceptance tapes for `wisp tapes`, recorded fresh each run by two
// scripted keyboard players reacting to the TypeScript simulation. Between
// them the tapes press every bound source, replay rollbacks and corrected
// predictions, and play a rematch.
import "../../test/host-natives";
import { adaptInput } from "../../src/game/input/adapter";
import { ACTION_COUNT, Action, bit } from "../../src/game/input/actions";
import { type AttackBuffer, attackBuffer } from "../../src/game/input/attackBuffer";
import { commitEdges, keyboardCapture, sampleKeys } from "../../src/game/input/keyboardCapture";
import { actionFor, keyLabel, presetBindings } from "../../src/game/input/keyBindings";
import { TAPE_HEADER, decodeTape } from "../../src/game/replay/tape";
import { type TapeSession, createTapeSession, performTapeOperation } from "../../src/game/replay/tapeRunner";
import { Character } from "../../src/game/sim/codes";
import { type Controls, fighterAt, neutralControls } from "../../src/game/sim/roster";

const bindings = presetBindings("standard");
/** Every bound key of the standard layout, by label, plus the controller stick's jump. */
const SOURCES = new Map<string, Action>();
for (const key of bindings.keys) {
  const action = actionFor(bindings, key);
  if (key !== 0 && action !== undefined) SOURCES.set(keyLabel(key), action);
}
const STICK_JUMP = "stick-up";
SOURCES.set(STICK_JUMP, Action.jump);

const LEFT = "W", RIGHT = "R", DOWN = "E", UP = "SPACE", JUMP = "I", JUMP_ALT = "8", ATTACK = "N", SPECIAL = "U",
  GRAB = "O", SHIELD_LEFT = "Q", SHIELD_RIGHT = "7", C_LEFT = "B", C_LEFT_ALT = "/", C_RIGHT = "M", C_UP = "J",
  C_DOWN = "H", WALK = "P";

/** Pseudo-sources: the direction key toward or away from the opponent on this frame. */
const TOWARD = "toward", AWAY = "away";

/** Hold these sources from frame `at` for `frames` frames. */
type Hold = readonly [at: number, frames: number, ...sources: string[]];
/**
 * From frame `at`, close on the opponent until within `within` units, for at
 * most APPROACH_FRAMES: dashing while far, walking for the last WALK_RANGE.
 */
type Approach = readonly [at: number, within: number];
const APPROACH_FRAMES = 40;
const WALK_RANGE = 120;

interface MatchScript {
  readonly placement?: string;
  readonly characters: readonly [Character, Character];
  readonly stage: number;
  readonly stocks: number;
  readonly minutes: number;
  readonly frames: number;
  readonly holds: readonly [readonly Hold[], readonly Hold[]];
  readonly approaches: readonly [readonly Approach[], readonly Approach[]];
  /** Replay `[first, last]` after frame `last`. */
  readonly rollbacks: readonly (readonly [number, number])[];
  /**
   * Run `[first, last]` as predictions that slot 1 is idle, then correct each
   * frame with the inputs actually recorded, oldest first, after frame `last`.
   */
  readonly predictions?: readonly (readonly [number, number])[];
  /** Slot 1 is the game's computer, which plays from the match in each runtime: the tape gives it no input. */
  readonly computer?: boolean;
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
    ...(script.stage > 1 ? [`test-stage ${script.stage}`] : [`stage 0 ${script.stage}`]), "start 0", ...(script.placement === undefined ? [] : [script.placement]),
  ];
}

/**
 * Plays one match as two keyboard players reacting to the TypeScript
 * simulation: each frame samples the held keys and adapts them for the
 * fighter as it stands, as the game does with network rows. The recorded
 * rows are what every runtime replays.
 */
function playMatch(script: MatchScript, session: TapeSession, play: (...lines: string[]) => void, pressed: Set<string>[]): void {
  const players = (script.computer === true ? [0] as const : [0, 1] as const).map(slot => ({
    slot, capture: keyboardCapture(), controls: neutralControls(), attacks: attackBuffer(0), held: new Set<string>(),
    approaches: script.approaches[slot].map(([at, within]) => ({ at, within, done: false })), holds: script.holds[slot],
  }));
  const rollbacks = new Map(script.rollbacks.map(([first, last]) => [last, first]));
  /** Recorded input lines of the predicted frames still to correct. */
  const actual: string[][] = [];
  for (let frame = 1; frame <= script.frames; frame++) {
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
      adaptInput(player.capture.row, self, frame, player.controls, player.attacks);
      commitEdges(player.capture);
      return `input ${player.slot} ${formatControls(player.controls, player.attacks)}`.trimEnd();
    });
    const first = rollbacks.get(frame);
    const prediction = script.predictions?.find(([from, to]) => frame >= from && frame <= to);
    if (prediction === undefined) play(...inputs, `frame ${frame}`);
    else {
      actual.push(inputs);
      play(...inputs.slice(0, 1), "input 1", `predict ${frame}`);
      if (frame === prediction[1]) actual.splice(0).forEach((recorded, index) => play(...recorded, `correct ${prediction[0] + index}`));
    }
    if (first !== undefined) play(`rollback ${first} ${frame}`);
  }
}

/** Records a tape by playing its matches, a rematch between consecutive ones. */
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

/** Each slot presses every bound source, the three jump sources overlapping, mostly within reach of the other. */
const ACTIONS: MatchScript = {
  characters: [Character.archer, Character.rifleman], stage: 0, stocks: 3, minutes: 0, frames: 410,
  holds: [[
    [30, 2, ATTACK], [40, 10, DOWN], [42, 2, ATTACK], [70, 6, WALK, TOWARD], [72, 2, ATTACK], [86, 4, UP],
    [87, 2, ATTACK], [100, 3, JUMP], [106, 2, ATTACK], [130, 14, JUMP_ALT], [134, 16, STICK_JUMP], [140, 2, ATTACK],
    [144, 2, DOWN], [165, 2, SPECIAL], [190, 2, GRAB], [200, 2, TOWARD], [215, 8, TOWARD], [217, 2, SPECIAL],
    [235, 20, SHIELD_LEFT], [241, 2, AWAY], [270, 12, SHIELD_RIGHT], [274, 2, DOWN], [290, 3, JUMP], [296, 6, UP],
    [298, 2, SHIELD_RIGHT], [315, 2, C_LEFT], [328, 2, C_RIGHT], [340, 2, C_LEFT_ALT], [352, 2, C_UP],
    [364, 2, C_DOWN], [378, 16, ATTACK], [380, 2, TOWARD], [396, 6, UP], [398, 2, SPECIAL],
  ], [
    [20, 24, SHIELD_RIGHT], [50, 2, ATTACK], [60, 2, GRAB], [84, 2, SHIELD_LEFT], [95, 4, JUMP], [101, 2, C_DOWN],
    [112, 2, SPECIAL], [126, 2, C_RIGHT], [150, 16, SHIELD_LEFT, SHIELD_RIGHT], [168, 14, STICK_JUMP],
    [170, 8, JUMP_ALT], [174, 2, ATTACK], [186, 2, UP], [192, 2, ATTACK], [194, 2, SPECIAL], [196, 2, JUMP],
    [210, 10, DOWN], [212, 2, SPECIAL], [230, 10, WALK, TOWARD], [232, 2, ATTACK], [250, 2, C_LEFT],
    [262, 2, C_LEFT_ALT], [274, 2, C_UP], [286, 10, TOWARD], [288, 2, GRAB], [300, 6, AWAY], [320, 6, SHIELD_LEFT],
    [322, 2, DOWN], [334, 3, JUMP], [338, 2, SHIELD_LEFT], [350, 2, C_RIGHT], [372, 2, UP],
  ]],
  approaches: [
    [[1, 45], [56, 45], [118, 50], [175, 35], [258, 45], [305, 50], [370, 45]],
    [[1, 60], [120, 40], [182, 40], [245, 50]],
  ],
  rollbacks: [...every(40, 400, 40, 6), [347, 410]],
};

/** Close combat, replayed one frame every frame, in short windows and over the whole retained history. */
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

/** A one-stock match ends when the Rifleman runs off the stage; one replay crosses the end. */
const FIRST_MATCH: MatchScript = {
  characters: [Character.demonHunter, Character.rifleman], stage: 0, stocks: 1, minutes: 0, frames: 110,
  holds: [[[20, 2, ATTACK], [40, 3, JUMP], [60, 2, SPECIAL]], [[1, 110, RIGHT]]],
  approaches: [[], []],
  rollbacks: [[80, 100]],
};

/** The rematch, configured through the menus: other fighters, the raised decks, two stocks and a clock. */
const SECOND_MATCH: MatchScript = {
  characters: [Character.archer, Character.demonHunter], stage: 1, stocks: 2, minutes: 1, frames: 140,
  holds: [[
    [20, 2, ATTACK], [30, 3, JUMP_ALT], [36, 2, DOWN], [60, 2, GRAB], [68, 2, UP], [86, 2, SPECIAL],
    [100, 14, SHIELD_LEFT], [126, 2, C_RIGHT],
  ], [
    [24, 2, ATTACK], [40, 4, JUMP], [46, 6, DOWN], [72, 2, ATTACK], [90, 2, C_LEFT], [104, 2, ATTACK], [118, 2, GRAB],
  ]],
  approaches: [[[1, 45], [45, 45], [116, 45]], [[1, 60], [95, 45]]],
  rollbacks: [[30, 34], [77, 140]],
};

/**
 * A player against the computer on the raised decks, with replays that reach
 * back over the computer's choices: each runtime makes them from the match.
 */
const COMPUTER: MatchScript = {
  characters: [Character.archer, Character.rifleman], stage: 1, stocks: 3, minutes: 0, frames: 900, computer: true,
  holds: [[
    [30, 2, ATTACK], [60, 3, JUMP], [64, 2, ATTACK], [100, 20, SHIELD_LEFT], [140, 2, SPECIAL], [180, 2, GRAB],
    [220, 8, TOWARD], [224, 2, C_RIGHT], [300, 3, JUMP], [303, 3, JUMP_ALT], [310, 2, ATTACK], [360, 30, SHIELD_RIGHT],
    [420, 2, C_DOWN], [470, 12, AWAY], [500, 2, SPECIAL], [560, 2, ATTACK], [600, 6, DOWN], [640, 2, C_UP],
    [700, 24, SHIELD_LEFT], [760, 3, JUMP], [764, 2, ATTACK], [820, 2, GRAB], [860, 2, SPECIAL],
  ], []],
  approaches: [[[1, 60], [150, 60], [250, 45], [400, 60], [540, 45], [680, 60], [800, 45]], []],
  rollbacks: [...every(120, 840, 120, 8), [837, 900]],
};

/** Lich's four specials, its free recovery and its frost normals near the Archer, replayed across each. */
const LICH: MatchScript = {
  characters: [Character.lich, Character.archer], stage: 0, stocks: 3, minutes: 0, frames: 480,
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

/** Records the acceptance tapes by name, and checks they press every bound source. */
export function generateTapes(): Map<string, string> {
  const pressed = [new Set<string>(), new Set<string>()];
  const tapes = new Map([
    ["actions", recordTape("Every bound source pressed by both players, with short replays.", [ACTIONS], pressed)],
    ["rollback", recordTape("Combat replayed from one frame up to the whole retained history.", [ROLLBACK])],
    ["rematch", recordTape("A one-stock match ends, both players confirm the rematch, a new match runs.", [FIRST_MATCH, SECOND_MATCH])],
    ["blademaster", recordTape("Blademaster's specials, follow-up, smashes, aerials and throws against Archer, with replays and corrected predictions.", [{
      characters: [Character.blademaster, Character.archer], stage: 0, stocks: 3, minutes: 0, frames: 480,
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
    ["computer", recordTape("A player against the computer on the raised decks, with replays.", [COMPUTER])],
    ["lich", recordTape("Lich's specials, free recovery and normals against the Archer, with replays.", [LICH])],
    ["moving-platforms", recordTape("Moving decks, jumping, dropping through, predictions and rollback over complete path cycles.", [{
      characters: [Character.archer, Character.rifleman], stage: 3, stocks: 3, minutes: 0, frames: 620,
      holds: [[[1, 20, RIGHT, WALK], [30, 10, JUMP], [180, 3, DOWN], [240, 10, JUMP], [400, 10, JUMP]], [[1, 10, JUMP], [140, 3, DOWN], [300, 10, JUMP]]],
      approaches: [[], []], rollbacks: [[57, 120], [357, 420], [537, 600]], predictions: [[250, 260]],
    }])],
    ["patterned-platforms", recordTape("Two independently patterned platforms through full loops and lifts with rollback.", [{
      characters: [Character.archer, Character.demonHunter], stage: 4, stocks: 3, minutes: 0, frames: 520,
      holds: [[[1, 10, JUMP], [140, 3, DOWN], [220, 10, JUMP]], [[1, 10, JUMP], [100, 3, DOWN], [180, 10, JUMP]]],
      approaches: [[], []], rollbacks: [[147, 210], [437, 500]], predictions: [[240, 250]],
    }])],
    ...[
      ["wind", 10, 1900, undefined],
      ["carried", 11, 940, "test-air 0 -420 125"],
      ["cannon", 12, 650, "test-air 0 -760 -350"],
      ["timed-lift", 13, 440, "test-air 0 -330 125"],
    ].map(([name, stage, frames, placement]) => [String(name), recordTape(`Deterministic ${name} hazard, controller presses, corrected predictions and rollback.`, [{
      characters: [Character.archer, Character.rifleman], stage: Number(stage), stocks: 3, minutes: 0, frames: Number(frames),
      ...(typeof placement === "string" ? { placement } : {}),
      holds: [[[30, 1, ATTACK], [300, 1, SPECIAL]], []], approaches: [[], []],
      rollbacks: [[37, 100], [337, 400]], predictions: [[120, 130]],
    }])] as const),
  ]);
  pressed.forEach((sources, slot) => {
    const missing = [...SOURCES.keys()].filter(source => !sources.has(source));
    if (missing.length > 0) throw new Error(`the actions tape never presses ${missing.join(", ")} for slot ${slot}`);
  });
  if (SOURCES.size !== 18 || new Set(SOURCES.values()).size !== ACTION_COUNT) throw new Error("the standard layout no longer binds the sources the tapes press");
  return tapes;
}
