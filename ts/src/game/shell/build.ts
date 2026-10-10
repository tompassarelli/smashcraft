

import type { FixedDelay } from "../netcode/fixedSchedule";


export type JournalIngress = "files" | "keyboard" | "editbox";


interface ShadowSettings {
  readonly delay: FixedDelay;
  readonly rollback: number;
}


type InputMode =

  | { readonly kind: "callback" }

  | ({ readonly kind: "keyboard"; readonly pairedSends: boolean } & ShadowSettings)

  | ({ readonly kind: "journal"; readonly ingress: JournalIngress } & ShadowSettings);

export type ShadowInputMode = Exclude<InputMode, { kind: "callback" }>;


type PresentationProfile = "native" | "pool-confirmed" | "pool-predicted";

const SCENARIOS = ["normal", "up-special-recovery", "knockdown", "tech", "shield-break", "ledge", "spike", "ko", "underside", "camera", "body-ceiling", "body-wall", "agency-none", "agency-di", "agency-act", "agency-thaw",
  "pain-low-small", "pain-low-medium", "pain-low-large", "pain-middle-small", "pain-middle-medium", "pain-middle-large", "pain-high-small", "pain-high-medium", "pain-high-large"] as const;

export type Scenario = (typeof SCENARIOS)[number];

export const isScenario = (name: string): name is Scenario => SCENARIOS.some(scenario => scenario === name);

export interface MapBuild {

  readonly id: string;

  readonly inputProfile: string;
  readonly input: InputMode;
  readonly presentation: PresentationProfile;
  readonly scenario: Scenario;
  readonly responseProbe: boolean;

  readonly pausePositionProbe?: boolean;

  readonly epochProbe?: boolean;

  readonly analogPad?: "keys" | "cursor";

  readonly analogPadDiagnostic?: boolean;

  readonly devConsole: boolean;





  readonly errorsOnScreen: boolean;





  readonly hotReload: boolean;
}

export const isShadow = (input: InputMode): input is ShadowInputMode => input.kind !== "callback";

export function journalIngress(build: Readonly<MapBuild>): JournalIngress | undefined {
  return build.input.kind === "journal" ? build.input.ingress : undefined;
}

export const usesPool = (build: Readonly<MapBuild>): boolean => build.presentation !== "native";
