// The bar's check of an app's appmeta/settings.json, as the firmware makes it before it will show or store the app's
// settings: a port of lib/js_app/js_app_settings.c (busy-app/busybar-firmware, as of firmware 1.3.1). A file it
// refuses makes the bar's web interface say "Application settings schema is invalid", and the simulator build refuses
// it too (scripts/build.ts), so CI catches it before a bar does.
//
// Messages are the firmware's ("Field 'sprint_changes': 'max_length' is greater than 255"). The firmware stops at the
// first problem; this lists them all. Runs in Node and in the browser.

/** The firmware's limits (js_app_settings.c, setting_types/js_app_settings_geo.h). */
export const SETTINGS_LIMITS = {
  formatVersion: 1,
  /** A group inside a group: at most four deep. */
  maxDepth: 4,
  /** A string field's max_length, at most. Without one it is 64. */
  stringMaxLength: 255,
  stringDefaultMaxLength: 64,
  enumMaxOptions: 32,
  geoNameMaxLength: 128,
} as const;

type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (j: Json): j is JsonObject => typeof j === "object" && j !== null && !Array.isArray(j);
const TYPE_NAMES: [string, (j: Json) => boolean][] = [
  ["bool", (j) => typeof j === "boolean"],
  ["number", (j) => typeof j === "number"],
  ["string", (j) => typeof j === "string"],
  ["array", Array.isArray],
  ["object", isObject],
  ["null", (j) => j === null],
];
const typeName = (j: Json) => TYPE_NAMES.find(([, is]) => is(j))?.[0] ?? "unknown";
const expected: Record<string, (j: Json) => boolean> = Object.fromEntries(TYPE_NAMES);

/** cJSON's valueint: the number, truncated. */
const int = (n: number) => Math.trunc(n);
/** C's strlen: UTF-8 bytes. */
const bytes = (s: string) => new TextEncoder().encode(s).length;

class Field {
  readonly path: string;
  readonly json: JsonObject;
  /** How many groups it is inside: 0 at the top. */
  readonly depth: number;
  private readonly errors: string[];

  constructor(path: string, json: JsonObject, depth: number, errors: string[]) {
    this.path = path;
    this.json = json;
    this.depth = depth;
    this.errors = errors;
  }

  error(message: string): false {
    this.errors.push(`Field '${this.path}': ${message}`);
    return false;
  }

  /** A key of the given JSON type: its value, undefined when it is optional and absent, or false (reported). */
  get(key: string, type: string, optional: boolean): Json | undefined | false {
    if (!(key in this.json)) return optional ? undefined : this.error(`key '${key}' is missing`);
    const value = this.json[key];
    if (!expected[type]!(value)) return this.error(`key '${key}' has type ${typeName(value)} (${type} was expected)`);
    return value;
  }

  /** A non-negative integer key (read_uint). */
  uint(key: string): number | undefined | false {
    const v = this.get(key, "number", true);
    if (v === undefined || v === false) return v;
    const n = int(v as number);
    return n >= 0 ? n : this.error(`key '${key}' must be a non-negative integer`);
  }
}

const PARSERS: Record<string, (f: Field, errors: string[]) => boolean> = {
  boolean: (f) => f.get("default", "bool", false) !== false,

  integer: (f) => {
    const def = f.get("default", "number", false);
    const min = f.get("min", "number", true);
    const max = f.get("max", "number", true);
    const step = f.uint("step");
    if (def === false || min === false || max === false || step === false) return false;
    const lo = min === undefined ? -(2 ** 31) : int(min as number);
    const hi = max === undefined ? 2 ** 31 - 1 : int(max as number);
    if (lo > hi) return f.error("'min' is greater than 'max'");
    if (step === 0) return f.error("key 'step' must be a non-zero integer");
    const d = int(def as number);
    return d >= lo && d <= hi ? true : f.error("default is out of bounds");
  },

  string: (f) => {
    const def = f.get("default", "string", false);
    if (def === false || f.get("sensitive", "bool", true) === false) return false;
    const min = f.uint("min_length");
    const max = f.uint("max_length");
    if (min === false || max === false) return false;
    const lo = min ?? 0;
    const hi = max ?? SETTINGS_LIMITS.stringDefaultMaxLength;
    if (lo > hi) return f.error("'min_length' is greater than 'max_length'");
    if (hi > SETTINGS_LIMITS.stringMaxLength) return f.error(`'max_length' is greater than ${SETTINGS_LIMITS.stringMaxLength}`);
    const length = bytes(def as string);
    return length >= lo && length <= hi ? true : f.error("default length is out of bounds");
  },

  enum: (f) => {
    const def = f.get("default", "string", false);
    if (def === false) return false;
    const options = f.get("options", "array", false);
    if (options === false) return false;
    const list = options as Json[];
    if (list.length === 0 || list.length > SETTINGS_LIMITS.enumMaxOptions) {
      return f.error(`key 'options' must contain between 1 and ${SETTINGS_LIMITS.enumMaxOptions} items`);
    }
    const values: string[] = [];
    for (const option of list) {
      // The firmware reads each option's keys as it reads a field's, and names the field in its message.
      const o = new Field(f.path, isObject(option) ? option : {}, f.depth, []);
      const value = o.get("value", "string", false);
      const label = o.get("label", "string", false);
      if (value === false || label === false) return f.error(`an option needs a string 'value' and 'label'`);
      if (values.includes(value as string)) return f.error(`duplicate enum option value '${value as string}'`);
      values.push(value as string);
    }
    return values.includes(def as string) ? true : f.error(`default '${def as string}' is not among the options`);
  },

  color: (f) => {
    const def = f.get("default", "string", false);
    if (def === false) return false;
    return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(def as string) ? true : f.error("default must be a '#RRGGBB' or '#RRGGBBAA' color");
  },

  time: (f) => {
    const def = f.get("default", "string", false);
    if (def === false) return false;
    const m = /^(\d\d):(\d\d)(?::(\d\d))?$/.exec(def as string);
    const ok = m !== null && Number(m[1]) < 24 && Number(m[2]) < 60 && Number(m[3] ?? 0) < 60;
    return ok ? true : f.error("default must be a 'HH:MM' or 'HH:MM:SS' time");
  },

  geolocation: (f) => {
    const def = f.get("default", "object", false);
    if (def === false) return false;
    const d = new Field(f.path, def as JsonObject, f.depth, []);
    const mode = d.get("mode", "string", false);
    if (mode === false) return f.error("key 'default.mode' is missing or isn't a string");
    if (mode !== "auto" && mode !== "fixed") return f.error(`key 'mode' must be 'auto' or 'fixed', got '${mode as string}'`);
    const name = d.get("name", "string", false);
    if (name === false) return f.error("key 'default.name' is missing or isn't a string");
    const length = bytes(name as string);
    if (length === 0 || length > SETTINGS_LIMITS.geoNameMaxLength) {
      return f.error(`key 'name' must be between 1 and ${SETTINGS_LIMITS.geoNameMaxLength} characters`);
    }
    const lat = d.get("lat", "number", true);
    const lon = d.get("lon", "number", true);
    if (lat === false || lon === false) return f.error("keys 'lat' and 'lon' must be numbers");
    const valid =
      mode === "auto"
        ? lat === undefined && lon === undefined
        : typeof lat === "number" && typeof lon === "number" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    return valid ? true : f.error("invalid default value");
  },

  group: (f, errors) => {
    const fields = f.get("fields", "object", false);
    if (fields === false) return false;
    if (Object.keys(fields as JsonObject).length === 0) return f.error("group has no fields");
    if (f.depth >= SETTINGS_LIMITS.maxDepth) return f.error(`maximum group nesting depth (${SETTINGS_LIMITS.maxDepth}) reached`);
    return checkFields(fields as JsonObject, f.path, f.depth + 1, errors);
  },
};

function checkFields(fields: JsonObject, parent: string | undefined, depth: number, errors: string[]): boolean {
  let ok = true;
  for (const [id, json] of Object.entries(fields)) {
    const f = new Field(parent ? `${parent}.${id}` : id, isObject(json) ? json : {}, depth, errors);
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      ok = f.error("invalid id format");
      continue;
    }
    const label = f.get("label", "string", false);
    const description = f.get("description", "string", true);
    const type = f.get("type", "string", false);
    if (label === false || description === false || type === false) {
      ok = false;
      continue;
    }
    const parse = PARSERS[type as string];
    if (!parse) ok = f.error(`unknown type '${type as string}'`);
    else if (!parse(f, errors)) ok = false;
  }
  return ok;
}

/**
 * What the bar would find wrong with an app's settings.json, in its own words: none when it accepts the file.
 * `text` is the file as read (its JSON is checked too).
 */
export function checkSettingsSchema(text: string): string[] {
  let root: Json;
  try {
    root = JSON.parse(text);
  } catch {
    return ["Malformed JSON or root item is not an object"];
  }
  if (!isObject(root)) return ["Malformed JSON or root item is not an object"];
  const { format_version: format, version, fields } = root;
  if (typeof format !== "number") return ["Root key 'format_version' is missing or is not a number"];
  if (int(format) !== SETTINGS_LIMITS.formatVersion) {
    return [`Unsupported format version: expected ${SETTINGS_LIMITS.formatVersion}, got ${int(format)}`];
  }
  if (typeof version !== "number") return ["Root key 'version' is missing or is not a number"];
  if (int(version) <= 0) return ["Root key 'version' must be a positive number"];
  if (!isObject(fields)) return ["Root key 'fields' is missing or is not an object"];
  if (Object.keys(fields).length === 0) return ["Root key 'fields' must not be empty"];
  const errors: string[] = [];
  checkFields(fields, undefined, 0, errors);
  return errors;
}
