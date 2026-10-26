#!/usr/bin/env python3
"""Record the Springforth demo walkthrough video.

CDP Page.startScreencast (server-pushed compositor frames) + espeak-ng
narration per section + ffmpeg mux. An injected CSS animation keeps the
compositor producing frames even on static pages.

Output: docs/hackathon/demo-assets/walkthrough.mp4
"""
import base64, json, os, subprocess, threading, time, websocket

BASE = "https://springforth.widespread.workers.dev"
OUT = "/home/terex/Documents/springforth/docs/hackathon/demo-assets"
TMP = "/tmp/springforth-video"
W, H, QUALITY = 1920, 1080, 62

SECTIONS = [
    ("01-landing", [("/", "scroll")], """Communities have overlapping plans in
different systems. Springforth deduplicates them into coordinated, funded
action. This is the live deployment. Good things happen when we move
together — the landing page shows live cards nearest to quorum."""),
    ("02-coordination", [("/coordination", "scroll")], """Across imported plans:
One Planet, a county C S V, Treegens field records, Silvi. The overlap
layer flags where strategies collide or complement. Each record carries
confidence, evidence, counter evidence, and humans validate: separate,
coordinate, or combine."""),
    ("03-funding", [("/rounds", "scroll"), ("/rounds/round-pairwise-demo", "scroll")],
     """Two rounds, same three needs. Standard quadratic on the left.
Pairwise on the right: the three donors who appreciated each other get
discounted, two hundred thirty two dollars eighty four, versus about two
sixty three. The appreciation graph is the sybil signal. No external
passport, no staking token. Collusion costs you. Diversity pays."""),
    ("04-evidence", [("/verify", "scroll"), ("/actors/demo-brian", "scroll")],
     """Every delivery action gets scored by independent public sources:
Sentinel 2 scene coverage, G B I F biodiversity records, NASA weather,
Treegens filmed trees. A field report corroborated by satellite earns
the reporter an assurance credit. Measure to earn."""),
    ("05-claims", [("/claims", "scroll")], """The outcome becomes a hypercert
shaped impact claim with an E A S attestation. Every chain route returns
unsigned call data. Wallets sign. Nothing custodies."""),
    ("06-governance", [("/governance", "scroll"), ("/datasets", "scroll")],
     """Protocol parameters are tuned by ballot, gated by Eigen Trust
standing. The social graph is the franchise, not a token. This proposal
already passed and rewrote the matching coefficient. And signed data
releases, anchored to Bitcoin: the data revenue lane."""),
    ("07-flip", [("/possibilities", "flip")], """This card sits at two of
three. Join, and quorum reached, commitment bound, the declaring group
gets pinged on Telegram. People and required resources: that's what
quorum means."""),
    ("08-ledger", [("/ledger/verify", None), ("/docs", "scroll")], """Every
decision is hash chained, the head anchored to Bitcoin via Open
Timestamps. The full A P I is documented with a typed client. This is
infrastructure others build on."""),
    ("09-close", [("/how-it-works", "scroll")], """Overlapping plans to coordinated,
funded action, with collusion resistance grown from the coordination
itself. Springforth, P S one, Team Two."""),
]

FLIP_ID = "poss-you-in-this-room-join-to-activate-mvhc8jlq"
# React frontend cards are divs carrying bg-card — find the smallest one
# containing the flip card's title text.
SCROLL_TO_CARD = (
    "[...document.querySelectorAll('.bg-card, [class*=\"bg-card\"]')]"
    ".filter(c=>c.innerText&&c.innerText.includes('in this room'))"
    ".sort((a,b)=>a.innerText.length-b.innerText.length)[0]"
    "?.scrollIntoView({behavior:'smooth',block:'center'})")
# keeps the compositor emitting frames on static pages
PULSE = """(() => {
  if (document.getElementById('__cap')) return true;
  const d = document.createElement('div');
  d.id = '__cap';
  d.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;'
    + 'z-index:2147483647;pointer-events:none;opacity:.01;';
  d.animate([{background:'#000'},{background:'#111'}],
    {duration:200,iterations:Infinity});
  document.body.appendChild(d); return true;
})()"""

os.makedirs(TMP, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

tab = json.loads(subprocess.check_output(
    ["curl", "-s", "-X", "PUT", "http://localhost:9222/json/new?about:blank"]))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=90,
                                 suppress_origin=True)

_mid, _results, _frames = [0], {}, []
_lock = threading.Lock()
_stop = threading.Event()

def reader():
    while not _stop.is_set():
        try:
            r = json.loads(ws.recv())
        except Exception:
            break
        if "id" in r:
            _results[r["id"]] = r.get("result", {})
        elif r.get("method") == "Page.screencastFrame":
            p = r["params"]
            _frames.append((p["metadata"]["timestamp"], p["data"]))
            send("Page.screencastFrameAck",
                 {"sessionId": p["sessionId"]}, wait=False)

def send(method, params=None, wait=True):
    with _lock:
        _mid[0] += 1
        i = _mid[0]
    ws.send(json.dumps({"id": i, "method": method, "params": params or {}}))
    if not wait:
        return None
    t0 = time.time()
    while i not in _results and time.time() - t0 < 60:
        time.sleep(0.01)
    return _results.pop(i, {})

def ev(expr):
    return send("Runtime.evaluate", {"expression": expr,
                                     "returnByValue": True,
                                     "awaitPromise": True
                                     }).get("result", {}).get("value")

threading.Thread(target=reader, daemon=True).start()
send("Emulation.setDeviceMetricsOverride",
     {"width": W, "height": H, "deviceScaleFactor": 1, "mobile": False})

def scroll_steps(page_dur, start_at):
    n = max(2, int(page_dur / 6))
    return [(start_at + i * (page_dur / n), "js",
             f"window.scrollBy({{top:{350 if i < n-1 else -99999},"
             "behavior:'smooth'}})") for i in range(n)]

def record(dur, steps):
    """Capture screencast frames for `dur` s while running timed steps."""
    _frames.clear()
    send("Page.startScreencast",
         {"format": "jpeg", "quality": QUALITY,
          "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
    t0, si, last_nav = time.time(), 0, 0.0
    while time.time() - t0 < dur:
        el = time.time() - t0
        while si < len(steps) and el >= steps[si][0]:
            kind, arg = steps[si][1], steps[si][2]
            if kind == "nav":
                send("Page.navigate", {"url": BASE + arg}, wait=False)
                last_nav = el
            elif kind == "js":
                ev(arg)
            si += 1
        ev(PULSE)          # keep frames flowing during static stretches
        time.sleep(0.4)
    send("Page.stopScreencast")
    time.sleep(0.5)
    return list(_frames), time.time() - t0

segs = []
for name, pages, narration in SECTIONS:
    wav = f"{TMP}/{name}.wav"
    subprocess.run(["espeak-ng", "-v", "en-us", "-s", "145", "-p", "30",
                    "-w", wav, narration], check=True)
    adur = float(subprocess.check_output(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", wav]).strip())
    dur = adur + 1.5
    per = dur / len(pages)
    steps = [(0.0, "nav", pages[0][0])]
    for i, (path, mode) in enumerate(pages):
        t0 = i * per + 2.6
        if i > 0:
            steps.append((i * per, "nav", path))
        if mode == "scroll":
            steps += scroll_steps(per - 3.5, t0)
        elif mode == "flip":
            steps += [
                (t0 + 1, "js", SCROLL_TO_CARD),
                (t0 + per * 0.45, "js",
                 "fetch('/possibilities/" + FLIP_ID + "/join',"
                 "{method:'POST',headers:{'Content-Type':'application/json'},"
                 "body:JSON.stringify({actor:'demo-judge'})})"
                 ".then(r=>r.status)"),
                (t0 + per * 0.62, "js", "location.reload()"),
                (t0 + per * 0.8, "js", SCROLL_TO_CARD),
            ]
    steps.sort(key=lambda s: s[0])
    print(f"[{name}] audio {adur:.1f}s -> record {dur:.1f}s", flush=True)
    frames, actual = record(dur, steps)
    sdir = f"{TMP}/{name}"
    os.makedirs(sdir, exist_ok=True)
    # write frames at their real timestamps via a concat-demuxer image list
    lst = f"{sdir}/frames.txt"
    with open(lst, "w") as f:
        tbase = frames[0][0] if frames else 0
        prev = 0.0
        for i, (ts, data) in enumerate(frames):
            fp = f"{sdir}/f{i:05d}.jpg"
            open(fp, "wb").write(base64.b64decode(data))
            d = max(0.001, ts - tbase - prev) if i else 0.001
            prev = ts - tbase
            f.write(f"file '{fp}'\nduration {d:.3f}\n")
        if frames:
            f.write(f"file '{sdir}/f{len(frames)-1:05d}.jpg'\n")
    seg = f"{TMP}/{name}.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-i", wav, "-t", f"{actual:.2f}",
         "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps=25",
         "-c:v", "mpeg4", "-q:v", "4", "-pix_fmt", "yuv420p",
         "-crf", "21", "-c:a", "aac", "-b:a", "128k",
         "-shortest", seg], check=True, capture_output=True)
    segs.append(seg)
    print(f"  {len(frames)} frames over {actual:.1f}s -> {seg}", flush=True)

lst = f"{TMP}/concat.txt"
open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
final = f"{OUT}/walkthrough.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                "-c", "copy", final], check=True, capture_output=True)
print("DONE:", final)
subprocess.run(["ffprobe", "-v", "quiet", "-show_entries",
                "format=duration,size", "-of", "default=nw=1", final])
_stop.set()
ws.close()
