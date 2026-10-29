// Every front style, by id: the one place the asset build and the guard test (test/styles.test.ts) look them up.
// A style is registered here and its id added to NAG_STYLES / REDIRECT_STYLES in src/presets.ts; the guard test
// then covers it automatically.

import type { Clip } from "@vladzaharia/bar-pixel";
import type { Nag, NagStyle, Redirect, RedirectStyle } from "../../src/presets.ts";
import { encounter } from "./encounter.ts";
import { board } from "./nags/board.ts";
import { progress } from "./nags/progress.ts";
import { notfound } from "./nags/notfound.ts";
import { squash } from "./nags/squash.ts";
import { buddy } from "./nags/buddy.ts";
import { slots } from "./nags/slots.ts";
import { eightball } from "./nags/eightball.ts";
import { invaders } from "./nags/invaders.ts";
import { forecast } from "./nags/forecast.ts";
import { nudge, runway, scroller, sign, trainer, walker } from "./redirect.ts";
import { ticker } from "./ticker.ts";

export const NAG_SCENES: Record<NagStyle, (e: Nag) => Clip> = { encounter, ticker, board, progress, notfound, squash, buddy, slots, eightball, invaders, forecast };

export const REDIRECT_SCENES: Record<RedirectStyle, (e: Redirect) => Clip> = { runway, nudge, sign, walker, trainer, scroller };
