declare const print: (this: void, line: string) => void;
declare const console: { log(this: void, line: string): void };

export function reportTestLine(line: string): void {
  if (typeof print === "function") print(line);
  else console.log(line);
}
