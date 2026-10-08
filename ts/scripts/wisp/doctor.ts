// Smashcraft's native clients for `wisp client doctor` (wisp:docs/doctor.md): how
// each client's Battle.net starts on its own private desktop, as clients A and
// B were started on 6 Oct, the Battle.net account each signs in with, and the
// watch doctor reads them through.
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

/** Each client's Steam compatibility folder (its prefix's parent), and the app and game ids its Battle.net ran as on 6 Oct. */
const CLIENTS: Readonly<Record<string, { readonly compatData: string; readonly appId: number; readonly gameId: string }>> = {
  a: { compatData: join(homedir(), ".local/share/wc3-melee/client-a"), appId: 3516115573, gameId: "16213922543717842946" },
  b: { compatData: join(homedir(), ".local/share/wc3-melee/client-b"), appId: 3516115572, gameId: "16213922543717842945" },
};

/**
 * The account each client signs in with (nixos-config:secrets/bnet.yaml; Tom
 * authorized autonomous sign-in for a, b and c on 7 Oct). Account a is Tom's
 * own, on his main-desktop install, so no test client uses it.
 */
const ACCOUNTS: Readonly<Record<string, string>> = { a: "c", b: "b" };
const SECRETS = join(homedir(), "code/nixos-config/main/secrets/bnet.yaml");

/**
 * Commands that print one account field on stdout for doctor to type: the
 * sops-nix file /run/secrets/bnet-ACCOUNT-FIELD when the system declares it,
 * else a decryption with the machine's sops key through passwordless sudo.
 */
const accountField = (account: string, field: "username" | "password") => {
  const runtime = `/run/secrets/bnet-${account}-${field}`;
  return existsSync(runtime)
    ? ["cat", runtime]
    : ["sudo", "-n", "env", "SOPS_AGE_KEY_FILE=/var/lib/sops-nix/key.txt", "sops", "--decrypt", "--extract", `["${account}"]["${field}"]`, SECRETS];
};

/** The clients file's fields doctor and accept read: each client's name and private desktop run folder. */
const ClientsFile = Schema.Struct({ clients: Schema.Array(Schema.Struct({ name: Schema.String, run: Schema.String,
  documents: Schema.String, menuReportPort: Schema.optionalKey(Schema.Finite), offline: Schema.optionalKey(Schema.Boolean),
})) });

/** The clients file, decoded; throws when it is missing or malformed. */
export const readClientsFile = (clientsFile = clientState) => Schema.decodeUnknownSync(ClientsFile)(JSON.parse(readFileSync(clientsFile, "utf8")));

/**
 * Battle.net Launcher.exe in the client's prefix on its private desktop: the
 * Steam Linux Runtime and GE-Proton, in a clean environment naming only that
 * desktop, under the machine-capacity helper as the native clients run.
 */
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

/**
 * The signed-in 3.0.1 clones (wisp:docs/lan.md, "Signed-in 3.0.1 clients"):
 * clients named clone-a, clone-b, clone-c or clone-d start only through their own
 * launch script, which keeps clone-a (Tom's account) off while he plays. They
 * keep their own sign-in, so doctor types no account into them.
 */
const CLONE_LAUNCH = join(homedir(), ".local/share/wisp/online/launch.sh");
const cloneLauncher = (name: string, run: string) => {
  const clone = /^clone-([abcd])$/.exec(name)?.[1];
  return clone === undefined ? undefined : { kind: "command" as const, command: [CLONE_LAUNCH, clone, run], log: join(homedir(), `.local/share/wisp/online/${name}-launch.log`) };
};

/** The doctor declaration for the clients file as it stands now (its desktops' displays are read from their run folders). */
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

/** What the watch counts as a match: the map's start receipts under its runtime prefix. */
export const smashcraftWatch = () => ClientWatch.layer({ filePrefix: "smashcraft" });

/** Doctor on every client, with its own watch, printing each step. */
export const checkClients = (print: (line: string) => void = console.log, clientsFile = clientState) =>
  Effect.try({ try: () => smashcraftDoctor(clientsFile), catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientsFile}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => clientsDoctor(declaration, [], print)),
    Effect.provide(smashcraftWatch()),
  );

/**
 * `run` on healed clients: doctor before it and once after a failure
 * (wisp:docs/doctor.md), inside the desync autopsy (wisp:docs/autopsy.md):
 * every desync the clients report during it gets its first divergent birth
 * printed and its evidence saved.
 */
export const onHealthyClients = <A, E, R>(run: Effect.Effect<A, E, R>, options: { readonly retry?: boolean; readonly clientsFile?: string } = {}) =>
  withDoctor(checkClients(console.log, options.clientsFile), console.log, run, { ...(options.retry === undefined ? {} : { retry: options.retry }), autopsy: { clientsFile: options.clientsFile ?? clientState } });
