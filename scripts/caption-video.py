#!/usr/bin/env python3
"""Burn captions + URL overlay into the demo walkthrough.

Re-encodes each segment from its JPEG sequence (no h264 decode needed),
rendering per-segment SRT captions via libass and a persistent
deployment-URL overlay via drawtext, then re-concatenates.
"""
import os, re, subprocess, textwrap

TMP = "/tmp/springforth-video"
OUT = "/home/terex/Documents/springforth/docs/hackathon/demo-assets"
ORDER = ["01-landing", "02-coordination", "03-funding", "04-evidence",
         "05-claims", "06-governance", "07-flip", "08-ledger", "09-close"]

# Human-readable captions (proper punctuation — not the TTS spelling).
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

FONT = "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf"
if not os.path.exists(FONT):
    FONT = "Sans"

def seg_dur(name):
    import cv2
    cap = cv2.VideoCapture(f"{TMP}/{name}.mp4")
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    cap.release()
    return n / fps

def ts(t):
    h, m = int(t // 3600), int((t % 3600) // 60)
    s, ms = int(t % 60), int((t % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

# caption track (SRT is also useful standalone for players that read subs)
global_srt = f"{OUT}/walkthrough.srt"
offset = 0.0
gidx = 1
glines = []
for name in ORDER:
    dur = seg_dur(name)
    cues = CAPTIONS[name]
    # spread cues over [0.4, dur-0.6]
    span = dur - 1.0
    per = span / len(cues)
    srt = f"{TMP}/{name}.srt"
    with open(srt, "w") as f:
        for i, cue in enumerate(cues):
            lines = textwrap.wrap(cue, 44)
            txt = "\n".join(lines)
            a, b = i * per + 0.4, (i + 1) * per + 0.4
            f.write(f"{i+1}\n{ts(a)} --> {ts(min(b, dur-0.3))}\n{txt}\n\n")
            glines.append(f"{gidx}\n{ts(offset+a)} --> "
                          f"{ts(offset+min(b, dur-0.3))}\n{txt}\n")
            gidx += 1
    offset += dur
open(global_srt, "w").write("\n".join(glines) + "\n")

STYLE = ("FontName=DejaVu Sans,FontSize=13,PrimaryColour=&H00FFFFFF,"
         "OutlineColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,"
         "MarginV=34,Alignment=2")
URL = ("drawtext=text='springforth.widespread.workers.dev'"
       f":fontfile={FONT if os.path.exists(FONT) else '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf'}"
       ":fontsize=15:fontcolor=white@0.8:x=w-tw-20:y=16"
       ":box=1:boxcolor=black@0.35:boxborderw=7")

for name in ORDER:
    seg = f"{TMP}/{name}-cap.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", f"{TMP}/{name}/frames.txt",
         "-i", f"{TMP}/{name}.wav",
         "-vf", f"subtitles={TMP}/{name}.srt:force_style='{STYLE}',{URL},"
                f"scale=1920:1080,fps=25",
         "-c:v", "h264_nvenc", "-pix_fmt", "yuv420p",
         "-preset", "p4", "-cq", "23",
         "-c:a", "aac", "-b:a", "128k", "-shortest", seg],
        check=True, capture_output=True)
    print("captioned:", name, flush=True)

cl = f"{TMP}/concat-cap.txt"
open(cl, "w").write("".join(f"file '{TMP}/{n}-cap.mp4'\n" for n in ORDER))
final = f"{OUT}/walkthrough.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cl,
                "-c", "copy", final], check=True, capture_output=True)
print("DONE:", final)
