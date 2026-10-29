// The concepts gallery: Pkmn Life's real front styles, rendered from the registries (assets/scenes/registry.ts), the
// "Review" cards that say what to look at in each debated item, and the prototypes that were not chosen. Everything
// plays as LEDs at device speed.
// Usage: node concepts/build.ts   (writes design-out/concepts/index.html at the repository root, git-ignored)
//
// A new style needs a card here: NAG_ABOUT and REDIRECT_ABOUT are Records over the style ids, so the typecheck says
// which one is missing. Redirects are shown for the example names only (SAM, ALEX, DAMIAN), never the names in
// redirects.json.

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hex, renderFrames, writePreview, type Clip, type PreviewEntry } from "@vladzaharia/bar-pixel";
import { NAG_SCENES, REDIRECT_SCENES } from "../assets/scenes/registry.ts";
import { ENTRIES, NAG_STYLES, REDIRECT_STYLES, type Nag, type NagStyle, type Redirect, type RedirectStyle } from "../src/presets.ts";
import { CONCEPTS as JIRA_A } from "./jira-a.ts";
import { CONCEPTS as JIRA_B } from "./jira-b.ts";
import { CONCEPTS as REDIRECT_A } from "./redirect-a.ts";
import { CONCEPTS as REDIRECT_B } from "./redirect-b.ts";
import { CONCEPTS as VARIANTS } from "./variants.ts";
import { H, W } from "./types.ts";

type Dir = 1 | -1;

const FPS = 60;
const nag = ENTRIES.find((e): e is Nag => e.kind === "nag")!;
const person = (name: string, dir: Dir): Redirect => ({ kind: "redirect", id: name.toLowerCase(), move: name, name, dir, message: "" });
const side = (dir: Dir) => (dir > 0 ? "right" : "left");

// --- Rendering ---------------------------------------------------------------------------------------------------

/** Each clip is rendered once, however many cards show it. */
const rendered = new Map<string, Uint8Array[]>();
function frames(key: string, clip: () => Clip): Uint8Array[] {
  let f = rendered.get(key);
  if (!f) rendered.set(key, (f = renderFrames(clip(), { width: W, height: H, fps: FPS, background: hex("#000000") })));
  return f;
}
const nagFrames = (style: NagStyle) => frames(style, () => NAG_SCENES[style](nag));
const redirectFrames = (style: RedirectStyle, name: string, dir: Dir) => frames(`${style} ${name} ${dir}`, () => REDIRECT_SCENES[style](person(name, dir)));

function card(id: string, name: string, group: string, about: string, usage: string, f: Uint8Array[]): PreviewEntry {
  return { id, name, group, about, usage, display: "front", fps: FPS, frames: f };
}

// --- What each style does ----------------------------------------------------------------------------------------

const NAG_ABOUT: Record<NagStyle, { name: string; about: string }> = {
  encounter: {
    name: "Wild encounter",
    about:
      "The screen flashes and stripes away; a wild ISSUE (a bug) scuttles in with its HP bar and the message plays out in typed dialogue boxes. Then TRAINER uses FILE JIRA TICKET: the Jira mark flies at the bug, its HP drains, it is super effective, and the bug turns into a Jira ticket.",
  },
  ticker: {
    name: "Burst ticker",
    about:
      "The clock switches off into a line of light that bursts, the Jira chevrons fly in, and the message glides in as one line over drifting particles, each letter dropping into place. It rests on its end, then rolls up whole in two small lines. Everything collapses to a point and the clock switches back on.",
  },
  board: {
    name: "Departure board",
    about:
      "Blinds close over the clock onto a split-flap board. Every flap clatters through its drum and stops, letter by letter, on FILE A / TICKET?; then the airline flap on the left turns through other logos and lands on Jira. Blinds open onto the clock.",
  },
  progress: {
    name: "Stuck progress bar",
    about:
      "\"Filing ticket...\" with a spinner and a bar that jumps ahead in smaller and smaller chunks to 99% and stalls. The spinner winds down and its dots drop onto the bar, which turns amber; then it all rolls away for \"...you didn't, / did you?\".",
  },
  notfound: {
    name: "404",
    about:
      "The clock tears into black. \"404 | TICKET NOT FOUND\" flickers in through heavy glitching, slams into place with a shake, glitches now and then while it holds, and tears apart on the way out.",
  },
  squash: {
    name: "Bug squash",
    about:
      "A bug scuttles in and stops, nervous. A Jira ticket drops from above and flattens it (the screen shakes, dust puffs, its legs twitch), then NO TICKET, / NO FIX. drops in beside it. An iris closes on the ticket.",
  },
  buddy: {
    name: "Ticket buddy",
    about:
      "The Jira ticket, with a face, hops in from the left and lands with a squash. It asks \"FILE ME?\" in a speech bubble, blinks, then \"PLEASE?\" with big eyes, and does a happy double hop before the picture squashes away.",
  },
  slots: {
    name: "Slot machine",
    about:
      "Stripes close over the clock onto a slot machine. Bulbs chase round it, the lever is pulled, and three reels of sevens, bugs and Jira marks spin and land one by one on Jira, Jira, Jira. Confetti, and \"JACKPOT!\" rolls in, then \"FILE IT!\".",
  },
  eightball: {
    name: "Magic 8-ball",
    about:
      "The clock irises shut onto an 8-ball; \"WHAT DO I / NEED NOW?\" types beside it. It shakes, turns its window to us, and the view irises into the window: the blue die grows to fill the screen and \"SIGNS POINT TO\", then \"A TICKET\", float up out of the ink.",
  },
  invaders: {
    name: "Ticket invaders",
    about:
      "Over a slow starfield a row of little Jira-card invaders marches in; a cannon slides under each and files it (zap, sparks, a green check). As the last one goes, a fresh wave marches in and \"FILE THEM ALL!\" types in, arcade-style.",
  },
  forecast: {
    name: "Forecast",
    about:
      "A weather report: a cloud drifts in raining little tickets while the forecast rolls through beside it: \"TODAY'S FORECAST\", \"100%\" (with a flash of lightning), \"CHANCE OF TICKETS\", \"FILE ONE!\".",
  },
};

const REDIRECT_ABOUT: Record<RedirectStyle, { name: string; about: string }> = {
  runway: {
    name: "Runway",
    about:
      "An amber wipe sweeps their way, then amber chevrons chase their way with the name opposite: as many chevrons (2 to 4) as fit between the name's ink and the edge. The same wipe takes the picture away.",
  },
  nudge: {
    name: "Nudge",
    about:
      "A big arrow sweeps across, blacking out the clock behind it, settles pointing at them and keeps nudging; the nudge's streak shortens before it would come near the name.",
  },
  sign: {
    name: "Wayfinding sign",
    about: "An airport-style yellow sign (a dark yellow, so a whole screen of it does not glare) slides in from their side over the clock with the name and an arrow, holds, and slides back out.",
  },
  walker: {
    name: "Walker",
    about:
      "The clock fades, a little person walks in from the far side leaving the name behind them letter by letter, waves, points the way with arrows blinking from their hand, walks over to that side and says \"HI!\" in a speech bubble, then steps off the edge.",
  },
  trainer: {
    name: "Trainer",
    about: "Battle stripes, the dialogue box rising, \"TRAINER <name> can help you!\", then \"Go see <name>!\" with a triangle marching their way.",
  },
  scroller: {
    name: "Scroller",
    about:
      "Chevron groups and the name stream towards them like a moving-walkway sign. The band's front wipes the clock away, slows to a stop with the first name centred for as long as it takes to read, and moves on; at the end it speeds off.",
  },
  motorway: {
    name: "Motorway sign",
    about:
      "A green guide sign drops in over the clock like a gantry sign coming into view: the name in white and a GO! tab in the corner on their side over a diagonal exit arrow. The sheen runs their way and the arrow nudges while it holds; the sign then slides off towards them.",
  },
  exit: {
    name: "Exit sign",
    about:
      "The clock fades and a lit green EXIT sign flickers on like a fluorescent tube. On their side the person sits at their own table with a monitor, chevrons pulse their way, and the ISO figure, a visitor, walks a few steps over and stops beside the table; then the name's tube stutters on. The sign holds, and stutters off.",
  },
  parcel: {
    name: "Parcel van",
    about:
      "\"Out for delivery\" types in over a tracking line that fills to the third stop, their house waiting at the last. A brown delivery van with the name on its cargo box drives in, shoving the tracker off, parks with its indicator blinking, and pulls off towards them.",
  },
  plane: {
    name: "Paper plane",
    about:
      "A paper plane flies in and loops the loop, its contrail drawing the circle, then glides their way unfurling the name behind it on an amber banner. It tows the banner into place and holds there, bobbing, the banner and the name still, then pulls the banner, name and all, off-screen their way.",
  },
  hand: {
    name: "Pointing hand",
    about:
      "A big cartoon hand pokes in from the far side pointing their way; the name drops in where it points and glints; two pokes nudge it, then a last jab knocks it off their way.",
  },
  train: {
    name: "Little train",
    about:
      "An engine chugs in pulling flatcars, one letter of the name on each, clickety-clack; it stops with the name in the middle, lets off steam, and chugs away their way.",
  },
  dog: {
    name: "Growlithe",
    about:
      "Growlithe bounds in and the name pops up behind it as it passes; it stops, wags its cream tail and barks their way (jaw drops, a puff of embers, the letters hop towards it in a wave), then bounds off that way. Over there comes its cry: \"GROWL!\", or \"GRR!\" when a wide name leaves less room.",
  },
  shout: {
    name: "Shout",
    about:
      "A megaphone on the far side shouts twice. \"HEY!\" blasts out of it and lands at the edge on their side, shaking, with sound arcs rolling out; the second shout blows \"HEY!\" off and blasts the name out to the same edge. The name settles, holds, and its letters fly off their way.",
  },
  map: {
    name: "Treasure map",
    about:
      "A parchment unrolls their way over the clock, a dotted red trail walks off that way and an X stamps down at its end; the name rises out of the ground beside it in gold, glinting; the map rolls up their way.",
  },
};

const SCENE_FILE: Record<RedirectStyle, string> = {
  runway: "assets/scenes/redirect.ts",
  nudge: "assets/scenes/redirect.ts",
  sign: "assets/scenes/redirect.ts",
  walker: "assets/scenes/redirect.ts",
  trainer: "assets/scenes/redirect.ts",
  scroller: "assets/scenes/redirect.ts",
  motorway: "assets/scenes/redirects/motorway.ts",
  exit: "assets/scenes/redirects/exit.ts",
  parcel: "assets/scenes/redirects/parcel.ts",
  plane: "assets/scenes/redirects/plane.ts",
  hand: "assets/scenes/redirects/hand.ts",
  train: "assets/scenes/redirects/train.ts",
  dog: "assets/scenes/redirects/dog.ts",
  shout: "assets/scenes/redirects/shout.ts",
  map: "assets/scenes/redirects/map.ts",
};
const NAG_FILE: Record<NagStyle, string> = {
  encounter: "assets/scenes/encounter.ts",
  ticker: "assets/scenes/ticker.ts",
  board: "assets/scenes/nags/board.ts",
  progress: "assets/scenes/nags/progress.ts",
  notfound: "assets/scenes/nags/notfound.ts",
  squash: "assets/scenes/nags/squash.ts",
  buddy: "assets/scenes/nags/buddy.ts",
  slots: "assets/scenes/nags/slots.ts",
  eightball: "assets/scenes/nags/eightball.ts",
  invaders: "assets/scenes/nags/invaders.ts",
  forecast: "assets/scenes/nags/forecast.ts",
};

// --- The groups --------------------------------------------------------------------------------------------------

const JIRA = "Jira";
const RIGHT = "Redirect · ALEX, right";
const LEFT = "Redirect · SAM, left";
const REVIEW = "Review";
const UNCHOSEN = "Unchosen concepts";

const jira = NAG_STYLES.map((s) => card(`jira-${s}`, NAG_ABOUT[s].name, JIRA, NAG_ABOUT[s].about, NAG_FILE[s], nagFrames(s)));
const redirects = (group: string, id: string, name: string, dir: Dir, note: string) =>
  REDIRECT_STYLES.map((s) => card(`${id}-${s}`, REDIRECT_ABOUT[s].name, group, REDIRECT_ABOUT[s].about + note, SCENE_FILE[s], redirectFrames(s, name, dir)));
const alexRight = redirects(RIGHT, "right", "ALEX", 1, "");
const samLeft = redirects(LEFT, "left", "SAM", -1, " Mirrored: the layout flips, the lettering does not.");

/** A Review card of a nag. */
const reviewNag = (style: NagStyle, about: string): PreviewEntry =>
  card(`review-${style}`, NAG_ABOUT[style].name, REVIEW, about, NAG_FILE[style], nagFrames(style));
/** A Review card of a redirect, for one name and side. */
const reviewRedirect = (style: RedirectStyle, name: string, dir: Dir, about: string): PreviewEntry =>
  card(`review-${style}-${name.toLowerCase()}-${side(dir)}`, `${REDIRECT_ABOUT[style].name} · ${name}, ${side(dir)}`, REVIEW, about, SCENE_FILE[style], redirectFrames(style, name, dir));

const review: PreviewEntry[] = [
  // The Jira mark, the ticket sprite and the glare fixes, in the nags.
  reviewNag(
    "encounter",
    "Look at: (1) the Jira mark flying at the bug and the ticket it becomes: the mark's weight sits top-right, so it is placed by its optical centre now, not its box; (2) the glare fixes: the dialogue boxes have a darker fill (#9DA9BC, was #CFD8E6) and the opening flashes are softer; (3) one lettering white for the whole set, and the \"???\" pulsing from white to amber, the same \"?\" pulse as in the ticker, the 8-ball and the stuck progress bar. Back screen (not drawn here): the header names the style, e.g. ENCOUNTER, and shows ALT: TICKER (the next in turn) when FILE A TICKET is set to Each in turn, which steps through all 11 nags in order after every play; OK cycles Each in turn, Random, then each style. Shared timings: every style opens and closes with the same few beats from the MOTION tokens (a transition about 0.4 s, a big move about 0.65 s, a scene-level entrance about 1.1 s) and holds what is read for readTime of it; look for any style whose entrance or exit feels faster or slower than the rest.",
  ),
  reviewNag(
    "ticker",
    "Look at: the Jira mark flying in (placed by its optical centre: does it sit in the middle of its slot?), the white lettering, and the amber \"?\" pulsing at the end of the message, the same pulse as in the other nags with a \"?\".",
  ),
  reviewNag(
    "board",
    "Look at: the logo flap on the left, where the Jira mark lands: is it optically centred in its tile?",
  ),
  reviewNag(
    "slots",
    "Look at: the Jira marks on the reels, centred in their slots, and the three of them landing in a row.",
  ),
  reviewNag(
    "squash",
    "Look at: the reworked ticket sprite (the card with the mark, the summary lines and the Task checkbox) dropping onto the bug, and the squash.",
  ),
  reviewNag(
    "buddy",
    "Look at: the ticket with a face (the reworked sprite), and its hops. Prototype behaviour you may want changed: the hops carry it off the top of the screen. Keep them, or lower them?",
  ),
  reviewNag(
    "notfound",
    "Look at: the exit. As in the prototype, the picture flickers in and out through heavy glitching on its way off before the black fades away. Keep the flicker, or end it more quietly?",
  ),
  reviewNag(
    "eightball",
    "Look at: the \"?\" in NEED NOW? pulsing from white to amber, the same pulse as in the encounter, the ticker and the stuck progress bar.",
  ),

  // The glare fixes, in the redirects.
  reviewRedirect("trainer", "ALEX", 1, "Look at: the dialogue box's darker fill (#9DA9BC, was #CFD8E6), which glared across the room. Is the text still easy to read in it?"),
  reviewRedirect("sign", "ALEX", 1, "Look at: the darker yellow (#E6BA10 to #C99A00, was #FFD21F to #F2B600). It had to stop glaring while staying clearly a yellow wayfinding sign. Too dark, or about right?"),

  // The debatable redesigns.
  reviewRedirect(
    "exit",
    "ALEX",
    1,
    "Look at: the exit sign's redesign. The person sits at their own table (a desk with a monitor) on their side; the pictogram figure is a visitor who walks a few steps over and stops beside the table; the name's tube lights only after the visitor has arrived. Does it read as \"go and see them\"?",
  ),
  reviewRedirect("exit", "SAM", -1, "The exit sign for someone on the left: the table and chevrons on the left, the visitor walking left, the name's lettering not mirrored."),
  reviewRedirect(
    "dog",
    "ALEX",
    1,
    "Look at: the Growlithe sprite (orange with black stripes, the big head, the cream mane and tail tuft: unmistakably Growlithe?) and its cry. There is no ARF! any more: after it bounds off, the cry pops at their edge, \"GROWL!\", with a puff of embers when it barks.",
  ),
  reviewRedirect("dog", "DAMIAN", 1, "Look at: the wide name leaves less room for the cry, so Growlithe says \"GRR!\" instead of \"GROWL!\". Does it still read?"),
  reviewRedirect("dog", "SAM", -1, "Growlithe for someone on the left: it bounds in from the right, barks left, and the cry pops at the left edge."),
  reviewRedirect(
    "shout",
    "ALEX",
    1,
    "Look at: the megaphone shouting \"HEY!\" first, then blowing it away and shouting the name. Does \"HEY!\" then the name work, or is the megaphone too much?",
  ),
  reviewRedirect("shout", "SAM", -1, "The shout for someone on the left: the megaphone on the right, the words landing at the left edge."),
  reviewRedirect(
    "scroller",
    "ALEX",
    1,
    "Look at: the band slowing to a stop with the name centred and pausing on it for as long as it takes to read (readTime of the name), then moving on.",
  ),
  reviewRedirect(
    "plane",
    "ALEX",
    1,
    "Look at: the name holding still on the banner while it is read, the plane bobbing; then the name leaving with the banner when the plane pulls it off-screen.",
  ),

  // Wide names after their fixes: DAMIAN is 46 px, the widest a name can be.
  reviewRedirect(
    "runway",
    "DAMIAN",
    1,
    "Wide name: the runway lays out from the name's width now: only as many chevrons (down to 2) as fit, so none touch the name's last letter.",
  ),
  reviewRedirect("runway", "DAMIAN", -1, "Wide name, mirrored: the same layout for someone on the left."),
  reviewRedirect(
    "walker",
    "DAMIAN",
    1,
    "Wide name: the walker stands where the name ends, the arrows and the bubble take what room is left, and the bubble says \"HI\" without its \"!\" (a pixel narrower). Does \"HI\" still read as a greeting?",
  ),
  reviewRedirect("walker", "DAMIAN", -1, "Wide name, mirrored: the walker and the \"HI\" bubble for someone on the left."),
  reviewRedirect("motorway", "DAMIAN", 1, "Wide name: DAMIAN, the widest, fills the room the sign leaves it with exactly 3 px to spare; the GO! tab and arrow sit clear of it."),
  reviewRedirect("motorway", "DAMIAN", -1, "Wide name, mirrored: the tab and arrow on the left."),
  reviewRedirect(
    "exit",
    "DAMIAN",
    1,
    "Wide name: the exit sign gets cramped. A wide name takes the second chevron, then the smaller chevron and the gaps, and lastly the visitor stands in front of the table's near end. Is this still readable, and is it acceptable?",
  ),
  reviewRedirect("exit", "DAMIAN", -1, "Wide name, mirrored: the cramped exit sign for someone on the left."),
  reviewRedirect(
    "hand",
    "DAMIAN",
    1,
    "Wide name: the cuff runs off the screen and the pokes shorten (2 px instead of 4) so the hand never touches the name, and the finger still points.",
  ),
  reviewRedirect("hand", "DAMIAN", -1, "Wide name, mirrored: the hand for someone on the left."),
  reviewRedirect(
    "map",
    "DAMIAN",
    1,
    "Wide name: the X sits just short of the name and the dotted trail has less width to wind through, so it swings further up and down. Still a trail?",
  ),
  reviewRedirect("map", "DAMIAN", -1, "Wide name, mirrored: the map and its trail for someone on the left."),
];

const unchosen: PreviewEntry[] = [...JIRA_A, ...JIRA_B, ...REDIRECT_A, ...REDIRECT_B, ...VARIANTS].map((c) => ({
  id: c.id,
  name: c.name,
  group: UNCHOSEN,
  about: c.about,
  usage: c.uses,
  display: "front" as const,
  fps: FPS,
  frames: frames(`concept ${c.id}`, () => c.clip),
}));

const entries = [...review, ...jira, ...alexRight, ...samLeft, ...unchosen];
const ids = entries.map((e) => e.id);
const clash = ids.find((id, i) => ids.indexOf(id) !== i);
if (clash) throw new Error(`two cards are called ${clash}`);

const out = fileURLToPath(new URL("../../../design-out/concepts/", import.meta.url));
// Last build's frames: a card that is gone must not linger in a folder that gets published.
rmSync(`${out}frames`, { recursive: true, force: true });
writePreview(out, {
  title: "Pkmn Life styles",
  eyebrow: "pkmn-life · styles",
  heading: "The front styles, and what to decide",
  lede: "The Review group has the items that need your eye, each with what to look at. Then every Jira nag, every redirect for ALEX (on the right) and for SAM (on the left), and last the prototypes that were not chosen. 72 × 16 at device resolution and speed. Click a display to pause it.",
  entries,
});
console.log(
  `${entries.length} cards -> ${out}index.html (${review.length} review, ${jira.length} Jira, ${alexRight.length + samLeft.length} redirects, ${unchosen.length} unchosen)`,
);
