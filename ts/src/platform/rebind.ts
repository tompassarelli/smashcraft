
export function bindPrototype<T extends object>(object: T, prototype: object): void {
  setmetatable(object, prototype);
}
