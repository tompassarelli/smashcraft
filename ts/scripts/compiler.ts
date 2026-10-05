// A map compiler that stays warm between compiles: TypeScript reuses the
// previous program's unchanged files, so an edit costs only re-checking and
// transforming, not process start, module load and parsing.
import ts from "typescript";
import { Transpiler, parseConfigFileWithSystem } from "typescript-to-lua";

export function mapCompiler(configPath: string): () => readonly ts.Diagnostic[] {
  let previous: ts.Program | undefined;
  return () => {
    // Parsed every time so added and removed files are picked up.
    const config = parseConfigFileWithSystem(configPath);
    if (config.errors.length > 0) return config.errors;
    const program = ts.createProgram({ rootNames: config.fileNames, options: config.options, ...(previous && { oldProgram: previous }) });
    previous = program;
    const preEmit = ts.getPreEmitDiagnostics(program);
    if (preEmit.length > 0) return preEmit;
    return new Transpiler().emit({ program }).diagnostics;
  };
}

export function report(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
}
