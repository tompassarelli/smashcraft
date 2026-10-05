// What a packaged map was built for: its identity, input path, presentation
// and developer scenario. The shell reads these settings and never changes them.
import type { FixedDelay } from "../netcode/fixedSchedule";

/** How the helper hands journal text to the map. */
export type JournalIngress = "files" | "keyboard" | "editbox";

/** Rollback input: a fixed delay D and a rollback window R, both for every epoch. */
interface ShadowSettings {
  readonly delay: FixedDelay;
  readonly rollback: number;
}

/** Where each client's synchronized input comes from. */
type InputMode =
  /** Key events adapted on the game callback; no synchronized input rows. */
  | { readonly kind: "callback" }
  /** Keys polled on the callback into rollback rows; pairedSends sends two rows per message. */
  | ({ readonly kind: "keyboard"; readonly pairedSends: boolean } & ShadowSettings)
  /** Rows the companion helper journals for their original frames. */
  | ({ readonly kind: "journal"; readonly ingress: JournalIngress } & ShadowSettings);

export type ShadowInputMode = Exclude<InputMode, { kind: "callback" }>;

/** native: the fighter unit animates; pool: clip models, from confirmed or predicted state. */
type PresentationProfile = "native" | "pool-confirmed" | "pool-predicted";

export type Scenario = "normal" | "knockdown" | "tech" | "shield-break" | "ledge" | "parry" | "spike" | "ko";

export interface MapBuild {
  /** Names every file the map and the helper exchange. */
  readonly id: string;
  /** The input profile's build name, as traces print it. */
  readonly inputProfile: string;
  readonly input: InputMode;
  readonly presentation: PresentationProfile;
  readonly scenario: Scenario;
  readonly responseProbe: boolean;
  /** The `-dev` chat commands and the developer status line; players of a playable build see neither. */
  readonly devConsole: boolean;
  /**
   * Displays runtime error reports (`error in HANDLER: ...`: handler names, TypeScript
   * lines, Lua messages) on screen. Reports reach the error file either way, which the
   * development host and the capture gates read; players of a playable build see no report.
   */
  readonly errorsOnScreen: boolean;
  /**
   * Polls CustomMapData for `bun wisp hot` bundles, 32 file lookups a second.
   * Under Wine a lookup that misses reads its whole folder, so a client with
   * no `smashcraft-hot` folder lists all of CustomMapData on every poll.
   */
  readonly hotReload: boolean;
}

export const isShadow = (input: InputMode): input is ShadowInputMode => input.kind !== "callback";

export function journalIngress(build: Readonly<MapBuild>): JournalIngress | undefined {
  return build.input.kind === "journal" ? build.input.ingress : undefined;
}

export const usesPool = (build: Readonly<MapBuild>): boolean => build.presentation !== "native";
