#!/usr/bin/env python3
"""Build the 1200x630 social-share (Open Graph) card for BE Mastery.

Dark brand background + gradient wash, the app mark, the headline, and a
cropped phone screenshot on the right. Run from the repo root; writes og.png.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

W, H = 1200, 630
BG = (10, 14, 26)
ACC = (99, 102, 241)
ACC2 = (34, 211, 238)
TXT = (238, 242, 251)
MUT = (159, 176, 204)

F = "/System/Library/Fonts/Supplemental/"
f_h1 = ImageFont.truetype(F + "Arial Bold.ttf", 60)
f_sub = ImageFont.truetype(F + "Arial.ttf", 27)
f_brand = ImageFont.truetype(F + "Arial Bold.ttf", 30)
f_kick = ImageFont.truetype(F + "Arial Bold.ttf", 19)
f_foot = ImageFont.truetype(F + "Arial.ttf", 22)

img = Image.new("RGB", (W, H), BG)

# --- radial gradient washes, drawn small then upscaled (cheap + smooth) ---
def wash(cx, cy, rad, colour, strength):
    s = 120
    g = Image.new("L", (s, s), 0)
    px = g.load()
    for y in range(s):
        for x in range(s):
            d = math.hypot((x + .5) / s - cx, (y + .5) / s - cy) / rad
            px[x, y] = int(max(0.0, 1.0 - d) ** 2 * 255 * strength)
    g = g.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(20))
    img.paste(Image.new("RGB", (W, H), colour), (0, 0), g)

wash(0.78, -0.05, 0.75, ACC, 0.55)
wash(0.02, 0.85, 0.70, ACC2, 0.22)

d = ImageDraw.Draw(img)

# --- brand mark: rounded tile + speech bubble with three bars ---
tx, ty, ts = 68, 62, 66
tile = Image.new("RGBA", (ts, ts), (0, 0, 0, 0))
td = ImageDraw.Draw(tile)
td.rounded_rectangle([0, 0, ts - 1, ts - 1], radius=19, fill=(15, 26, 48))
# bubble
bub = [(ts * .17, ts * .22), (ts * .83, ts * .70)]
td.rounded_rectangle(bub, radius=int(ts * .13), fill=ACC2)
td.polygon([(ts * .31, ts * .66), (ts * .47, ts * .66), (ts * .31, ts * .86)], fill=ACC2)
for i, (bx, bh) in enumerate([(.30, .12), (.45, .19), (.60, .26)]):
    td.rounded_rectangle([ts * bx, ts * (.55 - bh), ts * (bx + .075), ts * .55],
                         radius=int(ts * .035), fill=(255, 255, 255))
img.paste(tile, (tx, ty), tile)

d.text((tx + ts + 18, ty + 16), "BE", font=f_brand, fill=TXT)
d.text((tx + ts + 18 + d.textlength("BE ", font=f_brand), ty + 16), "Mastery",
       font=f_brand, fill=ACC2)

# --- kicker pill ---
kick = "12-WEEK SYSTEM  ·  25 MIN A DAY"
kw = d.textlength(kick, font=f_kick)
d.rounded_rectangle([68, 178, 68 + kw + 44, 178 + 44], radius=22,
                    outline=(255, 255, 255, 60), width=2)
d.text((90, 190), kick, font=f_kick, fill=ACC2)

# --- headline ---
y = 252
for line in ["Speak like you belong", "in the room."]:
    d.text((68, y), line, font=f_h1, fill=TXT)
    y += 72

# --- subhead ---
y += 18
for line in ["Guided Business English practice: shadowing,",
             "speaking feedback, phrases and progress tracking."]:
    d.text((68, y), line, font=f_sub, fill=MUT)
    y += 38

d.text((68, H - 74), "app.lomonec.com  ·  Lomonec LLC", font=f_foot, fill=(108, 124, 154))

# --- phone screenshot, rounded, on the right (bleeds off the bottom edge) ---
# m09 is the neutral "Alex" demo profile — never a real person's name in public art
shot = Image.open("manual/screenshots/m09-mobile.png").convert("RGB")
pw = 268
ph = int(shot.height * pw / shot.width)
shot = shot.resize((pw, ph), Image.LANCZOS)
px, py = 856, 96
shot = shot.crop((0, 0, pw, min(ph, H - py + 40)))     # run past the canvas bottom

mask = Image.new("L", shot.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.size[0] - 1, shot.size[1] + 40],
                                       radius=30, fill=255)
# bezel + glow behind the phone
bez = Image.new("RGBA", (pw + 20, shot.size[1] + 60), (0, 0, 0, 0))
ImageDraw.Draw(bez).rounded_rectangle([0, 0, pw + 19, shot.size[1] + 59],
                                      radius=38, fill=(255, 255, 255, 26))
img.paste(bez, (px - 10, py - 10), bez)
img.paste(shot, (px, py), mask)

img.save("og.png", "PNG", optimize=True)
print("og.png", img.size)
