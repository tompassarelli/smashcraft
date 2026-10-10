








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


interface Workload {

  readonly denseCycles: number;

  readonly walkers: readonly number[];
}

const DIRECTIONS = bit(Action.moveLeft) | bit(Action.moveRight) | bit(Action.moveDown) | bit(Action.moveUp) | bit(Action.smashLeft) | bit(Action.smashRight) | bit(Action.smashDown) | bit(Action.smashUp);

const tapFrames = (workload: Workload) => workload.denseCycles * PULSES.length * 3;


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

  readonly typed: [sequence: number, characters: number][];
  state: "idle" | "ready" | "journaling" | "ended";
  readonly queue: string[];
  journaled: number;
  started: number;

  control: number;

  limit: number | undefined;

  sealed: boolean;
}

export class JournalHelpers {
  private readonly helpers = new Map<number, Helper>();
  workload: Workload = { denseCycles: 0, walkers: [] };

  readonly silent = new Set<number>();

  rows: (slot: number, frame: number) => InputRow = (slot, frame) => rowFor(slot, frame, this.workload);

  readonly typed = new Map<number, number>();




  bursts = false;

  clock: ((clients: Lockstep) => number) | undefined = undefined;





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


  requestMoment(slot: number): void {
    const helper = this.helper(slot);
    helper.queue.push(momentRequest(helper.epoch));
  }






  pressStart(slot: number): void {
    const helper = this.helper(slot);
    const request = `JP1${padDecimal(helper.epoch, 10)}${padDecimal(helper.control, 10)}`;
    const pause = helper.limit === undefined && !helper.sealed;
    helper.sealed ||= pause;
    helper.queue.push(pause ? `${request}P${padDecimal(helper.journaled + 1, 10)}` : `${request}R`);
  }


  journaled(slot: number): number | undefined {
    const helper = this.helpers.get(slot);
    return helper?.state === "journaling" ? helper.journaled : undefined;
  }


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

        acknowledge("RESUME", Number(frame));
        helper.limit = undefined;
        helper.started = now - helper.journaled;
      }

      const box = client.frames.named("JournalControllerInput", 969);
      const typing = box !== undefined && client.frames.shown(box) && !this.silent.has(client.slot);
      const receipt = client.files.get(`smashcraft-journal-text-ack-${this.build}-e${epoch}-p${client.slot}.txt`)?.join("") ?? "";
      const consumed = Number(wordAfter(receipt, " consumed=") === "" ? "0" : wordAfter(receipt, " consumed="));
      const received = Number(wordAfter(receipt, " received=") === "" ? "0" : wordAfter(receipt, " received="));
      while ((helper.typed[0]?.[0] ?? Infinity) <= received) helper.typed.shift();
      let ahead = helper.typed.reduce((sum, [, characters]) => sum + characters, 0);
      const before = box?.text.length ?? 0;

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
