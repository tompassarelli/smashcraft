// A finished match's record, which each client writes into its player's
// CustomMapData for the Smashcraft client's match history and stats
// (smashcraft:docs/design/client.md, "Match records"). Local presentation
// only: it reads the confirmed match and the results tally and feeds nothing
// back. Its name and lines are a protocol the client parses.
//
// Each line is a word and space-separated key=value fields. A `name=` field
// comes last and runs to the end of its line, so a name may hold spaces.
// Values never hold `"` or `\`: a Preload line becomes a JASS string.
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantSlot } from "../input/participants";
import { type MatchState, computerActive } from "../match/rules";
import { stageInfo } from "../menu/stageCatalog";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import type { MatchTally } from "../presentation/matchCues";
import { fighterName } from "../sim/heroes/registry";
import { type Roster, fighterAt, isActive } from "../sim/roster";

export const MATCH_RECORD_HEADER = "smashcraft-match";
export const MATCH_RECORD_VERSION = 1;

/** Who wrote the record and which match it was. */
export interface MatchRecordSource {
  readonly build: string;
  readonly serial: number;
  /** This client's player slot; an observer's is not a fighter slot. */
  readonly local: number;
  /** Each human's account name, as the game shows it. */
  readonly players: Readonly<Slots<string | undefined>>;
}

const label = (slot: number) => `P${slot + 1}`;

/** A value without the characters a field or a Preload line can't hold. */
export function recordValue(text: string): string {
  let value = "";
  for (let index = 0; index < text.length; index++) {
    const character = text.substring(index, index + 1);
    value += character === " " || character === "=" || character === "\"" || character === "\\" ? "_" : character;
  }
  return value;
}

/** A name field's text: spaces kept, quotes and backslashes dropped. */
const nameText = (text: string) => text.split("\"").join("").split("\\").join("");

function mode(game: Readonly<MatchState>): string {
  if (game.training) return "training";
  if (game.endless) return "endless";
  return game.practice ? "practice" : "versus";
}

const flag = (value: boolean) => (value ? "1" : "0");

/** `count / per` to one decimal place, rounded down, or `none` when `per` is 0. Integer steps so Bun and Lua print it alike. */
export function ratio(count: number, per: number): string {
  if (per <= 0) return "none";
  const tenths = floorDiv(count * 10, per);
  return `${floorDiv(tenths, 10)}.${floorMod(tenths, 10)}`;
}

/** A fighter's combat stats line, which follows its fighter line. */
function combatLine(slot: ParticipantSlot, tally: Readonly<MatchTally>): string {
  const { dealt, openings, techs, missedTechs, ledgeGrabs } = tally.combat;
  const damage = Math.floor(dealt[slot]);
  const opened = openings[slot];
  return `combat slot=${label(slot)} dealt=${damage} openings=${opened} per-opening=${ratio(damage, opened)} openings-per-ko=${ratio(opened, tally.kos[slot])}`
    + ` techs=${techs[slot]} missed-techs=${missedTechs[slot]} ledge-grabs=${ledgeGrabs[slot]}`;
}

/** The record's lines for a match in its result, with the results screen's tally. */
export function matchRecordLines(source: Readonly<MatchRecordSource>, game: Readonly<MatchState>, world: Readonly<Roster>, tally: Readonly<MatchTally>): string[] {
  const stage = stageInfo(game.stageChoice);
  const lines = [
    `${MATCH_RECORD_HEADER} v=${MATCH_RECORD_VERSION} build=${recordValue(source.build)} serial=${source.serial} local=${isParticipantSlot(source.local) ? label(source.local) : "none"} mode=${mode(game)}`,
    `rules stocks=${game.stockCount} minutes=${game.timeLimitMinutes}`,
    `result frames=${game.matchFrame} winner=${game.winner === undefined ? "none" : label(game.winner)} timed-out=${flag(game.timedOut)} interrupted=${flag(game.interrupted)}`,
    `stage id=${stage.id} name=${nameText(stage.name)}`,
  ];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const player = source.players[slot];
    const who = computerActive(game, slot) ? "kind=computer" : `kind=human player=${recordValue(player === undefined || player === "" ? label(slot) : player)}`;
    const departed = (game.departedMask & (1 << slot)) !== 0;
    lines.push(`fighter slot=${label(slot)} ${who} character=${fighter.character} stocks=${fighter.status.stocks} damage=${Math.floor(fighter.status.damage)} kos=${tally.kos[slot]} falls=${tally.falls[slot]} left=${flag(departed)} name=${nameText(fighterName(fighter.character))}`);
    lines.push(combatLine(slot, tally));
  }
  lines.push(`end lines=${lines.length}`);
  return lines;
}

/** The serial an index file's chunk holds, or 1 for none or an unreadable one. */
export function nextSerial(chunk: string | undefined): number {
  const value = Number(chunk);
  return chunk !== undefined && chunk.length > 0 && value >= 1 && value === Math.floor(value) ? value : 1;
}
