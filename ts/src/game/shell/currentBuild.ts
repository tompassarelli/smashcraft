// Packaging replaces this file with the build it packages, as build.sh wrote
// BuildInfo.wurst. The checked-in value is the integrity candidate's profile.
import type { MapBuild } from "./build";

export const CURRENT_BUILD: MapBuild = {
  id: "typescript-dev",
  inputProfile: "shadow-d0-r24",
  input: { kind: "journal", ingress: "editbox", delay: 0, rollback: 24 },
  presentation: "pool-predicted",
  scenario: "normal",
  responseProbe: true,
  devConsole: true,
  stageDeckModel: "war3mapImported\\StageDeck-48ca8b3ca98aa77d741926a42ad589a5f8b1df78e68f565c285ccadd6bc2c27c.mdx",
};
