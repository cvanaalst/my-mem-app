"""
Generates placeholder app icons for Second Memory.
Run once locally: python3 icons/generate_icons.py
Not part of the runtime app — dev utility only.
"""
from PIL import Image, ImageDraw, ImageFont
import os

SIZES = [16, 32, 48, 72, 96, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512]
BG = (125, 116, 255)      # accent indigo-violet (matches --accent)
FG = (255, 255, 255)

def draw_icon(size, corner_radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(size * corner_radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)

    # simple "brain / memory" glyph: stylised M with a dot, drawn as strokes
    pad = size * 0.24
    w = size - 2 * pad
    h = w
    x0, y0 = pad, size / 2 - h / 2
    stroke = max(2, int(size * 0.09))

    pts = [
        (x0, y0 + h),
        (x0, y0),
        (x0 + w * 0.5, y0 + h * 0.55),
        (x0 + w, y0),
        (x0 + w, y0 + h),
    ]
    draw.line(pts, fill=FG, width=stroke, joint="curve")
    dot_r = size * 0.045
    cx, cy = size / 2, y0 + h + size * 0.09
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=FG)
    return img

out_dir = os.path.dirname(os.path.abspath(__file__))
for s in SIZES:
    icon = draw_icon(s)
    icon.save(os.path.join(out_dir, f"icon-{s}.png"))

# apple-touch-icon: 180x180, no transparency (iOS ignores alpha, fills black)
apple = draw_icon(180)
flat = Image.new("RGB", apple.size, BG)
flat.paste(apple, mask=apple.split()[3])
flat.save(os.path.join(out_dir, "apple-touch-icon.png"))

print("Generated", len(SIZES) + 1, "icons in", out_dir)
