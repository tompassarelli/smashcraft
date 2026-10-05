// The companion helper as headless clients need it: per client, the journal
// text it types into the integrity build's edit box (readiness, one I4 row
// per frame, the end marker) and its quiescence file. Like the real helper it
// types at most TEXT_WINDOW records past what the map's receipt has consumed.
import type { HeadlessClient, NativeBehaviors } from "wisp/src/headless/client";
import type { Lockstep } from "wisp/src/headless/lockstep";
import { Action, bit } from "../../src/game/input/actions";
import { type InputRow, inputRow } from "../../src/game/input/inputRow";
import { encodePacket, inputPacket } from "../../src/game/input/wire";
import { TEXT_WINDOW, textEnvelope } from "../../src/game/netcode/journal/text";
import { quiescentFile } from "../../src/game/shell/journalFiles";
import { journalLifecycleFile, journalReadyFile } from "../../src/runtime/gameFiles";


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
  box: unknown;
  text: string;
  epoch: number;
  sequence: number;
  state: "idle" | "ready" | "journaling" | "ended";
  readonly queue: string[];
  journaled: number;
  started: number;
}

export class JournalHelpers {
  private readonly helpers = new Map<number, Helper>();
  workload: Workload = { denseCycles: 0, walkers: [] };

  /** build: the map build whose journal files the helpers follow. */
  constructor(private readonly build: string) {}

  private helper(slot: number): Helper {
    let helper = this.helpers.get(slot);
    if (helper === undefined) {
      helper = { box: undefined, text: "", epoch: 0, sequence: 0, state: "idle", queue: [], journaled: 0, started: 0 };
      this.helpers.set(slot, helper);
    }
    return helper;
  }

  /** The edit box: the frame given the journal's text limit. Its text is the helper's. */
  natives(client: HeadlessClient): NativeBehaviors {
    const helper = this.helper(client.slot);
    return {
      BlzFrameSetTextSizeLimit: (frame: unknown) => {
        helper.box = frame;
      },
      BlzFrameGetText: (frame: unknown) => (frame === helper.box ? helper.text : ""),
      BlzFrameSetText: (frame: unknown, text: string) => {
        if (frame === helper.box) helper.text = text;
      },
    };
  }

  /** One frame of every helper, after the clients ran it. */
  service(clients: Lockstep): void {
    for (const client of clients.clients) {
      const helper = this.helper(client.slot);
      const next = helper.epoch + 1;
      if ((helper.state === "idle" || helper.state === "ended") && client.files.has(journalReadyFile(this.build, next, client.slot))) {
        Object.assign(helper, { epoch: next, sequence: 0, text: "", state: "ready" });
        helper.queue.length = 0;
        helper.queue.push(`JR1${next}`);
      }
      const { epoch } = helper;
      if (helper.state === "ready" && client.files.has(journalLifecycleFile(this.build, epoch, client.slot, "start"))) {
        Object.assign(helper, { state: "journaling", journaled: 0, started: clients.frame });
      }
      if (helper.state === "journaling" && client.files.has(journalLifecycleFile(this.build, epoch, client.slot, "end"))) {
        helper.state = "ended";
        helper.queue.push(`JE1${epoch}`);
        client.published.set(quiescentFile({ build: this.build, epoch, slot: client.slot }), ["Q"]);
      }
      while (helper.state === "journaling" && helper.journaled <= clients.frame - helper.started) {
        helper.journaled++;
        const packet = inputPacket(epoch, helper.journaled, [rowFor(client.slot, helper.journaled, this.workload)]);
        if (packet === undefined) throw new Error("no packet");
        helper.queue.push(encodePacket(packet));
      }
      const receipt = client.files.get(`smashcraft-journal-text-ack-${this.build}-e${epoch}-p${client.slot}.txt`)?.join("") ?? "";
      const consumed = Number(/ consumed=(\d+)/.exec(receipt)?.[1] ?? 0);
      for (let payload = helper.queue.shift(); payload !== undefined; payload = helper.queue.shift()) {
        if (helper.sequence >= consumed + TEXT_WINDOW) {
          helper.queue.unshift(payload);
          break;
        }
        helper.sequence++;
        helper.text += textEnvelope(epoch, helper.sequence, payload) ?? "";
      }
    }
  }
}
