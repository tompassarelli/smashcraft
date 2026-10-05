/** Bind an existing Lua table to a newly compiled TypeScript class. */
export function bindPrototype<T extends object>(object: T, prototype: object): void {
  setmetatable(object, prototype as LuaMetatable<T>);
}
