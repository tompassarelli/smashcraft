import { Action, bit } from "../src/game/input/actions";
import { type InputRow, inputRow } from "../src/game/input/inputRow";

interface Held {
  readonly buttons: number;
  readonly axisX: number;
  readonly axisZ: number;
}

export interface Command {
  readonly frame: number;
  readonly held: Held;
  readonly tap: number;
}

const NEUTRAL: Held = { buttons: 0, axisX: 0, axisZ: 0 };

const BUTTONS: Readonly<Record<string, number>> = {
  attack: bit(Action.attack), special: bit(Action.special), jump: bit(Action.jump), grab: bit(Action.grab),
  shield: bit(Action.leftTrigger), walk: bit(Action.walk), "short-hop": bit(Action.shortHop),
  "smash-left": bit(Action.smashLeft), "smash-right": bit(Action.smashRight), "smash-up": bit(Action.smashUp), "smash-down": bit(Action.smashDown),
};

const STICKS: Readonly<Record<string, readonly [number, number, number]>> = {
  left: [bit(Action.moveLeft), -127, 0], right: [bit(Action.moveRight), 127, 0],
  up: [bit(Action.moveUp), 0, 127], down: [bit(Action.moveDown), 0, -127],
};

const COMMAND_WORDS: readonly string[] = [...Object.keys(STICKS), ...Object.keys(BUTTONS), "neutral"];

const clamp = (value: number): number => Math.max(-127, Math.min(127, Math.trunc(value)));

function stickBit(axis: number, negative: number, positive: number): number {
  return axis <= -1 ? negative : axis >= 1 ? positive : 0;
}

export function parseCommands(text: string): Command[] {
  const commands: Command[] = [];
  let previous = -1;
  text.split("\n").forEach((raw, index) => {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") return;
    const [stamp, ...words] = line.split(/\s+/);
    const frame = Number(stamp);
    const where = `line ${index + 1}`;
    if (!Number.isInteger(frame) || frame < 0) throw new Error(`${where}: "${stamp}" is not a frame number`);
    if (frame < previous) throw new Error(`${where}: frame ${frame} comes after frame ${previous}`);
    previous = frame;
    let buttons = 0;
    let tap = 0;
    let axisX = 0;
    let axisZ = 0;
    for (const word of words) {
      const once = word.endsWith("!");
      const name = once ? word.slice(0, -1) : word;
      const axis = /^([xz])=(-?\d+)$/.exec(word);
      if (name === "neutral" && !once) continue;
      if (axis !== null) {
        if (axis[1] === "x") axisX = clamp(Number(axis[2]));
        else axisZ = clamp(Number(axis[2]));
        continue;
      }
      const button = BUTTONS[name];
      const stick = STICKS[name];
      if (button === undefined && stick === undefined) throw new Error(`${where}: unknown command "${word}" (known: ${COMMAND_WORDS.join(" ")}, x=N z=N, a trailing ! for one frame)`);
      if (once) {
        if (button === undefined) throw new Error(`${where}: "${word}" taps a stick direction; hold it or use x=N z=N`);
        tap |= button;
      } else if (button !== undefined) buttons |= button;
      else if (stick !== undefined) {
        buttons |= stick[0];
        axisX = stick[1] !== 0 ? stick[1] : axisX;
        axisZ = stick[2] !== 0 ? stick[2] : axisZ;
      }
    }
    commands.push({ frame, held: { buttons: buttons | stickBit(axisX, bit(Action.moveLeft), bit(Action.moveRight)) | stickBit(axisZ, bit(Action.moveDown), bit(Action.moveUp)), axisX, axisZ }, tap });
  });
  return commands;
}

export class InputTimeline {
  private index = 0;
  private held: Held = NEUTRAL;
  private before = 0;
  private readonly commands: readonly Command[];
  readonly delay: number;

  constructor(commands: readonly Command[], delay: number) {
    if (!Number.isInteger(delay) || delay < 0) throw new Error(`input delay ${delay} is not a whole number of frames`);
    this.commands = commands;
    this.delay = delay;
  }

  row(frame: number): InputRow {
    let tap = 0;
    while (this.index < this.commands.length && (this.commands[this.index]?.frame ?? Infinity) + this.delay <= frame) {
      const command = this.commands[this.index];
      if (command === undefined) break;
      this.held = command.held;
      if (command.frame + this.delay === frame) tap = command.tap;
      this.index++;
    }
    const { axisX, axisZ } = this.held;
    const buttons = this.held.buttons | tap;
    const pressed = buttons & ~this.before;
    const released = this.before & ~buttons;
    this.before = buttons;
    const row = inputRow({
      held: buttons, pressed, released, axisX, axisZ,
      triggerLeft: (buttons & bit(Action.leftTrigger)) !== 0 ? 255 : 0,
      specialX: (pressed & bit(Action.special)) !== 0 ? Math.sign(axisX) : 0,
      specialZ: (pressed & bit(Action.special)) !== 0 ? Math.sign(axisZ) : 0,
      dodgeX: (pressed & bit(Action.leftTrigger)) !== 0 ? Math.sign(axisX) : 0,
      dodgeZ: (pressed & bit(Action.leftTrigger)) !== 0 ? Math.sign(axisZ) : 0,
      ledgeVertical: (pressed & (bit(Action.moveUp) | bit(Action.moveDown))) !== 0 ? Math.sign(axisZ) : 0,
    });
    if (row === undefined) throw new Error(`frame ${frame}: the commands make an impossible input`);
    return row;
  }
}

export interface Hitbox {
  readonly move: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly gap: number;
}

export interface FighterView {
  readonly label: string;
  readonly x: number;
  readonly z: number;
  readonly percent: number;
  readonly stocks: number;
  readonly state: string;
  readonly facing: number;
  readonly ledge: number;
  readonly platform: { readonly dx: number; readonly dz: number } | undefined;
  readonly hitboxes: readonly Hitbox[];
}

const num = (value: number): string => {
  const rounded = Math.round(value);
  return rounded === 0 ? "0" : String(rounded);
};

const word = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ledgeDistance(x: number, left: number, right: number): number {
  return Math.min(x - left, right - x);
}

function fighterText(view: FighterView): string {
  const platform = view.platform === undefined ? "-" : `${num(view.platform.dx)}/${num(view.platform.dz)}`;
  const boxes = view.hitboxes.length === 0 ? "-" : view.hitboxes.map((box) => `${word(box.move)}[${num(box.minX)}..${num(box.maxX)},${num(box.minZ)}..${num(box.maxZ)}]gap${num(box.gap)}`).join("+");
  return `${view.label} x${num(view.x)} z${num(view.z)} ${num(view.percent)}% ${view.stocks}st ${view.state} ${view.facing < 0 ? "L" : "R"} ledge${num(view.ledge)} plat${platform} hb${boxes}`;
}

export function frameLine(frame: number, views: readonly FighterView[]): string {
  return `${frame} ${views.map(fighterText).join(" | ")}`;
}

interface Header {
  readonly seed: number;
  readonly stage: string;
  readonly you: string;
  readonly cpu: string;
  readonly level: string;
  readonly delay: number;
  readonly every: number;
  readonly stocks: number;
}

const LEGEND = "# frame, then per fighter: x z (world units, +x right, +z up), percent, stocks, state, facing, ledge (signed distance to the nearer deck edge, negative once past it), plat (dx/dz to the nearest side platform, dx 0 under or over it), hb (an active hitbox [local x range,z range, facing-relative] with its gap to the other fighter, within reach only)";

export function headerLines(header: Header): string[] {
  return [
    `# text-match seed=${header.seed} stage=${header.stage} A=${header.you} (stdin) B=${header.cpu} (${header.level}) delay=${header.delay} every=${header.every} stocks=${header.stocks}`,
    LEGEND,
  ];
}

export function resultLine(frame: number, winner: string, timedOut: boolean): string {
  return `# end frame=${frame} winner=${winner}${timedOut ? " (time)" : ""}`;
}
