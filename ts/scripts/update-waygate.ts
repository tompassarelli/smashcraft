// Publish Waygate's source separately, then record a generated immutable package
// here so private-repository authentication is unnecessary for consumer installs.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const [checkout, requestedRevision] = process.argv.slice(2);
if (checkout !== undefined && (requestedRevision === undefined || !/^[a-f0-9]{40}$/.test(requestedRevision))) {
  throw new Error("usage: bun run update:waygate [WAYGATE_CHECKOUT FULL_COMMIT]");
}
const repository = "https://github.com/tompassarelli/waygate";
const project = resolve(import.meta.dir, "..");
const run = (args: string[], cwd = project) => {
  const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`command failed: ${args[0]} (exit ${result.exitCode})`);
  return new TextDecoder().decode(result.stdout).trim();
};
mkdirSync(resolve(project, "vendor"), { recursive: true });
mkdirSync(resolve(project, "build"), { recursive: true });
const work = mkdtempSync(resolve(project, "build/waygate-package-"));
const source = resolve(work, "source");
mkdirSync(source);
const sourceArchive = resolve(work, "source.tar");
let revision: string;
let archive: string;
try {
  const gitSource = checkout === undefined ? resolve(work, "repository") : resolve(checkout);
  if (checkout === undefined) {
    run(["git", "clone", "--quiet", "--bare", "--depth=1", "--branch=main", `${repository}.git`, gitSource]);
  }
  revision = run(["git", "-C", gitSource, "rev-parse", `${requestedRevision ?? "HEAD"}^{commit}`]);
  if (!/^[a-f0-9]{40}$/.test(revision) || (requestedRevision !== undefined && revision !== requestedRevision)) {
    throw new Error("Waygate revision did not resolve to the requested commit");
  }
  archive = `vendor/waygate-${revision}.tgz`;
  if (!await Bun.file(resolve(project, archive)).exists()) {
    run(["git", "-C", gitSource, "archive", "--format=tar", `--output=${sourceArchive}`, revision]);
    run(["tar", "-xf", sourceArchive, "-C", source]);
    run([process.execPath, "install", "--frozen-lockfile"], source);
    run([process.execPath, "scripts/package.ts", resolve(project, archive)], source);
  }
} finally {
  rmSync(work, { recursive: true });
}
const packagePath = resolve(project, "package.json");
const pkg = await Bun.file(packagePath).json();
pkg.devDependencies.waygate = `file:${archive}`;
await Bun.write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
await Bun.write(resolve(project, "waygate.lock"), `${JSON.stringify({
  repository,
  revision,
  archive,
}, null, 2)}\n`);
run([process.execPath, "install"]);
console.log(`Waygate ${revision} installed from ${archive}`);
