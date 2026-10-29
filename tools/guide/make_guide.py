# -*- coding: utf-8 -*-
"""
ボスマップへの入り方の案内の絵（額縁に飾る画像）を作る。マップ 4×3 枚ぶん = 512×384
  python tools/guide/make_guide.py
  → guide/boss_guide.png
ImageFrame（プラグイン）がこの画像を GitHub の raw から読み込む（uf_27_guide.sk の uf_guideurl）。
マップの色数が少ないので、べた塗りの絵にしてある。絵はすべてここで描く（Mojang の絵は使わない。このリポジトリは公開なので）
"""
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'guide', 'boss_guide.png')
FONTS = ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 'C:/Windows/Fonts/meiryo.ttc', 'C:/Windows/Fonts/YuGothB.ttc']
W, H = 512, 384
BG = (20, 18, 26)


def font(size):
    for p in FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit('日本語のフォントが見つからない')


def text_c(d, cx, y, s, f, fill):
    w = d.textlength(s, font=f)
    d.text((cx - w / 2, y), s, font=f, fill=fill)


def icon_obsidian(d, x, y, s=96):
    # 泣く黒曜石: 暗い紫に、紫の涙
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=(27, 11, 46))
    r = random.Random(1)
    g = s // 8
    for i in range(8):
        for j in range(8):
            k = r.random()
            if k < 0.25:
                d.rectangle([x + i * g, y + j * g, x + i * g + g - 1, y + j * g + g - 1], fill=(38, 16, 62))
            elif k < 0.35:
                d.rectangle([x + i * g, y + j * g, x + i * g + g - 1, y + j * g + g - 1], fill=(138, 58, 217))
    d.rectangle([x, y, x + s - 1, y + s - 1], outline=(10, 4, 20), width=3)


def icon_deepslate(d, x, y, s=96):
    # 強化深層岩: 灰色の石に、上の面の線
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=(62, 66, 74))
    r = random.Random(2)
    g = s // 8
    for i in range(8):
        for j in range(8):
            k = r.random()
            if k < 0.3:
                d.rectangle([x + i * g, y + j * g, x + i * g + g - 1, y + j * g + g - 1], fill=(48, 51, 58))
            elif k < 0.4:
                d.rectangle([x + i * g, y + j * g, x + i * g + g - 1, y + j * g + g - 1], fill=(88, 94, 104))
    d.rectangle([x + 8, y + 8, x + s - 9, y + s - 9], outline=(190, 196, 206), width=4)
    d.rectangle([x, y, x + s - 1, y + s - 1], outline=(24, 25, 30), width=3)


def icon_skull(d, x, y, s=96):
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=(198, 42, 58))
    p = 14
    ox, oy = x + (s - 5 * p) // 2, y + (s - 5 * p) // 2
    rows = ['.###.', '#####', '#.#.#', '.###.', '.#.#.']
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            col = (245, 245, 245) if c == '#' else (198, 42, 58)
            if j == 2 and c == '.':
                col = (20, 18, 26)
            d.rectangle([ox + i * p, oy + j * p, ox + i * p + p - 1, oy + j * p + p - 1], fill=col)
    d.rectangle([x, y, x + s - 1, y + s - 1], outline=(90, 12, 22), width=3)


def icon_crown(d, x, y, s=96):
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=(91, 63, 138))
    p = 14
    ox, oy = x + (s - 5 * p) // 2, y + (s - 5 * p) // 2 + 4
    rows = ['#.#.#', '#####', '#####', '.....', '.....']
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c == '#':
                d.rectangle([ox + i * p, oy + j * p, ox + i * p + p - 1, oy + j * p + p - 1], fill=(232, 192, 74))
    d.rectangle([ox + 2 * p + 2, oy + 2 * p + 2, ox + 3 * p - 3, oy + 3 * p - 3], fill=(255, 91, 214))
    d.rectangle([x, y, x + s - 1, y + s - 1], outline=(40, 24, 70), width=3)


def mouse(d, x, y):
    # マウス（右ボタンが赤）
    d.rounded_rectangle([x, y, x + 44, y + 76], radius=18, fill=(200, 204, 212), outline=(60, 62, 70), width=3)
    d.rectangle([x + 22, y + 3, x + 41, y + 30], fill=(214, 47, 58))
    d.line([x + 22, y + 3, x + 22, y + 34], fill=(60, 62, 70), width=3)
    d.line([x + 3, y + 34, x + 41, y + 34], fill=(60, 62, 70), width=3)
    # クリックの線
    for dx, dy in ((54, 2), (58, 14), (54, 26)):
        d.line([x + dx, y + dy, x + dx + 12, y + dy - (6 if dy < 10 else (0 if dy < 20 else -6))], fill=(255, 224, 80), width=3)


def arrow(d, x0, x1, cy):
    c = (90, 214, 90)
    d.rectangle([x0, cy - 9, x1 - 30, cy + 9], fill=c)
    d.polygon([(x1 - 34, cy - 30), (x1, cy), (x1 - 34, cy + 30)], fill=c)


def row(d, y, icon, num, title, sub, hint, room, rtitle, rsub, f):
    icon(d, 28, y)
    mouse(d, 168, y + 6)
    text_c(d, 190, y + 88, '右クリック', f['s'], (255, 224, 80))
    arrow(d, 262, 352, y + 48)
    room(d, 388, y)
    text_c(d, 76, y + 100, title, f['m'], (255, 255, 255))
    text_c(d, 76, y + 122, sub, f['s'], (160, 166, 178))
    if hint:
        text_c(d, 76, y + 142, hint, f['s'], (255, 150, 150))
    text_c(d, 436, y + 100, rtitle, f['m'], (255, 255, 255))
    text_c(d, 436, y + 122, rsub, f['s'], (160, 166, 178))
    d.ellipse([6, y - 4, 34, y + 24], fill=(232, 192, 74))
    text_c(d, 20, y - 3, num, f['m'], (20, 18, 26))


def main():
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    f = {'t': font(30), 'm': font(17), 's': font(14)}
    d.rectangle([0, 0, W - 1, H - 1], outline=(232, 192, 74), width=4)
    text_c(d, W / 2, 14, 'ボスマップへの入り方', f['t'], (232, 192, 74))
    row(d, 58, icon_obsidian, '1', '中ボスの壁', '（泣く黒曜石）', '', icon_skull, '中ボスと戦う', '（上空の闘技場）', f)
    row(d, 204, icon_deepslate, '2', '階段の壁', '（強化深層岩）', '中ボスを倒した後に', icon_crown, 'ボスと戦う', '（勝つと次の階へ）', f)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT)
    print(OUT, im.size)


if __name__ == '__main__':
    main()
