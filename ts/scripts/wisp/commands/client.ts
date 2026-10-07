import { makeClient } from "wisp/scripts/wisp/commands/client";
import { doctor, signOut } from "../clientDoctorCommand";
import { clientState } from "../project";
// Match receipts let `client chat` and Return reach a running match (wisp:docs/watch.md, "Typing only into a match").
export const client = makeClient(clientState, { filePrefix: "smashcraft" }, doctor, signOut);
