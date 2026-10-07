// Direct play's join code (#142): eight characters a player reads out or
// pastes, shown as ABCD-EFGH. The first four name the hosted Battle.net game
// ("Smashcraft ABCD"), the last four are its password, so the code alone
// finds and opens the private lobby. Crockford's base 32 leaves out I, L, O
// and U; a typed O, I or L reads as 0, 1 or 1.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HALF = 4;

export interface JoinCode {
  /** As shown: ABCD-EFGH. */
  readonly text: string;
  /** The hosted game's exact (case-sensitive) name. */
  readonly gameName: string;
  readonly password: string;
}

const fromCharacters = (characters: string): JoinCode => {
  const name = characters.slice(0, HALF);
  const password = characters.slice(HALF);
  return { text: `${name}-${password}`, gameName: `Smashcraft ${name}`, password };
};

/** A new code from `random` bytes (eight of them are read). */
export function newJoinCode(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): JoinCode {
  const bytes = random(new Uint8Array(HALF * 2));
  return fromCharacters(Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join(""));
}

/** The code a player typed, or undefined when it isn't one. Spaces, dashes and case don't matter. */
export function readJoinCode(typed: string): JoinCode | undefined {
  const characters = typed.toUpperCase().replace(/[\s-]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (characters.length !== HALF * 2 || [...characters].some((character) => !ALPHABET.includes(character))) return undefined;
  return fromCharacters(characters);
}
