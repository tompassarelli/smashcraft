// Development hot reload. The host client polls the manifest scripts/hot.ts
// writes into CustomMapData and announces each newer version in a synchronized
// message; every client then reads its own copy, checks the checksum, loads the
// bundle and installs it on that same frame, so simulations stay in lockstep.
// Match state is untouched: it lives in globals the new code reads. The
// reloader's own handlers are reinstalled too, so it can reload itself.
import { MANIFEST_FILE, ackFile, chunkFile, parseManifest } from "../runtime/hotFiles";
import { checksum, decodeBase64 } from "../runtime/payload";
import { on, trampoline } from "./dispatch";
import { readChunks } from "./fileio";

const PREFIX = "SC_HR";
const POLL_SECONDS = 0.25;

/** What a reloadable bundle exports: re-register handlers, keep state. */
export interface Reloadable {
  install(this: void): void;
}

interface HotState {
  announced: number;
  applied: number;
  hostSlot: number;
  localSlot: number;
}

declare global {
  var __smashcraftHot: HotState | undefined;
}

function hot(): HotState {
  const state = globalThis.__smashcraftHot;
  if (state === undefined) throw new Error("hot reload used before startHotReload");
  return state;
}

function isReloadable(value: unknown): value is Reloadable {
  return typeof value === "object" && value !== null && "install" in value && typeof value.install === "function";
}

function bytesToText(bytes: readonly number[]): string {
  const parts: string[] = [];
  // string.char takes a bounded argument list; convert in slices.
  for (let i = 0; i < bytes.length; i += 4096) parts.push(string.char(...bytes.slice(i, i + 4096)));
  return parts.join("");
}

function publishedVersion(): number {
  const text = readChunks(MANIFEST_FILE)[0];
  return (text === undefined ? undefined : parseManifest(text))?.version ?? 0;
}

function poll(): void {
  const state = hot();
  if (state.localSlot !== state.hostSlot) return;
  const text = readChunks(MANIFEST_FILE)[0];
  if (text === undefined) return;
  const manifest = parseManifest(text);
  if (manifest === undefined || manifest.version <= state.announced) return;
  state.announced = manifest.version;
  BlzSendSyncData(PREFIX, text);
}

function report(text: string): void {
  DisplayTextToPlayer(GetLocalPlayer(), 0, 0, text);
}

function apply(): void {
  const state = hot();
  const manifest = parseManifest(BlzGetTriggerSyncData());
  if (manifest === undefined || manifest.version <= state.applied) return;
  const { version, files, checksum: expected } = manifest;
  const encoded: string[] = [];
  for (let index = 0; index < files; index++) encoded.push(...readChunks(chunkFile(version, index)));
  const bytes = decodeBase64(encoded.join(""));
  // A mismatch would make clients run different code; refuse it everywhere.
  if (bytes === undefined || checksum(bytes) !== expected) {
    report(`hot reload ${version}: payload mismatch, not applied`);
    return;
  }
  const [chunk, error] = load(bytesToText(bytes), `=hot${version}`);
  if (chunk === undefined) {
    report(`hot reload ${version}: ${error ?? "load failed"}`);
    return;
  }
  const module = chunk();
  if (!isReloadable(module)) {
    report(`hot reload ${version}: bundle exports no install()`);
    return;
  }
  module.install();
  state.applied = version;
  PreloadGenClear();
  PreloadGenStart();
  Preload(`applied ${version}`);
  PreloadGenEnd(ackFile(state.localSlot));
  report(`hot reload ${version} applied`);
}

/** Registers the reloader's handlers; a reloaded bundle calls this again. */
export function installHotReload(): void {
  on("hotReload.poll", poll);
  on("hotReload.apply", apply);
}

/** Starts polling for new bundles; the host slot announces them. */
export function startHotReload(hostSlot: number, localSlot: number): void {
  // A manifest left from an earlier session is the baseline, not a reload.
  globalThis.__smashcraftHot = { announced: publishedVersion(), applied: 0, hostSlot, localSlot };
  installHotReload();
  const sync = CreateTrigger();
  for (let slot = 0; slot < 4; slot++) BlzTriggerRegisterPlayerSyncEvent(sync, Player(slot), PREFIX, false);
  TriggerAddAction(sync, trampoline("hotReload.apply"));
  TimerStart(CreateTimer(), POLL_SECONDS, true, trampoline("hotReload.poll"));
}
