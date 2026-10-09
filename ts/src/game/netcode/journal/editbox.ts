
// Helper receipts, chat filenames and failure spellings are an external protocol.




import { JournalTextStream, TEXT_WINDOW } from "./text";


export const EDITBOX_CAPACITY = 4096;


const RECEIPT_TICKS = 2;


type ChatPhase =

  | "receiving"

  | "requested"

  | "released"

  | "chatting";


const CHAT_STATE: Readonly<Record<ChatPhase, number>> = { receiving: 0, requested: 1, released: 2, chatting: 3 };

export type EditboxFailure =
  | "controller text capacity was not accepted"
  | "controller record changed or exceeded the bounded receive window"
  | "controller text capacity reached"
  | "controller text changed during admission";





export class EditboxSession {
  readonly stream: JournalTextStream;
  chat: ChatPhase = "receiving";

  chatSerial = 0;
  failure: EditboxFailure | undefined;
  private revision = 0;
  private ticks = 0;
  private dirty = false;


  constructor(
    readonly build: string,
    readonly epoch: number,
    readonly slot: number,
    textLimit: number,
  ) {
    this.stream = new JournalTextStream(epoch);
    if (textLimit < EDITBOX_CAPACITY) this.failure = "controller text capacity was not accepted";
  }


  receiving(): boolean {
    return this.failure === undefined && (this.chat === "receiving" || this.chat === "requested");
  }






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


  consume(): boolean {
    if (!this.stream.consume()) {
      this.failure = "controller text changed during admission";
      return false;
    }
    this.dirty = true;
    return true;
  }


  requestChat(serial: number): boolean {
    if (this.chat !== "receiving") return false;
    this.chatSerial = serial;
    this.chat = "requested";
    return true;
  }


  tick(): boolean {
    this.ticks++;
    return this.dirty && this.ticks >= RECEIPT_TICKS;
  }


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


  chatFile(): string {
    return `smashcraft-journal-chat-${this.build}-e${this.epoch}-s${this.slot}-n${this.chatSerial}.pld`;
  }
}


export function pauseLabel(chat: ChatPhase, paused: boolean, pending: boolean, targetPaused: boolean): string {
  if (chat === "requested") return "Opening chat…";
  if (chat !== "receiving") return "Chat — match paused";
  if (pending) return targetPaused ? "Pausing…" : "Resuming…";
  return paused ? "Resume: Start" : "Pause: Start";
}
