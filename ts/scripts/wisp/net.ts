import { join } from "node:path";
import type { NetGame } from "wisp/scripts/wisp/net/peer";
import type { StandaloneInput, StandaloneNetSession } from "wisp/scripts/wisp/standalone";
import type { LockstepLink } from "wisp/src/headless/lockstep";
import { Phase } from "../../src/game/match/rules";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import type { MapBuild } from "../../src/game/shell/build";
import { PREDICTED_HEADLESS } from "./headless";
import { heldKeys } from "./standalone";

const SETUP_FRAME = 30;
const BUTTONS: Readonly<Record<string, string>> = { A: "attack", X: "special", B: "jump", Y: "jump", LB: "walk", TL: "walk", RB: "grab", TR: "grab", START: "start", VIEW: "view" };

interface PadEdge { readonly frame: number; readonly slot: number; readonly action: string; readonly args: readonly string[] }

/** A pad script's setup command and edges (smashcraft:docs/native-bot-session.md), read the way the native driver reads them. */
export function padEdges(script: string): { readonly setup: string; readonly edges: readonly PadEdge[] } {
  let setup = "-dev quick", previous = 0;
  const edges: PadEdge[] = [];
  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#! chat ")) { setup = line.substring(8); continue; }
    const source = line.split("#")[0]?.trim() ?? "";
    if (source === "") continue;
    const [frameText = "", player, action = "", ...args] = source.split(/\s+/);
    const frame = frameText.startsWith("+") ? previous + Number(frameText.substring(1)) : Number(frameText);
    if (!Number.isInteger(frame) || (player !== "a" && player !== "b")) throw new Error(`invalid pad line ${source}`);
    previous = frame;
    const slot = player === "a" ? 0 : 1;
    if (action === "tap") {
      edges.push({ frame, slot, action: "press", args }, { frame: frame + Number(args[1] ?? 1), slot, action: "release", args });
    } else edges.push({ frame, slot, action, args });
  }
  return { setup, edges: edges.sort((a, b) => a.frame - b.frame) };
}

/** One slot's pad as standalone input on each frame: buttons held, the stick, and the shield trigger past its threshold. */
export function padInputs(edges: readonly PadEdge[], slot: number) {
  const held = new Set<string>();
  let axisX = 0, axisY = 0, shield = 0, next = 0;
  const own = edges.filter((edge) => edge.slot === slot);
  return (frame: number): StandaloneInput => {
    while (next < own.length && (own[next]?.frame ?? Infinity) <= frame) {
      const edge = own[next++];
      if (edge === undefined) continue;
      const button = BUTTONS[(edge.args[0] ?? "").toUpperCase()];
      if (edge.action === "press" && button !== undefined) held.add(button);
      else if (edge.action === "release" && button !== undefined) held.delete(button);
      else if (edge.action === "stick") { axisX = Number(edge.args[0]); axisY = Number(edge.args[1]); }
      else if (edge.action === "shield") shield = Number(edge.args[0]);
    }
    return { buttons: [...held, ...(shield > 4000 / 32767 ? ["shield"] : [])], axisX, axisY };
  };
}

/**
 * The keyboard build, one slot per process: each process presses its own pad's keys as key events,
 * which Wisp's transport carries to both clients (wisp:docs/network-model.md).
 */
export function padNetGame(script: string): NetGame {
  return {
    create: async (link, slot) => {
      const runtime = installHeadless(PREDICTED_HEADLESS);
      try {
        const platform = join(import.meta.dir, "../../src/platform");
        interface State { readonly game: { readonly phase: number } }
        const { shell }: { shell(): State } = await import(join(platform, "shell/state.ts"));
        const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import(join(platform, "shell/diagnostics.ts"));
        const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(platform, "shell/keys.ts"));
        const { setHumanCount }: { setHumanCount(game: State["game"], count: number): void } = await import(join(import.meta.dir, "../../src/game/match/rules.ts"));
        const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import(join(platform, "main.ts"));
        const build: MapBuild = { ...PLAYABLE_BUILD, devConsole: true };
        const lockstep = runtime.clients({ install: () => main.install(build), start: () => main.startBuild(build) }, [slot], { humans: [0, 1], link, keepCalls: 0 });
        const client = lockstep.client(slot);
        const { setup, edges } = padEdges(script);
        const input = padInputs(edges, slot);
        let held = new Set<number>();
        return {
          start: () => lockstep.start(),
          step: () => {
            if (lockstep.frame === SETUP_FRAME) client.run(() => {
              setHumanCount(shell().game, 2);
              applyDeveloperCommand(shell(), 0, setup);
            });
            if (lockstep.frame >= SETUP_FRAME) {
              const next = heldKeys(input(lockstep.frame - SETUP_FRAME + 1));
              for (const key of held) if (!next.has(key)) lockstep.key(slot, key, 0, false);
              for (const key of next) if (!held.has(key)) lockstep.key(slot, key, 0, true);
              held = next;
            }
            lockstep.frames(1);
            if (client.errors.length > 0) throw new Error(client.errors.join("\n"));
          },
          frame: () => lockstep.frame,
          checksum: () => {
            let checksum = "";
            client.run(() => { checksum = confirmedChecksum(shell()); });
            return checksum;
          },
          close: () => runtime.restore(),
        };
      } catch (error) {
        runtime.restore();
        throw error;
      }
    },
  };
}

/** sha256 over every map source file, path and content in path order: two players with different sources get different hashes. */
export async function smashcraftMapHash(): Promise<string> {
  const root = join(import.meta.dir, "../../src");
  const paths = [...new Bun.Glob("**/*").scanSync({ cwd: root })].sort();
  const hash = new Bun.CryptoHasher("sha256");
  for (const path of paths) {
    hash.update(`${path}\0`);
    hash.update(new Uint8Array(await Bun.file(join(root, path)).arrayBuffer()));
  }
  return hash.digest("hex");
}

const PHASE_NAMES = new Map<number, string>(Object.entries(Phase).map(([name, value]) => [value, name]));

/** One player of a hosted or joined match: both humans meet at fighter selection, and each presses its window's input or its pad script. */
export async function createNetStandalone(link: LockstepLink, slot: number, options: { readonly script?: string } = {}): Promise<StandaloneNetSession> {
  const runtime = installHeadless(PREDICTED_HEADLESS);
  try {
    const platform = join(import.meta.dir, "../../src/platform");
    interface State { readonly game: { readonly phase: number } }
    const { shell }: { shell(): State } = await import(join(platform, "shell/state.ts"));
    const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import(join(platform, "shell/diagnostics.ts"));
    const { setHumanCount }: { setHumanCount(game: State["game"], count: number): void } = await import(join(import.meta.dir, "../../src/game/match/rules.ts"));
    const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import(join(platform, "main.ts"));
    const build: MapBuild = { ...PLAYABLE_BUILD, devConsole: true };
    const lockstep = runtime.clients({ install: () => main.install(build), start: () => main.startBuild(build) }, [slot], { humans: [0, 1], link, keepCalls: 0 });
    const client = lockstep.client(slot);
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(platform, "shell/keys.ts"));
    const scripted = options.script === undefined ? undefined : padInputs(padEdges(options.script).edges, slot);
    const chat = (options.script ?? "").split("\n").map((line) => line.trim()).filter((line) => line.startsWith("#! chat ")).map((line) => line.substring(8));
    let latest: StandaloneInput = { buttons: [], axisX: 0, axisY: 0 };
    let held = new Set<number>();
    let lastPhase = -1;
    return {
      client,
      input: (input) => { latest = input; },
      start: () => lockstep.start(),
      step: () => {
        if (lockstep.frame === SETUP_FRAME) {
          client.run(() => {
            setHumanCount(shell().game, 2);
            for (const command of chat) applyDeveloperCommand(shell(), command.startsWith("-dev fighter ") ? Number(command.split(" ")[2]) - 1 : 0, command);
          });
          console.log(`net: fighter selection with 2 players at frame ${lockstep.frame}`);
        }
        if (lockstep.frame >= SETUP_FRAME) {
          const next = heldKeys(scripted === undefined ? latest : scripted(lockstep.frame - SETUP_FRAME + 1));
          for (const key of held) if (!next.has(key)) lockstep.key(slot, key, 0, false);
          for (const key of next) if (!held.has(key)) lockstep.key(slot, key, 0, true);
          held = next;
        }
        lockstep.frames(1);
        if (client.errors.length > 0) throw new Error(client.errors.join("\n"));
        client.run(() => {
          const phase = shell().game.phase;
          if (phase !== lastPhase) console.log(`net: ${PHASE_NAMES.get(phase) ?? phase} at frame ${lockstep.frame}`);
          lastPhase = phase;
        });
      },
      frame: () => lockstep.frame,
      checksum: () => {
        let checksum = "";
        client.run(() => { checksum = confirmedChecksum(shell()); });
        return checksum;
      },
      close: () => runtime.restore(),
    };
  } catch (error) {
    runtime.restore();
    throw error;
  }
}
