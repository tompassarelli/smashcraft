import { makeClient } from "wisp/scripts/wisp/commands/client";
import { clientState } from "../project";
export const client = makeClient(clientState);
