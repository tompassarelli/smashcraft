import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { Effect, Option, Schema } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";

export const LAYOUTS = ["melee", "z-jump", "tom"] as const;
const LayoutSchema = Schema.Literals(LAYOUTS);
const ShieldSchema = Schema.Literals(["full", "light"]);
const SettingsSchema = Schema.Struct({
  pad_preset: Schema.optionalKey(LayoutSchema),
  tap_jump: Schema.optionalKey(Schema.Boolean),
  triggers: Schema.optionalKey(Schema.Struct({ left: Schema.optionalKey(ShieldSchema), right: Schema.optionalKey(ShieldSchema) })),
});
const StatusSchema = Schema.Struct({ status: Schema.Struct({ settings: Schema.Struct({ pad_preset: LayoutSchema }) }) });

export type Layout = typeof LAYOUTS[number];
export const controllerSettingsPath = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "wc3-controller/settings.json");

const fail = (problem: string) => new PlayProblem({ problem });
const readJsonLine = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));


const sendLive = (layout: Layout, port: number) =>
  Effect.acquireRelease(Effect.sync(() => connect({ host: "127.0.0.1", port })), (socket) => Effect.sync(() => socket.destroy())).pipe(
    Effect.flatMap((socket) => Effect.callback<boolean, PlayProblem>((resume) => {
      let buffer = "";
      let sent = false;
      socket.on("connect", () => { socket.write(JSON.stringify({ pad_preset: layout }) + "\n"); sent = true; });
      socket.on("error", (error: NodeJS.ErrnoException) => resume(error.code === "ECONNREFUSED" && !sent ? Effect.succeed(false) : Effect.fail(fail(String(error)))));
      socket.on("end", () => resume(Effect.fail(fail("the controller service closed before confirming the layout"))));
      socket.on("data", (data) => {
        buffer += data.toString();
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          const message = readJsonLine(line);
          if (Option.isNone(message)) resume(Effect.fail(fail("the controller service sent an unreadable status")));
          else if (Schema.is(StatusSchema)(message.value) && message.value.status.settings.pad_preset === layout) resume(Effect.succeed(true));
        }
      });
    })),
    Effect.timeoutOrElse({ duration: "3 seconds", orElse: () => Effect.fail(fail("the controller service didn't confirm the layout within 3 s")) }),
    Effect.scoped,
  );


export const setControllerLayout = (layout: Layout, path = controllerSettingsPath(), port = Number(process.env.WC3_CONTROLLER_PORT ?? 47631)) =>
  Effect.gen(function*() {
    if (yield* sendLive(layout, port)) return "live" as const;
    const text = yield* Effect.try({ try: () => existsSync(path) ? readFileSync(path, "utf8") : "{}", catch: (cause) => fail(`couldn't read ${path}: ${String(cause)}`) });
    const previous = yield* Schema.decodeEffect(Schema.fromJsonString(SettingsSchema))(text).pipe(Effect.mapError((cause) => fail(`${path}: ${String(cause)}`)));
    const settings = { pad_preset: layout, tap_jump: previous.tap_jump ?? false, triggers: { left: previous.triggers?.left ?? "full", right: previous.triggers?.right ?? "full" } };
    yield* Effect.try({
      try: () => {
        mkdirSync(dirname(path), { recursive: true });
        const temporary = `${path}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n");
        renameSync(temporary, path);
      },
      catch: (cause) => fail(`couldn't save ${path}: ${String(cause)}`),
    });
    return "saved" as const;
  });
