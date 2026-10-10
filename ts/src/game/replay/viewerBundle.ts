// The client kit's sim.js (smashcraft:docs/client-interface.md): the viewer, the replay files' format and this source's version.
import type * as Api from "./clientKitApi";
import { sourceVersion } from "../shell/sourceVersion";
import { joinReplay, parseReplayHeader, parseReplayPart } from "./replayFormat";
import { VIEWER_API, openReplay } from "./viewer";



({ VIEWER_API, openReplay, parseReplayHeader, parseReplayPart, joinReplay, sourceVersion }) satisfies typeof Api;
