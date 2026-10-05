// Journal text typed into an edit box, for the ingress path that holds
// keyboard focus during a match. The helper types text envelopes (text.ts)
// and polls the receipt the map writes as a Preload file. The receipt, the
// chat file name and the failure reasons are read by the helper and by probe
// tooling, so their spellings are a protocol. The natives live in
// platform/editboxJournal.ts.
import { JournalTextStream, TEXT_WINDOW } from "./text";

/** Characters the edit box must hold: the helper's bounded backlog. */
export const EDITBOX_CAPACITY = 4096;

/** Drained text is acknowledged at most once in this many ticks: every receipt is a file write. */
const RECEIPT_TICKS = 6;

/** The edit box's part in handing the keyboard to Warcraft's chat entry. */
export type ChatPhase =
  /** The box has focus and receives controller text. */
  | "receiving"
  /** The player asked to chat; the box keeps receiving until the helper stops typing. */
  | "requested"
  /** The box let go of focus; waiting for Warcraft's chat entry to open. */
  | "released"
  /** Warcraft's chat entry is open; the box takes the keyboard back when it closes. */
  | "chatting";

/** The receipt reports the phase by number. */
const CHAT_STATE: Readonly<Record<ChatPhase, number>> = { receiving: 0, requested: 1, released: 2, chatting: 3 };

export type EditboxFailure =
  | "controller text capacity was not accepted"
  | "controller record changed or exceeded the bounded receive window"
  | "controller text capacity reached"
  | "controller text changed during admission";

/**
 * One epoch of edit box ingress, without natives: the platform hands the
 * box's text in and writes back what remains.
 */
export class EditboxSession {
  readonly stream: JournalTextStream;
  chat: ChatPhase = "receiving";
  /** The local player's latest chat request; every receipt echoes it. */
  chatSerial = 0;
  failure: EditboxFailure | undefined;
  private revision = 0;
  private ticks = 0;
  private dirty = false;

  /** textLimit: the characters the box accepted as its limit. */
  constructor(
    readonly build: string,
    readonly epoch: number,
    readonly slot: number,
    textLimit: number,
  ) {
    this.stream = new JournalTextStream(epoch);
    if (textLimit < EDITBOX_CAPACITY) this.failure = "controller text capacity was not accepted";
  }

  /** Whether typed text reaches the stream: not once the box let go for chat, and never after a failure. */
  receiving(): boolean {
    return this.failure === undefined && (this.chat === "receiving" || this.chat === "requested");
  }

  /**
   * Feeds the box's text to the stream and returns the text the box keeps:
   * only received or skipped records leave, so an incomplete record and
   * whatever was typed after it stay.
   */
  drain(text: string): string {
    let rest = text;
    for (let attempt = 0; attempt < TEXT_WINDOW; attempt++) {
      const inspection = this.stream.inspect(rest);
      if (inspection.kind === "invalid") {
        this.failure = "controller record changed or exceeded the bounded receive window";
        return rest;
      }
      if (inspection.kind === "wait") {
        if (rest.length >= EDITBOX_CAPACITY) this.failure = "controller text capacity reached";
        else this.dirty = true;
        return rest;
      }
      rest = rest.substring(inspection.width);
      this.dirty = true;
    }
    return rest;
  }

  /** Marks the next payload applied; one that vanished before it was applied is a failure. */
  consume(): boolean {
    if (!this.stream.consume()) {
      this.failure = "controller text changed during admission";
      return false;
    }
    this.dirty = true;
    return true;
  }

  /** Starts a chat handoff for the local player's request; false unless the box is receiving. */
  requestChat(serial: number): boolean {
    if (this.chat !== "receiving") return false;
    this.chatSerial = serial;
    this.chat = "requested";
    return true;
  }

  /** Counts a tick; true when drained text has waited long enough for a receipt. */
  tick(): boolean {
    this.ticks++;
    return this.dirty && this.ticks >= RECEIPT_TICKS;
  }

  /** The receipt to write now; chatEntry: whether Warcraft's chat entry was found. */
  receipt(chatEntry: boolean): { readonly name: string; readonly line: string } {
    this.revision++;
    this.ticks = 0;
    this.dirty = false;
    const { build, epoch, slot, stream } = this;
    return {
      name: `smashcraft-journal-text-ack-${build}-e${epoch}-p${slot}.txt`,
      line: `SMASHCRAFT TEXT ACK v=1 build=${build} epoch=${epoch} slot=${slot} received=${stream.received()} `
        + `consumed=${stream.acknowledged()} revision=${this.revision} chat=${this.chatSerial} `
        + `chatState=${CHAT_STATE[this.chat]} chatFrame=${chatEntry ? 1 : 0}`,
    };
  }

  /** The file whose "Q" says the helper has stopped typing for the current chat request. */
  chatFile(): string {
    return `smashcraft-journal-chat-${this.build}-e${this.epoch}-s${this.slot}-n${this.chatSerial}.pld`;
  }
}

/** The pause hint beside the box. */
export function pauseLabel(chat: ChatPhase, paused: boolean, pending: boolean, targetPaused: boolean): string {
  if (chat === "requested") return "Opening chat…";
  if (chat !== "receiving") return "Chat — match paused";
  if (pending) return targetPaused ? "Pausing…" : "Resuming…";
  return paused ? "Resume: Start" : "Pause: Start";
}
