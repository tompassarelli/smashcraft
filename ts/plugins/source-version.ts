// Stamps a player-facing map with its source version: every read of the
// global SMASHCRAFT_SOURCE (smashcraft:ts/src/game/shell/sourceVersion.ts)
// compiles to the version's string. A visitor, so Wisp's own compiler applies
// it too. Only the playable and integrity profiles use it: each build compiles
// afresh, while a long-running incremental compiler (the development map's)
// would keep the stamp of its first compile.
import { join } from "node:path";
import * as ts from "typescript";
import * as tstl from "typescript-to-lua";
import { sourceVersion } from "../scripts/sourceVersion";

const GLOBAL = "SMASHCRAFT_SOURCE";

const plugin = (): tstl.Plugin => {
  const version = sourceVersion(join(import.meta.dir, ".."));
  return {
    visitors: {
      [ts.SyntaxKind.Identifier]: (node, context) =>
        node.text === GLOBAL ? tstl.createStringLiteral(version, node) : context.superTransformExpression(node),
    },
  };
};

export default plugin;
