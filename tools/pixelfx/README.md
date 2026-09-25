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
