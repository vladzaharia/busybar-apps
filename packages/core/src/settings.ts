// Typed reading of an app's settings (appmeta/settings.json). Stored values can be missing, stale after a schema
// change, or of the wrong type; every field falls back to its default instead.

/** A field's kind: a primitive type, or the list of allowed values for an enum. */
export type FieldKind = "boolean" | "integer" | "string" | readonly unknown[];

/** Picks known, well-typed fields out of `values`, falling back to `defaults` field by field. */
export function readSettings<T extends Record<string, unknown>>(
  values: Record<string, unknown> | null | undefined,
  defaults: T,
  spec: { [K in keyof T]: FieldKind },
): T {
  const out = { ...defaults };
  if (!values) return out;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const v = values[key];
    const kind = spec[key];
    const ok = Array.isArray(kind)
      ? kind.includes(v)
      : kind === "boolean"
        ? typeof v === "boolean"
        : kind === "integer"
          ? typeof v === "number" && Number.isInteger(v)
          : typeof v === "string";
    if (ok) out[key] = v as T[typeof key];
  }
  return out;
}
