#!/usr/bin/env python3
"""Build the edited judge walkthrough from real deployed-app captures (macOS)."""
from __future__ import annotations

import argparse
import wave
import json
import math
from pathlib import Path
import re
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
W, H, FPS = 1920, 1080, 24
PAPER, INK, MUTED, CLAY, LINE = "#f6f5f0", "#35452f", "#7b8474", "#bf6b47", "#dce0d2"
FONTS = Path("/System/Library/Fonts")


def font(size: int, kind: str = "sans") -> ImageFont.FreeTypeFont:
    names = {"sans": "Supplemental/Arial.ttf", "bold": "Supplemental/Arial Bold.ttf",
             "serif": "Supplemental/Georgia.ttf", "italic": "Supplemental/Georgia Italic.ttf",
             "mono": "Menlo.ttc"}
    return ImageFont.truetype(str(FONTS / names[kind]), size)


def lines(draw, xy, value, size=24, fill=INK, kind="sans", gap=1.4):
    x, y = xy
    for line in value.split("\n"):
        draw.text((x, y), line, font=font(size, kind), fill=fill)
        y += size * gap
    return y


def base_frame(scene, number):
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.text((76, 40), "ostrakon", font=font(40, "bold"), fill=INK)
    d.ellipse((248, 73, 254, 79), fill=CLAY)
    d.text((295, 58), "FIELDNOTES / ZCASH", font=font(16, "mono"), fill=MUTED)
    tag = scene["tag"]
    tag_width = d.textlength(tag, font=font(16, "mono"))
    d.rounded_rectangle((W-100-tag_width, 45, W-76, 90), radius=22, fill="#e7eadd")
    d.text((W-88-tag_width, 58), tag, font=font(16, "mono"), fill=INK)
    d.line((76, 120, W-76, 120), fill=LINE, width=2)
    if scene.get("capture"):
        lines(d, (76, 190), scene["kicker"], 15, CLAY, "mono")
        lines(d, (72, 250), scene["title"], 51, kind="serif", gap=1.22)
        lines(d, (76, 448), scene["detail"], 22, MUTED, gap=1.7)
        d.line((76, 630, 160, 630), fill=CLAY, width=3)
        lines(d, (76, 655), "Observe.\nExplain.\nKeep the context.", 21, MUTED, gap=1.65)
        shot = Image.open(HERE / "captures" / scene["capture"]).convert("RGB")
        if scene.get("crop"):
            shot = shot.crop(tuple(scene["crop"]))
        # Preserve screenshot proportions and all selected visible text.
        shot = ImageOps.contain(shot, (1308, 736), Image.Resampling.LANCZOS)
        sx, sy = 536+(1308-shot.width)//2, 174+(736-shot.height)//2
        d.rounded_rectangle((sx-3, sy-30, sx+shot.width+3, sy+shot.height+3),
                            radius=9, fill="#fffef9", outline=LINE, width=2)
        d.text((sx+14, sy-23), "ostrakon-kappa.vercel.app", font=font(12, "mono"), fill=MUTED)
        im.paste(shot, (sx, sy))
    else:
        lines(d, (76, 211), scene["kicker"], 18, CLAY, "mono")
        lines(d, (70, 285), scene["title"], 96, kind="serif", gap=1.18)
        lines(d, (78, 595), scene["detail"], 29, MUTED, gap=1.65)
        if scene["id"] == "opening":
            d.rounded_rectangle((1150, 203, 1825, 842), radius=28, fill="#e7eadd")
            lines(d, (1200, 255), "REAL MAINNET RECORDING", 18, CLAY, "mono")
            lines(d, (1190, 320), "3,520,054", 83, kind="serif")
            lines(d, (1200, 445), "One block. Seven records.\nA clear account of what is visible.", 25, gap=1.5)
            for j in range(7):
                x=1200+j*79
                d.rounded_rectangle((x, 606, x+51, 660), radius=12,
                                    fill=CLAY if j == 2 else "#bdc6b1")
            lines(d, (1200, 710), "NO KEYS  /  LOCAL ANALYSIS", 17, MUTED, "mono")
        else:
            for j, (title, note) in enumerate([
                ("MAINNET RECORDING", "Inspect the public fields."),
                ("TRANSPARENT LIMITS", "Keep inference separate."),
                ("LOCAL ANALYSIS", "Keep control of your data.")]):
                y=240+j*195
                lines(d, (1230, y), f"0{j+1}", 20, CLAY, "mono")
                lines(d, (1230, y+45), title, 21, INK, "bold")
                lines(d, (1230, y+88), note, 23, MUTED)
    d.line((76, 937, W-76, 937), fill=LINE, width=2)
    d.text((76, 895), f"{number:02d} / 10", font=font(14, "mono"), fill=MUTED)
    return im


def caption_chunks(text):
    chunks=[]
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        chunks.extend(textwrap.wrap(sentence, width=94, break_long_words=False))
    return chunks


def caption_frame(base, text):
    im=base.copy()
    d=ImageDraw.Draw(im)
    if text:
        wrapped=textwrap.wrap(text, width=86, break_long_words=False)
        top=958 if len(wrapped)>1 else 976
        for i, line in enumerate(wrapped):
            width=d.textlength(line, font=font(29))
            d.text(((W-width)/2, top+i*39), line, font=font(29), fill=INK)
    return im


def stamp(seconds):
    ms=round(seconds*1000)
    return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, default=ROOT/"exports/demo")
    p.add_argument("--voice", default="Daniel")
    p.add_argument("--rate", type=int, default=195)
    p.add_argument("--reuse-audio", action="store_true")
    p.add_argument("--prepare-only", action="store_true")
    args=p.parse_args()
    out=args.output.resolve()
    for sub in ("audio", "frames"):
        (out/sub).mkdir(parents=True, exist_ok=True)
    scenes=json.loads((HERE/"scenes.json").read_text())
    cursor=0
    plan=[]
    subtitle_entries=[]
    review=[]
    for i, scene in enumerate(scenes):
        audio=out/"audio"/f"{scene['id']}.wav"
        if not args.reuse_audio:
            subprocess.run(["say", "-v", args.voice, "-r", str(args.rate),
                            "-o", str(audio), "--data-format=LEI16@24000", scene["narration"]], check=True)
        with wave.open(str(audio), "rb") as f:
            seconds=f.getnframes()/f.getframerate()
        if seconds<0.5:
            raise SystemExit(f"Empty narration for {scene['id']}; enable local speech access.")
        duration=math.ceil(max(scene["minimumSeconds"], seconds+0.85)*FPS)/FPS
        base=base_frame(scene, i+1)
        chunks=caption_chunks(scene["narration"])
        total_chars=sum(len(c) for c in chunks)
        caption_cursor=0.25
        frames=[]
        blank=out/"frames"/f"{i:02}-blank.png"
        base.save(blank)
        frames.append({"start":0, "path":str(blank)})
        for j, chunk in enumerate(chunks):
            length=seconds*len(chunk)/total_chars
            start=cursor+caption_cursor
            end=min(cursor+seconds+0.25, start+length)
            subtitle_entries.append(f"{len(subtitle_entries)+1}\n{stamp(start)} --> {stamp(end)}\n{chunk}\n")
            path=out/"frames"/f"{i:02}-{j:02}.png"
            caption_frame(base, chunk).save(path)
            frames.append({"start":caption_cursor, "path":str(path)})
            caption_cursor+=length
        frames.append({"start":seconds+0.25,"path":str(blank)})
        plan.append({"id":scene["id"],"start":cursor,"duration":duration,
                     "audio":str(audio),"audioOffset":0.25,"audioSeconds":seconds,"frames":frames})
        review.append(base)
        cursor+=duration
        print(f"{scene['id']}: {duration:.2f}s ({seconds:.2f}s narration)", flush=True)
    if cursor>120:
        raise SystemExit(f"Cut is {cursor:.2f}s; increase --rate or shorten narration to meet 120s.")
    (out/"captions.srt").write_text("\n".join(subtitle_entries))
    (out/"render-plan.json").write_text(json.dumps({"width":W,"height":H,"fps":FPS,
                                                "duration":cursor,"scenes":plan}, indent=2))
    review[0].save(out/"poster.png")
    sheet=Image.new("RGB",(960,270*5),PAPER)
    for i, frame in enumerate(review):
        sheet.paste(frame.resize((480,270),Image.Resampling.LANCZOS),(i%2*480,i//2*270))
    sheet.save(out/"review.png")
    print(f"Total: {cursor:.2f}s. Captions, poster and review frames prepared.", flush=True)
    if not args.prepare_only:
        executable=out/"render-native"
        subprocess.run(["swiftc","-O","-module-cache-path",str(out/"swift-cache"),
                        str(HERE/"render.swift"),"-o",str(executable)],check=True)
        subprocess.run([str(executable),str(out/"render-plan.json"),
                        str(out/"ostrakon-demo.mp4")],check=True)


if __name__=="__main__":
    main()
