import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkSettingsSchema } from "../src/settings-schema.ts";

const APPS = fileURLToPath(new URL("../../../apps/", import.meta.url));

/** A settings.json with these fields. */
const schema = (fields: Record<string, unknown>, root: Record<string, unknown> = {}) =>
  JSON.stringify({ format_version: 1, version: 1, fields, ...root });
const check = (field: Record<string, unknown>) => checkSettingsSchema(schema({ f: { label: "F", ...field } }));

test("every app's settings.json passes the bar's check", () => {
  for (const slug of readdirSync(APPS)) {
    const path = `${APPS}${slug}/src/appmeta/settings.json`;
    if (existsSync(path)) assert.deepEqual(checkSettingsSchema(readFileSync(path, "utf8")), [], `apps/${slug}`);
  }
});

test("each type the bar knows, with a valid default, passes", () => {
  const fields = {
    on: { label: "On", type: "boolean", default: true },
    n: { label: "N", type: "integer", default: 5, min: 0, max: 10, step: 5 },
    s: { label: "S", type: "string", default: "", max_length: 255, sensitive: true },
    e: { label: "E", type: "enum", default: "b", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
    c: { label: "C", type: "color", default: "#FF8800CC" },
    t: { label: "T", type: "time", default: "07:30:00" },
    here: { label: "Here", type: "geolocation", default: { mode: "auto", name: "Here" } },
    there: { label: "There", type: "geolocation", default: { mode: "fixed", name: "There", lat: 52.5, lon: 13.4 } },
    g: { label: "G", type: "group", fields: { inner: { label: "I", type: "boolean", default: false } } },
  };
  assert.deepEqual(checkSettingsSchema(schema(fields)), []);
});

test("a string's max_length is 255 at most (what Pkmn Life's sprint changes broke)", () => {
  assert.deepEqual(check({ type: "string", default: "", max_length: 500 }), ["Field 'f': 'max_length' is greater than 255"]);
  assert.deepEqual(check({ type: "string", default: "x".repeat(65) }), ["Field 'f': default length is out of bounds"]);
});

test("an enum has 1 to 32 options, distinct, and its default among them", () => {
  const options = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `V${i}` }));
  assert.deepEqual(check({ type: "enum", default: "v0", options: options(32) }), []);
  assert.deepEqual(check({ type: "enum", default: "v0", options: options(33) }), [
    "Field 'f': key 'options' must contain between 1 and 32 items",
  ]);
  assert.deepEqual(check({ type: "enum", default: "x", options: options(2) }), ["Field 'f': default 'x' is not among the options"]);
  const twice = [...options(2), { value: "v1", label: "Again" }];
  assert.deepEqual(check({ type: "enum", default: "v0", options: twice }), ["Field 'f': duplicate enum option value 'v1'"]);
});

test("ids, labels, types and defaults, in the bar's words, every problem listed", () => {
  const errors = checkSettingsSchema(
    schema({
      Bad: { label: "B", type: "boolean", default: true },
      nolabel: { type: "boolean", default: true },
      odd: { label: "O", type: "slider", default: 1 },
      late: { label: "L", type: "time", default: "24:00" },
      range: { label: "R", type: "integer", default: 11, max: 10 },
      paint: { label: "P", type: "color", default: "orange" },
    }),
  );
  assert.deepEqual(errors, [
    "Field 'Bad': invalid id format",
    "Field 'nolabel': key 'label' is missing",
    "Field 'odd': unknown type 'slider'",
    "Field 'late': default must be a 'HH:MM' or 'HH:MM:SS' time",
    "Field 'range': default is out of bounds",
    "Field 'paint': default must be a '#RRGGBB' or '#RRGGBBAA' color",
  ]);
});

test("the file itself: JSON, format_version 1, a positive version, some fields", () => {
  assert.deepEqual(checkSettingsSchema("{"), ["Malformed JSON or root item is not an object"]);
  assert.deepEqual(checkSettingsSchema(schema({}, { format_version: 2 })), ["Unsupported format version: expected 1, got 2"]);
  assert.deepEqual(checkSettingsSchema(schema({}, { version: 0 })), ["Root key 'version' must be a positive number"]);
  assert.deepEqual(checkSettingsSchema(schema({})), ["Root key 'fields' must not be empty"]);
});

test("groups nest four deep at most, paths named in full", () => {
  const nest = (depth: number): Record<string, unknown> =>
    depth === 0 ? { leaf: { label: "L", type: "boolean", default: true } } : { g: { label: "G", type: "group", fields: nest(depth - 1) } };
  assert.deepEqual(checkSettingsSchema(schema(nest(4))), []);
  assert.deepEqual(checkSettingsSchema(schema(nest(5))), ["Field 'g.g.g.g.g': maximum group nesting depth (4) reached"]);
});
