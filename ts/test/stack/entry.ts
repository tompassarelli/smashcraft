





import { installDispatch, trampoline } from "wisp/src/platform/dispatch";
import { configureRuntime } from "wisp/src/runtime/config";
import { CURRENT_BUILD } from "../../src/game/shell/currentBuild";
import { STACK_DEMO_COMMAND, STACK_DEMO_HANDLER, installStackDemo } from "../../src/platform/stackDemo";

const SOURCE = "src/platform/stackDemo.ts";
const MESSAGE = `Error: stack demo failure: ${STACK_DEMO_COMMAND}`;
const EXPECTED = [
  { name: "failInnermost", text: "throw new Error(" },
  { name: "runMiddle", text: "failInnermost(label);" },
  { name: "runOuter", text: "runMiddle(label);" },
  { name: "stackDemoCommand", text: "runOuter(GetEventPlayerChatString());" },
] as const;

function fail(message: string): never {
  print(`stack frames FAILED: ${message}`);
  return os.exit(1);
}

function sourceLines(path: string): string[] {
  const [file, problem] = io.open(path, "r");
  if (file === undefined) return fail(`cannot read ${path}: ${problem}`);
  const text = file.read("a");
  file.close();
  return (text ?? "").split("\n");
}

function report(): string[] {
  let lines: string[] = [];
  Object.assign(globalThis, {
    GetLocalPlayer: () => 0,
    GetPlayerId: (player: number) => player,
    GetEventPlayerChatString: () => STACK_DEMO_COMMAND,
    DisplayTextToPlayer: () => {},
    PreloadGenClear: () => { lines = []; },
    PreloadGenStart: () => {},
    Preload: (text: string) => { lines.push(text); },
    PreloadGenEnd: () => {},
  });
  configureRuntime({ filePrefix: "stackDemo", readyPrefix: "SD_HRR", globalPrefix: "__stackDemo" });
  installDispatch();
  installStackDemo({ ...CURRENT_BUILD, devConsole: true });
  trampoline(STACK_DEMO_HANDLER)();
  return lines;
}

const lines = report();
print(lines.join("\n"));
if (lines[0] !== `error 1 in ${STACK_DEMO_HANDLER}` || lines[1] !== MESSAGE) fail(`report starts "${lines[0]}", "${lines[1]}"`);
const frames = lines.slice(2);
if (frames.length < EXPECTED.length) fail(`${frames.length} frames, expected at least ${EXPECTED.length}`);
const source = sourceLines(SOURCE);
EXPECTED.forEach(({ name, text }, index) => {
  const [path, line, frameName] = string.match(frames[index] ?? "", "^(.-):(%d+): in (.+)$");
  if (path !== SOURCE || frameName !== name) fail(`frame ${index + 1} is "${frames[index]}", expected ${SOURCE} in ${name}`);
  const executing = source[(tonumber(line) ?? 0) - 1];
  if (executing === undefined || !executing.includes(text)) fail(`${SOURCE}:${line} reads "${executing}", expected it to contain "${text}"`);
});
print(`stack frames passed: ${frames.length} TypeScript frames, the first ${EXPECTED.length} checked against ${SOURCE}`);
