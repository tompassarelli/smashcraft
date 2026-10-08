// Replays one joined match replay in Lua and prints what it reached, the
// 32-bit Lua side of `bun wisp replay` (scripts/wisp/commands/replay.ts).
// Environment: REPLAY_FILE, a joined replay of plain lines.
import { replayMatch } from "../../src/game/replay/matchReplay";

const path = os.getenv("REPLAY_FILE") ?? "";
const [file] = io.open(path, "r");
if (file === undefined) {
  print(`cannot open replay ${path}`);
  os.exit(1);
} else {
  const text = file.read("a") ?? "";
  file.close();
  const lines = text.split("\n").filter((line) => line.length > 0);
  const result = replayMatch(lines);
  print(`frames ${result.frames} reached ${result.reached} recorded ${result.recorded} checksum ${result.checksum} digests ${result.digests} divergent ${result.divergent}`);
  for (const problem of result.problems) print(`problem ${problem}`);
}
