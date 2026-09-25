#!/usr/bin/env python3
"""pixelfx — local pixel / resolution modulation for high-res images.

Runs fully offline. Effects can be chained; each one takes the output of the
previous one.

    python pixelfx.py input/ -o output/ --fx quadtree
    python pixelfx.py painting.jpg --fx "radial:cx=0.3,cy=0.4" --fx "rgbshift:amount=8"
    python pixelfx.py input/ --sheet            # contact sheet of every effect

Effect parameters are given as  name:key=value,key=value
Run  python pixelfx.py --list  to see every effect and its defaults.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None  # museum scans can be huge

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".bmp"}


# ---------------------------------------------------------------- helpers

def luminance(a):
    """Perceptual brightness (0-255 float) of an HxWx3 array."""
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def mosaic(img, block):
    """Uniform pixelation: average each block x block cell, scale back up."""
    block = max(1, int(block))
    if block == 1:
        return img.copy()
    w, h = img.size
    small = img.resize((max(1, w // block), max(1, h // block)), Image.BOX)
    return small.resize((w, h), Image.NEAREST)


def modulated_mosaic(img, level_map, sizes, blend=False):
    """Variable resolution: level_map (HxW, 0..1) picks a block size per pixel.

    0 -> sizes[0] (finest), 1 -> sizes[-1] (coarsest). Every size is rendered
    as a full mosaic layer and the level map selects between them, so any
    scalar field (distance, noise, brightness...) can drive the resolution.
    """
    layers = np.stack([np.asarray(mosaic(img, s), dtype=np.float32) for s in sizes])
    pos = np.clip(level_map, 0, 1) * (len(sizes) - 1)
    lo = np.floor(pos).astype(int)
    if not blend:
        idx = np.rint(pos).astype(int)
        out = np.take_along_axis(layers, idx[None, ..., None], axis=0)[0]
    else:
        hi = np.minimum(lo + 1, len(sizes) - 1)
        t = (pos - lo)[..., None]
        a = np.take_along_axis(layers, lo[None, ..., None], axis=0)[0]
        b = np.take_along_axis(layers, hi[None, ..., None], axis=0)[0]
        out = a * (1 - t) + b * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def block_sizes(lo, hi):
    """Powers of two between lo and hi, e.g. 2,4,8,...,128."""
    sizes, s = [], max(1, int(lo))
    while s < hi:
        sizes.append(s)
        s *= 2
    sizes.append(int(hi))
    return sizes


def value_noise(h, w, scale, seed):
    """Smooth random field in 0..1 (bilinear-upscaled random grid)."""
    rng = np.random.default_rng(seed)
    gh, gw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
    grid = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
    return np.asarray(grid.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255


# ---------------------------------------------------------------- effects

def fx_pixelate(img, block=24):
    """Classic uniform mosaic."""
    return mosaic(img, block)


def fx_quadtree(img, fine=4, coarse=128, thresh=14.0):
    """Adaptive resolution: detailed areas stay sharp, flat areas become big blocks.

    A cell is split into four while its brightness std-dev exceeds `thresh`
    and it is larger than `fine` pixels.
    """
    a = np.asarray(img, dtype=np.float32)
    lum = luminance(a)
    out = np.empty_like(a)
    h, w = lum.shape
    coarse = int(coarse)
    stack = [(y, x, coarse) for y in range(0, h, coarse) for x in range(0, w, coarse)]
    while stack:
        y, x, s = stack.pop()
        cell = lum[y:y + s, x:x + s]
        if cell.size == 0:  # sub-cell fell past the image edge
            continue
        if s > fine and cell.std() > thresh:
            half = s // 2
            stack += [(y, x, half), (y, x + half, half),
                      (y + half, x, half), (y + half, x + half, half)]
        else:
            out[y:y + s, x:x + s] = a[y:y + s, x:x + s].reshape(-1, 3).mean(0)
    return Image.fromarray(out.astype(np.uint8))


def fx_radial(img, cx=0.5, cy=0.45, radius=0.15, fine=1, coarse=96, blend=0):
    """Foveated: full resolution at a focus point, dissolving towards the edges."""
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((xx - cx * w) / w, (yy - cy * h) / w)  # normalised by width
    level = np.clip((d - radius) / (d.max() - radius + 1e-6), 0, 1) ** 0.8
    return modulated_mosaic(img, level, block_sizes(fine, coarse), bool(blend))


def fx_bands(img, bands=7, fine=1, coarse=64, axis=0, phase=0.0):
    """Stripes of alternating resolution that rise and fall like a wave."""
    w, h = img.size
    n = h if int(axis) == 0 else w
    t = np.linspace(0, 1, n, dtype=np.float32)
    wave = (np.sin((t * bands + phase) * 2 * np.pi) + 1) / 2
    level = np.repeat(wave[:, None], w, 1) if int(axis) == 0 else np.repeat(wave[None, :], h, 0)
    return modulated_mosaic(img, level, block_sizes(fine, coarse))


def fx_noise(img, scale=260, fine=1, coarse=64, seed=7, contrast=1.6):
    """Organic patches of low resolution drifting through the picture."""
    w, h = img.size
    n = value_noise(h, w, scale, int(seed))
    level = np.clip((n - 0.5) * contrast + 0.5, 0, 1)
    return modulated_mosaic(img, level, block_sizes(fine, coarse))


def fx_luma(img, fine=2, coarse=48, invert=0):
    """Resolution follows brightness: shadows go coarse, highlights stay fine."""
    blur = img.resize((64, max(1, int(64 * img.height / img.width))), Image.BOX)
    blur = blur.resize(img.size, Image.BICUBIC)
    level = 1 - luminance(np.asarray(blur, dtype=np.float32)) / 255
    if int(invert):
        level = 1 - level
    return modulated_mosaic(img, level, block_sizes(fine, coarse))


def fx_sort(img, lo=60, hi=200, axis=0, reverse=0):
    """Pixel sorting: runs of mid-tone pixels are sorted by brightness."""
    a = np.asarray(img)
    if int(axis) == 1:
        a = a.transpose(1, 0, 2)
    lum = luminance(a.astype(np.float32))
    mask = (lum >= lo) & (lum <= hi)
    prev = np.zeros_like(mask)
    prev[:, 1:] = mask[:, :-1]
    # every unmasked pixel is its own segment; a masked run shares one id
    starts = ~mask | (mask & ~prev)
    seg = np.cumsum(starts, axis=1).astype(np.int64)
    key = lum.astype(np.int64)
    if int(reverse):
        key = 255 - key
    order = np.argsort(seg * 512 + key, axis=1, kind="stable")
    out = np.take_along_axis(a, order[..., None], axis=1)
    if int(axis) == 1:
        out = out.transpose(1, 0, 2)
    return Image.fromarray(np.ascontiguousarray(out))


def fx_rgbshift(img, amount=6, bands=0, seed=3):
    """Chromatic split: red and blue drift apart; bands>0 adds glitch slices."""
    a = np.asarray(img).copy()
    s = int(amount)
    a[..., 0] = np.roll(a[..., 0], s, axis=1)
    a[..., 2] = np.roll(a[..., 2], -s, axis=1)
    rng = np.random.default_rng(int(seed))
    h = a.shape[0]
    for _ in range(int(bands)):
        y = rng.integers(0, h)
        bh = rng.integers(4, max(5, h // 30))
        a[y:y + bh] = np.roll(a[y:y + bh], rng.integers(-s * 8, s * 8 + 1), axis=1)
    return Image.fromarray(a)


def fx_dither(img, colors=8, scale=3):
    """Low-res, reduced palette with Floyd–Steinberg dithering (palette from the image)."""
    w, h = img.size
    scale = max(1, int(scale))
    small = img.resize((w // scale, h // scale), Image.BOX)
    q = small.quantize(colors=int(colors), method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.FLOYDSTEINBERG)
    return q.convert("RGB").resize((w, h), Image.NEAREST)


def fx_halftone(img, cell=14, gap=1.0):
    """Coloured dot screen: dot size tracks the brightness of each cell."""
    w, h = img.size
    cell = int(cell)
    small = np.asarray(img.resize((w // cell, h // cell), Image.BOX))
    out = Image.new("RGB", (w, h), (245, 240, 230))
    d = ImageDraw.Draw(out)
    for j in range(small.shape[0]):
        for i in range(small.shape[1]):
            c = tuple(int(v) for v in small[j, i])
            r = cell / 2 * gap * (1 - luminance(np.array(c, dtype=np.float32)) / 255) ** 0.5 * 1.3
            cx, cy = i * cell + cell / 2, j * cell + cell / 2
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c)
    return out


# ---------------------------------------------------------------- colour sets
#
# Pixels are grouped into k colour sets with k-means in CIE Lab space (a
# perceptual space: L = lightness, a/b = colour). A transformation moves each
# set's *centre* to a new colour, and every pixel moves by the same offset as
# its set, so the variation inside each brushstroke survives. By default the
# lightness (L) is untouched: the value structure — drawing, chiaroscuro,
# modelling — stays exactly as the painter left it; only colour changes.

_M = np.array([[0.4124564, 0.3575761, 0.1804375],
               [0.2126729, 0.7151522, 0.0721750],
               [0.0193339, 0.1191920, 0.9503041]], dtype=np.float32)
_M_INV = np.linalg.inv(_M).astype(np.float32)
_WHITE = np.array([0.95047, 1.0, 1.08883], dtype=np.float32)
_EPS, _KAPPA = 216 / 24389, 24389 / 27


def rgb_to_lab(a):
    c = a.astype(np.float32) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = c @ _M.T / _WHITE
    f = np.where(xyz > _EPS, np.cbrt(xyz), (_KAPPA * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16,
                     500 * (f[..., 0] - f[..., 1]),
                     200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > _EPS, f ** 3, (116 * f - 16) / _KAPPA) * _WHITE
    c = np.clip(xyz @ _M_INV.T, 0, 1)
    c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    return (np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8)


def hex_to_lab(h):
    h = h.lstrip("#")
    return rgb_to_lab(np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)]]))[0]


def lab_to_hex(lab):
    return "#" + "".join(f"{v:02x}" for v in lab_to_rgb(lab[None])[0])


def kmeans(x, k, seed=1, iters=30):
    """Plain k-means (k-means++ seeding). Centres are sorted dark -> light."""
    rng = np.random.default_rng(seed)
    c = [x[rng.integers(len(x))]]
    for _ in range(1, k):
        d = ((x[:, None] - np.array(c)[None]) ** 2).sum(-1).min(1)
        c.append(x[rng.choice(len(x), p=d / d.sum())])
    c = np.array(c)
    for _ in range(iters):
        lbl = ((x[:, None] - c[None]) ** 2).sum(-1).argmin(1)
        new = np.array([x[lbl == i].mean(0) if np.any(lbl == i) else c[i] for i in range(k)])
        done = np.allclose(new, c, atol=0.05)
        c = new
        if done:
            break
    return c[np.argsort(c[:, 0])]


def colour_sets(lab, k, seed=1, samples=60000):
    flat = lab.reshape(-1, 3)
    rng = np.random.default_rng(seed)
    pick = rng.choice(len(flat), min(samples, len(flat)), replace=False)
    return kmeans(flat[pick], int(k), seed)


def set_weights(lab, centres, soft):
    """HxWxk membership. soft=0: hard sets; soft>0 (Lab units): smooth edges."""
    d2 = np.stack([((lab - c) ** 2).sum(-1) for c in centres], -1)
    if soft <= 0:
        return (d2 == d2.min(-1, keepdims=True)).astype(np.float32)
    w = np.exp(-(d2 - d2.min(-1, keepdims=True)) / (2 * soft ** 2))
    return w / w.sum(-1, keepdims=True)


def parse_sets(spec, k):
    """'0;3;5' -> [0, 3, 5];  '' or 'all' -> every set."""
    spec = str(spec).strip()
    if spec in ("", "all"):
        return list(range(int(k)))
    return [int(v) for v in spec.split(";") if v != ""]


def fx_recolor(img, k=8, shuffle=1, seed=1, palette="", map="", pick="all",
               rest=0.0, hue=0.0, sat=1.0, keep_l=1.0, soft=6.0, amount=1.0):
    """Group pixels into k colour sets and recolour them; lightness/brushwork kept.

    shuffle=1        sets swap colours with each other (seed picks the swap)
    palette=path     take the k colours of another image (matched dark->light)
    map=2:c83a2a;5:1f4e79   send set 2 and set 5 to those exact colours
    hue=deg, sat=x   rotate / scale the colour of the picked sets
    pick=0;3         only these sets change (see the `clusters` effect for numbers)
    rest=0..1        desaturate every set that is NOT picked (1 = greyscale)
    keep_l=0..1      how much of the original lightness to keep (1 = all)
    soft             edge softness between sets (0 = hard borders)
    """
    lab = rgb_to_lab(np.asarray(img))
    centres = colour_sets(lab, k, int(seed))
    k = len(centres)
    picked = parse_sets(pick, k)
    targets = centres.copy()

    if palette:
        ref = rgb_to_lab(np.asarray(load(Path(palette), 900)))
        targets = colour_sets(ref, k, int(seed))
    elif map:
        pass
    elif int(shuffle):
        perm = np.random.default_rng(int(seed) + 101).permutation(picked)
        targets[picked, 1:] = centres[perm, 1:]
    for pair in filter(None, str(map).split(";")):
        i, _, h = pair.partition(":")
        targets[int(i)] = hex_to_lab(h)
    if hue or sat != 1:
        t = np.radians(hue)
        a, b = targets[:, 1].copy(), targets[:, 2].copy()
        targets[:, 1] = (a * np.cos(t) - b * np.sin(t)) * sat
        targets[:, 2] = (a * np.sin(t) + b * np.cos(t)) * sat

    unpicked = [i for i in range(k) if i not in picked]
    targets[unpicked] = centres[unpicked]
    delta = targets - centres
    delta[:, 0] *= 1 - keep_l

    w = set_weights(lab, centres, soft)
    out = lab + amount * (w @ delta)
    if rest and unpicked:
        out[..., 1:] *= 1 - rest * w[..., unpicked].sum(-1, keepdims=True)
    return Image.fromarray(lab_to_rgb(out))


def fx_clusters(img, k=8, seed=1):
    """Diagnostic: the k colour sets as flat areas, with a numbered swatch bar."""
    lab = rgb_to_lab(np.asarray(img))
    centres = colour_sets(lab, k, int(seed))
    lbl = set_weights(lab, centres, 0).argmax(-1)
    flat = Image.fromarray(lab_to_rgb(centres[lbl]))
    w, h = img.size
    bar = max(60, h // 12)
    out = Image.new("RGB", (w, h + bar), (18, 18, 18))
    out.paste(flat, (0, 0))
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=max(12, bar // 4))
    sw = w / len(centres)
    for i, c in enumerate(centres):
        share = (lbl == i).mean() * 100
        x0 = int(i * sw)
        d.rectangle((x0, h, int((i + 1) * sw), h + bar), fill=lab_to_hex(c))
        ink = (0, 0, 0) if c[0] > 55 else (255, 255, 255)
        d.text((x0 + 8, h + 6), f"{i}  {lab_to_hex(c)}\n{share:.0f}%", fill=ink, font=font)
    return out


def fx_clusterfx(img, k=8, pick="0", fx="pixelate", invert=0, soft=6.0, seed=1, **sub):
    """Apply another effect only inside chosen colour sets (sub_<param> passes params).

    e.g. clusterfx:pick=0;1,fx=quadtree,sub_coarse=64  -> only the darkest sets dissolve
    """
    lab = rgb_to_lab(np.asarray(img))
    centres = colour_sets(lab, k, int(seed))
    mask = set_weights(lab, centres, soft)[..., parse_sets(pick, len(centres))].sum(-1)
    if int(invert):
        mask = 1 - mask
    params = {key[4:]: v for key, v in sub.items() if key.startswith("sub_")}
    other = np.asarray(EFFECTS[fx](img, **params), dtype=np.float32)
    base = np.asarray(img, dtype=np.float32)
    return Image.fromarray((base + (other - base) * mask[..., None]).astype(np.uint8))


EFFECTS = {
    "pixelate": fx_pixelate,
    "quadtree": fx_quadtree,
    "radial": fx_radial,
    "bands": fx_bands,
    "noise": fx_noise,
    "luma": fx_luma,
    "sort": fx_sort,
    "rgbshift": fx_rgbshift,
    "dither": fx_dither,
    "halftone": fx_halftone,
    "recolor": fx_recolor,
    "clusters": fx_clusters,
    "clusterfx": fx_clusterfx,
}

SHEET_SKIP = {"clusters"}  # diagnostics: different output size


# ---------------------------------------------------------------- CLI

def number(v):
    for cast in (int, float):
        try:
            return cast(v)
        except ValueError:
            pass
    return v  # paths, colour maps, set lists stay strings


def parse_fx(spec):
    """'radial:cx=0.3,coarse=128' -> ('radial', {'cx': 0.3, 'coarse': 128})"""
    name, _, args = spec.partition(":")
    if name not in EFFECTS:
        sys.exit(f"unknown effect '{name}'. Available: {', '.join(EFFECTS)}")
    params = {}
    for pair in filter(None, args.split(",")):
        k, _, v = pair.partition("=")
        params[k.strip()] = number(v.strip())
    return name, params


def apply_chain(img, chain):
    for name, params in chain:
        img = EFFECTS[name](img, **params)
    return img


def collect(inputs):
    files = []
    for p in map(Path, inputs):
        if p.is_dir():
            files += sorted(f for f in p.iterdir() if f.suffix.lower() in IMAGE_EXTS)
        elif p.is_file():
            files.append(p)
        else:
            sys.exit(f"not found: {p}")
    return files


def load(path, max_side):
    img = Image.open(path).convert("RGB")
    if max_side and max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    return img


def contact_sheet(img, title, thumb=420):
    """One tile per effect (default params) so you can pick a direction."""
    tiles = [("original", img)] + [(n, f(img)) for n, f in EFFECTS.items()
                                  if n not in SHEET_SKIP]
    ratio = img.height / img.width
    tw, th = thumb, int(thumb * ratio)
    cols = 4
    rows = -(-len(tiles) // cols)
    pad, label = 12, 26
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + label + pad) + pad + 30), (18, 18, 18))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    d.text((pad, 10), title, fill=(230, 230, 230), font=font)
    for k, (name, t) in enumerate(tiles):
        x = pad + (k % cols) * (tw + pad)
        y = 30 + pad + (k // cols) * (th + label + pad)
        sheet.paste(t.resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x, y + th + 6), name, fill=(200, 200, 200), font=font)
    return sheet


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="*", help="image files or folders")
    ap.add_argument("-o", "--out", default="output", help="output folder (default: output/)")
    ap.add_argument("--fx", action="append", default=[], help="effect spec, repeatable to chain")
    ap.add_argument("--max-side", type=int, default=0,
                    help="downscale input so its longest side is at most N px (fast previews)")
    ap.add_argument("--sheet", action="store_true", help="render a contact sheet of all effects")
    ap.add_argument("--list", action="store_true", help="list effects and their parameters")
    ap.add_argument("--format", default="png", choices=["png", "jpg", "tif"])
    args = ap.parse_args()

    if args.list:
        import inspect
        for n, f in EFFECTS.items():
            params = list(inspect.signature(f).parameters.values())[1:]
            sig = ", ".join(f"{p.name}={p.default!r}" for p in params
                            if p.kind is not p.VAR_KEYWORD)
            print(f"  {n:<10} {sig}\n  {'':<10} {f.__doc__.splitlines()[0]}\n")
        return
    if not args.inputs:
        ap.error("give at least one image or folder")
    if not args.fx and not args.sheet:
        args.fx = ["quadtree"]

    chain = [parse_fx(s) for s in args.fx]
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = "+".join(n for n, _ in chain)

    for path in collect(args.inputs):
        img = load(path, args.max_side)
        if args.sheet:
            dest = out_dir / f"{path.stem}_sheet.jpg"
            contact_sheet(load(path, 1400), path.name).save(dest, quality=90)
        else:
            dest = out_dir / f"{path.stem}_{tag}.{args.format}"
            result = apply_chain(img, chain)
            result.save(dest, **({"quality": 95} if args.format == "jpg" else {}))
        print(f"{path.name} -> {dest}")


if __name__ == "__main__":
    main()
