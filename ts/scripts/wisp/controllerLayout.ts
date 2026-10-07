import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { Schema } from "effect";

const LayoutSchema = Schema.Literals(["standard", "z-jump"]);
const ShieldSchema = Schema.Literals(["full", "light"]);
const SettingsSchema = Schema.Struct({
  pad_preset: Schema.optionalKey(LayoutSchema),
  tap_jump: Schema.optionalKey(Schema.Boolean),
  triggers: Schema.optionalKey(Schema.Struct({ left: Schema.optionalKey(ShieldSchema), right: Schema.optionalKey(ShieldSchema) })),
});
const StatusSchema = Schema.Struct({ status: Schema.Struct({ settings: Schema.Struct({ pad_preset: LayoutSchema }) }) });

export type Layout = "standard" | "z-jump";
export const controllerSettingsPath = () => join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "smashcraft/controller.json");

/** Sends a live choice and waits for the service to report it; a stopped service saves it for next start. */
export async function setControllerLayout(layout: Layout, path = controllerSettingsPath(), port = Number(process.env.WC3_CONTROLLER_PORT ?? 47631)): Promise<"live" | "saved"> {
  const live = await new Promise<boolean>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port });
    let buffer = "";
    let sent = false;
    socket.setTimeout(3000);
    const finish = (error?: Error, connected = true) => {
      socket.destroy();
      if (error) reject(error); else resolve(connected);
    };
    socket.on("connect", () => { socket.write(JSON.stringify({ pad_preset: layout }) + "\n"); sent = true; });
    socket.on("timeout", () => finish(new Error("the controller service didn't confirm the layout within 3 s")));
    socket.on("error", (error: NodeJS.ErrnoException) => error.code === "ECONNREFUSED" && !sent ? finish(undefined, false) : finish(error));
    socket.on("end", () => finish(new Error("the controller service closed before confirming the layout")));
    socket.on("data", (data) => {
      buffer += data.toString();
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try {
          const message: unknown = JSON.parse(line);
          if (Schema.is(StatusSchema)(message) && message.status.settings.pad_preset === layout) finish();
        } catch { finish(new Error("the controller service sent an unreadable status")); }
      }
    });
  });
  if (live) return "live";
  const saved: unknown = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const previous = Schema.decodeUnknownSync(SettingsSchema)(saved);
  const settings = { pad_preset: layout, tap_jump: previous.tap_jump ?? false, triggers: { left: previous.triggers?.left ?? "full", right: previous.triggers?.right ?? "full" } };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n");
  renameSync(temporary, path);
  return "saved";
}
