# -*- coding: utf-8 -*-
"""
Gera os ícones PNG do PWA (192 e 512) com gradiente anil->roxo,
sem dependências externas (zlib + struct). Executar em qualquer
versão de Python:  python make_icons.py
"""

import struct
import zlib
from pathlib import Path


def make_png(size, a, b, c):
    """Gradiente diagonal de (a,b,c) para roxo mais escuro."""
    w = h = size
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            t = (x + y) / (w + h)
            r = int(a[0] + (b[0] - a[0]) * t)
            g = int(a[1] + (b[1] - a[1]) * t)
            bl = int(a[2] + (b[2] - a[2]) * t)
            # caixa "C2" branca central
            if (0.36 <= x / w <= 0.64) and (0.30 <= y / h <= 0.70):
                r, g, bl = 255, 255, 255
            row += bytes([r, g, bl, 255])
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        payload = tag + data
        return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    return png


def main():
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(exist_ok=True)
    for size in (192, 512):
        p = out / f"icon-{size}.png"
        p.write_bytes(make_png(size, (42, 33, 96), (107, 47, 163), (20, 8, 40)))
        print(f"OK {p} ({size}x{size})")


if __name__ == "__main__":
    main()