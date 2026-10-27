#!/usr/bin/env python3
"""Bridge to the firmware's Python asset tools (scripts/flipper/rle.py, scripts/seq2anim.py).

    python3 reference.py <firmware-checkout>

Reads one JSON request per line on stdin and answers with one JSON line each:
  {"op": "rle_compress" | "rle_decompress", "blk": n, "data": hex}  ->  {"out": hex}
  {"op": "qoi", "data": hex}                                         ->  {"out": hex}   (RGBA pixels in)
  {"op": "convert", "dir": path, "out": path}                        ->  {"out": path}  (seq2anim on a frame folder)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / "scripts"))

from flipper import rle  # noqa: E402
import seq2anim  # noqa: E402

for line in sys.stdin:
    req = json.loads(line)
    op = req["op"]
    if op == "rle_compress":
        out = rle.compress(bytes.fromhex(req["data"]), req["blk"]).hex()
    elif op == "rle_decompress":
        out = rle.decompress(bytes.fromhex(req["data"]), req["blk"]).hex()
    elif op == "qoi":
        data = bytes.fromhex(req["data"])
        out = seq2anim.qoi_headerless_compress(data, data).hex()
    elif op == "convert":
        seq2anim.BSBAnimConverter().convert_dir(Path(req["dir"]), Path(req["out"]))
        out = req["out"]
    else:
        raise ValueError(op)
    print(json.dumps({"out": out}), flush=True)
