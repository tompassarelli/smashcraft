// Two simulated Warcraft clients in lockstep, for the desync guard. The
// clients take turns running the same map code, and every synchronized event
// (chat, keys, sync data either client sends) reaches both clients in the same
// order, so a test can require their native call logs to be identical.
import { Client, type Handle, type NativeCall, type SyncMessage } from "./simulatedClient";

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
    if (typeof leftArg === "function" && typeof rightArg === "function") continue;
    if (typeof leftArg === "object" && leftArg !== null && "id" in leftArg && "kind" in leftArg
      && typeof rightArg === "object" && rightArg !== null && "id" in rightArg && "kind" in rightArg) {
      if (leftArg.id !== rightArg.id || leftArg.kind !== rightArg.kind) return false;
      continue;
    }
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
