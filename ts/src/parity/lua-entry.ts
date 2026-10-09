
import { evaluateCase } from "./corpus";

const count = 2000;
for (let index = 0; index < count; index++) {
  const results = evaluateCase(index);
  const fields: string[] = [];
  for (const value of results) fields.push(string.format("%.17g", value));
  print(`${index} ${fields.join(" ")}`);
}
