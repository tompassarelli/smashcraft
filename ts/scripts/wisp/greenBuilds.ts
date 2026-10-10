type Verdict = "success" | "failure" | "pending" | "missing";

export interface RunSummary {
  readonly status: string;
  readonly conclusion: string;
  readonly createdAt: string;
}

export interface Candidate {
  readonly sha: string;
  readonly ci: Verdict;
  readonly farm: Verdict;
}

const SHORT_COMMIT = 7;

export const PLAYABLE_FILE = /^Smashcraft (\d+\.\d+\.\d+)(?: ([0-9a-f]{7,40}))?\.w3x$/;

const KEPT_PRIOR_VERSIONS = 2;

export function verdictOf(runs: readonly RunSummary[]): Verdict {
  const latest = runs.reduce<RunSummary | undefined>((best, run) => best === undefined || run.createdAt > best.createdAt ? run : best, undefined);
  if (latest === undefined) return "missing";
  if (latest.status !== "completed") return "pending";
  return latest.conclusion === "success" ? "success" : "failure";
}

const isGreen = ({ ci, farm }: Candidate): boolean => ci === "success" && farm === "success";

export function installName(version: string, sha: string): string {
  return `Smashcraft ${version} ${sha.slice(0, SHORT_COMMIT)}`;
}

interface Installed {
  readonly version: readonly [number, number, number];
  readonly commit: string | undefined;
}

export function parseInstalled(file: string): Installed | undefined {
  const match = PLAYABLE_FILE.exec(file);
  if (match === null) return undefined;
  const [major = 0, minor = 0, patch = 0] = (match[1] ?? "").split(".").map(Number);
  return { version: [major, minor, patch], commit: match[2] };
}

const newerVersion = (a: Installed, b: Installed): number =>
  b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2];

export function pickGreen(commits: readonly Candidate[], installed: readonly string[]): Candidate | undefined {
  const has = (sha: string) => installed.some((commit) => commit.length > 0 && sha.startsWith(commit));
  const index = commits.findIndex(isGreen);
  if (index === -1) return undefined;
  if (commits.slice(0, index + 1).some(({ sha }) => has(sha))) return undefined;
  return commits[index];
}

export function pruneTargets(present: readonly string[], keep: string): string[] {
  const versions = present.flatMap((file) => {
    const parsed = file === keep ? undefined : parseInstalled(file);
    return parsed === undefined ? [] : [{ file, parsed }];
  });
  versions.sort((a, b) => newerVersion(a.parsed, b.parsed) || (a.file < b.file ? 1 : a.file > b.file ? -1 : 0));
  return versions.slice(KEPT_PRIOR_VERSIONS).map(({ file }) => file);
}
