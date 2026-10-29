# Pkmn Life Remote

A Mac app for playing Pkmn Life entries on a BUSY Bar from your desk, and for changing Pkmn Life's settings. It
needs macOS 26 Tahoe: it is built with Liquid Glass.

## The panel

The remote is a small glass card of round buttons in the top-right corner of the screen, floating above your windows
on every Space. Clicking it never takes focus from the app you're in.

- **With an ultrawide display connected** (21:9 or wider, or 3000 points across), the panel stays out on it all the
  time.
- **Otherwise** it tucks into the right edge, leaving only a small tab. Point at the tab and the panel slides out;
  move away and it tucks back after a moment (not while a menu is open or a request is on its way). Click the tab to
  pin the panel out, and again to let it tuck.

You can choose this in Settings or the **…** menu: **Automatic** (as above), **Always Shown** or **Tucked to the
Side**. The panel follows displays as you connect and disconnect them. With Reduce Motion on, it appears and disappears
without sliding.

On the panel:

- A round button per entry, left to right as the redirects point: the people to the left of the bar, **Ticket**
  (File a Ticket), the people to the right. Who they are is set in Settings (below). Click a button to play it. Its
  tooltip says what a click plays. Right-click (or Control-click) to play a particular version now, or to change what
  a click plays: the bar's own setting, random, or one version.

The colours come from what each entry looks like on the bar: the ticket in Jira blue, the redirects in Runway's
amber, Title Card in the bar's orange.

While the pointer is on the panel, a second card comes out under the buttons (and goes away a moment after the
pointer leaves, not while a menu is open or a request is on its way):

- The orange calendar (**Title Card**): the Majora's Mask title card for now ("Dawn of", "Meal of" or "Dusk of the Nth
  Day").
- **Stop**: stops whatever is playing, the card's one big button.
- The gear: Settings. Its dot is the connection: green while the bar answers, orange for the simulator, red when the
  last request failed or the bar needs something (Mac remote off). Point at the gear for the status in full.
- **…**: start Pkmn Life on the bar, check the connection, the panel's placement, Quit.

The menu bar icon has all of the same, plus **Show Panel**.

## Settings

- **General**: where Pkmn Life is. **Simulator** is the simulator on this Mac at `127.0.0.1:2879` (run
  `pnpm sim:serve` in `apps/pkmn-life` and keep the page it prints open), **USB** the bar on USB at `10.0.4.20`, and
  **IP Address** a bar on the network by its Wi-Fi address (from the bar's web UI), with its HTTP API password if
  password protection is on (web UI: Network, HTTP API; kept in your keychain). Also who the redirects send to, and
  where the panel stays. **Redirects** takes the same list as Pkmn Life's
  `redirects.json` ([apps/pkmn-life](../apps/pkmn-life#who-the-redirects-send-to)): `< Sam, Alex >`, where `< Sam`
  sits to the left of the bar and `Alex >` to the right. The names stay in this Mac's preferences.
- **Pkmn Life**: the app's own settings on the bar, the same as on the bar and in its web UI: the ticket and redirect
  styles, the clock and its animation, the sprint display, sprint changes, Mac remote. Changes go to the bar as you make them, and Pkmn
  Life picks them up within a second while **Mac remote** is on (otherwise when it next starts).

Pkmn Life must be installed on the bar, with **Mac remote** on (the default). macOS asks once for permission to reach
devices on the local network.

## Build and install

On a Mac with macOS 26 and Xcode 26 (or its command-line tools):

```sh
cd mac/PkmnLifeRemote
swift test                           # the PkmnLifeRemoteKit tests (these also run on Linux)
./build-app.sh                       # dist/Pkmn Life Remote.app
open "dist/Pkmn Life Remote.app"     # or drag it to /Applications
```

To try it without a bar, drive the simulator: it runs Pkmn Life's real build in a browser and answers the bar's
HTTP API, so a click on the panel plays on the simulated bar and Settings edits its settings
([packages/sim](../packages/sim)).

```sh
cd apps/pkmn-life && pnpm sim:serve                                   # then open http://127.0.0.1:2879/
open "dist/Pkmn Life Remote.app"                                      # Settings, General, Connection: Simulator
```

The status then reads "Connected to the simulator", with an orange dot. For checks that need no browser, the mock bar
answers the same API from memory (any saved preference can be overridden for one run this way):

```sh
Tools/mock-bar.py &                                                   # prints each request the app makes
"dist/Pkmn Life Remote.app/Contents/MacOS/PkmnLifeRemote" -host 127.0.0.1:8787 -dockMode tucked
```

If something else already listens on 8787 (`wrangler dev` does by default), give the mock `--port` and the app the
same port. The app says so if the address answers but isn't a bar.

`Tools/screenshots.sh` builds the app and captures it in every state (shown, hovered, tucked, peeking, pinned, both
Settings tabs; light and dark) into `screens/`, with the mock on a free port. The **Mac visual check** workflow runs
it on GitHub's `xcode-27` runner (Actions → Mac visual check → Run workflow) and uploads the `mac-screens` artifact.
The app's launch options for this (`--appearance`, `--pin`, `--peek`, `--settings`, `--snapshot`) are listed in
`LaunchOptions.swift`. Screen captures need Screen Recording permission and an unlocked screen; `--snapshot` works
without either, and its `panel-render.png` (drawn by SwiftUI, with stand-in glass) is the one to look at then.

CI builds it too: download the `pkmn-life-remote` artifact and unzip it. The app is signed ad hoc, not notarised, so
the first time macOS may ask you to open it from Finder with right-click → Open.

## How it works

A running bar app can't be sent messages, but it can read its own settings, and the bar's HTTP API can write them.
So each click writes a request into Pkmn Life's **Remote request** setting, `"<seq> <unix time> play alex random"`,
and Pkmn Life checks it once a second (`remoteInbox` in bar-core) and plays it. A request is acted on once, and only
within 15 seconds of being sent, so an old one never replays. That also means the bar's clock and the Mac's must
agree to within 15 seconds, which they do when both set the time automatically. The same once-a-second read is how
Pkmn Life notices settings changed from the Mac.

Requests: `play <entry> <default|random|style>`, `card`, `stop`. Every write reads the settings first and writes them
back whole, changing only its own fields.

Pkmn Life has to be running on the bar. The remote doesn't start it on every click (that would restart it); use
**…** → Start Pkmn Life on the Bar, and a request sent in the 15 seconds before still plays once it is up.

## Code

| Path | |
| --- | --- |
| `Sources/PkmnLifeRemoteKit` | The part that needs no UI, and its tests: the bar's HTTP API (`BarClient`), the request format, Pkmn Life's entries (`Catalog`) and settings (`PkmnSettings`), and where the panel goes (`ScreenLayout`) |
| `Sources/PkmnLifeRemote/Panel` | The floating panel and its placement (`PanelController`) |
| `Sources/PkmnLifeRemote/Views` | The SwiftUI views: the panel's cards and buttons, the tab, the two Settings tabs |
| `Sources/PkmnLifeRemote` | The app, its state (`RemoteModel`, `BarSettingsModel`), the Settings window, the keychain, launch options |
| `Tools` | `mock-bar.py` (the bar's HTTP API, in memory), `screenshots.sh`, and `ci/`: the release scripts ([RELEASE.md](RELEASE.md)) |

`Catalog` and `PkmnSettings` mirror `apps/pkmn-life/src/presets.ts` and `appmeta/settings.json`. When you add an
entry or a setting there, add it here too; `swift test` fails until the two match.

## Releases

Signed builds come with the repository's releases (the **Release** workflow, `.github/workflows/release.yml`, for a
`vX.Y.Z` tag): it builds the app, signs it with Developer ID (hardened runtime, secure timestamp), has Apple notarize
it, staples the ticket, and attaches the ZIP to the GitHub Release, so it opens with a double-click. On your own Mac,
`./build-app.sh --developer-id` signs the same way from your keychain, and `--notarize <profile>` notarizes too. Its
scripts are in `Tools/ci`. [`RELEASE.md`](RELEASE.md) has the one-time setup and how to check a download;
[`../RELEASE.md`](../RELEASE.md) how to cut a release.
