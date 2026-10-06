// Smashcraft's native clients for `wisp doctor` (wisp:docs/doctor.md): how
// each client's Battle.net starts on its own private desktop, as clients A and
// B were started on 6 Oct, and the watch doctor reads them through.
import { readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { type DoctorDeclaration, clientsDoctor } from "wisp/scripts/wisp/commands/doctor";
import { DoctorStop, withDoctor } from "wisp/scripts/wisp/doctor";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { clientState } from "./project";

const steam = join(homedir(), ".local/share/Steam");
const proton = join(steam, "compatibilitytools.d/GE-Proton11-7-x86_64/proton");
const runtime = join(steam, "steamapps/common/SteamLinuxRuntime_4/_v2-entry-point");
const capacity = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");

/** Each client's Steam compatibility folder (its prefix's parent), and the app and game ids its Battle.net ran as on 6 Oct. */
const CLIENTS: Readonly<Record<string, { readonly compatData: string; readonly appId: number; readonly gameId: string }>> = {
  a: { compatData: join(steam, "steamapps/compatdata/3516115571"), appId: 3516115571, gameId: "16213922543717842944" },
  b: { compatData: join(homedir(), ".local/share/wc3-melee/client-b"), appId: 3516115572, gameId: "16213922543717842945" },
};

interface ClientsFile {
  readonly clients: readonly { readonly name: string; readonly run: string }[];
}

/**
 * Battle.net Launcher.exe in the client's prefix on its private desktop: the
 * Steam Linux Runtime and GE-Proton, in a clean environment naming only that
 * desktop, under the machine-capacity helper as the native clients run.
 */
const launcherCommand = (name: string, run: string, client: { readonly compatData: string; readonly appId: number; readonly gameId: string }) => {
  const read = (file: string) => readFileSync(join(run, file), "utf8").trim();
  return [
    process.execPath, capacity, "session", "--class", "moderate", "--owner", `native-client-${name}`, "--",
    "env", "-i", `HOME=${homedir()}`, `USER=${userInfo().username}`, "PATH=/run/current-system/sw/bin",
    `DISPLAY=${read("display")}`, `WAYLAND_DISPLAY=${read("wayland-display")}`, `XDG_RUNTIME_DIR=${join(run, "runtime")}`, "XAUTHORITY=",
    "dbus-run-session", "--", "steam-run", "env",
    `STEAM_COMPAT_DATA_PATH=${client.compatData}`, `STEAM_COMPAT_CLIENT_INSTALL_PATH=${steam}`, `STEAM_COMPAT_APP_ID=${client.appId}`,
    `SteamAppId=${client.appId}`, `SteamGameId=${client.gameId}`,
    runtime, "--verb=waitforexitandrun", "--", proton, "waitforexitandrun",
    join(client.compatData, "pfx/drive_c/Program Files (x86)/Battle.net/Battle.net Launcher.exe"),
  ];
};

/** The doctor declaration for the clients file as it stands now (its desktops' displays are read from their run folders). */
export const smashcraftDoctor = (): DoctorDeclaration => {
  const file = JSON.parse(readFileSync(clientState, "utf8")) as ClientsFile;
  const start: Record<string, DoctorDeclaration["start"][string]> = {};
  for (const { name, run } of file.clients) {
    const client = CLIENTS[name];
    if (client !== undefined) {
      start[name] = { kind: "command", command: launcherCommand(name, run, client), log: join(homedir(), `.local/state/smashcraft/client-${name}-launcher.log`) };
    }
  }
  return { clientsFile: clientState, start };
};

/** What the watch counts as a match: the map's start receipts under its runtime prefix. */
export const smashcraftWatch = () => ClientWatch.layer({ filePrefix: "smashcraft" });

/** Doctor on every client, with its own watch, printing each step. */
export const checkClients = (print: (line: string) => void = console.log) =>
  Effect.try({ try: smashcraftDoctor, catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientState}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => clientsDoctor(declaration, [], print)),
    Effect.provide(smashcraftWatch()),
  );

/** `run` on healed clients: doctor before it and once after a failure (wisp:docs/doctor.md). */
export const onHealthyClients = <A, E, R>(run: Effect.Effect<A, E, R>, options: { readonly retry?: boolean } = {}) =>
  withDoctor(checkClients(), console.log, run, options);
