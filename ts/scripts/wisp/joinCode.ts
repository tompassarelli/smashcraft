





const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const HALF = 4;

export interface JoinCode {

  readonly text: string;

  readonly gameName: string;
  readonly password: string;
}

const fromCharacters = (characters: string): JoinCode => {
  const name = characters.slice(0, HALF);
  const password = characters.slice(HALF);
  return { text: `${name}-${password}`, gameName: `Smashcraft ${name}`, password };
};


export function newJoinCode(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): JoinCode {
  const bytes = random(new Uint8Array(HALF * 2));
  return fromCharacters(Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join(""));
}


export function readJoinCode(typed: string): JoinCode | undefined {
  const characters = typed.toUpperCase().replace(/[\s-]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (characters.length !== HALF * 2 || [...characters].some((character) => !ALPHABET.includes(character))) return undefined;
  return fromCharacters(characters);
}
