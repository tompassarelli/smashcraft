



import type { HeadlessClient } from "wisp/src/headless/client";

interface Handle {
  readonly kind: string;
  readonly id: number;
}

type Native = (this: void, ...args: unknown[]) => unknown;
type LuaValues = LuaTable<AnyNotNil, unknown>;

const isHandle = (value: unknown): value is Handle =>
  typeof value === "object" && value !== null && "kind" in value && typeof value.kind === "string" && "id" in value && typeof value.id === "number";
const isNative = (value: unknown): value is Native => typeof value === "function";
const isKey = (value: unknown): value is AnyNotNil => value !== undefined && value !== null;
const isLuaTable = (value: unknown): value is LuaValues => type(value) === "table";


const creates = (name: string) => name.startsWith("Create") || name.startsWith("BlzCreate") || name.startsWith("Add");

const attaches = (name: string) => name.startsWith("TriggerRegister") || name.startsWith("BlzTriggerRegister") || name.startsWith("TriggerAdd");

const releases = (name: string) => name.startsWith("Destroy") || name.startsWith("BlzDestroy") || name === "KillSoundWhenDone" || (name.startsWith("Remove") && !name.startsWith("RemoveSaved"));


export class HandleCensus {

  private readonly live = new Map<string, Map<number, Handle>>();

  private readonly attached = new Map<number, Handle[]>();

  private readonly parents = new Map<number, number>();

  private released = new Set<number>();

  constructor(client: HeadlessClient, functions: readonly (readonly [string, string, number])[]) {
    const natives = client.natives;
    for (const [name] of functions) {
      const call = natives[name];
      if (!isNative(call)) continue;
      if (creates(name)) {

        const owner = name === "BlzCreateFrameByType" ? 2 : name === "BlzCreateFrame" || name === "BlzCreateSimpleFrame" ? 1 : -1;
        natives[name] = (...args: unknown[]) => {
          const made = call(...args);
          if (isHandle(made)) {
            this.add(made);
            const parent = owner < 0 ? undefined : args[owner];
            if (isHandle(parent)) this.parents.set(made.id, parent.id);
          }
          return made;
        };
      } else if (attaches(name)) {
        natives[name] = (...args: unknown[]) => {
          const made = call(...args);
          const trigger = args[0];
          if (isHandle(made) && isHandle(trigger)) {
            this.add(made);
            const list = this.attached.get(trigger.id);
            if (list === undefined) this.attached.set(trigger.id, [made]);
            else list.push(made);
          }
          return made;
        };
      } else if (releases(name)) {
        natives[name] = (...args: unknown[]) => {
          const handle = args[0];
          if (isHandle(handle)) this.release(handle);
          return call(...args);
        };
      }
    }
  }

  private add(handle: Handle): void {
    let kind = this.live.get(handle.kind);
    if (kind === undefined) {
      kind = new Map();
      this.live.set(handle.kind, kind);
    }
    kind.set(handle.id, handle);
  }

  private release(handle: Handle): void {
    const kind = this.live.get(handle.kind);
    if (kind === undefined || !kind.has(handle.id)) return;
    kind.delete(handle.id);
    this.released.add(handle.id);
    const attached = this.attached.get(handle.id);
    if (attached !== undefined) {
      this.attached.delete(handle.id);
      for (const item of attached) this.live.get(item.kind)?.delete(item.id);
    }
    if (handle.kind !== "framehandle") return;
    this.parents.delete(handle.id);
    const children: Handle[] = [];
    for (const [id, parent] of this.parents) if (parent === handle.id) children.push({ kind: "framehandle", id });
    for (const child of children) this.release(child);
  }


  counts(): (readonly [string, number])[] {
    const counts: (readonly [string, number])[] = [];
    for (const [kind, handles] of this.live) counts.push([kind, handles.size]);
    counts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return counts;
  }


  liveHandles(): readonly Handle[] {
    const handles: Handle[] = [];
    for (const [, kind] of this.live) for (const [, handle] of kind) handles.push(handle);
    return handles;
  }


  takeReleased(): ReadonlySet<number> {
    const released = this.released;
    this.released = new Set();
    return released;
  }
}


function keepIn(owner: unknown, field: string, kept: (item: unknown) => boolean): void {
  const list = isLuaTable(owner) ? owner.get(field) : undefined;
  if (!Array.isArray(list)) throw new Error(`the headless client keeps no ${field} list now: update compactEmulator`);
  let at = 0;
  for (const item of list) if (kept(item)) list[at++] = item;
  list.length = at;
}

const triggerOf = (registration: unknown): unknown => (typeof registration === "object" && registration !== null && "trigger" in registration ? registration.trigger : undefined);








export function compactEmulator(client: HeadlessClient, released: ReadonlySet<number>): string[] {
  if (released.size > 0) {
    const live = (item: unknown) => !isHandle(item) || !released.has(item.id);
    keepIn(client, "timers", live);
    keepIn(client, "registrations", (registration) => live(triggerOf(registration)));
    keepIn(client.frames, "all", live);
  }
  const errors = [...client.errors];
  client.errors.length = 0;
  client.messages.length = 0;
  client.thrown.length = 0;
  client.soundLog.length = 0;
  client.files.clear();
  client.forget(client.log.length);
  return errors;
}


export interface Reach {
  readonly tables: number;
  readonly functions: number;
  readonly entries: number;
  readonly stringBytes: number;
  readonly byGlobal: (readonly [string, number])[];

  readonly tableShapes: (readonly [string, number, readonly string[]])[];
}








export function reach(environment: unknown, emulator: readonly unknown[], traceTables = false): Reach {
  const seen = new LuaTable<AnyNotNil, boolean>();
  if (!isLuaTable(environment)) return { tables: 0, functions: 0, entries: 0, stringBytes: 0, byGlobal: [], tableShapes: [] };
  seen.set(environment, true);
  seen.set(_G, true);
  for (const item of emulator) if (isKey(item) && typeof item !== "string") seen.set(item, true);
  const globals: string[] = [];
  for (const [key, value] of pairs(environment)) {
    if (typeof key === "string" && !(isKey(value) && seen.get(value))) globals.push(key);
  }
  globals.sort();
  let tables = 0;
  let functions = 0;
  let entries = 0;
  let stringBytes = 0;
  const byGlobal: (readonly [string, number])[] = [];
  const stack: unknown[] = [];
  const paths: string[] = [];
  const shapes = new Map<string, { count: number; paths: string[] }>();
  const visit = (value: unknown, path = "") => {
    if (!isKey(value) || seen.get(value) === true) return;
    if (typeof value === "string") {
      seen.set(value, true);
      stringBytes += value.length;
    } else if (isLuaTable(value) || isNative(value)) {
      seen.set(value, true);
      stack.push(value);
      if (traceTables) paths.push(path.slice(-512));
    }
  };
  for (const name of globals) {
    const before = entries;
    visit(environment.get(name), name);
    while (stack.length > 0) {
      const value = stack.pop();
      const path = traceTables ? paths.pop() ?? "" : "";
      if (isLuaTable(value)) {
        tables++;
        if (traceTables) {
          const fields: string[] = [];
          const otherKeys = new Set<string>();
          for (const [key] of pairs(value)) {
            if (typeof key === "string") fields.push(key);
            else otherKeys.add(`<${type(key)}>`);
          }
          fields.push(...otherKeys);
          fields.sort();
          const shape = `${name}:{${fields.join(",")}}`;
          const found = shapes.get(shape);
          if (found === undefined) shapes.set(shape, { count: 1, paths: [path] });
          else {
            found.count++;
            if (found.paths.length < 3) found.paths.push(path);
          }
        }
        for (const [key, item] of pairs(value)) {
          entries++;
          visit(key, traceTables ? `${path}.<key>` : "");
          visit(item, traceTables ? `${path}.${typeof key === "string" || typeof key === "number" ? key : `<${type(key)}>`}` : "");
        }
        visit(getmetatable(value), traceTables ? `${path}.<metatable>` : "");
      } else if (isNative(value)) {
        functions++;
        for (let index = 1; ; index++) {
          const [upvalue, item] = debug.getupvalue(value, index);
          if (upvalue === undefined) break;
          entries++;
          visit(item, traceTables ? `${path}.<upvalue:${upvalue}>` : "");
        }
      }
    }
    byGlobal.push([name, entries - before]);
  }
  byGlobal.sort((a, b) => b[1] - a[1]);
  const tableShapes: (readonly [string, number, readonly string[]])[] = [];
  for (const [shape, found] of shapes) tableShapes.push([shape, found.count, found.paths]);
  tableShapes.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return { tables, functions, entries, stringBytes, byGlobal, tableShapes };
}
