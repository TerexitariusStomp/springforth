#!/usr/bin/env python3
"""Re-record only the flip segment (card B flips on camera) and rebuild
walkthrough.mp4 by re-concatenating the existing segments."""
import base64, json, os, subprocess, threading, time, websocket

BASE = "https://springforth.widespread.workers.dev"
OUT = "/home/terex/Documents/springforth/docs/hackathon/demo-assets"
TMP = "/tmp/springforth-video"
W, H, QUALITY = 1920, 1080, 62
FLIP_ID = "poss-round-two-join-to-activate-mvhc8ikp"
NAME = "07-flip"
NARRATION = """This card sits at two of three. Join, and quorum reached,
commitment bound, the declaring group gets pinged on Telegram. People
and required resources: that's what quorum means."""

SCROLL_TO_CARD = (
    "[...document.querySelectorAll('.card')]"
    ".find(c=>c.innerText.includes('Round two'))"
    "?.scrollIntoView({behavior:'smooth',block:'center'})")
PULSE = """(() => {
  if (document.getElementById('__cap')) return true;
  const d = document.createElement('div'); d.id = '__cap';
  d.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;'
    + 'z-index:2147483647;pointer-events:none;opacity:.01;';
  d.animate([{background:'#000'},{background:'#111'}],
    {duration:200,iterations:Infinity});
  document.body.appendChild(d); return true;
})()"""

tab = json.loads(subprocess.check_output(
    ["curl", "-s", "-X", "PUT", "http://localhost:9222/json/new?about:blank"]))
ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=90,
                                 suppress_origin=True)
_mid, _results, _frames = [0], {}, []
_lock, _stop = threading.Lock(), threading.Event()

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
    r = send("Runtime.evaluate", {"expression": expr,
                                  "returnByValue": True,
                                  "awaitPromise": True})
    if r.get("exceptionDetails"):
        print("  JS ERR:", json.dumps(r["exceptionDetails"])[:200])
    return r.get("result", {}).get("value")

threading.Thread(target=reader, daemon=True).start()
send("Emulation.setDeviceMetricsOverride",
     {"width": W, "height": H, "deviceScaleFactor": 1, "mobile": False})

wav = f"{TMP}/{NAME}.wav"
subprocess.run(["espeak-ng", "-v", "en-us", "-s", "145", "-p", "30",
                "-w", wav, NARRATION], check=True)
adur = float(subprocess.check_output(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
     "-of", "csv=p=0", wav]).strip())
dur = adur + 2.0
steps = [
    (0.0, "nav", "/possibilities"),
    (3.2, "js", SCROLL_TO_CARD),
    (dur * 0.42, "js",
     "fetch('/possibilities/" + FLIP_ID + "/join',"
     "{method:'POST',headers:{'Content-Type':'application/json'},"
     "body:JSON.stringify({actor:'demo-judge-2',bringing:'attention'})})"
     ".then(r=>r.status)"),
    (dur * 0.62, "js", "location.reload()"),
    (dur * 0.8, "js", SCROLL_TO_CARD),
]
frames = []
_frames_ref = _frames
send("Page.startScreencast",
     {"format": "jpeg", "quality": QUALITY,
      "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
t0, si = time.time(), 0
while time.time() - t0 < dur:
    el = time.time() - t0
    while si < len(steps) and el >= steps[si][0]:
        kind, arg = steps[si][1], steps[si][2]
        if kind == "nav":
            send("Page.navigate", {"url": BASE + arg}, wait=False)
        else:
            ev(arg)
        si += 1
    ev(PULSE)
    time.sleep(0.4)
send("Page.stopScreencast")
time.sleep(0.5)
actual = time.time() - t0
frames = list(_frames)
print(f"{len(frames)} frames over {actual:.1f}s")

sdir = f"{TMP}/{NAME}"
os.makedirs(sdir, exist_ok=True)
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

seg = f"{TMP}/{NAME}.mp4"
subprocess.run(
    ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
     "-i", wav, "-t", f"{actual:.2f}",
     "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps=25",
     "-c:v", "h264_nvenc", "-pix_fmt", "yuv420p",
     "-preset", "p4", "-cq", "23",
     "-c:a", "aac", "-b:a", "128k", "-shortest", seg],
    check=True)

order = ["01-landing", "02-coordination", "03-funding", "04-evidence",
         "05-claims", "06-governance", "07-flip", "08-ledger", "09-close"]
cl = f"{TMP}/concat.txt"
open(cl, "w").write("".join(f"file '{TMP}/{n}.mp4'\n" for n in order))
final = f"{OUT}/walkthrough.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cl,
                "-c", "copy", final], check=True)
print("DONE:", final)
_stop.set()
ws.close()
