



import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { makeDoctor, makeSignOut } from "wisp/scripts/wisp/clientDoctorCommand";
import { DoctorStop } from "wisp/scripts/wisp/doctor";
import { clientState } from "./project";
import { smashcraftDoctor, smashcraftWatch } from "./doctor";

export const doctorForClients = (clientsFile: string): Command => (names) =>
  Effect.try({ try: () => smashcraftDoctor(clientsFile), catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientsFile}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => makeDoctor(declaration, smashcraftWatch())(names)),
  );

export const signOutForClients = (clientsFile: string): Command => (names) =>
  Effect.try({ try: () => smashcraftDoctor(clientsFile), catch: (cause) => new DoctorStop({ problem: `can't read the clients from ${clientsFile}: ${String(cause)}` }) }).pipe(
    Effect.flatMap((declaration) => makeSignOut(declaration)(names)),
  );

export const doctor = doctorForClients(clientState);
export const signOut = signOutForClients(clientState);
