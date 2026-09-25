# pixelfx

Local, offline tool that modulates the pixels and resolution of high-res images.

## Setup

```bash
cd tools/pixelfx
python3 -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
```

Put your images in `input/`. Results go to `output/`. Both folders are gitignored.

## Usage

```bash
python pixelfx.py --list                        # every effect + its parameters
python pixelfx.py input/ --sheet                # contact sheet: all effects per image
python pixelfx.py input/ --fx quadtree          # apply one effect to a whole folder
python pixelfx.py input/toorop.jpg --fx "radial:cx=0.6,cy=0.35,coarse=128"
python pixelfx.py input/ --fx quadtree --fx "rgbshift:amount=4"   # chain effects
python pixelfx.py input/ --fx noise --max-side 1200 --format jpg  # fast preview
```

Effect parameters use the form `name:key=value,key=value`.

## Effects

| effect     | what it does |
|------------|--------------|
| `pixelate` | uniform mosaic |
| `quadtree` | **adaptive resolution**: detailed areas stay sharp, flat areas collapse into big blocks |
| `radial`   | **foveated**: full resolution at a focus point (`cx`,`cy`), dissolving outward |
| `bands`    | stripes of rising/falling resolution (`axis=0` horizontal, `1` vertical) |
| `noise`    | organic drifting patches of low resolution (`seed` changes the pattern) |
| `luma`     | resolution follows brightness (`invert=1` flips it) |
| `sort`     | pixel sorting of mid-tones (`lo`,`hi` brightness range, `axis`) |
| `rgbshift` | chromatic channel split, `bands>0` adds glitch slices |
| `dither`   | reduced palette taken from the image, Floyd–Steinberg dithered |
| `halftone` | coloured dot screen |

`radial`, `bands`, `noise` and `luma` all run on the same engine
(`modulated_mosaic`): any 0–1 map picks a block size per pixel, from `fine`
to `coarse`. To make a new effect, write a function that builds a map.

## Colour sets: recolour without losing the painting

`recolor`, `clusters` and `clusterfx` group pixels into `k` colour sets
(k-means in CIE Lab, a perceptual colour space), then transform whole sets.

To keep the artist's work intact:
- **lightness is never touched** by default (`keep_l=1`), so drawing, modelling
  and chiaroscuro stay exactly as painted: only hue and saturation change;
- each pixel moves by its set's offset instead of being flattened to one
  colour, so the variation inside every brushstroke, and even the cracks in
  the paint, survives;
- set borders are soft (`soft=6`), so there are no cut-out edges.

Workflow:

```bash
# 1. see the sets and their numbers (0 = darkest)
python pixelfx.py input/de-hooch.jpg --fx clusters

# 2. transform them
python pixelfx.py input/de-hooch.jpg --fx "recolor:palette=input/toorop.jpg"   # borrow another painting's colours
python pixelfx.py input/eelkema.jpg  --fx "recolor:shuffle=1,seed=4"           # sets swap colours
python pixelfx.py input/de-hooch.jpg --fx "recolor:map=5:1f6fb5;3:b0402a"      # set 5 -> blue, set 3 -> red
python pixelfx.py input/de-hooch.jpg --fx "recolor:pick=5,rest=1,shuffle=0"    # spot colour: only set 5 keeps colour
python pixelfx.py input/de-hooch.jpg --fx "recolor:pick=2;4,hue=140"           # rotate hue of two sets
python pixelfx.py input/de-hooch.jpg --fx "clusterfx:pick=0;1;2,fx=quadtree"   # dissolve only the dark sets
```

`clusterfx` runs any other effect only inside the chosen sets; pass settings
to that effect with a `sub_` prefix, e.g. `fx=pixelate,sub_block=40`.
