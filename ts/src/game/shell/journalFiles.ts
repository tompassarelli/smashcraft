// Companion Preload filenames and lines are an external protocol.

import type { DevSettings } from "./devSettings";
import type { MatchState } from "../match/rules";
import type { JournalIngress } from "./build";
import { devCommandReceiptFile, journalControlFile, journalLifecycleFile, journalReadyFile, journalMenuFile, journalTransportReadyFile, journalFailureFile, stageReceiptFile } from "../../runtime/gameFiles";

interface PreloadFile {
  readonly name: string;
  readonly lines: readonly string[];
}

export interface JournalIdentity {
  readonly build: string;
  readonly epoch: number;
  readonly slot: number;
}


type ControlRequest = "PAUSE" | "PAUSE_COMMIT" | "RESUME";

function controlLine({ build, epoch, slot }: JournalIdentity, sequence: number, state: string, frame: number): string {
  return `SMASHCRAFT JOURNAL CONTROL v=1 build=${build} epoch=${epoch} slot=${slot} sequence=${sequence} state=${state} frame=${frame}`;
}

export function controlFile(identity: JournalIdentity, sequence: number, state: ControlRequest, frame: number): PreloadFile {
  const { build, epoch, slot } = identity;
  return { name: journalControlFile(build, epoch, slot, sequence), lines: [controlLine(identity, sequence, state, frame)] };
}


export function startFile(identity: JournalIdentity, frame: number): PreloadFile {
  const { build, epoch, slot } = identity;
  return { name: journalLifecycleFile(build, epoch, slot, "start"), lines: [controlLine(identity, 0, "START", frame)] };
}






export function endFile(identity: JournalIdentity, frame: number, winner: number | undefined): PreloadFile {
  const { build, epoch, slot } = identity;
  return {
    name: journalLifecycleFile(build, epoch, slot, "end"),
    lines: [`${controlLine(identity, 0, "END", frame)} winner=${winner === undefined ? "none" : `P${winner + 1}`}`],
  };
}


export const quiescentFile = ({ build, epoch, slot }: JournalIdentity) => `smashcraft-journal-quiescent-${build}-e${epoch}-s${slot}.pld`;

const TRANSPORT_DESCRIPTIONS: Readonly<Record<JournalIngress, string>> = {
  editbox: "transport=editbox-v1; semicolon-delimited I4; local poll and consumed-prefix drain; text-capacity=4096",
  keyboard: "transport=keyboard-mailbox-v1; seven printable ASCII bytes per committed chunk; exact ACK before data is reused",
  files: "transport=SC_GP; files are immutable; absent next filename is retried; sequence advances after local capture and successful submission",
};

interface JournalSettings {
  readonly inputProfile: string;
  readonly ingress: JournalIngress;
  readonly delay: number;
  readonly rollback: number;
}


export function readyFile(identity: JournalIdentity, { inputProfile, ingress, delay, rollback }: JournalSettings): PreloadFile {
  const { build, epoch, slot } = identity;
  return {
    name: journalReadyFile(build, epoch, slot),
    lines: [
      `SMASHCRAFT JOURNAL v=1 build=${build} epoch=${epoch} slot=${slot}`,
      `input=${inputProfile} delay=${delay} rollback=${rollback} first_frame=${1 + delay}`,
      `filename=smashcraft-journal-${build}-e${epoch}-s${slot}-n{SEQUENCE}.pld`,
      "packet=canonical I4; records=1 or 2 consecutive original frames; include neutral rows; no sparse events",
      TRANSPORT_DESCRIPTIONS[ingress],
      "pause=sequenced control request; companion ACK names the next input frame; simulation pauses or resumes only at that acknowledged confirmed frame",
    ],
  };
}

export type MenuPhase = "CHARACTER" | "CPU" | "STAGE" | "RESULT" | "BLOCKED";

interface MenuRoster {
  readonly connected: number;
  readonly humanFighters: number;
  readonly computers: number;
  readonly fighters: number;
}


export function menuFile(identity: JournalIdentity, phase: MenuPhase, roster: MenuRoster): PreloadFile {
  const { build, epoch, slot } = identity;
  return {
    name: journalMenuFile(build, slot),
    lines: [
      `SMASHCRAFT JOURNAL MENU v=1 build=${build} epoch=${epoch} slot=${slot} phase=${phase}`,
      `connected=${roster.connected} human-fighters=${roster.humanFighters} computers=${roster.computers} fighters=${roster.fighters}`,
    ],
  };
}


export function transportReadyFile({ build, epoch, slot }: JournalIdentity, receivedMask: number): PreloadFile {
  return {
    name: journalTransportReadyFile(build, epoch, slot),
    lines: [`build=${build} epoch=${epoch} slot=${slot} received-mask=${receivedMask} before-journal-reads=yes`],
  };
}

export function failureFile({ build, epoch, slot }: JournalIdentity, reason: string, sequence: number, frame: number): PreloadFile {
  return {
    name: journalFailureFile(build, epoch, slot),
    lines: [`build=${build} epoch=${epoch} slot=${slot}`, `reason=${reason} sequence=${sequence} frame=${frame}`],
  };
}






export function devReceiptFile({ build, epoch, slot }: JournalIdentity, receipt: number, { rollback, delay, batch, rematchSeconds }: Readonly<DevSettings>, game: Readonly<MatchState>): PreloadFile {
  const [a, b, c, d] = game.characterChoices;
  return {
    name: devCommandReceiptFile(build, slot),
    lines: [
      `SMASHCRAFT DEV v=1 build=${build} receipt=${receipt} epoch=${epoch} rb=${rollback} delay=${delay} batch=${batch} rematchSeconds=${rematchSeconds} `,
      `SETUP phase=${game.phase} human-fighters=${game.humanFighterMask} computers=${game.computerMask} characters=${a},${b},${c},${d} stocks=${game.stockCount} minutes=${game.timeLimitMinutes} automatic-rematch=${game.automaticRematch ? 1 : 0} stage=${game.stageChoice} `,
    ],
  };
}


export function stageDrawnFile({ build, epoch, slot }: JournalIdentity, stage: number, decks: number): PreloadFile {
  return { name: stageReceiptFile(build, slot), lines: [`SMASHCRAFT STAGE v=1 build=${build} epoch=${epoch} stage=${stage} decks=${decks} `] };
}
