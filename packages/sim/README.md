# @vladzaharia/bar-sim

Interactive BUSY Bar simulator. `node packages/sim/scripts/build.ts <app-dir> --out <dir>` (or `pnpm sim` in an app)
builds the app with busy-cli and writes a page that runs that build against an emulated bar:

- the draw canvas (elements by id, z order, timeouts), `.anim` playback with the firmware's section rules, settings,
  and 403 for endpoints apps cannot reach;
- the app's lifecycle: it ends when nothing keeps it alive, a long BACK force-quits it;
- BACK, START and the wheel (turn and press for OK), with press/long/repeat/short, plus the keyboard;
- a settings form from the app's `settings.json`, and a log of every request and input.

Scripts can drive it through `window.barSim`.

## Driving it over the bar's HTTP API

The page is static: any web server can serve it. To control it from outside the browser as you would a bar (the Pkmn
Life Remote Mac app, curl), serve it with the simulator's own server instead:

```sh
node packages/sim/scripts/build.ts <app-dir> --serve [--port N]   # build, then serve
node packages/sim/scripts/serve.ts <sim-dir> [--port N]           # serve a page built earlier
```

It listens on `127.0.0.1:2879` by default (BUSY on a phone keypad) and prints the page's URL and the address to give
the Mac app (`127.0.0.1:2879`). Open the page: the API answers only while it is open, since the page holds the
settings, as the bar does.

| Request | Answer |
| ------- | ------ |
| `GET /api/version` | `{"version": "bar-sim"}`, so a companion can tell it's the simulator |
| `GET /api/apps/settings?app_id=<id>` | `{"version": n, "values": {...}}`: `version` from `settings.json`, the page's current values |
| `PUT /api/apps/settings?app_id=<id>` | Writes the document's `values` into the page without restarting the app (it sees them on its next read, as with a write to the bar) |
| `POST /api/apps/launch?app_id=<id>` | Restarts the app |

Another `app_id` is a 404 (a bar without that app), as is any other `/api` path; with no page open, the settings and
launch requests answer 503. The server takes requests only from this machine, and none from other web pages.

How the page and the server talk: when the server serves `index.html` it adds `window.__SIM_BRIDGE__`, and with that
flag the page (`src/bridge.ts`) opens a Server-Sent Events stream (`/__sim/events`) for the server's commands
(`settings`, `launch`) and posts its values to `/__sim/state` when it connects and whenever they change: through the
form, over the API, or from a script writing `window.barSim.settings` (checked once a second). Every write over the API
shows in the settings form and in the activity log. A page served by any other server has no flag and never connects.
