# Génère les icônes de l'app (nuage + gouttes). Usage : python3 scripts/make-icons.py assets
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
S = 4096  # supersampling

def gradient(size, top, bottom):
    im = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(im)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return im

def motif(size, scale, cloud_fill, drop_fill, shadow=True):
    """Nuage + 3 gouttes, centré, sur calque transparent. scale = part de la largeur occupée."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    u = size * scale / 100.0          # unité : motif dessiné dans une boîte 100x100
    ox = (size - 100 * u) / 2
    oy = (size - 100 * u) / 2
    P = lambda x, y: (ox + x * u, oy + y * u)
    def circle(d, cx, cy, r, fill):
        x, y = P(cx, cy); d.ellipse([x - r * u, y - r * u, x + r * u, y + r * u], fill=fill)
    def cloud(d, fill, dy=0):
        circle(d, 33, 44 + dy, 17, fill)
        circle(d, 55, 35 + dy, 23, fill)
        circle(d, 74, 47 + dy, 14, fill)
        x0, y0 = P(33, 40 + dy); x1, y1 = P(74, 61 + dy)
        d.rectangle([x0, y0, x1, y1], fill=fill)
    def drop(d, cx, cy, r, fill):
        circle(d, cx, cy, r, fill)
        a = P(cx - r * 0.97, cy - r * 0.25); b = P(cx + r * 0.97, cy - r * 0.25); c = P(cx, cy - r * 2.3)
        d.polygon([a, b, c], fill=fill)

    if shadow:
        sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        cloud(ImageDraw.Draw(sh), (0, 20, 60, 90), dy=2.5)
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(size * 0.012)))
    d = ImageDraw.Draw(im)
    cloud(d, cloud_fill)
    for cx, cy in ((34, 82), (52, 90), (70, 82)):
        drop(d, cx, cy, 5.2, drop_fill)
    return im

TOP, BOTTOM = (64, 156, 255), (10, 72, 186)
WHITE, DROP = (255, 255, 255, 255), (178, 222, 255, 255)

def save(im, name, size, mode):
    im.resize((size, size), Image.LANCZOS).convert(mode).save(f'{OUT}/{name}.png', optimize=True)

# iOS / icône générale : opaque, sans transparence
bg = gradient(S, TOP, BOTTOM).convert('RGBA')
icon = Image.alpha_composite(bg, motif(S, 0.72, WHITE, DROP))
save(icon, 'icon', 1024, 'RGB')
save(icon, 'favicon', 48, 'RGBA')

# Android adaptive : avant-plan transparent dans la zone sûre (66 %), fond = dégradé
save(motif(S, 0.56, WHITE, DROP), 'android-icon-foreground', 512, 'RGBA')
save(bg, 'android-icon-background', 512, 'RGBA')
save(motif(S, 0.62, WHITE, WHITE, shadow=False), 'android-icon-monochrome', 432, 'RGBA')

# Splash : motif bleu sur fond transparent
save(motif(S, 0.8, (31, 111, 235, 255), (90, 162, 255, 255), shadow=False), 'splash-icon', 1024, 'RGBA')
