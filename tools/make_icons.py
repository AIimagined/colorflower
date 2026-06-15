"""Generate Colorflower app icons / favicons from the source flower artwork.

Strictly uses the original raster image (no redrawing): it only removes the
white background (flood-fill from the borders so interior white/cream petals are
preserved), trims to the artwork, pads to a square, and exports the icon set.

Usage:  python tools/make_icons.py <source.png>
"""
import sys
import base64
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SENTINEL = (255, 0, 255)   # marker colour for flood-filled background
THRESH = 64                # how close to the seed colour counts as background
MARGIN = 0.035             # square padding around the artwork

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
PNG_SIZES = [512, 256, 192, 180, 152, 128, 96, 64, 48, 32, 16]
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def remove_background(src: Image.Image) -> Image.Image:
    orig = src.convert("RGB")
    work = orig.copy()
    w, h = work.size
    # Seed the flood from many border points so the whole connected background
    # (including the soft drop shadow) is captured, while isolated interior
    # white petals stay untouched.
    seeds = []
    for t in range(0, 101, 10):
        seeds += [(int(w * t / 100), 0), (int(w * t / 100), h - 1),
                  (0, int(h * t / 100)), (w - 1, int(h * t / 100))]
    for s in seeds:
        x = min(max(s[0], 0), w - 1)
        y = min(max(s[1], 0), h - 1)
        if work.getpixel((x, y)) != SENTINEL:
            ImageDraw.floodfill(work, (x, y), SENTINEL, thresh=THRESH)

    arr = np.array(work)
    mask_bg = np.all(arr == SENTINEL, axis=-1)
    alpha = np.where(mask_bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.array(orig), alpha])
    return Image.fromarray(rgba, "RGBA")


def square_trim(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()  # bounds of non-transparent pixels
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    side = int(max(cw, ch) * (1 + MARGIN * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2), cropped)
    return canvas


def main():
    src_path = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    master = square_trim(remove_background(Image.open(src_path)))

    master.resize((1024, 1024), Image.LANCZOS).save(OUT / "colorflower-icon.png")
    for s in PNG_SIZES:
        master.resize((s, s), Image.LANCZOS).save(OUT / f"icon-{s}.png")
    master.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")

    master.save(OUT / "favicon.ico", sizes=[(s, s) for s in ICO_SIZES])

    # Pixel-exact "SVG" that embeds the transparent PNG (scalable, still the
    # original artwork — not a trace).
    png_bytes = (OUT / "icon-512.png").read_bytes()
    b64 = base64.b64encode(png_bytes).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        f'<image width="512" height="512" href="data:image/png;base64,{b64}"/>'
        '</svg>'
    )
    (OUT / "colorflower-icon.svg").write_text(svg, encoding="utf-8")

    print("Wrote icons to", OUT)
    for p in sorted(OUT.iterdir()):
        print(f"  {p.name:26} {p.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
