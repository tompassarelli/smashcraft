import { makeClient } from "waygate/scripts/waygate/commands/client";
import { clientState } from "../project";
export const client = makeClient(clientState);
