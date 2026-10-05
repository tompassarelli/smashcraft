# Language-service demonstration — 5 October 2026

The executable fixture at
smashcraft:evidence/wurst-capabilities-20261005/language-service.ts uses the
project's installed TypeScript 6.0.2 compiler API. It holds two fixture files
in memory and makes direct definition, reference, rename and semantic
diagnostic requests. No editor extension or game process participates.

At Smashcraft `0303bb7`, the command
`bun evidence/wurst-capabilities-20261005/language-service.ts` returned 0.
The recorded output in
smashcraft:evidence/wurst-capabilities-20261005/language-service-result.json
contains one cross-file definition, four references, four rename locations in
two files, and one invalid-assignment diagnostic (2322). After applying the
declaration rename and repairing that assignment, both files had zero syntax
and semantic diagnostics. Rename starts at the exported declaration; renaming
an imported local binding instead intentionally creates an import alias.

The comparison operation on the Wurst side is defined by compiler pin
`6b129956f6e7cf9582510f26b99d305526bf3ded`, whose language-server initialization
advertises definitions, references and rename, and whose text-document service
dispatches those requests to its project model. Those source declarations were
inspected; no new Wurst language-server benchmark was run. The result measures
TypeScript's compiler API behavior on this two-file fixture, not editor setup
or whole-project response time.
