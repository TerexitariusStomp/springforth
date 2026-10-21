#!/usr/bin/env python3
"""Re-voice the walkthrough with edge-tts neural narration.

Re-encodes each segment from its JPEG sequence, muxes the new mp3
narration, re-times captions to the new audio, keeps the URL overlay.
Segment length = audio + tail, except 07-flip which keeps its full
video arc (join -> reload -> quorum reveal needs ~16s).
"""
import os, subprocess, textwrap

TMP = "/tmp/springforth-video"
OUT = "/home/terex/Documents/springforth/docs/hackathon/demo-assets"
ORDER = ["01-landing", "02-coordination", "03-funding", "04-evidence",
         "05-claims", "06-governance", "07-flip", "08-ledger", "09-close"]
MIN_DUR = {"07-flip": 16.5}   # preserve the flip arc
TAIL = 1.5

CAPTIONS = {
    "01-landing": ["Communities have overlapping plans in different systems.",
                   "Springforth deduplicates them into coordinated, funded action.",
                   "This is the live deployment — the landing page opens with "
                   "what needs attention right now."],
    "02-coordination": ["Across imported plans — OnePlanet, a county CSV, "
                        "Treegens field records, Silvi —",
                        "the overlap layer flags where strategies collide "
                        "or complement.",
                        "Each record carries confidence, evidence, "
                        "counter-evidence,",
                        "and humans validate: separate, coordinate, or combine."],
    "03-funding": ["Two rounds, same three needs. Standard quadratic on the left.",
                   "Pairwise on the right — the three donors who appreciated "
                   "each other get discounted:",
                   "$232.84 versus ~$263.",
                   "The appreciation graph is the sybil signal —",
                   "no external passport, no staking token.",
                   "Collusion costs you; diversity pays."],
    "04-evidence": ["Every delivery action gets scored by independent "
                    "public sources:",
                    "Sentinel-2 scene coverage, GBIF biodiversity records, "
                    "NASA weather, Treegens filmed trees.",
                    "A field report corroborated by satellite earns the "
                    "reporter an assurance credit —",
                    "measure-to-earn."],
    "05-claims": ["The outcome becomes a hypercert-shaped impact claim",
                  "with an EAS attestation.",
                  "Every chain route returns unsigned calldata —",
                  "wallets sign, nothing custodies."],
    "06-governance": ["Protocol parameters are tuned by ballot, gated by "
                      "EigenTrust standing —",
                      "the social graph is the franchise, not a token.",
                      "This proposal already passed and rewrote the "
                      "matching coefficient.",
                      "And signed data releases, anchored to Bitcoin — "
                      "the data-revenue lane."],
    "07-flip": ["This card sits at two of three. Join —",
                "— quorum reached, commitment bound,",
                "the declaring group gets pinged on Telegram.",
                "People AND required resources — that's what quorum means."],
    "08-ledger": ["Every decision hash-chained, the head anchored to "
                  "Bitcoin via OpenTimestamps.",
                  "The full API is documented with a typed client —",
                  "this is infrastructure others build on."],
    "09-close": ["Overlapping plans to coordinated, funded action —",
                 "with collusion resistance grown from the coordination itself.",
                 "Springforth. PS1. Team Two."],
}

STYLE = ("FontName=DejaVu Sans,FontSize=13,PrimaryColour=&H00FFFFFF,"
         "OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,"
         "MarginV=34,Alignment=2")
URL = ("drawtext=text='springforth.widespread.workers.dev'"
       ":fontfile=/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf"
       ":fontsize=15:fontcolor=white@0.8:x=w-tw-20:y=16"
       ":box=1:boxcolor=black@0.35:boxborderw=7")

def ts(t):
    h, m = int(t // 3600), int((t % 3600) // 60)
    s, ms = int(t % 60), int((t % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def adur(name):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", f"{TMP}/{name}-v2.mp3"]).strip())

offset, gidx, glines = 0.0, 1, []
for name in ORDER:
    a = adur(name)
    segdur = max(a + TAIL, MIN_DUR.get(name, 0))
    cues = CAPTIONS[name]
    span = a - 0.8          # captions live inside the narration
    per = span / len(cues)
    srt = f"{TMP}/{name}.srt"
    with open(srt, "w") as f:
        for i, cue in enumerate(cues):
            txt = "\n".join(textwrap.wrap(cue, 44))
            ca, cb = i * per + 0.4, min((i + 1) * per + 0.4, a - 0.2)
            f.write(f"{i+1}\n{ts(ca)} --> {ts(cb)}\n{txt}\n\n")
            glines.append(f"{gidx}\n{ts(offset+ca)} --> "
                          f"{ts(offset+cb)}\n{txt}\n")
            gidx += 1
    seg = f"{TMP}/{name}-v2.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", f"{TMP}/{name}/frames.txt",
         "-i", f"{TMP}/{name}-v2.mp3",
         "-vf", f"tpad=stop=3:stop_mode=clone,"
                f"subtitles={srt}:force_style='{STYLE}',{URL},"
                "scale=1920:1080,fps=25",
         "-t", f"{segdur:.2f}",
         "-c:v", "h264_nvenc", "-pix_fmt", "yuv420p",
         "-preset", "p4", "-cq", "23",
         "-c:a", "aac", "-b:a", "128k", seg],
        check=True, capture_output=True)
    print(f"{name}: audio {a:.1f}s seg {segdur:.1f}s", flush=True)
    offset += segdur

open(f"{OUT}/walkthrough.srt", "w").write("\n".join(glines) + "\n")
cl = f"{TMP}/concat-v2.txt"
open(cl, "w").write("".join(f"file '{TMP}/{n}-v2.mp4'\n" for n in ORDER))
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cl,
                "-c", "copy", f"{OUT}/walkthrough.mp4"],
               check=True, capture_output=True)
print("DONE")
