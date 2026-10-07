// Aggregate #179 report; game checks run the same samples in emitted Lua32.
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";
import { fighterCoverage } from "../src/game/match/botCoverage";

const reports = SELECTABLE_CHARACTERS.map((_character, index) => fighterCoverage(index));
console.log("| Fighter | Matches | Moving frames | Attacks | Kit starts/branches | Specials N/S/U/D | Defense frames | Recovery inputs | Defense probe /16 | Recovery probe /2 | Refused mana | Missing |");
console.log("|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|");
for (const r of reports) console.log(`| ${r.fighter} | ${r.matches} | ${r.movement} | ${r.attacks} | ${r.kit} | ${r.specials.join("/")} | ${r.defense} | ${r.recovery} | ${r.defenseDecisions} | ${r.recoveryDecisions} | ${r.manaDenied} | ${r.missing.join(", ") || "none"} |`);
const inactive = reports.filter(report => report.missing.length > 0);
console.log(`${reports.length} selectable fighters, ${reports.reduce((sum, report) => sum + report.matches, 0)} seeded Wren Expert matches, ${inactive.length} inactive fighters`);
process.exitCode = inactive.length > 0 ? 1 : 0;
