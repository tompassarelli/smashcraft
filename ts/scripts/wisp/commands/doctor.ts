// `bun wisp doctor [CLIENT...]`: brings clients A and B (or those named) to a
// ready state, recovering each known bad state with its documented recovery
// and printing each step (wisp:docs/doctor.md). It stops with one plain line
// when Tom must sign in.
import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { makeDoctor } from "wisp/scripts/wisp/commands/doctor";
import { DoctorStop } from "wisp/scripts/wisp/doctor";
import { clientState } from "../project";
import { smashcraftDoctor, smashcraftWatch } from "../doctor";

export const doctor: Command = (names) =>
  Effect.try({ try: smashcraftDoctor, catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientState}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => makeDoctor(declaration, smashcraftWatch())(names)),
  );
