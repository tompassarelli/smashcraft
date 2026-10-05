// Preload files the map writes for the companion helper and the integrity
// harness, which parse them: their names and lines are a protocol.
import type { DevSettings } from "./devSettings";
import type { JournalIngress } from "./build";
import { devCommandReceiptFile, journalControlFile, journalLifecycleFile, journalReadyFile, journalMenuFile, journalTransportReadyFile, journalFailureFile } from "../../runtime/gameFiles";

interface PreloadFile {
  readonly name: string;
  readonly lines: readonly string[];
}

export interface JournalIdentity {
  readonly build: string;
  readonly epoch: number;
  readonly slot: number;
}

/** What the map asks the helper to do: request a pause, commit it at the prepared frame, or resume. */
type ControlRequest = "PAUSE" | "PAUSE_COMMIT" | "RESUME";

function controlLine({ build, epoch, slot }: JournalIdentity, sequence: number, state: string, frame: number): string {
  return `SMASHCRAFT JOURNAL CONTROL v=1 build=${build} epoch=${epoch} slot=${slot} sequence=${sequence} state=${state} frame=${frame}`;
}

export function controlFile(identity: JournalIdentity, sequence: number, state: ControlRequest, frame: number): PreloadFile {
  const { build, epoch, slot } = identity;
  return { name: journalControlFile(build, epoch, slot, sequence), lines: [controlLine(identity, sequence, state, frame)] };
}

/** Match start and end: the helper starts and stops journaling an epoch. */
export function lifecycleFile(identity: JournalIdentity, kind: "start" | "end", frame: number): PreloadFile {
  const { build, epoch, slot } = identity;
  return { name: journalLifecycleFile(build, epoch, slot, kind), lines: [controlLine(identity, 0, kind === "start" ? "START" : "END", frame)] };
}

/** The helper's reply that it has stopped writing an ended epoch; it holds "Q". */
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

/** Written when an epoch starts: how the helper must journal it. */
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

export type MenuPhase = "CHARACTER" | "STAGE" | "RESULT" | "BLOCKED";

interface MenuRoster {
  readonly connected: number;
  readonly humanFighters: number;
  readonly computers: number;
  readonly fighters: number;
}

/** The menu the helper's controller may drive now; BLOCKED while a match or its journal is live. */
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

/** Every human's helper is ready, before any journal read. */
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

/** Confirms a dev command on this client, so automation knows every client holds it. */
export function devReceiptFile({ build, epoch, slot }: JournalIdentity, receipt: number, { rollback, delay, batch }: Readonly<DevSettings>): PreloadFile {
  return {
    name: devCommandReceiptFile(build, slot),
    lines: [`SMASHCRAFT DEV v=1 build=${build} receipt=${receipt} epoch=${epoch} rb=${rollback} delay=${delay} batch=${batch} `],
  };
}
