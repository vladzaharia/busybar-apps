// The page's end of the dev server's relay (scripts/serve.ts): with the server in front, anything that speaks the
// bar's HTTP API (the Pkmn Life Remote Mac app, curl) can write the app's settings and launch it. The server sends
// those as Server-Sent Events; the page posts its current settings back whenever they change, so the server can
// answer reads. Only used when the server marked the page (window.__SIM_BRIDGE__).

type Values = Record<string, unknown>;

export interface Bridge {
  /** The values changed here: tell the server now (it would also notice within a second). */
  changed(): void;
}

export function connectBridge(
  base: string,
  o: {
    /** The live settings values, sent to the server whenever they change. */
    values: Values;
    /** Settings written over the HTTP API (the whole document's values, as written). */
    onSettings: (values: Values) => void;
    /** An app launch over the HTTP API. */
    onLaunch: () => void;
  },
): Bridge {
  const events = new EventSource(`${base}/events`);
  // What the server has: posted only when it differs.
  let sent: string | null = null;
  const post = (force = false) => {
    if (events.readyState !== EventSource.OPEN) return;
    const json = JSON.stringify(o.values);
    if (!force && json === sent) return;
    sent = json;
    fetch(`${base}/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: `{"values":${json}}` })
      .then((r) => {
        if (!r.ok) sent = null;
      })
      .catch(() => {
        sent = null;
      });
  };
  // On every (re)connect: the server may be new.
  events.addEventListener("open", () => post(true));
  events.addEventListener("settings", (e) => {
    o.onSettings((JSON.parse((e as MessageEvent<string>).data) as { values: Values }).values);
    post();
  });
  events.addEventListener("launch", () => o.onLaunch());
  // A script writing window.barSim.settings tells no one: compare once a second.
  setInterval(() => post(), 1000);
  return { changed: () => post() };
}
