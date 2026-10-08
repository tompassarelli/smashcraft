// The companion helper as headless clients need it: per client, the journal
// text it types into the integrity build's edit box while the box is shown
// (readiness, I4 rows or an I5 backlog as the companion's are, pause
// acknowledgments, the end marker) and its quiescence file. It types as
// wc3-journal does: at most TEXT_WINDOW records past what the map's receipt has
// consumed, and with pairs at most TYPED_AHEAD_CHARACTERS past what it
// received, joining waiting packets into records within that bound. It
// journals and types frame by frame of its own clock, also while the game
// stands still, so what it typed then reaches the box at once.
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, inputRow } from "../../src/game/input/inputRow";
import { encodeInputMessage, encodePacket, inputPacket } from "../../src/game/input/wire";
import { decodeTransport } from "../../src/game/netcode/journal/transport";
import { TEXT_WINDOW, TYPED_AHEAD_CHARACTERS, textEnvelope } from "../../src/game/netcode/journal/text";
import { momentRequest } from "../../src/game/replay/moment";
import { padDecimal } from "../../src/game/netcode/journal/decimal";
import { quiescentFile } from "../../src/game/shell/journalFiles";
import { journalControlFile, journalLifecycleFile, journalReadyFile } from "../../src/runtime/gameFiles";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";


/** #26's twelve bindings as the actions each press reports, then attack and special together. */
const PULSES: readonly number[] = [
  bit(Action.moveLeft) | bit(Action.smashLeft),
  bit(Action.moveRight) | bit(Action.smashRight),
  bit(Action.moveDown) | bit(Action.smashDown),
  bit(Action.jump) | bit(Action.moveUp),
  bit(Action.jump),
  bit(Action.jump),
  bit(Action.attack),
  bit(Action.special),
  bit(Action.leftTrigger),
  bit(Action.rightTrigger),
  bit(Action.grab),
  bit(Action.walk),
  bit(Action.attack) | bit(Action.special),
];

/** What both helpers play in one match, in frames of the helper's own clock from 1. */
export interface Workload {
  /** Cycles of #26's dense taps, one every three frames (50 ms), pressed and released within a frame. */
  readonly denseCycles: number;
  /** Slots that walk off their own side from the first frame, slot 0 left and the others right; their taps leave the stick alone. */
  readonly walkers: readonly number[];
}

const DIRECTIONS = bit(Action.moveLeft) | bit(Action.moveRight) | bit(Action.moveDown) | bit(Action.moveUp) | bit(Action.smashLeft) | bit(Action.smashRight) | bit(Action.smashDown) | bit(Action.smashUp);

const tapFrames = (workload: Workload) => workload.denseCycles * PULSES.length * 3;

/** The letters, digits and underscores right after `key` in `text`; "" without the key. Plain string calls, so Lua programs can use the helper. */
function wordAfter(text: string, key: string): string {
  const at = text.indexOf(key);
  if (at < 0) return "";
  const start = at + key.length;
  let end = start;
  for (; end < text.length; end++) {
    const code = text.charCodeAt(end);
    if (!((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95)) break;
  }
  return text.substring(start, end);
}

/** The row a slot's helper journals for a frame of the workload. */
export function rowFor(slot: number, frame: number, workload: Workload): InputRow {
  const taps = tapFrames(workload);
  const direction = workload.walkers.includes(slot) ? bit(slot === 0 ? Action.moveLeft : Action.moveRight) : 0;
  const pulse = frame <= taps && floorMod(frame, 3) === 1 ? PULSES[floorMod(floorDiv(frame - 1, 3), PULSES.length)] ?? 0 : 0;
  const tap = direction === 0 ? pulse : pulse & ~DIRECTIONS;
  const row = inputRow({ held: direction, pressed: tap | (frame === 1 ? direction : 0), released: tap, axisX: direction === 0 ? 0 : slot === 0 ? -127 : 127 });
  if (row === undefined) throw new Error(`no row for frame ${frame}`);
  return row;
}


interface Helper {
  epoch: number;
  sequence: number;
  /** Records typed and not yet received, by sequence, with their characters. */
  readonly typed: [sequence: number, characters: number][];
  state: "idle" | "ready" | "journaling" | "ended";
  readonly queue: string[];
  journaled: number;
  started: number;
  /** The map's next control request: a pause, its commit or a resume. */
  control: number;
  /** While a pause is prepared or in effect, the last frame to journal. */
  limit: number | undefined;
  /** Its Start asked to pause and the map's request hasn't reached it yet. */
  sealed: boolean;
}

export class JournalHelpers {
  private readonly helpers = new Map<number, Helper>();
  workload: Workload = { denseCycles: 0, walkers: [] };
  /** Slots whose helper types nothing, as when it isn't running or has stalled; its clock keeps journaling rows. */
  readonly silent = new Set<number>();
  /** The row a slot's controller makes on a frame of its helper's clock; the workload's by default. */
  rows: (slot: number, frame: number) => InputRow = (slot, frame) => rowFor(slot, frame, this.workload);
  /** Characters each slot's helper typed into its client's edit box in the last service; none for a slot that typed nothing. */
  readonly typed = new Map<number, number>();
  /**
   * Type as wc3-journal did before 8ac53f2f: every record the window allows
   * at once, none joined, which after a stall is a burst of hundreds of characters.
   */
  bursts = false;
  /** The helpers' clock in frames, such as a soak's wall clock; the clients' frames by default. */
  clock: ((clients: Lockstep) => number) | undefined = undefined;
  /**
   * build: the map build whose journal files the helpers follow. pairs: as
   * the companion journals, a row waits for the next frame's, so each packet
   * carries two frames until a pause seals one alone.
   */
  constructor(
    private readonly build: string,
    private readonly pairs = false,
  ) {}

  private helper(slot: number): Helper {
    let helper = this.helpers.get(slot);
    if (helper === undefined) {
      helper = { epoch: 0, sequence: 0, typed: [], state: "idle", queue: [], journaled: 0, started: 0, control: 1, limit: undefined, sealed: false };
      this.helpers.set(slot, helper);
    }
    return helper;
  }

  /** Slot's helper types a request to save a moment, as the companion does when View is held for a second. */
  requestMoment(slot: number): void {
    const helper = this.helper(slot);
    helper.queue.push(momentRequest(helper.epoch));
  }

  /**
   * Slot's controller presses Start, as the companion types it among the rows:
   * a pause at the next frame it journals, or a resume while paused or
   * while its pause is still settling.
   */
  pressStart(slot: number): void {
    const helper = this.helper(slot);
    const request = `JP1${padDecimal(helper.epoch, 10)}${padDecimal(helper.control, 10)}`;
    const pause = helper.limit === undefined && !helper.sealed;
    helper.sealed ||= pause;
    helper.queue.push(pause ? `${request}P${padDecimal(helper.journaled + 1, 10)}` : `${request}R`);
  }

  /** Frames a slot's helper has journaled this match; undefined while it isn't journaling. */
  journaled(slot: number): number | undefined {
    const helper = this.helpers.get(slot);
    return helper?.state === "journaling" ? helper.journaled : undefined;
  }

  /** One frame of every helper, after the clients ran it. */
  service(clients: Lockstep): void {
    const now = this.clock?.(clients) ?? clients.frame;
    this.typed.clear();
    for (const client of clients.clients) {
      const helper = this.helper(client.slot);
      const next = helper.epoch + 1;
      if ((helper.state === "idle" || helper.state === "ended") && client.files.has(journalReadyFile(this.build, next, client.slot))) {
        helper.epoch = next;
        helper.sequence = 0;
        helper.state = "ready";
        helper.control = 1;
        helper.limit = undefined;
        helper.sealed = false;
        helper.queue.length = 0;
        helper.typed.length = 0;
        helper.queue.push(`JR1${next}`);
      }
      const { epoch } = helper;
      const start = client.files.get(journalLifecycleFile(this.build, epoch, client.slot, "start"));
      if (helper.state === "ready" && start !== undefined) {
        const first = Number(wordAfter(start.join(""), " frame="));
        if (!Number.isInteger(first) || first < 1) throw new Error("invalid journal start frame");
        helper.state = "journaling";
        helper.journaled = first - 1;
        helper.started = now - helper.journaled;
      }
      if (helper.state === "journaling" && client.files.has(journalLifecycleFile(this.build, epoch, client.slot, "end"))) {
        helper.state = "ended";
        helper.queue.push(`JE1${epoch}`);
        client.published.set(quiescentFile({ build: this.build, epoch, slot: client.slot }), ["Q"]);
      }
      // Control requests, answered as the companion does: a pause stops at the next frame,
      // its commit journals up to the committed frame, and a resume restarts the clock there.
      const control = helper.state === "journaling" ? client.files.get(journalControlFile(this.build, epoch, client.slot, helper.control)) : undefined;
      const controlText = control?.join("") ?? "";
      const request = wordAfter(controlText, "state=");
      const frame = wordAfter(controlText, " frame=");
      const acknowledge = (stage: string, at: number) => helper.queue.push(`ACK1|${helper.control}|${stage}|${at}`);
      let committed: number | undefined;
      if (request === "PAUSE") {
        acknowledge("PREPARE", helper.journaled + 1);
        helper.limit = helper.journaled;
        helper.sealed = false;
      } else if (request === "PAUSE_COMMIT") {
        committed = Number(frame);
        helper.limit = committed - 1;
      } else if (request === "RESUME") {
        // The companion restarts at the paused frame, keeping rows it already journaled past it.
        acknowledge("RESUME", Number(frame));
        helper.limit = undefined;
        helper.started = now - helper.journaled;
      }
      // The map's edit box, which has the keyboard while it is shown, and its receipt, which can't change before the next frame.
      const box = client.frames.named("JournalControllerInput", 969);
      const typing = box !== undefined && client.frames.shown(box) && !this.silent.has(client.slot);
      const receipt = client.files.get(`smashcraft-journal-text-ack-${this.build}-e${epoch}-p${client.slot}.txt`)?.join("") ?? "";
      const consumed = Number(wordAfter(receipt, " consumed=") === "" ? "0" : wordAfter(receipt, " consumed="));
      const received = Number(wordAfter(receipt, " received=") === "" ? "0" : wordAfter(receipt, " received="));
      while ((helper.typed[0]?.[0] ?? Infinity) <= received) helper.typed.shift();
      let ahead = helper.typed.reduce((sum, [, characters]) => sum + characters, 0);
      const before = box?.text.length ?? 0;
      /** Types every queued record the window allows, as the companion does whenever it may. */
      const type = () => {
        if (!typing || box === undefined) return;
        for (let payload = helper.queue.shift(); payload !== undefined; payload = helper.queue.shift()) {
          const envelope = textEnvelope(epoch, helper.sequence + 1, payload) ?? "";
          if (helper.sequence >= consumed + TEXT_WINDOW || (this.pairs && !this.bursts && ahead > 0 && ahead + envelope.length > TYPED_AHEAD_CHARACTERS)) {
            helper.queue.unshift(payload);
            break;
          }
          helper.sequence++;
          helper.typed.push([helper.sequence, envelope.length]);
          ahead += envelope.length;
          box.text += envelope;
        }
      };
      type();
      // Frame by frame of the helper's clock, as the companion journals and types between the game's frames,
      // also while the game stands still: then what it typed waits in the box, and later packets join.
      const due = helper.limit ?? Math.floor(now - helper.started) + 1;
      while (helper.state === "journaling" && helper.journaled < due) {
        const first = helper.journaled + 1;
        if (this.pairs && first === due && helper.limit === undefined) break;
        const rows = [this.rows(client.slot, first)];
        if (this.pairs && first < due) rows.push(this.rows(client.slot, first + 1));
        const packet = inputPacket(epoch, first, rows);
        if (packet === undefined) throw new Error("no packet");
        const last = helper.queue.length - 1;
        const untyped = helper.queue[last];
        let joined: string | undefined;
        if (this.pairs && !this.bursts && untyped !== undefined) {
          const previous = decodeTransport(untyped);
          const start = previous?.[0];
          if (start !== undefined && start.epoch === epoch) {
            const waiting = previous?.flatMap(part => part.rows) ?? [];
            if (start.firstFrame + waiting.length === first) {
              const combined = [...waiting, ...rows];
              const through = first + rows.length - 1;
              const message = encodeInputMessage(epoch, start.firstFrame, through, frame => {
                const row = combined[frame - start.firstFrame];
                if (row === undefined) throw new Error("no queued journal row");
                return row;
              });
              const envelope = textEnvelope(epoch, helper.sequence + 1, message.wire);
              if (message.lastFrame === through && envelope !== undefined && envelope.length <= TYPED_AHEAD_CHARACTERS) joined = message.wire;
            }
          }
        }
        if (joined === undefined) helper.queue.push(encodePacket(packet));
        else helper.queue[last] = joined;
        helper.journaled += rows.length;
        type();
      }
      if (committed !== undefined) acknowledge("PAUSE", committed);
      if (request !== "") helper.control++;
      type();
      if (box !== undefined) this.typed.set(client.slot, box.text.length - before);
    }
  }
}
