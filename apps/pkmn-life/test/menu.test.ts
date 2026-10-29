// The back menu's pure parts (src/styles.ts): the header labels, how OK and "alternate" step through the styles, and
// how a remote request picks one. main.ts draws and plays; this is what it decides with.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { font, textWidth } from "@vladzaharia/bar-pixel";
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, type Entry, type Style } from "../src/presets.ts";
import { HEADER_WIDTH, NAG_MODES, REDIRECT_MODES, STYLE_NAMES, nextInTurn, nextMode, requestedStyle, turnAfter } from "../src/styles.ts";

const small = font("small");

const ticket = ENTRIES.find((e) => e.kind === "nag")!;
const someone: Entry = { kind: "redirect", id: "sam", move: "SAM", name: "SAM", dir: 1, message: "" };

test("every header label fits", () => {
  const tooWide: string[] = [];
  for (const style of NAG_STYLES) {
    const text = `ALT: ${STYLE_NAMES[style]}`;
    if (textWidth(text, small) > HEADER_WIDTH) tooWide.push(`${text} (${textWidth(text, small)} px)`);
  }
  for (const style of REDIRECT_STYLES) {
    const text = STYLE_NAMES[style];
    if (textWidth(text, small) > HEADER_WIDTH) tooWide.push(`${text} (${textWidth(text, small)} px)`);
  }
  assert.deepEqual(tooWide, [], `labels wider than ${HEADER_WIDTH} px`);
});

test("every style has a label of printable capitals, and no two share one", () => {
  const styles: readonly Style[] = [...NAG_STYLES, ...REDIRECT_STYLES];
  const labels = styles.map((s) => STYLE_NAMES[s]);
  for (const label of labels) assert.match(label, /^[A-Z0-9][A-Z0-9 -]*$/, label);
  assert.equal(new Set(labels).size, labels.length);
  assert.deepEqual(Object.keys(STYLE_NAMES).sort(), [...styles].sort());
});

test("alternate goes through every nag in turn and wraps", () => {
  const seen: string[] = [NAG_STYLES[0]];
  for (let i = 1; i < NAG_STYLES.length; i++) seen.push(nextInTurn(seen[i - 1] as (typeof NAG_STYLES)[number]));
  assert.deepEqual(seen, [...NAG_STYLES]);
  assert.equal(nextInTurn(NAG_STYLES[NAG_STYLES.length - 1]!), NAG_STYLES[0]);
});

test("alternate moves on only when the nag it announced has played, in that mode", () => {
  const [due, other] = NAG_STYLES;
  // Each in turn played the one it announced: the next is due.
  assert.equal(turnAfter(due, due, "alternate"), nextInTurn(due));
  assert.equal(turnAfter(NAG_STYLES[NAG_STYLES.length - 1]!, NAG_STYLES[NAG_STYLES.length - 1]!, "alternate"), NAG_STYLES[0]);
  // A remote request for another style, or a random draw, in Each in turn: the announced one is still due.
  assert.equal(turnAfter(due, other, "alternate"), due);
  // Another mode was playing when Each in turn was switched on, whatever it played.
  assert.equal(turnAfter(due, other, "random"), due);
  assert.equal(turnAfter(due, due, other), due);
  // A redirect never moves it.
  assert.equal(turnAfter(due, "runway", "alternate"), due);
});

test("cycling with OK visits every mode once and wraps", () => {
  for (const modes of [NAG_MODES, REDIRECT_MODES]) {
    const seen = [modes[0]!];
    for (let i = 1; i < modes.length; i++) seen.push(nextMode(seen[i - 1]!, modes));
    assert.deepEqual(seen, [...modes]);
    assert.equal(new Set(seen).size, modes.length);
    assert.equal(nextMode(modes[modes.length - 1]!, modes), modes[0]);
  }
  // A mode that is not in the list (an old saved value) starts again from the first.
  assert.equal(nextMode("gone", NAG_MODES), NAG_MODES[0]);
});

test("the modes are alternate and random, then every style", () => {
  assert.deepEqual(NAG_MODES, ["alternate", "random", ...NAG_STYLES]);
  assert.deepEqual(REDIRECT_MODES, ["random", ...REDIRECT_STYLES]);
});

test("an unknown requested style falls back", () => {
  let drawn = 0;
  const fallback = (): Style => {
    drawn++;
    return "ticker";
  };
  // Unknown words, the Mac's "default", a missing word, and a style of the other kind all take the fallback.
  for (const word of ["bogus", "default", "", undefined, "runway", "ENCOUNTER"]) {
    drawn = 0;
    assert.equal(requestedStyle(ticket, word, fallback), "ticker", String(word));
    assert.equal(drawn, 1, `${word}: the fallback is drawn once`);
  }
  assert.equal(requestedStyle(someone, "encounter", () => "runway"), "runway");
});

test("a known requested style plays as asked, without drawing the fallback", () => {
  const never = (): Style => assert.fail("the fallback was drawn");
  for (const style of NAG_STYLES) assert.equal(requestedStyle(ticket, style, never), style);
  for (const style of REDIRECT_STYLES) assert.equal(requestedStyle(someone, style, never), style);
});

test("settings.json offers every mode the app reads, in order, at version 7", () => {
  const schema = JSON.parse(readFileSync(new URL("../src/appmeta/settings.json", import.meta.url), "utf8"));
  assert.equal(schema.version, 7);
  const options = (field: string): string[] => schema.fields[field].options.map((o: { value: string }) => o.value);
  assert.deepEqual(options("nag_style"), [...NAG_MODES]);
  assert.deepEqual(options("redirect_style"), [...REDIRECT_MODES]);
  const alternate = schema.fields.nag_style.options.find((o: { value: string }) => o.value === "alternate");
  assert.equal(alternate.label, "Each in turn");
  assert.equal(schema.fields.nag_style.default, "alternate");
  assert.equal(schema.fields.redirect_style.default, "random");
});
