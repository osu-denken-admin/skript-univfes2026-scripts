# -*- coding: utf-8 -*-
"""
武具の絵（32×32）。名前に合わせて 1 つずつ形から描く（build.py が使う）
  剣・斧: 柄（左下）から切っ先（右上）への向きを u、それに直角の向きを v とした座標で形を決める
  弓: 曲線からの距離で太さを決める
  防具・銃: 図形（長方形・多角形・楕円）を重ねる。防具は左右対称
"""
import io
import math

from PIL import Image

S = 32
OUT = '#14121a'


def hexc(s):
    if isinstance(s, tuple):
        return s
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def mix(a, b, t):
    a, b = hexc(a), hexc(b)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


class Canvas:
    def __init__(self):
        self.px = {}

    def set(self, x, y, c):
        if 0 <= x < S and 0 <= y < S and c is not None:
            self.px[(x, y)] = hexc(c)

    def get(self, x, y):
        return self.px.get((x, y))

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(S):
            for x in range(S):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                    self.set(x, y, c)

    def poly(self, pts, c):
        for y in range(S):
            for x in range(S):
                if inside(pts, x + 0.5, y + 0.5):
                    self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1))
        for i in range(n + 1):
            self.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def mirror(self):
        for (x, y), c in list(self.px.items()):
            if x < S // 2:
                self.px[(S - 1 - x, y)] = c

    def outline(self, c=OUT, diag=False):
        col = hexc(c)
        nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if diag:
            nb += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
        add = set()
        for (x, y) in self.px:
            for dx, dy in nb:
                p = (x + dx, y + dy)
                if p not in self.px and 0 <= p[0] < S and 0 <= p[1] < S:
                    add.add(p)
        for p in add:
            self.px[p] = col
        return self

    def png(self):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        for (x, y), c in self.px.items():
            im.putpixel((x, y), c)
        b = io.BytesIO()
        im.save(b, 'PNG')
        return b.getvalue()


def inside(pts, x, y):
    n = len(pts)
    ok = False
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            ok = not ok
        j = i
    return ok


# ------------------------------------------------------------
# 剣・斧（u: 柄の端 0 → 切っ先、v: 右下向きが +）
# ------------------------------------------------------------
O = (1.5, 30.5)
# 柄の端から右上の角までを u = 0〜33 にする（32×32 いっぱいに描く）
K = 33 / (29.0 * math.sqrt(2))
D = (1 / math.sqrt(2), -1 / math.sqrt(2))
N = (1 / math.sqrt(2), 1 / math.sqrt(2))


def uv(x, y):
    px, py = x + 0.5 - O[0], y + 0.5 - O[1]
    return (px * D[0] + py * D[1]) * K, (px * N[0] + py * N[1]) * K


def diag(fn, outline=OUT):
    """fn(u, v) → 色 または None"""
    cv = Canvas()
    for y in range(S):
        for x in range(S):
            u, v = uv(x, y)
            cv.set(x, y, fn(u, v))
    return cv.outline(outline)


def shade(v, hi, mid, lo, w):
    """刃の横の位置で明るさを変える（左上が明るい）"""
    if v < -w * 0.35:
        return hi
    if v > w * 0.35:
        return lo
    return mid


def hilt(u, v, grip='#2a2a33', wrap='#4a4a58', guard='#c9a227', guard_w=3.6, pommel='#c9a227', gu=(0, 9)):
    """柄・つば・柄頭。当たらなければ None"""
    g0, g1 = gu
    if u < g0 + 1.8 and abs(v) <= 1.7 and u >= g0:
        return pommel
    if g0 + 1.8 <= u < g1 - 1.4 and abs(v) <= 1.05:
        return wrap if int(u * 1.4) % 2 == 0 else grip
    if g1 - 1.4 <= u < g1 and abs(v) <= guard_w:
        return mix(guard, '#ffffff', 0.35) if v < 0 else guard
    return None


def w_pointer(u, v):
    # さしぼうソード: 伸び縮みする指し棒。3 段の銀の筒、つなぎ目の輪、先に赤い玉、黒いゴムの持ち手
    h = hilt(u, v, grip='#1c1c22', wrap='#2c2c36', guard='#b8bec6', guard_w=1.7, pommel='#1c1c22')
    if h:
        return h
    segs = [(9, 17, 1.35), (17, 24.5, 1.05), (24.5, 31, 0.8)]
    for a, b, w in segs:
        if a <= u < b and abs(v) <= w:
            if b - u < 0.9:
                return '#7a828c'
            return shade(v, '#ffffff', '#c8ced6', '#8a929c', w)
    if (u - 32.2) ** 2 + v ** 2 <= 1.9 ** 2:
        return '#ff6b6b' if v < -0.4 and u < 32.2 else '#d62f2f'
    return None


def w_dictionary(u, v):
    # じしょブレード: 分厚い辞書が刃。赤茶の表紙、紙の小口に線、金の題字、色つきのつめ（あかさたな）
    h = hilt(u, v, grip='#4a2a14', wrap='#6b3f1f', guard='#c9a227', guard_w=4.6, pommel='#c9a227')
    if h:
        return h
    if 9 <= u < 31.5 and abs(v) <= 4.6:
        if u > 30.3 or abs(v) > 3.6:
            # 表紙
            if 12.5 < u < 13.6 or 27 < u < 28.1:
                return '#e8c04a'
            return '#9a2424' if v < 0 else '#6e1414'
        # 紙の小口（線）
        if 2.4 < v <= 3.6 and int(u) % 4 == 0:
            return ['#e23b3b', '#3a8fd6', '#5cc06b', '#f2c230'][int(u) // 4 % 4]
        return '#d9cfae' if int((v + 5) * 2.2) % 2 == 0 else '#fbf6e6'
    return None


def w_flask(u, v):
    # フラスコアックス: 木の柄に三角フラスコ（コルクの栓・細い首・広がる胴・平らな底）。底（刃の側）に緑の薬と泡
    if 0 <= u < 33 and abs(v) <= 1.0:
        if u < 2:
            return '#4a4a4a'
        return '#a0703c' if v < 0 else '#7a4a24'
    d = -v
    cu = 18.5
    if 1.0 < d <= 2.8 and abs(u - cu) <= 1.5:
        return '#c08850' if u < cu else '#8a5a2a'  # コルク
    if 2.8 < d <= 3.6 and abs(u - cu) <= 2.0:
        return '#7fc8da'  # 口のふち
    if 3.6 < d <= 10.5:
        half = 1.3 if d < 5.4 else 1.3 + (d - 5.4) * 0.85
        if abs(u - cu) <= half:
            if half - abs(u - cu) < 0.75 or d > 9.8:
                return '#4a9fb8'
            if d > 7.0:
                for bu, bd, r in ((17.0, 8.7, 0.7), (20.2, 9.2, 0.55), (18.6, 7.8, 0.45)):
                    if (u - bu) ** 2 + (d - bd) ** 2 < r * r:
                        return '#d8ffe0'
                return '#46d468' if u < cu + 1.2 else '#2a9a46'
            if abs(u - (cu - half + 1.5)) < 0.45 and d > 5:
                return '#ffffff'
            return '#e2f8ff'
    return None


def w_lan(u, v):
    # LANケーブルソード: 青いケーブルの刃（より線の模様）、先に透明の RJ45 コネクタと金の端子
    h = hilt(u, v, grip='#3a3f46', wrap='#5a6068', guard='#9aa3ad', guard_w=3.0, pommel='#2f6fd6')
    if h:
        return h
    if 9 <= u < 24 and abs(v) <= 1.3:
        return '#5aa8ff' if int(u * 1.2 + v * 2) % 3 else '#2f6fd6'
    if 24 <= u < 26 and abs(v) <= 1.7:
        return '#1c3f80'
    if 26 <= u < 32 and abs(v) <= 2.4:
        if u > 30.8 and v > -1.8 and int((v + 3) * 1.5) % 2 == 0:
            return '#f2c94c'
        if v < -1.9 and 27 < u < 30:
            return '#bfe6ff'
        return '#e8f7ff' if v < 0 else '#c6e2f2'
    return None


def w_forklift(u, v):
    # フォークリフトアックス: 黒と黄色の柄、柄の先に黄色のマスト、そこから外へ 2 本の太いフォークの爪（先は細い）
    if 0 <= u < 12 and abs(v) <= 1.0:
        return '#f2c230' if int(u / 2) % 2 == 0 else '#2a2a2a'
    d = -v
    # マスト（柄より太い、黄色と黒のしま）
    if 11.5 <= u <= 31 and -1.6 <= v <= 2.4:
        return '#f2c230' if int((u - v) / 1.8) % 2 == 0 else '#2a2a2a'
    # 爪（マストの端から外へ）
    for a in (12.5, 20.5):
        if 1.6 < d <= 10.5 and a <= u <= a + 2.6:
            if d > 8.8 and u > a + 2.6 - (d - 8.8) * 1.2:
                continue
            return '#e0e6ec' if u < a + 1.0 else '#8a929c'
    # 爪をつなぐ横棒
    if 1.6 < d <= 3.4 and 12.5 <= u <= 23.1:
        return '#5a6068'
    return None


def w_pen(u, v):
    # 万年筆ブレード: 黒い軸と金の帯・クリップ、先に金のペン先（切り割りと穴）
    h = hilt(u, v, grip='#151520', wrap='#22222e', guard='#d4af37', guard_w=2.4, pommel='#d4af37')
    if h:
        return h
    if 9 <= u < 23 and abs(v) <= 1.8:
        if -1.0 < v < -0.4 and 10 < u < 21:
            return '#5a5a70'
        return '#1d1d2a'
    if 23 <= u < 24.4 and abs(v) <= 1.9:
        return '#f2d36b'
    if 24.4 <= u < 26.6 and abs(v) <= 1.3:
        return '#2a2a38'
    if 26.6 <= u < 33.5:
        w = 1.6 * (33.5 - u) / 6.9
        if abs(v) <= w + 0.2:
            if abs(v) < 0.3 and u > 28.6:
                return '#5a4410'
            if (u - 28.2) ** 2 + v ** 2 < 0.5:
                return '#5a4410'
            return '#f7dc7a' if v < 0 else '#c9a227'
    # クリップ
    if 11 <= u < 20 and -2.7 <= v < -1.9:
        return '#e8c04a'
    return None


def w_key(u, v):
    # 封鎖区画のカギ: 輪（手元）・長い軸・先の歯。さびた青銅色、赤い札
    r = math.hypot(u - 3.6, v)
    if 1.5 <= r <= 3.6:
        return '#c9a46a' if v < 0 else '#8a6430'
    if 0.3 <= u - 3.6 - 3.6 and u < 31 and abs(v) <= 1.05:
        return '#c9a46a' if v < 0 else '#8a6430'
    if 8.5 <= u < 9.8 and abs(v) <= 2.0:
        return '#a0763c'
    # 歯
    if 24 <= u < 31 and 1.0 < v <= 4.6:
        if (int(u) in (25, 26, 29, 30)) or v <= 2.8:
            return '#a0763c'
    # 札
    if -1.2 <= u <= 1.6 and 3.4 <= v <= 7.0:
        return '#d62f3a' if not (0 < u < 0.9 and 4.6 < v < 5.8) else '#fbe7c6'
    return None


def w_lord(u, v):
    # 15号館の主の剣: 幅広の黒紫の刃、赤紫に光るふち、真ん中の溝に光る点、金の翼のつばと赤い宝石
    if 0 <= u < 1.9 and abs(v) <= 1.9:
        return '#b04ad6' if (u - 0.9) ** 2 + v ** 2 < 1.3 else '#e8c04a'
    if 1.9 <= u < 7.4 and abs(v) <= 1.1:
        return '#e8c04a' if int(u * 1.5) % 2 == 0 else '#2a0f45'
    if 7.4 <= u < 9.4 and abs(v) <= 5.8 - abs(u - 8.4) * 0.6:
        if abs(v) < 1.1:
            return '#ff2a4a'
        return '#ffe07a' if v < 0 else '#c9a227'
    if 9.4 <= u < 33:
        w = 2.9 if u < 28 else 2.9 * (33 - u) / 5
        if abs(v) <= w:
            if abs(v) > w - 0.9:
                return '#ff5bd6' if v < 0 else '#c23aa8'
            if abs(v) < 0.5 and u < 27:
                return '#ffd6f6' if int(u) % 3 == 0 else '#140620'
            return '#5b2a8a' if v < 0 else '#3a1660'
    return None


def w_dealer(u, v):
    # ディーラーの剣: 金の刃にトランプの柄（♦♠♥♣）、つばは赤いカジノのチップ、柄頭はサイコロ
    if 0 <= u < 2.6 and abs(v) <= 1.9:
        if (abs(u - 1.3) < 0.45 and abs(v) < 0.45) or (abs(u - 0.5) < 0.4 and abs(v + 1.1) < 0.4) or (abs(u - 2.1) < 0.4 and abs(v - 1.1) < 0.4):
            return '#14121a'
        return '#ffffff'
    if 2.6 <= u < 7.6 and abs(v) <= 1.05:
        return '#7a1020' if int(u * 1.5) % 2 else '#d62f3a'
    r = math.hypot(u - 8.6, v)
    if r <= 3.3:
        if r > 2.4:
            return '#ffffff' if int(math.degrees(math.atan2(v, u - 8.6)) // 30) % 2 == 0 else '#d62f3a'
        return '#d62f3a'
    if 11.9 <= u < 33:
        w = 2.4 if u < 29 else 2.4 * (33 - u) / 4
        if abs(v) <= w:
            for i, cu in enumerate((15, 19.5, 24)):
                if abs(u - cu) + abs(v) * 1.1 < 1.3:
                    return '#d62f3a' if i % 2 == 0 else '#14121a'
            return shade(v, '#fff6c2', '#f2c230', '#b8860b', w)
    return None


def w_pcb(u, v):
    # 電研ブレード: 緑の基板の刃に金の配線と黒い IC、ふちは銀
    h = hilt(u, v, grip='#22262b', wrap='#3a3f46', guard='#3fd0e0', guard_w=3.2, pommel='#3fd0e0')
    if h:
        return h
    if 9 <= u < 32:
        w = 2.4 if u < 28 else 2.4 * (32 - u) / 4
        if abs(v) <= w:
            if abs(v) > w - 0.7:
                return '#e8eef2' if v < 0 else '#9aa3ad'
            if 14 <= u < 17 and abs(v) < 1.2 or 22 <= u < 25 and abs(v) < 1.2:
                return '#1a1a1a'
            if abs(v - 0.6) < 0.35 or (int(u) % 5 == 0):
                return '#f2c94c'
            return '#2e8b3a' if v < 0 else '#1f6b2a'
    return None


def w_katana(u, v):
    # 蒼刃: 青い刀。刃文（波の模様）、丸い黒のつば、ひし形の巻きの柄
    if 0 <= u < 1.4 and abs(v) <= 1.3:
        return '#9ab0ff'
    if 1.4 <= u < 8.0 and abs(v) <= 1.2:
        return '#e8eef8' if (int(u * 2) + int((v + 2) * 2)) % 2 == 0 else '#1b2f7a'
    if (u - 8.8) ** 2 + v ** 2 <= 2.9 ** 2:
        return '#2a2a33' if math.hypot(u - 8.8, v) > 1.2 else '#d4af37'
    if 11.7 <= u < 33:
        w = 1.9 if u < 30 else 1.9 * (33 - u) / 3
        if abs(v) <= w:
            wave = -0.3 + 0.5 * math.sin(u * 1.3)
            if v < wave:
                return '#e6f0ff'
            return '#3a63d8' if v < w - 0.6 else '#1b2f7a'
    return None


# ------------------------------------------------------------
# 弓（曲線からの距離で太さを決める）
# ------------------------------------------------------------
BA, BC, BB = (5.5, 2.5), (32.5, -0.5), (29.5, 26.5)


def bez(t):
    x = (1 - t) ** 2 * BA[0] + 2 * (1 - t) * t * BC[0] + t * t * BB[0]
    y = (1 - t) ** 2 * BA[1] + 2 * (1 - t) * t * BC[1] + t * t * BB[1]
    return x, y


BPTS = [bez(i / 300) for i in range(301)]


def bow(limb, string='#e8e8e8', thick=(1.0, 1.9), deco=None, pull=None, arrow=('#8b5a2b', '#c8ccd2', '#f0f0f0')):
    """limb(t, side) → 色（t: 0〜1 の位置、side: 外側 -1〜内側 1）"""
    cv = Canvas()
    # 弦と矢（弓の下に描く）
    a = (BA[0] + 0.5, BA[1] + 1.5)
    b = (BB[0] - 1.5, BB[1] - 0.5)
    if pull is None:
        cv.line(round(a[0]), round(a[1]), round(b[0]), round(b[1]), string)
    else:
        k = 3 + pull * 2
        m = ((a[0] + b[0]) / 2 - k, (a[1] + b[1]) / 2 + k)
        cv.line(round(a[0]), round(a[1]), round(m[0]), round(m[1]), string)
        cv.line(round(m[0]), round(m[1]), round(b[0]), round(b[1]), string)
        L = 13 + pull * 2
        for i in range(1, L):
            cv.set(round(m[0]) + i, round(m[1]) - i, arrow[0])
            cv.set(round(m[0]) + i + 1, round(m[1]) - i, arrow[0] if i < L - 2 else arrow[1])
        tx, ty = round(m[0]) + L, round(m[1]) - L
        for p in ((0, 0), (1, 0), (0, 1), (1, -1), (-1, 1), (2, -1)):
            cv.set(tx + p[0], ty + p[1], arrow[1])
        for p in ((-1, 0), (0, 1), (-1, 1), (-2, 1), (-1, 2), (-2, 0), (0, 2)):
            cv.set(round(m[0]) + p[0], round(m[1]) + p[1], arrow[2])
    # 弓の木
    for y in range(S):
        for x in range(S):
            best, bt = 99, 0
            for i, (bx, by) in enumerate(BPTS[::3]):
                d = math.hypot(x + 0.5 - bx, y + 0.5 - by)
                if d < best:
                    best, bt = d, i * 3 / 300
            w = thick[0] + (thick[1] - thick[0]) * (1 - abs(bt - 0.5) * 2)
            if best <= w:
                # 外側か内側か（曲線のふくらむ向き = 右上が外）
                bx, by = bez(bt)
                side = ((x + 0.5 - bx) * -1 + (y + 0.5 - by) * 1) / max(w, 0.1)
                cv.set(x, y, limb(bt, side))
    if deco:
        deco(cv)
    return cv.outline()


def limb_plain(main, dark, light, grip):
    def f(t, side):
        if 0.44 < t < 0.56:
            return grip
        if side < -0.35:
            return light
        if side > 0.45:
            return dark
        return main
    return f


def bow_set(key, limb, string, thick=(1.0, 1.9), deco=None):
    out = {key: bow(limb, string, thick, deco)}
    for i in range(3):
        out['%s_pulling_%d' % (key, i)] = bow(limb, string, thick, deco, pull=i)
    return out


def bows():
    T = {}

    # チョークボウ: 白いチョークの弓、先は赤・黄・青のチョーク、持ち手は黒板の緑
    def chalk(t, side):
        if 0.44 < t < 0.56:
            return '#2f5d3a' if side < 0.3 else '#1f4028'
        if t < 0.1:
            return '#e86b6b'
        if t > 0.9:
            return '#6bb7e8'
        if 0.86 < t <= 0.9 or 0.1 <= t < 0.14:
            return '#f2e36b'
        return '#ffffff' if side < 0 else '#d8d8d0'
    T.update(bow_set('dgb_2', chalk, '#f2f2f2', (1.3, 2.1)))

    # しおりの弓: 茶色の革の弓と、持ち手から下がる赤いしおりのひも
    def ribbon(cv):
        for i in range(9):
            cv.set(17 + (i % 2), 15 + i, '#d62f3a')
            cv.set(18 + (i % 2), 15 + i, '#a01c28')
        for p in ((16, 24), (17, 24), (18, 24), (19, 24), (17, 25), (18, 25)):
            cv.set(p[0], p[1], '#e8c04a')
    T.update(bow_set('dgb_3', limb_plain('#8b4a24', '#5a2a12', '#b06a3a', '#e8d9b0'), '#fbf3dc', deco=ribbon))

    # 試験管ボウ: ガラスの試験管が弓。中に色つきの薬、両端にゴム栓
    def tube(t, side):
        if t < 0.05 or t > 0.95:
            return '#5a3a2a'
        if 0.45 < t < 0.55:
            return '#c8ccd2'
        if abs(side) > 0.6:
            return '#5fb7c9'
        if t < 0.45:
            return '#6bd88a' if t > 0.2 else '#e8fbff'
        return '#c06be8' if t < 0.8 else '#e8fbff'
    T.update(bow_set('dgb_4', tube, '#d8f6ff', (1.4, 1.9)))

    # 光ファイバーの弓: 暗い弓の中を水色の光が通る。弦も光る
    def fiber(t, side):
        if 0.45 < t < 0.55:
            return '#2a2f3a'
        if abs(side) < 0.4:
            return '#ffffff' if int(t * 40) % 5 == 0 else '#52f2ff'
        return '#1c2a40'
    T.update(bow_set('dgb_5', fiber, '#9ff8ff', (1.2, 1.8)))

    # 物干し竿の弓: 銀の竿、色とりどりの洗濯ばさみ
    def pole(t, side):
        for i, c in enumerate(('#ff6b9a', '#6bd8ff', '#f2e36b', '#6be88a')):
            if abs(t - (0.16, 0.32, 0.68, 0.84)[i]) < 0.025:
                return c
        if 0.45 < t < 0.55:
            return '#4a4f57'
        return '#e8eef2' if side < 0 else '#9aa3ad'
    T.update(bow_set('dgb_6', pole, '#f2f2f2', (1.0, 1.4)))

    # 指示棒の弓: 伸び縮みする銀の棒がつながった弓、先は赤い玉
    def pointer(t, side):
        if t < 0.04 or t > 0.96:
            return '#d62f2f'
        if 0.45 < t < 0.55:
            return '#1c1c22'
        if int(t * 12) % 4 == 0:
            return '#7a828c'
        return '#ffffff' if side < -0.2 else '#b8bec6'
    T.update(bow_set('dgb_7', pointer, '#e8e8e8', (0.9, 1.3)))

    # 封鎖の大弓: 太い鉄の弓に、黄色と黒のしま、鎖
    def heavy(t, side):
        if 0.43 < t < 0.57:
            return '#6e4a1e'
        if 0.2 < t < 0.3 or 0.7 < t < 0.8:
            return '#f2c230' if int(t * 60) % 2 == 0 else '#2a2a2a'
        return '#8a929c' if side < 0 else '#4f5660'
    T.update(bow_set('dgb_8', heavy, '#c9a46a', (1.6, 2.6)))

    # 15号館の主の天弓: 紫の弓に金の飾り、赤紫に光る弦、持ち手に宝石
    def sky(t, side):
        if 0.46 < t < 0.54:
            return '#ff2a4a'
        if abs(side) > 0.55:
            return '#e8c04a'
        return '#7a3cc8' if side < 0 else '#4a1e80'
    T.update(bow_set('dgb_9', sky, '#ff5bd6', (1.4, 2.4)))

    # ギャンブラーの弓: 金と赤の弓、持ち手から下がるサイコロ
    def dice(cv):
        cv.rect(16, 18, 20, 22, '#ffffff')
        for p in ((17, 19), (19, 21), (18, 20)):
            cv.set(p[0], p[1], '#d62f3a')
        cv.set(18, 16, '#e8c04a')
        cv.set(18, 17, '#e8c04a')

    def gold(t, side):
        if 0.44 < t < 0.56:
            return '#d62f3a'
        if abs(side) > 0.6:
            return '#d62f3a'
        return '#fff07a' if side < -0.1 else '#f2c230'
    T.update(bow_set('cg_bow', gold, '#ffffff', (1.2, 2.0), deco=dice))
    return T


# ------------------------------------------------------------
# 防具（左右対称。左半分を描いて写す）
# ------------------------------------------------------------
def helmet_cap():
    # 制服の帽子: 紺の帽子に黒いつばと金の校章
    c = Canvas()
    c.ellipse(16, 15, 11, 8, '#2a3f7a')
    c.rect(5, 15, 26, 18, '#2a3f7a')
    c.rect(6, 9, 12, 12, '#4a64b0')
    c.rect(5, 17, 26, 18, '#1c2a55')
    c.poly([(4, 19), (28, 19), (27, 23), (5, 23)], '#14141c')
    c.rect(8, 19, 23, 19, '#2a2a36')
    c.ellipse(16, 13.5, 2.6, 2.6, '#e8c04a')
    c.rect(15, 12, 16, 15, '#c9a227')
    return c.outline()


def helmet_goggles():
    # 白衣（かぶと）: 白いヘッドバンドと大きな保護めがね
    c = Canvas()
    c.ellipse(16, 14, 11, 9, '#f4f6f8')
    c.rect(5, 14, 26, 21, '#f4f6f8')
    c.rect(5, 19, 26, 21, '#c4ccd4')
    c.rect(7, 8, 11, 10, '#ffffff')
    c.rect(4, 13, 27, 15, '#3a8fd6')
    c.ellipse(10.5, 15.5, 4.5, 3.8, '#14121a')
    c.ellipse(21.5, 15.5, 4.5, 3.8, '#14121a')
    c.ellipse(10.5, 15.5, 3.4, 2.8, '#9fe7ff')
    c.ellipse(21.5, 15.5, 3.4, 2.8, '#9fe7ff')
    c.rect(8, 14, 9, 14, '#ffffff')
    c.rect(19, 14, 20, 14, '#ffffff')
    return c.outline()


def helmet_lord():
    # 主の兜: 黒紫の兜に金の角、目のすき間が赤紫に光る
    c = Canvas()
    c.poly([(4, 4), (8, 4), (10, 10), (7, 11)], '#e8c04a')
    c.poly([(28, 4), (24, 4), (22, 10), (25, 11)], '#e8c04a')
    c.ellipse(16, 15, 10, 9, '#2a1f3a')
    c.rect(6, 15, 25, 25, '#2a1f3a')
    c.rect(15, 6, 16, 25, '#e8c04a')
    c.rect(8, 16, 23, 17, '#ff5bd6')
    c.rect(6, 23, 25, 25, '#e8c04a')
    c.rect(8, 8, 12, 12, '#5b3f8a')
    return c.outline()


def helmet_tophat():
    # ラッキーハット: 金のシルクハットに赤い帯と緑のクローバー
    c = Canvas()
    c.rect(9, 4, 22, 20, '#f2c230')
    c.rect(9, 4, 12, 20, '#fff07a')
    c.rect(20, 4, 22, 20, '#b8860b')
    c.rect(9, 16, 22, 19, '#d62f3a')
    c.rect(3, 20, 28, 23, '#f2c230')
    c.rect(3, 22, 28, 23, '#b8860b')
    for (x, y) in ((17, 16), (19, 16), (18, 15), (18, 17)):
        c.ellipse(x + 0.5, y + 0.5, 1.2, 1.2, '#3ac25a')
    c.set(18, 18, '#1f6b2a')
    return c.outline()


def chest(base, lapel=None):
    c = Canvas()
    # 胴と袖（左半分）
    c.poly([(3, 6), (11, 4), (16, 7), (16, 28), (6, 28), (6, 16), (2, 18), (1, 9)], base[0])
    c.poly([(1, 9), (3, 6), (5, 7), (4, 18), (2, 18)], base[1])
    c.rect(6, 25, 16, 28, base[1])
    if lapel:
        lapel(c)
    c.mirror()
    return c


def chest_uniform():
    # 制服: 紺のブレザー、白いシャツと赤いネクタイ、金のボタン
    c = chest(('#2a3f7a', '#1c2a55'))
    c.poly([(11, 4), (21, 4), (16, 14)], '#f4f6f8')
    c.poly([(15, 6), (17, 6), (18, 16), (16, 19), (14, 16)], '#c62a3a')
    c.rect(15, 6, 16, 7, '#8a1c28')
    for y in (17, 21, 25):
        c.rect(12, y, 13, y + 1, '#e8c04a')
        c.rect(18, y, 19, y + 1, '#e8c04a')
    c.rect(4, 9, 5, 11, '#4a64b0')
    return c.outline()


def chest_labcoat():
    # 白衣: 白い上着、えり、胸ポケットにペン、青い名札
    c = chest(('#f4f6f8', '#c4ccd4'))
    c.poly([(11, 4), (21, 4), (16, 15)], '#9fc7ea')
    c.poly([(10, 4), (12, 4), (16, 15), (15, 17), (9, 8)], '#dfe5ea')
    c.poly([(22, 4), (20, 4), (16, 15), (17, 17), (23, 8)], '#dfe5ea')
    c.rect(16, 15, 16, 28, '#c4ccd4')
    c.rect(19, 15, 23, 19, '#dfe5ea')
    c.rect(20, 12, 20, 16, '#2a2a36')
    c.rect(21, 13, 21, 16, '#d62f3a')
    c.rect(8, 15, 13, 17, '#3a8fd6')
    c.rect(9, 16, 12, 16, '#ffffff')
    return c.outline()


def chest_lord():
    # 主の鎧: 黒紫の板金、金のふち取り、胸に赤紫の宝石、肩当て
    c = chest(('#2a1f3a', '#140e1f'))
    c.ellipse(4, 8, 4, 3.5, '#5b3f8a')
    c.ellipse(28, 8, 4, 3.5, '#5b3f8a')
    c.rect(1, 10, 6, 10, '#e8c04a')
    c.rect(25, 10, 30, 10, '#e8c04a')
    c.poly([(11, 4), (21, 4), (16, 9)], '#14121a')
    c.rect(15, 9, 16, 28, '#e8c04a')
    c.rect(7, 24, 24, 24, '#e8c04a')
    c.ellipse(16, 15, 3.2, 3.2, '#e8c04a')
    c.ellipse(16, 15, 2.1, 2.1, '#ff5bd6')
    c.rect(15, 14, 15, 14, '#ffd6f6')
    return c.outline()


def chest_lucky():
    # ラッキージャケット: 金の上着、赤いえり、トランプの柄のボタン、クローバーのバッジ
    c = chest(('#f2c230', '#b8860b'))
    c.poly([(11, 4), (21, 4), (16, 13)], '#14121a')
    c.poly([(10, 4), (12, 4), (16, 13), (15, 15), (8, 8)], '#d62f3a')
    c.poly([(22, 4), (20, 4), (16, 13), (17, 15), (24, 8)], '#d62f3a')
    for i, y in enumerate((16, 20, 24)):
        col = '#d62f3a' if i % 2 == 0 else '#14121a'
        c.poly([(16, y - 1), (17.5, y + 0.5), (16, y + 2), (14.5, y + 0.5)], col)
    for (x, y) in ((9, 16), (11, 16), (10, 15), (10, 17)):
        c.ellipse(x + 0.5, y + 0.5, 1.1, 1.1, '#3ac25a')
    return c.outline()


def chest_special():
    # 特殊防具: 鋼のベストに水色の光るライン
    c = chest(('#7f96b0', '#4f6680'))
    c.poly([(11, 4), (21, 4), (16, 10)], '#14121a')
    c.rect(9, 12, 22, 13, '#3fd0e0')
    c.rect(15, 13, 16, 26, '#3fd0e0')
    c.rect(10, 18, 13, 22, '#b8cde0')
    c.rect(18, 18, 21, 22, '#b8cde0')
    return c.outline()


def legs(main, dark, belt, extra=None):
    c = Canvas()
    c.rect(6, 4, 16, 8, main)
    c.rect(6, 4, 16, 5, belt)
    c.rect(6, 8, 14, 28, main)
    c.rect(6, 8, 8, 28, mix(main, '#ffffff', 0.25))
    c.rect(12, 8, 14, 28, dark)
    c.mirror()
    for y in range(9, 29):
        c.px.pop((15, y), None)
        c.px.pop((16, y), None)
    if extra:
        extra(c)
    return c.outline()


def legs_uniform():
    # 制服のズボン: 紺、黒いベルトと銀のバックル
    def e(c):
        c.rect(15, 4, 16, 5, '#c8ccd2')
    return legs('#2a3f7a', '#1c2a55', '#14141c', e)


def legs_labcoat():
    # 白衣の下: 白衣のすそ（白）と灰色のズボン
    def e(c):
        c.rect(5, 8, 10, 15, '#f4f6f8')
        c.rect(21, 8, 26, 15, '#f4f6f8')
        c.rect(5, 15, 10, 15, '#c4ccd4')
        c.rect(21, 15, 26, 15, '#c4ccd4')
    return legs('#7a808a', '#555a62', '#f4f6f8', e)


def legs_lord():
    # 主のすね当て: 黒紫、金のひざ当て
    def e(c):
        c.rect(7, 15, 12, 18, '#e8c04a')
        c.rect(19, 15, 24, 18, '#e8c04a')
        c.rect(9, 16, 10, 17, '#ff5bd6')
        c.rect(21, 16, 22, 17, '#ff5bd6')
    return legs('#2a1f3a', '#140e1f', '#e8c04a', e)


def legs_lucky():
    # ラッキーパンツ: 金、横に赤い線
    def e(c):
        c.rect(6, 8, 6, 28, '#d62f3a')
        c.rect(25, 8, 25, 28, '#d62f3a')
    return legs('#f2c230', '#b8860b', '#d62f3a', e)


def boots(main, dark, sole, extra=None):
    c = Canvas()
    c.rect(4, 12, 12, 24, main)
    c.rect(4, 12, 6, 24, mix(main, '#ffffff', 0.25))
    c.rect(2, 20, 13, 25, main)
    c.rect(2, 26, 13, 27, sole)
    c.rect(10, 12, 12, 24, dark)
    c.mirror()
    if extra:
        extra(c)
    return c.outline()


def boots_uniform():
    # 制服のくつ: 茶色のローファー
    def e(c):
        c.rect(5, 20, 11, 20, '#3a2010')
        c.rect(20, 20, 26, 20, '#3a2010')
    return boots('#6b3f1f', '#4a2a14', '#1c1c22', e)


def boots_labcoat():
    # 白衣のくつ: 白いサンダル（つま先に青い線）
    def e(c):
        c.rect(3, 22, 12, 22, '#3a8fd6')
        c.rect(19, 22, 28, 22, '#3a8fd6')
    return boots('#f4f6f8', '#c4ccd4', '#9aa3ad', e)


def boots_lord():
    # 主の足甲: 黒紫、金のつま先
    def e(c):
        c.rect(2, 22, 6, 25, '#e8c04a')
        c.rect(25, 22, 29, 25, '#e8c04a')
        c.rect(4, 12, 12, 13, '#e8c04a')
        c.rect(19, 12, 27, 13, '#e8c04a')
    return boots('#2a1f3a', '#140e1f', '#5b3f8a', e)


def boots_lucky():
    # ラッキーブーツ: 金、赤い底、クローバー
    def e(c):
        for (x, y) in ((7, 17), (9, 17), (8, 16), (8, 18)):
            c.ellipse(x + 0.5, y + 0.5, 1.0, 1.0, '#3ac25a')
        for (x, y) in ((22, 17), (24, 17), (23, 16), (23, 18)):
            c.ellipse(x + 0.5, y + 0.5, 1.0, 1.0, '#3ac25a')
    return boots('#f2c230', '#b8860b', '#d62f3a', e)


# ------------------------------------------------------------
# 銃（横から。銃口は左）
# ------------------------------------------------------------
def gun_handgun():
    # ハンドガン: 灰色のスライド（溝つき）、茶色の握り、引き金
    c = Canvas()
    c.rect(3, 10, 26, 15, '#6a7078')
    c.rect(3, 10, 26, 11, '#a8b0b8')
    for x in range(19, 25, 2):
        c.rect(x, 12, x, 14, '#40454c')
    c.rect(1, 12, 3, 14, '#40454c')
    c.rect(24, 8, 25, 9, '#40454c')
    c.rect(8, 16, 22, 17, '#40454c')
    c.poly([(16, 17), (23, 17), (26, 28), (19, 28)], '#6b3f1f')
    for y in range(19, 27, 2):
        c.line(18 + (y - 17) * 0.3, y, 23 + (y - 17) * 0.3, y, '#4a2a14')
    c.ellipse(14, 19.5, 3, 2.6, '#40454c')
    c.ellipse(14, 19.5, 1.8, 1.4, (0, 0, 0, 0))
    for (x, y) in list(c.px):
        if c.px[(x, y)] == (0, 0, 0, 0):
            del c.px[(x, y)]
    c.rect(14, 18, 14, 20, '#22262b')
    return c.outline()


def gun_rifle():
    # アサルトライフル: 黒い本体、上にスコープ、曲がったマガジン、木の銃床
    c = Canvas()
    c.rect(0, 13, 6, 14, '#22262b')
    c.rect(0, 12, 1, 15, '#40454c')
    c.rect(6, 11, 21, 16, '#2e333a')
    c.rect(6, 11, 21, 12, '#5a6068')
    c.rect(9, 7, 18, 9, '#14161a')
    c.rect(8, 7, 8, 9, '#3fd0e0')
    c.rect(12, 10, 14, 10, '#14161a')
    c.poly([(12, 16), (16, 16), (17, 25), (13, 25), (11, 22)], '#22262b')
    c.rect(18, 17, 20, 20, '#2e333a')
    c.poly([(21, 11), (31, 13), (31, 19), (22, 17)], '#7a4a24')
    c.rect(22, 12, 30, 13, '#a0703c')
    return c.outline()


def gun_shotgun():
    # ショットガン: 長い銃身と下の筒、木のポンプと銃床
    c = Canvas()
    c.rect(0, 11, 20, 13, '#4a4f57')
    c.rect(0, 11, 20, 11, '#8e98a3')
    c.rect(0, 14, 16, 15, '#3a3f46')
    c.rect(5, 14, 12, 17, '#9a5b2a')
    for x in range(6, 12, 2):
        c.rect(x, 15, x, 16, '#6e4a1e')
    c.rect(16, 11, 22, 17, '#4a4f57')
    c.poly([(22, 11), (31, 14), (31, 21), (27, 21), (21, 17)], '#9a5b2a')
    c.rect(23, 12, 30, 14, '#c07a3a')
    c.ellipse(19, 19, 2.2, 2, '#3a3f46')
    return c.outline()


def gun_energy():
    # エネルギー銃: 紫の未来的な本体、水色に光るコイルの輪、光るエネルギーの電池
    c = Canvas()
    c.ellipse(4, 13.5, 3.5, 3.5, '#52f2ff')
    c.ellipse(4, 13.5, 2, 2, '#ffffff')
    c.rect(4, 11, 20, 16, '#7d3cc8')
    c.rect(4, 11, 20, 12, '#c69cff')
    for x in (8, 11, 14):
        c.rect(x, 10, x + 1, 17, '#52f2ff')
    c.poly([(20, 9), (28, 11), (28, 17), (20, 17)], '#5a2a9a')
    c.poly([(19, 17), (25, 17), (26, 27), (21, 27)], '#3b2060')
    c.rect(22, 19, 24, 24, '#52f2ff')
    c.rect(22, 19, 24, 20, '#ffffff')
    c.ellipse(17, 19, 2, 1.8, '#3b2060')
    return c.outline()


# ------------------------------------------------------------
def all_textures():
    T = {
        'dgw_2': diag(w_pointer),
        'dgw_3': diag(w_dictionary),
        'dgw_4': diag(w_flask),
        'dgw_5': diag(w_lan),
        'dgw_6': diag(w_forklift),
        'dgw_7': diag(w_pen),
        'dgw_8': diag(w_key),
        'dgw_9': diag(w_lord, outline='#0c0614'),
        'cg_sword': diag(w_dealer, outline='#2a1206'),
        'melee_basic': diag(w_pcb),
        'melee_adv': diag(w_katana),
        'dga_uniform_helmet': helmet_cap(),
        'dga_uniform_chest': chest_uniform(),
        'dga_uniform_legs': legs_uniform(),
        'dga_uniform_boots': boots_uniform(),
        'dga_labcoat_helmet': helmet_goggles(),
        'dga_labcoat_chest': chest_labcoat(),
        'dga_labcoat_legs': legs_labcoat(),
        'dga_labcoat_boots': boots_labcoat(),
        'dga_lord_helmet': helmet_lord(),
        'dga_lord_chest': chest_lord(),
        'dga_lord_legs': legs_lord(),
        'dga_lord_boots': boots_lord(),
        'cg_helmet': helmet_tophat(),
        'cg_chest': chest_lucky(),
        'cg_legs': legs_lucky(),
        'cg_boots': boots_lucky(),
        'armor_special': chest_special(),
        'gun_handgun': gun_handgun(),
        'gun_rifle': gun_rifle(),
        'gun_shotgun': gun_shotgun(),
        'gun_energy': gun_energy(),
    }
    T.update(bows())
    return T
