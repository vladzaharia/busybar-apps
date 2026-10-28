#!/usr/bin/env python3
"""A stand-in for a BUSY Bar's HTTP API, as far as Pkmn Life Remote uses it, so the Mac app runs without a bar.

    Tools/mock-bar.py [--port 8787] [--log requests.log]
    then start the app with  -host 127.0.0.1:8787

Answers GET /api/version, GET and PUT /api/apps/settings?app_id=..., POST /api/apps/launch. Settings start at Pkmn
Life's defaults (apps/pkmn-life/src/appmeta/settings.json) and live in memory. Every request is printed (and appended
to --log), with the "remote" field of each settings write, so a check can see what the app sent.
"""

import argparse
import json
import pathlib
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = pathlib.Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "apps/pkmn-life/src/appmeta/settings.json"
APP_ID = "app.vlad.pkmn_life"


def defaults():
    schema = json.loads(SCHEMA.read_text())
    return {
        "version": schema["version"],
        "values": {key: field.get("default") for key, field in schema["fields"].items()},
    }


class Bar(BaseHTTPRequestHandler):
    doc = defaults()
    log_path = None

    def note(self, text):
        line = f"{self.command} {self.path} {text}".rstrip()
        print(line, flush=True)
        if Bar.log_path:
            with open(Bar.log_path, "a") as f:
                f.write(line + "\n")

    def reply(self, status, body=None):
        data = json.dumps(body).encode() if body is not None else b""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def app_ok(self):
        app = parse_qs(urlparse(self.path).query).get("app_id", [""])[0]
        if app != APP_ID:
            self.note("-> 404")
            self.reply(404, {"error": "no such app"})
            return False
        return True

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/version":
            self.note("")
            self.reply(200, {"version": "mock"})
        elif path == "/api/apps/settings" and self.app_ok():
            self.note("")
            self.reply(200, Bar.doc)
        elif path != "/api/apps/settings":
            self.reply(404, {"error": "not found"})

    def do_PUT(self):
        if urlparse(self.path).path != "/api/apps/settings" or not self.app_ok():
            return
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        Bar.doc = body
        changed = {k: v for k, v in body.get("values", {}).items() if k != "remote"}
        self.note(f"remote={body.get('values', {}).get('remote', '')!r} values={json.dumps(changed, sort_keys=True)}")
        self.reply(200, {"result": "OK"})

    def do_POST(self):
        if urlparse(self.path).path == "/api/apps/launch" and self.app_ok():
            self.note("")
            self.reply(200, {"result": "OK"})

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=8787)
    parser.add_argument("--log")
    args = parser.parse_args()
    Bar.log_path = args.log
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Bar)
    print(f"Mock bar on http://127.0.0.1:{args.port}", file=sys.stderr, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
