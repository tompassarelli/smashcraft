import type { HeadlessClient } from "wisp/src/headless/client";

export interface Handle {
  readonly kind: string;
  readonly id: number;
}

type Native = (this: void, ...args: unknown[]) => unknown;

const isHandle = (value: unknown): value is Handle =>
  typeof value === "object" && value !== null && "kind" in value && typeof value.kind === "string" && "id" in value && typeof value.id === "number";
const isNative = (value: unknown): value is Native => typeof value === "function";


const creates = (name: string) => name.startsWith("Create") || name.startsWith("BlzCreate") || name.startsWith("Add");

const attaches = (name: string) => name.startsWith("TriggerRegister") || name.startsWith("BlzTriggerRegister") || name.startsWith("TriggerAdd");

const releases = (name: string) => name.startsWith("Destroy") || name.startsWith("BlzDestroy") || name === "KillSoundWhenDone" || (name.startsWith("Remove") && !name.startsWith("RemoveSaved"));


/** Live Warcraft handles per kind, counted where the map creates, attaches and releases them. */
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


/** Each handle kind whose live count differs from its menu baseline, as `kind baseline -> now`. */
export function liveHandleProblems(baseline: Readonly<Record<string, number>>, now: Readonly<Record<string, number>>): string[] {
  const kinds = new Set<string>();
  for (const kind of Object.keys(baseline)) kinds.add(kind);
  for (const kind of Object.keys(now)) kinds.add(kind);
  const problems: string[] = [];
  for (const kind of [...kinds].sort()) {
    const before = baseline[kind] ?? 0;
    const after = now[kind] ?? 0;
    if (before !== after) problems.push(`${kind} ${before} -> ${after}`);
  }
  return problems;
}
