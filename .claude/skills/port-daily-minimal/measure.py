"""Measure a Daily Minimal source image, or a render of a port, in pixels.

  python3 measure.py IMG bbox                  bounds of everything unlike the background
  python3 measure.py IMG row Y [X0 X1]         centers of the marks crossing row Y
  python3 measure.py IMG col X [Y0 Y1]         centers of the marks crossing column X
  python3 measure.py IMG color X Y             RGB at a pixel

The background is sampled from the top-left corner. A pixel is part of a mark
when its grey level differs from the background by more than --th (default 60).
The source images carry a caption near the bottom; bbox ignores the bottom 20%.
"""
import sys

import numpy as np
from PIL import Image


def main():
    args = sys.argv[1:]
    th = 60
    if '--th' in args:
        i = args.index('--th')
        th = float(args[i + 1])
        del args[i : i + 2]
    path, cmd, *rest = args
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
    grey = rgb.mean(axis=2)
    bg = grey[5, 5]
    mark = np.abs(grey - bg) > th
    h, w = grey.shape
    print(f'size {w}x{h}  background grey {bg:.0f}')

    if cmd == 'bbox':
        ys, xs = np.where(mark[: int(h * 0.8)])
        print(f'x {xs.min()}..{xs.max()}  y {ys.min()}..{ys.max()}  ({xs.max() - xs.min() + 1}x{ys.max() - ys.min() + 1})')
    elif cmd in ('row', 'col'):
        at = int(rest[0])
        lo = int(rest[1]) if len(rest) > 1 else 0
        hi = int(rest[2]) if len(rest) > 2 else (w if cmd == 'row' else h)
        line = mark[at, lo:hi] if cmd == 'row' else mark[lo:hi, at]
        centers, i = [], 0
        while i < len(line):
            if line[i]:
                j = i
                while j < len(line) and line[j]:
                    j += 1
                centers.append(lo + (i + j - 1) / 2)
                i = j
            else:
                i += 1
        print(f'{len(centers)} marks:', ' '.join(f'{c:g}' for c in centers))
        if len(centers) > 1:
            print('gaps:', ' '.join(f'{d:g}' for d in np.diff(centers)))
    elif cmd == 'color':
        x, y = int(rest[0]), int(rest[1])
        r, g, b = rgb[y, x]
        print(f'rgb({r}, {g}, {b})  #{r:02x}{g:02x}{b:02x}')
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
