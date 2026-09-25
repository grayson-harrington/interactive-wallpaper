"""Lay a port's render over its source image to check fidelity.

  python3 overlay.py SOURCE RENDER OUT.png [--shift DX DY] [--crop X0 Y0 X1 Y1]

Red is the source, cyan is the render; where they agree the lines turn white
or grey. --shift moves the source (e.g. when the port centers artwork the
original placed above its caption). The source's caption, the bottom 20%, is
dropped. Also writes OUT-side.png with the two side by side.
"""
import sys

from PIL import Image


def main():
    args = sys.argv[1:]
    dx = dy = 0
    crop = None
    if '--shift' in args:
        i = args.index('--shift')
        dx, dy = int(args[i + 1]), int(args[i + 2])
        del args[i : i + 3]
    if '--crop' in args:
        i = args.index('--crop')
        crop = tuple(int(v) for v in args[i + 1 : i + 5])
        del args[i : i + 5]
    src_path, render_path, out = args

    render = Image.open(render_path).convert('RGB')
    src = Image.open(src_path).convert('RGB').resize(render.size)
    bg = src.getpixel((5, 5))
    shifted = Image.new('RGB', src.size, bg)
    shifted.paste(src.crop((0, 0, src.width, int(src.height * 0.8))), (dx, dy))

    merged = Image.merge('RGB', (shifted.getchannel(0), render.getchannel(1), render.getchannel(2)))
    if crop:
        merged, shifted, render = merged.crop(crop), shifted.crop(crop), render.crop(crop)
    merged.save(out)

    side = Image.new('RGB', (shifted.width * 2, shifted.height))
    side.paste(shifted, (0, 0))
    side.paste(render, (shifted.width, 0))
    side.save(out.rsplit('.', 1)[0] + '-side.png')
    print(out)


if __name__ == '__main__':
    main()
