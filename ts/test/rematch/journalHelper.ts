// The companion helper as headless clients need it: per client, the journal
// text it types into the integrity build's edit box while the box is shown
// (readiness, I4 rows of one frame, or of two as the companion's are, pause
// acknowledgments, the end marker) and its quiescence file. Like the real
// helper it types at most TEXT_WINDOW records past what the map's receipt has
// consumed.
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, inputRow } from "../../src/game/input/inputRow";
import { encodePacket, inputPacket } from "../../src/game/input/wire";
import { TEXT_WINDOW, textEnvelope } from "../../src/game/netcode/journal/text";
import { quiescentFile } from "../../src/game/shell/journalFiles";
import { journalControlFile, journalLifecycleFile, journalReadyFile } from "../../src/runtime/gameFiles";


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

function rowFor(slot: number, frame: number, workload: Workload): InputRow {
  const taps = tapFrames(workload);
  const direction = workload.walkers.includes(slot) ? bit(slot === 0 ? Action.moveLeft : Action.moveRight) : 0;
  const pulse = frame <= taps && frame % 3 === 1 ? PULSES[((frame - 1) / 3) % PULSES.length] ?? 0 : 0;
  const tap = direction === 0 ? pulse : pulse & ~DIRECTIONS;
  const row = inputRow({ held: direction, pressed: tap | (frame === 1 ? direction : 0), released: tap, axisX: direction === 0 ? 0 : slot === 0 ? -127 : 127 });
  if (row === undefined) throw new Error(`no row for frame ${frame}`);
  return row;
}

interface Helper {
  epoch: number;
  sequence: number;
  state: "idle" | "ready" | "journaling" | "ended";
  readonly queue: string[];
  journaled: number;
  started: number;
  /** The map's next control request: a pause, its commit or a resume. */
  control: number;
  /** While a pause is prepared or in effect, the last frame to journal. */
  limit: number | undefined;
}

export class JournalHelpers {
  private readonly helpers = new Map<number, Helper>();
  workload: Workload = { denseCycles: 0, walkers: [] };
  /** Slots whose helper types nothing, as when it isn't running or has stalled; its clock keeps journaling rows. */
  readonly silent = new Set<number>();
  /** The row a slot's controller makes on a frame of its helper's clock; the workload's by default. */
  rows: (slot: number, frame: number) => InputRow = (slot, frame) => rowFor(slot, frame, this.workload);
  /** The helpers' clock in frames, such as a soak's wall clock; the clients' frames by default. */
  clock: ((clients: Lockstep) => number) | undefined = undefined;
  /** As the companion journals: a row waits for the next frame's, so each packet carries two frames until a pause seals one alone. */
  pairsOnly = false;

  /**
   * build: the map build whose journal files the helpers follow. pairs: a
   * packet carries two frames once two are due, as the companion helper's do.
   */
  constructor(
    private readonly build: string,
    private readonly pairs = false,
  ) {}

  private helper(slot: number): Helper {
    let helper = this.helpers.get(slot);
    if (helper === undefined) {
      helper = { epoch: 0, sequence: 0, state: "idle", queue: [], journaled: 0, started: 0, control: 1, limit: undefined };
      this.helpers.set(slot, helper);
    }
    return helper;
  }

  /** Frames a slot's helper has journaled this match; undefined while it isn't journaling. */
  journaled(slot: number): number | undefined {
    const helper = this.helpers.get(slot);
    return helper?.state === "journaling" ? helper.journaled : undefined;
  }

  /** One frame of every helper, after the clients ran it. */
  service(clients: Lockstep): void {
    const now = this.clock?.(clients) ?? clients.frame;
    for (const client of clients.clients) {
      const helper = this.helper(client.slot);
      const next = helper.epoch + 1;
      if ((helper.state === "idle" || helper.state === "ended") && client.files.has(journalReadyFile(this.build, next, client.slot))) {
        Object.assign(helper, { epoch: next, sequence: 0, state: "ready", control: 1, limit: undefined });
        helper.queue.length = 0;
        helper.queue.push(`JR1${next}`);
      }
      const { epoch } = helper;
      if (helper.state === "ready" && client.files.has(journalLifecycleFile(this.build, epoch, client.slot, "start"))) {
        Object.assign(helper, { state: "journaling", journaled: 0, started: now });
      }
      if (helper.state === "journaling" && client.files.has(journalLifecycleFile(this.build, epoch, client.slot, "end"))) {
        helper.state = "ended";
        helper.queue.push(`JE1${epoch}`);
        client.published.set(quiescentFile({ build: this.build, epoch, slot: client.slot }), ["Q"]);
      }
      // Control requests, answered as the companion does: a pause stops at the next frame,
      // its commit journals up to the committed frame, and a resume restarts the clock there.
      const control = helper.state === "journaling" ? client.files.get(journalControlFile(this.build, epoch, client.slot, helper.control)) : undefined;
      const [, request = "", frame = "0"] = /state=(\w+) frame=(\d+)/.exec(control?.join("") ?? "") ?? [];
      const acknowledge = (stage: string, at: number) => helper.queue.push(`ACK1|${helper.control}|${stage}|${at}`);
      let committed: number | undefined;
      if (request === "PAUSE") {
        acknowledge("PREPARE", helper.journaled + 1);
        helper.limit = helper.journaled;
      } else if (request === "PAUSE_COMMIT") {
        committed = Number(frame);
        helper.limit = committed - 1;
      } else if (request === "RESUME") {
        acknowledge("RESUME", helper.journaled + 1);
        helper.limit = undefined;
        helper.started = now - helper.journaled;
      }
      const due = helper.limit ?? Math.floor(now - helper.started) + 1;
      while (helper.state === "journaling" && helper.journaled < due) {
        const first = helper.journaled + 1;
        if (this.pairsOnly && first === due && helper.limit === undefined) break;
        const rows = [this.rows(client.slot, first)];
        if (this.pairs && first < due) rows.push(this.rows(client.slot, first + 1));
        const packet = inputPacket(epoch, first, rows);
        if (packet === undefined) throw new Error("no packet");
        helper.queue.push(encodePacket(packet));
        helper.journaled += rows.length;
      }
      if (committed !== undefined) acknowledge("PAUSE", committed);
      if (request !== "") helper.control++;
      // The map's edit box, which has the keyboard while it is shown.
      const box = client.frames.named("JournalControllerInput", 969);
      if (box === undefined || !client.frames.shown(box) || this.silent.has(client.slot)) continue;
      const receipt = client.files.get(`smashcraft-journal-text-ack-${this.build}-e${epoch}-p${client.slot}.txt`)?.join("") ?? "";
      const consumed = Number(/ consumed=(\d+)/.exec(receipt)?.[1] ?? 0);
      for (let payload = helper.queue.shift(); payload !== undefined; payload = helper.queue.shift()) {
        if (helper.sequence >= consumed + TEXT_WINDOW) {
          helper.queue.unshift(payload);
          break;
        }
        helper.sequence++;
        box.text += textEnvelope(epoch, helper.sequence, payload) ?? "";
      }
    }
  }
}
