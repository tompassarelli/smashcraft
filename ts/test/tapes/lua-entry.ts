// Runs one tape in Lua and prints its records, the 32-bit Lua side of
// scripts/tapes.ts. Environment: TAPE_FILE.
import { decodeTape } from "../../src/game/replay/tape";
import { runTape } from "../../src/game/replay/tapeRunner";

const path = os.getenv("TAPE_FILE") ?? "";
const [file] = io.open(path, "r");
if (file === undefined) {
  print(`cannot open tape ${path}`);
  os.exit(1);
} else {
  const text = file.read("a") ?? "";
  file.close();
  const decoded = decodeTape(text);
  if (!decoded.ok) {
    print(`${path}:${decoded.line}: ${decoded.message}`);
    os.exit(1);
  } else {
    const result = runTape(decoded.value, (record) => io.write(record, "\n"));
    if (!result.ok) {
      print(`${path}:${result.line}: ${result.message}`);
      os.exit(1);
    }
  }
}
