# @vladzaharia/bar-sim

Interactive BUSY Bar simulator. `node packages/sim/scripts/build.ts <app-dir> --out <dir>` (or `pnpm sim` in an app)
builds the app with busy-cli and writes a page that runs that build against an emulated bar:

- the draw canvas (elements by id, z order, timeouts), `.anim` playback with the firmware's section rules, settings,
  and 403 for endpoints apps cannot reach;
- the app's lifecycle: it ends when nothing keeps it alive, a long BACK force-quits it;
- BACK, START and the wheel (turn and press for OK), with press/long/repeat/short, plus the keyboard;
- a settings form from the app's `settings.json`, and a log of every request and input.

Scripts can drive it through `window.barSim`.
