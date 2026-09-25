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
}


# ---------------------------------------------------------------- CLI

def parse_fx(spec):
    """'radial:cx=0.3,coarse=128' -> ('radial', {'cx': 0.3, 'coarse': 128})"""
    name, _, args = spec.partition(":")
    if name not in EFFECTS:
        sys.exit(f"unknown effect '{name}'. Available: {', '.join(EFFECTS)}")
    params = {}
    for pair in filter(None, args.split(",")):
        k, _, v = pair.partition("=")
        params[k.strip()] = float(v) if "." in v else int(v)
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
    tiles = [("original", img)] + [(n, f(img)) for n, f in EFFECTS.items()]
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
            sig = ", ".join(f"{p.name}={p.default}" for p in list(inspect.signature(f).parameters.values())[1:])
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
