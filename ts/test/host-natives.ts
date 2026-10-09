// Warcraft natives return binary32 values and use JASS conversions.


const natives = {
  R2I: (x: number) => (x < 0 ? Math.ceil(x) : Math.floor(x)),
  I2R: (x: number) => x,
  I2S: (x: number) => String(x),
  R2S: (x: number) => x.toFixed(3),
  S2I: (s: string) => {
    const m = /^\s*[-+]?\d+/.exec(s);
    return m === null ? 0 : Number(m[0]) | 0;
  },
  S2R: (s: string) => {
    const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)/.exec(s);
    return m === null ? 0 : Math.fround(Number(m[0]));
  },
  SquareRoot: (x: number) => Math.fround(Math.sqrt(x)),
  Atan2: (y: number, x: number) => Math.fround(Math.atan2(y, x)),
  SubString: (s: string, start: number, end: number) => s.substring(start, end),
  StringLength: (s: string) => s.length,
  BlzBitAnd: (a: number, b: number) => a & b,
  BlzBitOr: (a: number, b: number) => a | b,
  BlzBitXor: (a: number, b: number) => a ^ b,
};
Object.assign(globalThis, natives);
