


import { EDITBOX_CAPACITY, type EditboxFailure, EditboxSession, pauseLabel } from "../game/netcode/journal/editbox";
import { trampoline } from "wisp/src/platform/dispatch";
import { readChunk, writeLine } from "wisp/src/platform/fileio";
import { nativeChatFile } from "../runtime/gameFiles";


export const EDITBOX_ENTER = "journal.editboxEnter";

// Warcraft 3.0 chat entry shape: recipient leaf plus four-child edit box whose first child has five.
function isChatEntry(frame: framehandle): boolean {
  if (BlzFrameGetName(frame) !== "" || BlzFrameGetChildrenCount(frame) !== 2) return false;
  const label = BlzFrameGetChild(frame, 0);
  const entry = BlzFrameGetChild(frame, 1);
  if (BlzFrameGetName(label) !== "" || BlzFrameGetChildrenCount(label) !== 0) return false;
  if (BlzFrameGetName(entry) !== "" || BlzFrameGetChildrenCount(entry) !== 4) return false;
  const text = BlzFrameGetChild(entry, 0);
  return BlzFrameGetName(text) === "" && BlzFrameGetChildrenCount(text) === 5;
}


function chatEntry(gameUi: framehandle): framehandle | undefined {
  let found: framehandle | undefined;
  for (let index = 0; index < BlzFrameGetChildrenCount(gameUi); index++) {
    const candidate = BlzFrameGetChild(gameUi, index);
    if (!isChatEntry(candidate)) continue;
    if (found !== undefined) return undefined;
    found = candidate;
  }
  return found;
}

export function warcraftChatOpen(): boolean {
  const chat = chatEntry(BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0));
  return chat !== undefined && BlzFrameIsVisible(chat);
}






export class EditboxIngress {
  private readonly box: framehandle;
  private readonly hint: framehandle;
  private readonly chat: framehandle | undefined;
  private session: EditboxSession | undefined;
  private observedChat: boolean | undefined;
  private chatRevision = 0;

  constructor() {
    const gameUi = BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
    this.chat = chatEntry(gameUi);
    this.box = BlzCreateFrameByType("EDITBOX", "JournalControllerInput", gameUi, "EscMenuEditBoxTemplate", 969);
    BlzFrameSetAbsPoint(this.box, FRAMEPOINT_TOPLEFT, 0.03999999910593033, 0.550000011920929);
    BlzFrameSetSize(this.box, 0.7200000286102295, 0.03500000014901161);
    BlzFrameSetTextSizeLimit(this.box, EDITBOX_CAPACITY);
    BlzFrameSetAlpha(this.box, 0);
    BlzFrameSetVisible(this.box, false);
    this.hint = BlzCreateFrameByType("TEXT", "JournalPauseHelp", gameUi, "", 970);
    BlzFrameSetAbsPoint(this.hint, FRAMEPOINT_TOPLEFT, 0.6100000143051147, 0.49000000953674316);
    BlzFrameSetSize(this.hint, 0.15000000596046448, 0.02500000037252903);
    BlzFrameSetVisible(this.hint, false);
    const entered = CreateTrigger();
    BlzTriggerRegisterFrameEvent(entered, this.box, FRAMEEVENT_EDITBOX_ENTER);
    TriggerAddAction(entered, trampoline(EDITBOX_ENTER));
  }

  private writeReceipt(session: EditboxSession): void {
    const { name, line } = session.receipt(this.chat !== undefined);
    writeLine(name, line);
  }


  private take(): void {
    BlzFrameSetText(this.box, "");
    BlzFrameSetVisible(this.box, true);
    BlzFrameSetFocus(this.box, true);
  }

  beginEpoch(build: string, epoch: number, slot: number): void {
    const session = new EditboxSession(build, epoch, slot, BlzFrameGetTextSizeLimit(this.box));
    this.session = session;
    this.take();
    BlzFrameSetVisible(this.hint, true);
    this.writeReceipt(session);
  }

  endEpoch(): void {
    const { session } = this;
    if (session === undefined) return;
    this.writeReceipt(session);
    this.session = undefined;
    BlzFrameSetFocus(this.box, false);
    BlzFrameSetVisible(this.box, false);
    BlzFrameSetVisible(this.hint, false);
    BlzFrameSetText(this.box, "");
  }


  failure(): EditboxFailure | undefined {
    return this.session?.failure;
  }


  chatOpen(): boolean {
    return this.chat !== undefined && BlzFrameIsVisible(this.chat);
  }


  publishChat(build: string, slot: number): void {
    const open = this.chatOpen();
    if (this.observedChat === open) return;
    this.observedChat = open;
    this.chatRevision++;
    writeLine(nativeChatFile(build, slot), `SMASHCRAFT CHAT v=1 build=${build} slot=${slot} revision=${this.chatRevision} available=${this.chat !== undefined ? 1 : 0} open=${open ? 1 : 0}`);
  }


  chatSerial(): number | undefined {
    return this.session?.chatSerial;
  }


  takePauseControls(): string {
    if (this.session?.chat !== "receiving" || !BlzIsLocalClientActive()) return "";
    const text = BlzFrameGetText(this.box);
    let journal = "";
    let controls = "";
    let cursor = 0;
    while (cursor < text.length) {
      if (text.charAt(cursor) === "@") {
        const end = text.indexOf(";", cursor);
        if (end < 0) {
          journal += text.substring(cursor);
          break;
        }
        journal += text.substring(cursor, end + 1);
        cursor = end + 1;
      } else {
        const key = text.charAt(cursor);
        if ("ijklop-=h enu".includes(key)) controls += key;
        else journal += key;
        cursor++;
      }
    }
    if (journal !== text) BlzFrameSetText(this.box, journal);
    return controls;
  }






  peek(): string | undefined {
    const { session } = this;
    if (session === undefined || !session.receiving() || !BlzIsLocalClientActive()) return undefined;
    const text = BlzFrameGetText(this.box);
    const rest = session.drain(text);
    if (rest !== text) BlzFrameSetText(this.box, rest);
    return session.failure === undefined ? session.stream.next() : undefined;
  }


  consumed(): boolean {
    return this.session?.consume() === true;
  }

  requestChat(serial: number): void {
    const { session } = this;
    if (session === undefined || !session.requestChat(serial)) return;
    BlzFrameSetFocus(this.box, true);
    this.writeReceipt(session);
  }





  serviceChat(paused: boolean): boolean {
    const { session, chat } = this;
    if (session === undefined) return false;
    switch (session.chat) {
      case "requested":

        if (!paused || readChunk(session.chatFile()) !== "Q") return false;
        BlzFrameSetFocus(this.box, false);
        BlzFrameSetVisible(this.box, false);
        session.chat = "released";
        break;
      case "released":
        if (chat === undefined || !BlzFrameIsVisible(chat)) return false;
        session.chat = "chatting";
        break;
      case "chatting":
        if (chat !== undefined && BlzFrameIsVisible(chat)) return false;
        this.take();
        session.chat = "receiving";
        this.writeReceipt(session);
        return true;
      case "receiving":
        return false;
    }
    this.writeReceipt(session);
    return false;
  }


  tick(): void {
    const { session } = this;
    if (session?.tick() === true) this.writeReceipt(session);
  }


  flushReceipt(): void {
    if (this.session !== undefined) this.writeReceipt(this.session);
  }

  updatePauseHint(paused: boolean, pending: boolean, targetPaused: boolean, hideHud: boolean): void {
    if (this.session === undefined) return;
    BlzFrameSetVisible(this.hint, !hideHud);
    BlzFrameSetText(this.hint, pauseLabel(this.session.chat, paused, pending, targetPaused));
  }
}
