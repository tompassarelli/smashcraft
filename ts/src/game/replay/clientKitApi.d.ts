// Client kit 1's sim.js (smashcraft:docs/client-interface.md): copied into the kit as sim.d.ts, so it imports nothing.

export interface ReplayRepro {
  readonly build: string;
  readonly frame: number;
  readonly checksum: string;
  readonly lines: readonly string[];
}

/** A manifest's or joined replay's header; `parts` is undefined for a joined replay. */
export interface ReplayHeader {
  readonly repro: ReplayRepro;
  readonly serial: number;
  readonly version: string;
  readonly parts: number | undefined;
}

export interface SceneCapsule {
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  readonly radius: number;
}

export interface ScenePart extends SceneCapsule {
  /** 0 normal, 1 invincible, 2 intangible. */
  readonly state: number;
}

export interface SceneFighter {
  readonly slot: number;
  readonly character: number;
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  readonly damage: number;
  readonly stocks: number;
  readonly out: boolean;
  readonly parts: readonly ScenePart[];
  readonly strikes: readonly SceneCapsule[];
  readonly projectiles: readonly { readonly x: number; readonly z: number }[];
}

export interface ReplayScene {
  readonly frame: number;
  readonly stage: number;
  readonly surfaces: readonly { readonly left: number; readonly right: number; readonly z: number }[];
  readonly blast: { readonly left: number; readonly right: number; readonly bottom: number; readonly top: number };
  readonly fighters: readonly SceneFighter[];
}

/** A replay opened for watching. */
export interface ReplayViewer {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  /** The frame the replay starts after, and its last frame. */
  readonly first: number;
  readonly last: number;
  /** The frame the shown state is after. */
  readonly frame: number;
  /** Runs the next frame; false at the last frame or when a frame can't run. */
  step(): boolean;
  /** Shows the state after `frame`, clamped to the replay. */
  seek(frame: number): void;
  scene(): ReplayScene;
}

export declare const VIEWER_API: number;
/** The source version this simulation plays (the `version` line of its replays). */
export declare function sourceVersion(): string;
export declare function openReplay(lines: readonly string[]): ReplayViewer | string;
/** A part's lines, or what is wrong with them. */
export declare function parseReplayPart(lines: readonly string[], serial: number, part: number): readonly string[] | string;
export declare function parseReplayHeader(lines: readonly string[]): ReplayHeader | string;
/** One joined replay from a manifest's header and its parts' lines. */
export declare function joinReplay(header: ReplayHeader, parts: readonly (readonly string[])[]): string[];
