# Pkmn Life Remote

A menu bar app for macOS (13 or later) that plays Pkmn Life entries on a BUSY Bar from your desk.

Click the menu bar icon for a Control Center–style panel:

- **File a Ticket**, **Alex**, **Sam**: click a tile to play it. Right-click for a menu: play a particular version
  now, or change what a click plays (the bar's own setting, random, or one version). The tile shows what a click
  will play.
- **Title Card**: today's Majora's Mask "Dawn of the Nth Day".
- **Stop**: stops whatever is playing.
- The **…** menu: start Pkmn Life on the bar, check the connection, open the panel as a floating window (it stays
  above other windows and on every Space), settings, quit.

## Build and install

On a Mac with Xcode or the Xcode command-line tools:

```sh
cd mac/PkmnLifeRemote
./build-app.sh                       # dist/Pkmn Life Remote.app
open "dist/Pkmn Life Remote.app"     # or drag it to /Applications
```

CI also builds it on every run: download the `pkmn-life-remote` artifact and unzip it. The app is signed ad hoc, not
notarised, so the first time macOS may ask you to open it from Finder with right-click → Open.

## Set up

In the app's Settings (**…** → Settings):

- **Bar address**: `10.0.4.20` when the bar is connected by USB, otherwise its Wi-Fi address (shown in the bar's web
  UI).
- **API password**: the bar's HTTP API password (web UI: Network, HTTP API), if password protection is on. Not needed
  over USB. It is kept in your keychain.

Pkmn Life must be installed on the bar, with its **Mac remote** setting on (the default). macOS asks once for
permission to reach devices on the local network.

## How it works

A running bar app can't be sent messages, but it can read its own settings, and the bar's HTTP API can write them.
So each click writes a request into Pkmn Life's **Remote request** setting, `"<seq> <unix time> play alex random"`,
and Pkmn Life checks it once a second (`remoteInbox` in bar-core) and plays it. A request is acted on once, and only
within 15 seconds of being sent, so an old one never replays. That also means the bar's clock and the Mac's must
agree to within 15 seconds, which they do when both set the time automatically.

Requests: `play <entry> <default|random|style>`, `card`, `stop`. Entry ids and styles are those in
`apps/pkmn-life/src/presets.ts`; `Catalog.swift` lists the same, so update both when adding an entry.

Pkmn Life has to be running on the bar. The remote doesn't start it on every click (that would restart it); use
**…** → Start Pkmn Life on the Bar, and a request sent in the 15 seconds before still plays once it is up.
