# Effect and TSTL probe

Run from smashcraft:ts/ with Bun installed:

```sh
bun test/compatibility/probe-effect-tstl.ts
```

This opt-in probe is excluded from `bun test`. With Effect 4.0.1 and
TypeScriptToLua 1.37.1, the published package path fails with:

```text
error TSTL: Could not resolve lua source files for require path 'effect' in file effect-tstl.ts.
```

The probe then creates a temporary symlink and imports the installed
package's Effect module as a namespace. That gets past package resolution, but TSTL exits
while transforming an Effect class:

```text
TypeError: undefined is not an object (evaluating 'node.kind')
    at isVariableDeclaration (.../typescript.js:31127:10)
    at getReflectionClassName (.../typescript-to-lua/.../class/setup.js:83:17)
```

This records the package-resolution and source-transformation blockers for this
exact Effect/TSTL pairing. It does not test a deliberately restricted subset of
Effect APIs or claim anything about Effect's runtime behavior in Lua.
