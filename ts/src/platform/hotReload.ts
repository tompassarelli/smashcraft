// Development hot reload. The host client polls for the next manifest
// scripts/hot.ts writes into CustomMapData and announces it in a synchronized
// message. Every client reads its own copy, verifies and loads it, and
// broadcasts whether it is ready. When the last answer arrives, all clients
// install the bundle on that same frame, or all refuse it, so a file problem
// on one client can't split the simulations. Match state is untouched: it lives
// in globals the new code reads. The reloader's own handlers are reinstalled
// too, so it can reload itself.
import { ackFile, chunkFile, manifestFile, parseManifest, payloadKey } from "../runtime/hotFiles";
import { checksum, decodeBase64 } from "../runtime/payload";
import { floorDiv } from "../sim/intMath";
import { on, trampoline } from "./dispatch";
import { readChunks } from "./fileio";

const ANNOUNCE = "SC_HR";
const READY = "SC_HRR";
const POLL_SECONDS = 0.25;
const MAX_SLOTS = 4;

/** What a reloadable bundle exports: re-register handlers, keep state. */
export interface Reloadable {
  install(this: void): void;
}

/** A version waiting for every client's answer. `bundle` is this client's own load. */
interface Pending {
  version: number;
  bundle: Reloadable | string;
  waiting: number;
  refused: boolean;
}

interface HotState {
  announced: number;
  applied: number;
  hostSlot: number;
  localSlot: number;
  pending: Pending | undefined;
  /** Game time since the reloader started, which every client reads alike on a given frame. */
  clock?: timer;
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

const manifestExists = (version: number) => readChunks(manifestFile(version)).length > 0;

/**
 * The newest version published before this match. Manifests are never removed
 * and versions only rise, so existence is monotonic and a search finds it in
 * a logarithmic number of reads.
 */
function latestVersion(): number {
  if (!manifestExists(1)) return 0;
  let low = 1;
  while (manifestExists(low * 2)) low *= 2;
  let high = low * 2;
  while (high - low > 1) {
    const middle = floorDiv(low + high, 2);
    if (manifestExists(middle)) low = middle;
    else high = middle;
  }
  return low;
}

function playingHumans(): number {
  let count = 0;
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    const player = Player(slot);
    if (GetPlayerSlotState(player) === PLAYER_SLOT_STATE_PLAYING && GetPlayerController(player) === MAP_CONTROL_USER) count++;
  }
  return count;
}

function startClock(): timer {
  const clock = CreateTimer();
  TimerStart(clock, 86400.0, false, () => {});
  return clock;
}

function report(text: string): void {
  DisplayTextToPlayer(GetLocalPlayer(), 0, 0, text);
}

function poll(): void {
  const state = hot();
  if (state.localSlot !== state.hostSlot) return;
  const text = readChunks(manifestFile(state.announced + 1))[0];
  if (text === undefined) return;
  state.announced++;
  BlzSendSyncData(ANNOUNCE, text);
}

/** This client's copy of an announced bundle, loaded but not run, or why it failed. */
function loadLocal(text: string): { version: number; bundle: Reloadable | string } | undefined {
  const manifest = parseManifest(text);
  if (manifest === undefined) return undefined;
  const { version, files, checksum: expected } = manifest;
  const encoded: string[] = [];
  for (let index = 0; index < files; index++) encoded.push(...readChunks(chunkFile(expected, index)));
  const bytes = decodeBase64(encoded.join(""));
  if (bytes === undefined || checksum(bytes) !== expected) return { version, bundle: "payload missing or damaged" };
  const [chunk, error] = load(bytesToText(bytes), `=hot-${payloadKey(expected)}`);
  if (chunk === undefined) return { version, bundle: error ?? "load failed" };
  // A bundle that fails while loading is refused like a damaged one, so every client still answers.
  const [ran, module] = pcall(chunk);
  if (!ran) return { version, bundle: `failed while loading: ${String(module)}` };
  return { version, bundle: isReloadable(module) ? module : "bundle exports no install()" };
}

function announced(): void {
  const state = hot();
  const local = loadLocal(BlzGetTriggerSyncData());
  if (local === undefined || local.version <= state.applied) return;
  state.pending = { ...local, waiting: playingHumans(), refused: false };
  BlzSendSyncData(READY, `${local.version} ${typeof local.bundle === "string" ? "refuse" : "ready"}`);
}

function answered(): void {
  const state = hot();
  const pending = state.pending;
  const [versionText, answer] = BlzGetTriggerSyncData().split(" ");
  if (pending === undefined || Number(versionText) !== pending.version) return;
  if (answer !== "ready") pending.refused = true;
  pending.waiting--;
  if (pending.waiting > 0) return;
  state.pending = undefined;
  const { version, bundle } = pending;
  if (pending.refused || typeof bundle === "string") {
    report(`hot reload ${version} not applied: ${typeof bundle === "string" ? bundle : "another client couldn't load it"}`);
    return;
  }
  bundle.install();
  state.applied = version;
  state.clock ??= startClock();
  PreloadGenClear();
  PreloadGenStart();
  Preload(`applied ${version} at ${TimerGetElapsed(state.clock)}`);
  PreloadGenEnd(ackFile(state.localSlot));
  report(`hot reload ${version} applied`);
}

/** Registers the reloader's handlers; a reloaded bundle calls this again. */
export function installHotReload(): void {
  on("hotReload.poll", poll);
  on("hotReload.announced", announced);
  on("hotReload.answered", answered);
}

function onSync(prefix: string, handler: string): void {
  const trigger = CreateTrigger();
  for (let slot = 0; slot < MAX_SLOTS; slot++) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), prefix, false);
  TriggerAddAction(trigger, trampoline(handler));
}

/** Starts polling for new bundles; the host slot announces them. */
export function startHotReload(hostSlot: number, localSlot: number): void {
  // Versions published before this match are its baseline, not reloads.
  globalThis.__smashcraftHot = { announced: latestVersion(), applied: 0, hostSlot, localSlot, pending: undefined };
  installHotReload();
  onSync(ANNOUNCE, "hotReload.announced");
  onSync(READY, "hotReload.answered");
  TimerStart(CreateTimer(), POLL_SECONDS, true, trampoline("hotReload.poll"));
}
