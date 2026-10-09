import { assertEquals, test } from "wisp/src/runtime/testing";
import type { BindingLoadResult } from "../../game/ui/bindingSettings";
import { departPlayerFiles, enqueuePlayerFile, receivePlayerFileChunk, type PlayerFileQueue } from "./playerFileQueue";

function fixture() {
  const files: PlayerFileQueue = { queue: [] };
  const sent: number[] = [];
  const completed: string[] = [];
  const send = (owner: number) => { sent.push(owner); };
  const complete = (label: string) => (result: BindingLoadResult) => {
    completed.push(`${label}:${result.kind}${result.kind === "loaded" ? `:${result.encoded}` : ""}`);
  };
  return { files, sent, completed, send, complete };
}

test("a departure resolves the owner's loads, resumes surviving files without stale chunks and never resends or requeues [repro #42]", () => {
  {
  const { files, sent, completed, send, complete } = fixture();
  enqueuePlayerFile(files, 0, complete("departed-head"), send);
  enqueuePlayerFile(files, 1, complete("survivor"), send);
  enqueuePlayerFile(files, 0, complete("departed-tail"), send);
  enqueuePlayerFile(files, 2, complete("next-survivor"), send);
  receivePlayerFileChunk(files, 0, "partial", false, send);
  departPlayerFiles(files, 0, send);
  assertEquals(completed.join(","), "departed-head:unavailable,departed-tail:unavailable");
  assertEquals(sent.join(","), "0,1");
  receivePlayerFileChunk(files, 0, "stale", false, send);
  receivePlayerFileChunk(files, 0, "stale-last", true, send);
  assertEquals(files.queue.length, 2);
  receivePlayerFileChunk(files, 1, "saved", false, send);
  receivePlayerFileChunk(files, 1, "-controls", true, send);
  assertEquals(sent.join(","), "0,1,2");
  receivePlayerFileChunk(files, 2, "", true, send);
  assertEquals(completed.join(","), "departed-head:unavailable,departed-tail:unavailable,survivor:loaded:saved-controls,next-survivor:empty");
  assertEquals(files.queue.length, 0);
  }
  {
  const { files, sent, completed, send, complete } = fixture();
  enqueuePlayerFile(files, 1, complete("active"), send);
  enqueuePlayerFile(files, 0, complete("departed"), send);
  receivePlayerFileChunk(files, 1, "first", false, send);
  departPlayerFiles(files, 0, send);
  departPlayerFiles(files, 0, send);
  departPlayerFiles(files, 3, send);
  assertEquals(sent.join(","), "1");
  receivePlayerFileChunk(files, 1, "-last", true, send);
  assertEquals(completed.join(","), "departed:unavailable,active:loaded:first-last");
  }
  {
  const { files, sent, completed, send, complete } = fixture();
  enqueuePlayerFile(files, 0, (result) => {
    complete("departed")(result);
    enqueuePlayerFile(files, 0, complete("retry-departed"), send);
    enqueuePlayerFile(files, 1, complete("new-head"), send);
  }, send);
  enqueuePlayerFile(files, 0, complete("departed-tail"), send);
  departPlayerFiles(files, 0, send);
  assertEquals(sent.join(","), "0,1");
  assertEquals(completed.join(","), "departed:unavailable,retry-departed:unavailable,departed-tail:unavailable");
  receivePlayerFileChunk(files, 1, "controls", true, send);
  assertEquals(files.queue.length, 0);
  }
});
