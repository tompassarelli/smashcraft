// Two simulated Warcraft clients in lockstep, for the desync guard. Every
// native declared in waygate:src/natives/warcraft.d.ts is stubbed per client; the
// clients take turns running the same map code, with the shell's global state
// swapped in and out, and every synchronized event (chat, keys, sync data
// either client sends) reaches both clients in the same order. Each client
// logs its native calls, except the local-only calls ALLOWED_LOCAL names, so
// a test can require the two logs to be identical.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Natives a client may call differently from the others: they read or show
 * local state and create, destroy or change nothing synchronized.
 */
export const ALLOWED_LOCAL: Readonly<Record<string, string>> = {
  GetLocalPlayer: "identifies the client; every local branch starts here",
  BlzSendSyncData: "only the sending client calls it; its message reaches every client as an event",
  BlzGetLocalClientWidth: "local screen size, for layout",
  BlzGetLocalClientHeight: "local screen size, for layout",
  BlzGetMouseScreenPosX: "local pointer, sent through sync data when it chooses",
  BlzGetMouseScreenPosY: "local pointer, sent through sync data when it chooses",
  BlzIsMouseButtonPressed: "local pointer, sent through sync data when it chooses",
  BlzIsKeyPressed: "local keys, sent through sync data as input rows",
  BlzIsLocalClientActive: "local focus, which input polling reads",
  BlzFrameSetVisible: "shows an existing frame on this client",
  BlzFrameSetText: "changes an existing frame's text on this client",
  BlzFrameSetTexture: "changes an existing frame's texture on this client",
  BlzFrameSetAbsPoint: "moves an existing frame on this client",
  BlzFrameSetSize: "sizes an existing frame on this client",
  BlzFrameSetEnable: "enables an existing frame on this client",
  BlzFrameSetFocus: "focuses an existing frame on this client",
  BlzFrameGetText: "reads an existing frame's local text",
  BlzFrameGetEnable: "reads an existing frame's local state",
  BlzFrameIsVisible: "reads an existing frame's local state",
  PreloadGenClear: "local file output",
  PreloadGenStart: "local file output",
  Preload: "local file output",
  PreloadGenEnd: "local file output",
  Preloader: "local file input, synchronized only through sync data",
  BlzGetAbilityTooltip: "FileIO's local file buffer",
  BlzSetAbilityTooltip: "FileIO's local file buffer",
  DisplayTextToPlayer: "local message",
  TimerGetElapsed: "reads a timer; local measurements never feed synchronized state",
  GetPlayerId: "reads a player's slot number; no effect",
  I2S: "pure conversion",
  R2S: "pure conversion",
  R2I: "pure conversion",
  I2R: "pure conversion",
  S2I: "pure conversion",
};

type Handle = { readonly kind: string; readonly id: number };
type Callback = () => void;

interface Native {
  readonly name: string;
  readonly returns: string;
}

const declarations = readFileSync(join(import.meta.dir, "../../node_modules/waygate/src/natives/warcraft.d.ts"), "utf8");
const NATIVES: readonly Native[] = [...declarations.matchAll(/^declare function (\w+)\(.*\): (\w+);$/gm)].map(([, name, returns]) => ({ name: name ?? "", returns: returns ?? "void" }));
const CONSTANTS: readonly [string, string][] = [...declarations.matchAll(/^declare const (\w+): (\w+);$/gm)].map(([, name, type]) => [name ?? "", type ?? ""]);

interface Timer extends Handle {
  callback: Callback | undefined;
  periodTicks: number;
  dueTick: number;
  startTick: number;
  running: boolean;
}

interface Trigger extends Handle {
  readonly actions: Callback[];
  destroyed: boolean;
}

interface EventContext {
  player: number;
  syncPrefix: string;
  syncData: string;
  chat: string;
  key: number;
  timer: Timer | undefined;
}

type Registration =
  | { kind: "sync"; trigger: Trigger; player: number; prefix: string }
  | { kind: "chat"; trigger: Trigger; player: number; text: string; exact: boolean }
  | { kind: "key"; trigger: Trigger; player: number; key: number; meta: number; down: boolean };

export interface SyncMessage {
  readonly sender: number;
  readonly prefix: string;
  readonly data: string;
}

interface NativeCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

const TICK_SECONDS = 1 / 60;

/** The client whose code is running. */
let current: Client | undefined;

/**
 * Points every native and constant at the running client, and returns a
 * function that puts back what the globals held before.
 */
export function installNatives(): () => void {
  const global = globalThis as Record<string, unknown>;
  const names = [...NATIVES.map(({ name }) => name), ...CONSTANTS.map(([name]) => name), "xpcall", "setmetatable"];
  const before = new Map(names.map(name => [name, global[name]] as const));
  for (const name of names) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => {
        if (current === undefined) throw new Error(`${name} used outside a client`);
        return current.natives[name];
      },
    });
  }
  return () => {
    for (const [name, value] of before) {
      if (value === undefined) delete global[name];
      else Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
  };
}

/** One client: its natives, its handles, its share of the shell's globals and its call log. */
export class Client {
  readonly log: NativeCall[] = [];
  /** Allowed local-only calls, kept to explain a difference. */
  readonly localLog: NativeCall[] = [];
  readonly errors: string[] = [];
  readonly files = new Map<string, string[]>();
  readonly natives: Record<string, unknown> = {};
  /** The `__smashcraft*` globals while another client runs. */
  private globals: Record<string, unknown> = {};
  private nextId = 0;
  private tick = 0;
  private readonly timers: Timer[] = [];
  private readonly registrations: Registration[] = [];
  private readonly memo = new Map<string, Handle>();
  private event: EventContext = { player: 0, syncPrefix: "", syncData: "", chat: "", key: 0, timer: undefined };
  private preload: string[] = [];

  constructor(readonly slot: number, readonly humans: readonly number[], readonly network: SyncMessage[], screenWidth: number) {
    const handle = (kind: string): Handle => ({ kind, id: ++this.nextId });
    const special: Record<string, (...args: never[]) => unknown> = {
      GetLocalPlayer: () => this.slot,
      Player: (n: number) => n,
      GetPlayerId: (p: number) => p,
      GetTriggerPlayer: () => this.event.player,
      GetHandleId: (h: unknown) => (typeof h === "object" && h !== null && "id" in h ? (h as Handle).id : h),
      GetPlayerController: (p: number) => (this.humans.includes(p) ? "MAP_CONTROL_USER" : "MAP_CONTROL_NONE"),
      GetPlayerSlotState: (p: number) => (this.humans.includes(p) ? "PLAYER_SLOT_STATE_PLAYING" : "PLAYER_SLOT_STATE_EMPTY"),
      BlzGetLocalClientWidth: () => screenWidth,
      BlzGetLocalClientHeight: () => 1080,
      BlzIsLocalClientActive: () => true,
      BlzLoadTOCFile: () => true,
      BlzFrameGetTextSizeLimit: () => 4096,
      BlzGetAbilityTooltip: () => " ",
      BlzGetTriggerSyncData: () => this.event.syncData,
      BlzGetTriggerSyncPrefix: () => this.event.syncPrefix,
      GetEventPlayerChatString: () => this.event.chat,
      BlzGetTriggerPlayerKey: () => this.event.key,
      GetExpiredTimer: () => this.event.timer,
      // Frame getters return one handle per frame, made at the first call: the gray area local calls must not reach.
      BlzGetOriginFrame: (type: unknown, index: number) => this.memoized(`origin ${String(type)} ${index}`, "framehandle"),
      BlzGetFrameByName: (name: string, context: number) => this.memoized(`name ${name} ${context}`, "framehandle"),
      BlzFrameGetChild: (frame: Handle, index: number) => this.memoized(`child ${frame.id} ${index}`, "framehandle"),
      CreateTrigger: (): Trigger => ({ ...handle("trigger"), actions: [], destroyed: false }),
      DestroyTrigger: (t: Trigger) => { t.destroyed = true; },
      TriggerAddAction: (t: Trigger, action: Callback) => { t.actions.push(action); return handle("triggeraction"); },
      BlzTriggerRegisterPlayerSyncEvent: (trigger: Trigger, player: number, prefix: string) => {
        this.registrations.push({ kind: "sync", trigger, player, prefix });
        return handle("event");
      },
      TriggerRegisterPlayerChatEvent: (trigger: Trigger, player: number, text: string, exact: boolean) => {
        this.registrations.push({ kind: "chat", trigger, player, text, exact });
        return handle("event");
      },
      BlzTriggerRegisterPlayerKeyEvent: (trigger: Trigger, player: number, key: number, meta: number, down: boolean) => {
        this.registrations.push({ kind: "key", trigger, player, key, meta, down });
        return handle("event");
      },
      CreateTimer: (): Timer => {
        const timer: Timer = { ...handle("timer"), callback: undefined, periodTicks: 0, dueTick: 0, startTick: 0, running: false };
        this.timers.push(timer);
        return timer;
      },
      TimerStart: (timer: Timer, timeout: number, periodic: boolean, callback: Callback) => {
        const ticks = Math.max(periodic ? 1 : 0, Math.round(timeout * 60));
        Object.assign(timer, { callback, periodTicks: periodic ? ticks : 0, dueTick: this.tick + Math.max(1, ticks), startTick: this.tick, running: true });
      },
      PauseTimer: (timer: Timer) => { timer.running = false; },
      DestroyTimer: (timer: Timer) => { timer.running = false; },
      TimerGetElapsed: (timer: Timer) => (this.tick - timer.startTick) * TICK_SECONDS,
      BlzSendSyncData: (prefix: string, data: string) => {
        this.network.push({ sender: this.slot, prefix, data });
        return true;
      },
      PreloadGenClear: () => { this.preload = []; },
      Preload: (line: string) => { this.preload.push(line); },
      PreloadGenEnd: (name: string) => { this.files.set(name, this.preload); },
      DisplayTextToPlayer: (_p: number, _x: number, _y: number, text: string) => { if (text.startsWith("error in")) this.errors.push(text); },
      I2S: (n: number) => String(n),
      R2S: (n: number) => n.toFixed(3),
      R2I: (n: number) => Math.trunc(n),
      I2R: (n: number) => n,
      S2I: (s: string) => Number.parseInt(s, 10) || 0,
      SquareRoot: (n: number) => Math.fround(Math.sqrt(n)),
      Atan2: (y: number, x: number) => Math.fround(Math.atan2(y, x)),
      BlzBitAnd: (a: number, b: number) => a & b,
      BlzBitOr: (a: number, b: number) => a | b,
    };
    for (const { name, returns } of NATIVES) {
      const behave = special[name] ?? (name.startsWith("Convert") ? (value: unknown) => value : this.defaultNative(returns, handle));
      this.natives[name] = (...args: unknown[]) => {
        if (ALLOWED_LOCAL[name] === undefined) this.log.push({ name, args });
        else this.localLog.push({ name, args });
        return (behave as (...values: unknown[]) => unknown)(...args);
      };
    }
    for (const [name, type] of CONSTANTS) this.natives[name] = type === "boolean" ? name === "TRUE" : type === "number" ? 0 : name;
    this.natives.xpcall = (callback: Callback, handler: (error: unknown) => void) => {
      try {
        callback();
        return true;
      } catch (error) {
        this.errors.push(String(error instanceof Error ? error.stack ?? error.message : error));
        handler(error);
        return false;
      }
    };
    this.natives.setmetatable = (table: object, metatable: object) => {
      Object.setPrototypeOf(table, metatable);
      return table;
    };
  }

  private defaultNative(returns: string, handle: (kind: string) => Handle): (...args: unknown[]) => unknown {
    switch (returns) {
      case "void": return () => undefined;
      case "number": return () => 0;
      case "string": return () => "";
      case "boolean": return () => false;
      default: return () => handle(returns);
    }
  }

  private memoized(key: string, kind: string): Handle {
    const known = this.memo.get(key);
    if (known !== undefined) return known;
    const created = { kind, id: ++this.nextId };
    this.memo.set(key, created);
    return created;
  }

  /** Makes this client's natives and shell state the global ones, runs `body`, and takes its state back. */
  run(body: () => void): void {
    current = this;
    Object.assign(globalThis, this.globals);
    try {
      body();
    } finally {
      current = undefined;
      this.globals = {};
      for (const key of Object.keys(globalThis)) {
        if (!key.startsWith("__smashcraft")) continue;
        this.globals[key] = (globalThis as Record<string, unknown>)[key];
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
  }

  private fire(trigger: Trigger, event: Partial<EventContext>): void {
    if (trigger.destroyed) return;
    this.event = { ...this.event, ...event };
    for (const action of trigger.actions) action();
  }

  /** One game tick: every due timer, in creation order. */
  step(): void {
    this.run(() => {
      this.tick++;
      const timerCount = this.timers.length;
      for (let index = 0; index < timerCount; index++) {
        const timer = this.timers[index];
        if (timer === undefined) continue;
        if (!timer.running || timer.dueTick > this.tick || timer.callback === undefined) continue;
        if (timer.periodTicks > 0) timer.dueTick += timer.periodTicks;
        else timer.running = false;
        this.event = { ...this.event, timer };
        timer.callback();
      }
    });
  }

  deliverSync({ sender, prefix, data }: SyncMessage): void {
    this.run(() => {
      for (const r of [...this.registrations]) {
        if (r.kind === "sync" && r.player === sender && r.prefix === prefix) this.fire(r.trigger, { player: sender, syncPrefix: prefix, syncData: data });
      }
    });
  }

  chat(sender: number, message: string): void {
    this.run(() => {
      for (const r of [...this.registrations]) {
        if (r.kind === "chat" && r.player === sender && (r.exact ? message === r.text : message.includes(r.text))) this.fire(r.trigger, { player: sender, chat: message });
      }
    });
  }

  key(sender: number, key: number, meta: number, down: boolean): void {
    this.run(() => {
      for (const r of [...this.registrations]) {
        if (r.kind === "key" && r.player === sender && r.key === key && r.meta === meta && r.down === down) this.fire(r.trigger, { player: sender, key });
      }
    });
  }
}

function describe(value: unknown): string {
  if (typeof value === "function") return "fn";
  if (typeof value === "object" && value !== null && "id" in value) return `${(value as Handle).kind}#${(value as Handle).id}`;
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function describeCall(name: string, args: readonly unknown[]): string {
  let call = `${name}(`;
  for (let index = 0; index < args.length; index++) {
    if (index > 0) call += ", ";
    call += describe(args[index]);
  }
  return `${call})`;
}

function sameCall(left: NativeCall, right: NativeCall): boolean {
  if (left.name !== right.name || left.args.length !== right.args.length) return false;
  for (let index = 0; index < left.args.length; index++) {
    const leftArg = left.args[index];
    const rightArg = right.args[index];
    // Equal primitive arguments need no diagnostic string allocation. Handles
    // and callbacks keep the guard's client-independent representation.
    if (leftArg === rightArg) continue;
    if (describe(leftArg) !== describe(rightArg)) return false;
  }
  return true;
}

/** The clients and the synchronized channel between them. */
export class Lockstep {
  readonly network: SyncMessage[] = [];
  readonly clients: readonly Client[];

  constructor(humans: readonly number[]) {
    // Different screens, so layout that depends on the local screen is exercised.
    this.clients = humans.map((slot, index) => new Client(slot, humans, this.network, 1920 + 640 * index));
  }

  /** Runs `body` on every client, as the map's main() or a hot reload's install() does. */
  everywhere(body: () => void): void {
    for (const client of this.clients) client.run(body);
    this.flush();
  }

  /** Synchronized messages reach every client in the order they were sent. */
  private flush(): void {
    for (let delivered = 0; this.network.length > 0; delivered++) {
      if (delivered > 10000) throw new Error("synchronized messages never settle");
      const message = this.network.shift();
      if (message !== undefined) for (const client of this.clients) client.deliverSync(message);
    }
  }

  ticks(count: number): void {
    for (let tick = 0; tick < count; tick++) {
      for (const client of this.clients) client.step();
      this.flush();
    }
  }

  chat(sender: number, message: string): void {
    for (const client of this.clients) client.chat(sender, message);
    this.flush();
  }

  /** A key press and release with a modifier (2: Ctrl), as every client sees it. */
  press(sender: number, key: number, meta = 0): void {
    for (const down of [true, false]) {
      for (const client of this.clients) client.key(sender, key, meta, down);
      this.flush();
    }
  }

  /** The first call at which two clients' logs differ, with context; undefined when they agree. */
  firstDivergence(): string | undefined {
    const [first, ...others] = this.clients;
    if (first === undefined) return undefined;
    for (const other of others) {
      const length = Math.max(first.log.length, other.log.length);
      for (let index = 0; index < length; index++) {
        const firstCall = first.log[index];
        const otherCall = other.log[index];
        if (firstCall !== undefined && otherCall !== undefined && sameCall(firstCall, otherCall)) continue;
        const context = (log: readonly NativeCall[]) => log.slice(Math.max(0, index - 4), index + 2).map(call => describeCall(call.name, call.args)).join("\n    ");
        return `call ${index} differs between slot ${first.slot} and slot ${other.slot}:\n  slot ${first.slot}:\n    ${context(first.log)}\n  slot ${other.slot}:\n    ${context(other.log)}`;
      }
    }
    return undefined;
  }
}
