



import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { type DoctorDeclaration, clientsDoctor } from "wisp/scripts/wisp/clientDoctorCommand";
import { DoctorStop, withDoctor } from "wisp/scripts/wisp/doctor";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { clientState } from "./project";

const steam = join(homedir(), ".local/share/Steam");
const proton = join(steam, "compatibilitytools.d/GE-Proton11-7-x86_64/proton");
const runtime = join(steam, "steamapps/common/SteamLinuxRuntime_4/_v2-entry-point");
const capacity = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");


const CLIENTS: Readonly<Record<string, { readonly compatData: string; readonly appId: number; readonly gameId: string }>> = {
  a: { compatData: join(homedir(), ".local/share/wc3-melee/client-a"), appId: 3516115573, gameId: "16213922543717842946" },
  b: { compatData: join(homedir(), ".local/share/wc3-melee/client-b"), appId: 3516115572, gameId: "16213922543717842945" },
};






const ACCOUNTS: Readonly<Record<string, string>> = { a: "c", b: "b" };
const SECRETS = join(homedir(), "code/nixos-config/main/secrets/bnet.yaml");






export const accountField = (account: string, field: "username" | "password") => {
  const runtime = `/run/secrets/bnet-${account}-${field}`;
  return existsSync(runtime)
    ? ["cat", runtime]
    : ["sudo", "-n", "env", "SOPS_AGE_KEY_FILE=/var/lib/sops-nix/key.txt", "sops", "--decrypt", "--extract", `["${account}"]["${field}"]`, SECRETS];
};


const ClientsFile = Schema.Struct({ clients: Schema.Array(Schema.Struct({ name: Schema.String, run: Schema.String,
  documents: Schema.String, menuReportPort: Schema.optionalKey(Schema.Finite), offline: Schema.optionalKey(Schema.Boolean),
})) });


export const readClientsFile = (clientsFile = clientState) => Schema.decodeUnknownSync(ClientsFile)(JSON.parse(readFileSync(clientsFile, "utf8")));






const launcherCommand = (name: string, run: string, client: { readonly compatData: string; readonly appId: number; readonly gameId: string }) => {
  const read = (file: string) => readFileSync(join(run, file), "utf8").trim();
  return [
    process.execPath, capacity, "session", "--class", "native", "--owner", `native-client-${name}`, "--",
    "env", "-i", `HOME=${homedir()}`, `USER=${userInfo().username}`, "PATH=/run/current-system/sw/bin",
    `DISPLAY=${read("display")}`, `WAYLAND_DISPLAY=${read("wayland-display")}`, `XDG_RUNTIME_DIR=${join(run, "runtime")}`, "XAUTHORITY=",
    "dbus-run-session", "--", "steam-run", "env",
    `STEAM_COMPAT_DATA_PATH=${client.compatData}`, `STEAM_COMPAT_CLIENT_INSTALL_PATH=${steam}`, `STEAM_COMPAT_APP_ID=${client.appId}`,
    `SteamAppId=${client.appId}`, `SteamGameId=${client.gameId}`,
    runtime, "--verb=waitforexitandrun", "--", proton, "waitforexitandrun",
    join(client.compatData, "pfx/drive_c/Program Files (x86)/Battle.net/Battle.net Launcher.exe"),
  ];
};







const CLONE_LAUNCH = join(homedir(), ".local/share/wisp/online/launch.sh");
const cloneLauncher = (name: string, run: string) => {
  const clone = /^clone-([abcd])$/.exec(name)?.[1];
  return clone === undefined ? undefined : { kind: "command" as const, command: [CLONE_LAUNCH, clone, run], log: join(homedir(), `.local/share/wisp/online/${name}-launch.log`) };
};


export const smashcraftDoctor = (clientsFile = clientState): DoctorDeclaration => {
  const file = readClientsFile(clientsFile);
  const start: Record<string, DoctorDeclaration["start"][string]> = {};
  const accounts: Record<string, NonNullable<DoctorDeclaration["accounts"]>[string]> = {};
  for (const { name, run, offline } of file.clients) {
    if (offline === true) continue;
    const clone = cloneLauncher(name, run);
    if (clone !== undefined) start[name] = clone;
    const client = CLIENTS[name];
    if (client !== undefined) {
      start[name] = { kind: "command", command: launcherCommand(name, run, client), log: join(homedir(), `.local/state/smashcraft/client-${name}-launcher.log`) };
    }
    const account = ACCOUNTS[name];
    if (account !== undefined) accounts[name] = { username: accountField(account, "username"), password: accountField(account, "password") };
  }
  return { clientsFile, start, ...(Object.keys(accounts).length === 0 ? {} : { accounts }) };
};


export const smashcraftWatch = ClientWatch.layer({ filePrefix: "smashcraft" });


const checkClients = (print: (line: string) => void = console.log, clientsFile = clientState) =>
  Effect.try({ try: () => smashcraftDoctor(clientsFile), catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientsFile}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => clientsDoctor(declaration, [], print)),
    Effect.provide(smashcraftWatch),
  );





export const onHealthyClients = <A, E, R>(run: Effect.Effect<A, E, R>, options: { readonly retry?: boolean; readonly clientsFile?: string } = {}) =>
  withDoctor(checkClients(console.log, options.clientsFile), console.log, run, options.retry === undefined ? {} : { retry: options.retry });
