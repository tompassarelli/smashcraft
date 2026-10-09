import { resolve } from "node:path";
import { refuseUntagged } from "./oracleTags";

const root = resolve(import.meta.dir, "..");
const files = new Set([
  ...new Bun.Glob("**/*{.test,_test,.spec,_spec}.{js,jsx,ts,tsx}").scanSync(root),
  ...new Bun.Glob("scripts/**/*.tests.ts").scanSync(root),
  ...new Bun.Glob("src/**/*.tests.ts").scanSync(root),
]);
refuseUntagged(root, [...files].filter((file) => file !== "test/game.test.ts" && !file.startsWith("build/") && !file.split("/").some((part) => part === "node_modules" || part === ".git")).sort());
