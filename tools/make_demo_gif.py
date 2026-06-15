"""Assemble captured fold-sequence frames into a looping demo GIF for the README.

Crops each full-viewport screenshot to the centered flower and builds a
ping-pong (bloom -> bud -> bloom) loop.
Usage: python tools/make_demo_gif.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SEQ = ROOT / ".playwright-mcp" / "seq"
OUT = ROOT / "assets" / "screenshots" / "colorflower-fold.gif"

frames_in = [SEQ / f"f{i}.png" for i in range(5)]


def crop_center(img):
    w, h = img.size
    side = int(h * 0.62)
    cx, cy = w // 2, int(h * 0.46)
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    return img.crop(box).resize((520, 520), Image.LANCZOS).convert("RGB")


def main():
    imgs = [crop_center(Image.open(p)) for p in frames_in if p.exists()]
    if not imgs:
        raise SystemExit("no frames found")
    # ping-pong: forward then back (skip duplicate ends)
    loop = imgs + imgs[-2:0:-1]
    durations = [700] + [160] * (len(loop) - 2) + [700]
    imgs[0].save(
        OUT, save_all=True, append_images=loop[1:],
        duration=durations, loop=0, optimize=True
    )
    print("Wrote", OUT, f"({OUT.stat().st_size // 1024} KB, {len(loop)} frames)")


if __name__ == "__main__":
    main()
