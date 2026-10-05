// Publish Waygate's source separately, then record a generated immutable package
// here so private-repository authentication is unnecessary for consumer installs.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [checkout, revision] = process.argv.slice(2);
if (checkout === undefined || revision === undefined) {
  throw new Error("usage: bun scripts/update-waygate.ts WAYGATE_CHECKOUT FULL_COMMIT");
}
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Waygate revision must be a full commit ID");
const project = resolve(import.meta.dir, "..");
const run = (args: string[]) => {
  const result = Bun.spawnSync(args, { cwd: project, stdout: "pipe", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`command failed: ${args[0]} (exit ${result.exitCode})`);
  return new TextDecoder().decode(result.stdout).trim();
};
const resolved = run(["git", "-C", resolve(checkout), "rev-parse", `${revision}^{commit}`]);
if (resolved !== revision) throw new Error("Waygate revision did not resolve to the requested commit");
const archive = `vendor/waygate-${revision}.tgz`;
mkdirSync(resolve(project, "vendor"), { recursive: true });
run(["git", "-C", resolve(checkout), "archive", "--format=tar.gz", "--prefix=package/", `--output=${resolve(project, archive)}`, revision]);
const packagePath = resolve(project, "package.json");
const pkg = await Bun.file(packagePath).json();
pkg.devDependencies.waygate = `file:${archive}`;
await Bun.write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
await Bun.write(resolve(project, "waygate.lock"), `${JSON.stringify({
  repository: "https://github.com/tompassarelli/waygate",
  revision,
  archive,
}, null, 2)}\n`);
run([process.execPath, "install"]);
console.log(`Waygate ${revision} installed from ${archive}`);
