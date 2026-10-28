# -*- coding: utf-8 -*-
"""
武具以外のアイテムの絵（32×32）。art.py の道具（Canvas・diag）で、名前に合わせて 1 つずつ描く
  お守り 3 つは同じ形（お守り袋）で色と模様を変える。ドリンク 3 つも同じ形（ペットボトル）でラベルを変える
  道具・ペン・カギは art.py の剣と同じ向き（柄が左下、先が右上）
"""
import math

from art import Canvas, diag, mix, shade, OUT, S


def ring(c, cx, cy, r_out, r_in, col):
    for y in range(S):
        for x in range(S):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if r_in < d <= r_out:
                c.set(x, y, col)


def grid3(c, x0=23, y0=23, col='#ffffff', dark='#2a2a33'):
    """3×3 の印（右下）。3×3 ピッケル・シャベル"""
    c.rect(x0 - 1, y0 - 1, x0 + 7, y0 + 7, dark)
    for i in range(3):
        for j in range(3):
            c.rect(x0 + i * 3, y0 + j * 3, x0 + i * 3 + 1, y0 + j * 3 + 1, col)


# 小さい数字（3×5）
DIGITS = {
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '5': ['###', '#..', '##.', '..#', '##.'],
}


def digits(c, text, x0, y0, col, k=1):
    x = x0
    for ch in text:
        for j, row in enumerate(DIGITS[ch]):
            for i, p in enumerate(row):
                if p == '#':
                    c.rect(x + i * k, y0 + j * k, x + i * k + k - 1, y0 + j * k + k - 1, col)
        x += 4 * k


# ------------------------------------------------------------
# お守り（お守り袋。上の結び目と紐の輪、金の縁取り、まん中に模様）
# ------------------------------------------------------------
def omamori(main, dark, light, emblem):
    c = Canvas()
    c.rect(9, 11, 22, 29, main)
    c.rect(10, 10, 21, 10, main)
    c.rect(11, 9, 20, 9, main)
    c.rect(9, 11, 10, 29, light)
    c.rect(21, 11, 22, 29, dark)
    c.rect(9, 29, 22, 29, dark)
    # 金の縁取り
    for y in (13, 27):
        c.rect(11, y, 20, y, '#e8c04a')
    c.rect(11, 13, 11, 27, '#e8c04a')
    c.rect(20, 13, 20, 27, '#e8c04a')
    # 結び目と紐の輪
    c.rect(13, 7, 18, 9, '#f4f4f4')
    c.rect(13, 9, 18, 9, '#c8c8d0')
    ring(c, 15.9, 4.4, 3.4, 1.7, '#f4f4f4')
    emblem(c)
    return c.outline()


def acc_basic():
    # 俊足のお守り: 緑の袋に白い羽
    def e(c):
        c.poly([(13, 25), (19, 15), (20, 17), (15, 25)], '#ffffff')
        c.poly([(14, 22), (17, 16), (19, 15), (16, 21)], '#d8f0dc')
        c.line(13, 25, 19, 16, '#9ab8a0')
    return omamori('#2f9e4f', '#1e6e34', '#5cc675', e)


def acc_rare():
    # 守護のお守り: 紫の袋に金の盾
    def e(c):
        c.poly([(12.5, 16), (19.5, 16), (19.5, 21), (16, 25.5), (12.5, 21)], '#e8c04a')
        c.poly([(13.5, 17), (16, 17), (16, 24), (13.5, 20.5)], '#fff0a8')
        c.rect(15, 18, 16, 22, '#a8781c')
    return omamori('#7a3ab8', '#52227e', '#a468e0', e)


def it_jump():
    # ジャンプのお守り: 黄緑の袋に白い上向きの矢印
    def e(c):
        c.poly([(16, 15), (20, 20), (17.5, 20), (17.5, 25), (14.5, 25), (14.5, 20), (12, 20)], '#ffffff')
        c.rect(14, 23, 17, 25, '#d0e8b8')
    return omamori('#8cc63a', '#5e8e1e', '#b8e870', e)


# ------------------------------------------------------------
# ドリンク（ペットボトル。ふた・首・胴、まん中のラベルに模様）
# ------------------------------------------------------------
def drink(cap, liquid, label, label_dark, icon):
    c = Canvas()
    c.rect(13, 2, 18, 5, cap)
    c.rect(13, 2, 14, 5, mix(cap, '#ffffff', 0.35))
    c.rect(12, 6, 19, 7, '#dfe8ee')
    c.poly([(12, 8), (19, 8), (22, 12), (22, 28), (21, 29), (10, 29), (9, 28), (9, 12)], liquid)
    c.rect(10, 11, 11, 27, mix(liquid, '#ffffff', 0.45))
    c.rect(9, 14, 22, 24, label)
    c.rect(9, 23, 22, 24, label_dark)
    c.rect(9, 14, 22, 14, mix(label, '#ffffff', 0.4))
    icon(c)
    return c.outline()


def it_speed():
    # スピードドリンク: 水色、ラベルに黄色のいなずま
    def i(c):
        c.poly([(17, 15), (13, 20), (16, 20), (14, 23), (19, 18), (16, 18), (18, 15)], '#ffe23a')
    return drink('#1f7fd0', '#7fd8f0', '#1e9fd8', '#14709a', i)


def it_power():
    # パワードリンク: 赤、ラベルに炎
    def i(c):
        c.poly([(15.5, 15), (19, 19), (18.5, 22.5), (12.5, 22.5), (12, 19.5), (14, 18), (14.5, 20)], '#ffb020')
        c.poly([(15.5, 18.5), (17.3, 20.5), (17, 22.5), (14, 22.5), (14.3, 20.5)], '#fff1a0')
    return drink('#8a1a1a', '#f08a7a', '#d8342c', '#9a1e18', i)


def it_guard():
    # ガードドリンク: 青、ラベルに白い盾
    def i(c):
        c.poly([(12.5, 15.5), (19.5, 15.5), (19.5, 19.5), (16, 22.8), (12.5, 19.5)], '#ffffff')
        c.poly([(16, 15.5), (19.5, 15.5), (19.5, 19.5), (16, 22.8)], '#c8d8f0')
    return drink('#1c2f7a', '#8aa8f0', '#3456c8', '#1f3488', i)


def ore_potion():
    # 鉱石探知ポーション: 丸いフラスコに青緑の薬、中に鉱石のつぶ（ダイヤ・金・鉄）
    c = Canvas()
    c.rect(13, 2, 18, 5, '#b07a42')
    c.rect(13, 2, 14, 5, '#d09a5a')
    c.rect(12, 6, 19, 6, '#cfe6ee')
    c.rect(13, 7, 18, 10, '#cfe6ee')
    c.ellipse(16, 20, 10, 9.5, '#cfe6ee')
    c.ellipse(16, 21, 9, 8.3, '#1fa49a')
    c.rect(8, 13, 23, 14, '#cfe6ee')
    c.ellipse(16, 21, 9, 8.3, '#1fa49a')
    c.ellipse(12, 17, 2.4, 2.4, '#5ad8c8')
    for (x, y, col) in [(11, 22, '#7ff0ff'), (19, 18, '#ffd84a'), (18, 25, '#e8b090'), (14, 26, '#7ff0ff'), (21, 23, '#ffd84a')]:
        c.rect(x, y, x + 1, y + 1, col)
        c.set(x, y, '#ffffff')
    c.rect(9, 15, 9, 22, '#ffffff')
    return c.outline()


# ------------------------------------------------------------
# 回復・弾薬・道具
# ------------------------------------------------------------
def heal_kit():
    # 回復キット: 白い救急箱に赤い十字、上に取っ手
    c = Canvas()
    c.rect(11, 5, 20, 6, '#8a8a96')
    c.rect(11, 5, 12, 9, '#8a8a96')
    c.rect(19, 5, 20, 9, '#8a8a96')
    c.rect(3, 9, 28, 27, '#f2f2f4')
    c.rect(3, 9, 28, 10, '#ffffff')
    c.rect(3, 25, 28, 27, '#c8c8d2')
    c.rect(27, 9, 28, 27, '#d8d8e0')
    c.rect(3, 13, 28, 13, '#d0d0da')
    c.rect(13, 14, 18, 24, '#e02c2c')
    c.rect(10, 17, 21, 21, '#e02c2c')
    c.rect(13, 14, 14, 24, '#ff5a5a')
    c.rect(10, 17, 21, 17, '#ff5a5a')
    return c.outline()


def ammo():
    # 弾薬: 立てた弾 3 つ（真ちゅうの薬きょう、銅の弾頭）
    c = Canvas()
    for x0, top in [(5, 10), (13, 7), (21, 10)]:
        c.rect(x0, top + 6, x0 + 5, 28, '#d8a838')
        c.rect(x0, top + 6, x0 + 1, 28, '#f6d878')
        c.rect(x0 + 5, top + 6, x0 + 5, 28, '#a07818')
        c.rect(x0, 26, x0 + 5, 26, '#a07818')
        c.ellipse(x0 + 3, top + 4, 3, 5, '#c8683a')
        c.rect(x0, top + 4, x0 + 5, top + 6, '#c8683a')
        c.rect(x0 + 1, top + 1, x0 + 2, top + 5, '#f0a070')
    return c.outline()


def hook():
    # グラップリングフック: 鉄のいかり形のフック（3 本の爪）と、輪につないだ縄
    c = Canvas()
    ring(c, 16, 4.5, 3.6, 1.6, '#9aa2ae')
    c.rect(15, 7, 17, 22, '#b8c0ca')
    c.rect(15, 7, 15, 22, '#e6eaf0')
    # 爪（左・右・まん中）
    for side in (-1, 1):
        pts = []
        for i in range(0, 13):
            a = math.radians(-90 + i * 9)
            pts.append((16 + side * (8 * math.cos(a + math.pi / 2)), 22 + 8 * math.sin(a + math.pi / 2) - 8))
        for (x, y) in pts:
            c.rect(round(x) - 1, round(y) - 1, round(x), round(y), '#b8c0ca')
        tip_x = 16 + side * 8
        c.poly([(tip_x - 2, 14), (tip_x + 2, 14), (tip_x, 10)], '#e6eaf0')
    c.rect(14, 22, 18, 25, '#8a929c')
    c.poly([(14.5, 25), (17.5, 25), (16, 29)], '#e6eaf0')
    # 縄
    c.line(13, 3, 9, 1, '#c89a5a')
    c.line(9, 1, 4, 4, '#c89a5a')
    c.line(4, 4, 2, 9, '#c89a5a')
    return c.outline()


def hook_cast():
    # 投げたとき: フックは飛んでいき、手もとには巻いた縄だけ
    c = Canvas()
    ring(c, 13, 21, 8.5, 4.5, '#c89a5a')
    ring(c, 13, 21, 7, 6, '#9a6e34')
    c.line(19, 15, 30, 2, '#c89a5a')
    c.line(20, 15, 31, 2, '#9a6e34')
    return c.outline()


def admin_tool():
    # 管理者ツール: 赤い本、金の歯車の紋章、右に紙の小口
    c = Canvas()
    c.rect(6, 3, 26, 29, '#8a1c22')
    c.rect(6, 3, 8, 29, '#5e1016')
    c.rect(24, 5, 27, 28, '#f2ead0')
    for y in range(6, 28, 2):
        c.rect(25, y, 27, y, '#c8bea0')
    c.rect(9, 3, 23, 3, '#b8343a')
    # 歯車
    cx, cy = 16, 16
    for y in range(S):
        for x in range(S):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            tooth = (math.cos(a * 8) > 0.35)
            if r <= 5 or (r <= 6.6 and tooth):
                if r > 2.2:
                    c.set(x, y, '#e8c04a' if dx + dy < 0 else '#c0901c')
    c.rect(9, 25, 22, 25, '#e8c04a')
    c.rect(9, 7, 22, 7, '#e8c04a')
    return c.outline()


def warp_book():
    # 帰還の書: 青い表紙の本、金の角、まん中に紫のうず（復帰地点へ戻る）。右に紙の小口
    c = Canvas()
    c.rect(6, 3, 26, 29, '#24408a')
    c.rect(6, 3, 8, 29, '#162a60')
    c.rect(24, 5, 27, 28, '#f2ead0')
    for y in range(6, 28, 2):
        c.rect(25, y, 27, y, '#c8bea0')
    c.rect(9, 3, 23, 3, '#3a5cb8')
    for (x, y) in [(9, 4), (21, 4), (9, 26), (21, 26)]:
        c.rect(x, y, x + 2, y + 2, '#e8c04a')
    ring(c, 15.5, 16, 6.2, 4.4, '#9a3ae0')
    ring(c, 15.5, 16, 3.6, 2.0, '#c87aff')
    c.rect(15, 15, 16, 16, '#ffffff')
    c.set(11, 11, '#e0b0ff')
    c.set(20, 21, '#e0b0ff')
    return c.outline()


def ammo_box():
    # 弾薬パック: 緑の弾薬箱（取っ手・黄色の帯）から、弾が 3 発のぞいている
    c = Canvas()
    for x0 in (9, 14, 19):
        c.rect(x0, 6, x0 + 3, 12, '#d8a838')
        c.rect(x0, 6, x0, 12, '#f6d878')
        c.ellipse(x0 + 2, 6, 2, 2.6, '#c8683a')
    c.rect(4, 11, 27, 28, '#56653a')
    c.rect(4, 11, 27, 13, '#73844e')
    c.rect(26, 11, 27, 28, '#3e4a28')
    c.rect(4, 27, 27, 28, '#3e4a28')
    c.rect(4, 18, 27, 20, '#e8c04a')
    for x in range(5, 27, 4):
        c.rect(x, 18, x + 1, 20, '#3e4a28')
    c.rect(12, 14, 19, 15, '#2a3018')
    c.rect(13, 23, 18, 25, '#c8ced6')
    return c.outline()


def trophy_15():
    # 15号館 制覇の証: 赤と青のリボンに金のメダル、まん中に「15」
    c = Canvas()
    c.poly([(8, 0), (14, 0), (17, 12), (12, 12)], '#d8343a')
    c.poly([(18, 0), (24, 0), (20, 12), (15, 12)], '#2f5ad0')
    c.poly([(8, 0), (10, 0), (13.5, 12), (12, 12)], '#ff6a6a')
    c.ellipse(16, 21, 10, 10, '#c0901c')
    c.ellipse(16, 21, 8.6, 8.6, '#e8c04a')
    c.ellipse(13.5, 17.5, 3, 2.5, '#fff0a8')
    digits(c, '15', 10, 16, '#8a5e0e', k=2)
    return c.outline()


# ------------------------------------------------------------
# 素材
# ------------------------------------------------------------
def crystal(c, x0, y0, w, h, base, light, dark):
    """上がとがった六角柱"""
    c.poly([(x0, y0 + w * 0.6), (x0 + w / 2, y0), (x0 + w, y0 + w * 0.6), (x0 + w, y0 + h), (x0, y0 + h)], base)
    c.poly([(x0, y0 + w * 0.6), (x0 + w / 2, y0), (x0 + w / 2, y0 + h), (x0, y0 + h)], light)
    c.rect(round(x0 + w / 2) + 1, round(y0 + w * 0.6), round(x0 + w) - 1, round(y0 + h) - 1, dark)


def mat_upgrade():
    # 武器強化素材: 紫の結晶が 3 本
    c = Canvas()
    crystal(c, 4, 13, 7, 15, '#9a5ad8', '#c99af0', '#6e34a8')
    crystal(c, 21, 15, 7, 13, '#9a5ad8', '#c99af0', '#6e34a8')
    crystal(c, 11, 3, 10, 25, '#b070f0', '#e0c0ff', '#7a3cbe')
    c.rect(3, 28, 28, 29, '#5a5060')
    c.set(15, 7, '#ffffff')
    c.set(14, 9, '#ffffff')
    return c.outline()


def mat_special():
    # 特殊素材: 光る水色の宝石（ひし形）とまわりのきらめき
    c = Canvas()
    c.poly([(16, 4), (27, 15), (16, 28), (5, 15)], '#2fc8d8')
    c.poly([(16, 4), (16, 28), (5, 15)], '#7ff0f8')
    c.poly([(16, 4), (21, 15), (16, 28), (11, 15)], '#bff8ff')
    c.poly([(16, 15), (21, 15), (16, 28)], '#1aa0b8')
    c.rect(5, 15, 27, 15, '#ffffff')
    c.outline()
    for (x, y) in [(4, 5), (27, 26)]:
        c.rect(x - 1, y, x + 1, y, '#ffffff')
        c.rect(x, y - 1, x, y + 1, '#ffffff')
    return c


def mat_part():
    # 武器パーツ: 黒い鉄の歯車、まん中にオレンジのねじ
    c = Canvas()
    cx, cy = 16, 16
    for y in range(S):
        for x in range(S):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            tooth = math.cos(a * 8) > 0.3
            if r <= 10.5 or (r <= 14 and tooth):
                c.set(x, y, '#6a6e78' if dx + dy < -4 else ('#3a3e46' if dx + dy > 6 else '#50545e'))
    ring(c, 16, 16, 7.5, 6.5, '#2a2e36')
    c.ellipse(16, 16, 3.6, 3.6, '#e07a1e')
    c.rect(14, 15, 18, 16, '#7a3a0a')
    c.set(14, 14, '#ffb060')
    return c.outline()


def mat_final():
    # 最終強化パーツ: 光る金の星と、まわりのきらめき
    c = Canvas()
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = 13 if i % 2 == 0 else 5.6
        pts.append((16 + r * math.cos(a), 17 + r * math.sin(a)))
    c.poly(pts, '#f0b820')
    inner = [(16 + (p[0] - 16) * 0.55, 17 + (p[1] - 17) * 0.55) for p in pts]
    c.poly(inner, '#ffe060')
    c.ellipse(16, 17, 2.5, 2.5, '#ffffff')
    c.outline('#6a4a08')
    for (x, y) in [(4, 4), (27, 4), (27, 28)]:
        c.rect(x - 1, y, x + 1, y, '#fff1a0')
        c.rect(x, y - 1, x, y + 1, '#fff1a0')
        c.set(x, y, '#ffffff')
    return c


# ------------------------------------------------------------
# 道具（剣と同じ向き）
# ------------------------------------------------------------
def handle(u, v, end=24, wood='#a0703c', dark='#6e4a24'):
    if 0 <= u < end and abs(v) <= 1.1:
        return wood if v < 0 else dark
    return None


def tool_pick3():
    # 3×3ピッケル: 水色の大きな頭（左右に長い）
    def f(u, v):
        cu = 21 - 0.045 * v * v
        if abs(u - cu) <= 1.9 - abs(v) * 0.06 and abs(v) <= 11:
            return shade(u - cu, '#bff8ff', '#4ad8e0', '#1e9aa8', 1.8)
        return handle(u, v, 23)
    c = diag(f)
    grid3(c, 23, 23, '#7ff0f8')
    return c


def tool_shovel3():
    # 3×3シャベル: 水色の広い刃
    def f(u, v):
        if 19 <= u < 31 and abs(v) <= 4.6 - max(0, u - 28) * 1.2:
            return shade(v, '#bff8ff', '#4ad8e0', '#1e9aa8', 4.6)
        if 17.5 <= u < 19 and abs(v) <= 2.2:
            return '#7a828c'
        return handle(u, v, 19)
    c = diag(f)
    grid3(c, 23, 23, '#7ff0f8')
    return c


def tool_axe():
    # 木こり斧: 長い柄に大きな赤い刃、右下に葉っぱ
    def f(u, v):
        if 18 <= u < 30 and -10 <= v < -1:
            w = 3 + (-v - 1) * 0.55
            if abs(u - 24) <= w:
                if -v > 8.5:
                    return '#e6eaf0'
                return '#d8342c' if u > 24 else '#a8201a'
        if 29 <= u < 31 and -1 <= v <= 3:
            return '#7a828c'
        return handle(u, v, 31)
    c = diag(f)
    c.poly([(23, 30), (24, 25), (29, 22), (30, 23), (28, 28)], '#4caf50')
    c.line(24, 29, 29, 23, '#2e7d32')
    return c


def red_pen():
    # 先生の赤ペン: 赤い軸、銀のクリップ、先に赤いインク
    def f(u, v):
        if 3 <= u < 24 and abs(v) <= 1.9:
            if 8 <= u < 10:
                return '#e6eaf0'
            return shade(v, '#ff6a6a', '#d8242a', '#9a1218', 1.9)
        if 0 <= u < 3 and abs(v) <= 1.6:
            return '#9a1218'
        if 5 <= u < 15 and -3.2 <= v < -1.9:
            return '#c8ced6'
        if 24 <= u < 30 and abs(v) <= 1.9 - (u - 24) * 0.28:
            return '#c8ced6' if u < 28 else '#e02c2c'
        return None
    return diag(f)


def key_shape(head, head_dark, metal='#c8ced6', metal_dark='#8a929c', rust=None):
    """プラスチックの頭（左下）と、ぎざぎざの刃（右上）のカギ"""
    def f(u, v):
        if 0 <= u < 11 and abs(v) <= 5.2:
            if (u - 4) ** 2 + v ** 2 <= 2.2:
                return None
            if abs(v) > 4.2 or u < 1:
                return head_dark
            return head if v < 1 else head_dark
        if 11 <= u < 31 and -1.8 <= v <= 1.4:
            if rust and int(u * 2.3 + v * 3) % 5 == 0:
                return rust
            return metal if v < 0 else metal_dark
        if 15 <= u < 29 and 1.4 < v <= 3.4 and int(u) % 3 != 0:
            return metal_dark
        return None
    return diag(f)


def bike_key(head, head_dark):
    c = key_shape(head, head_dark)
    return c


def rusty_key():
    # 錆びた封鎖の鍵: 輪のついた古い鍵、茶色に錆びている
    def f(u, v):
        if (u - 5) ** 2 + v ** 2 <= 5.2 ** 2 and (u - 5) ** 2 + v ** 2 > 2.6 ** 2:
            return '#a0582a' if v < 0 else '#6e3a1a'
        if 10 <= u < 30 and abs(v) <= 1.3:
            return '#b06a34' if (int(u * 1.7) % 4) else '#5a3014'
        if 22 <= u < 30 and 1.3 < v <= 4.5 and int(u) % 3 != 1:
            return '#8a4a20'
        return None
    return diag(f, outline='#2a1408')


# ------------------------------------------------------------
# バイク・食べ物・道具類
# ------------------------------------------------------------
def bike_kit():
    # バイク強化キット: オレンジの工具箱、銀の留め金と取っ手
    c = Canvas()
    c.rect(11, 6, 20, 7, '#3a3e46')
    c.rect(11, 6, 12, 11, '#3a3e46')
    c.rect(19, 6, 20, 11, '#3a3e46')
    c.rect(3, 11, 28, 27, '#e8742a')
    c.rect(3, 11, 28, 12, '#ffa060')
    c.rect(3, 16, 28, 17, '#a84a14')
    c.rect(27, 11, 28, 27, '#b8561c')
    c.rect(3, 26, 28, 27, '#a84a14')
    c.rect(14, 15, 17, 19, '#c8ced6')
    c.rect(14, 15, 17, 15, '#ffffff')
    # スパナの模様
    c.line(7, 24, 11, 20, '#3a3e46')
    c.rect(10, 19, 12, 20, '#3a3e46')
    c.line(20, 24, 24, 20, '#3a3e46')
    c.rect(23, 19, 25, 20, '#3a3e46')
    return c.outline()


def onigiri():
    # おにぎり: 白い三角に黒いのり
    c = Canvas()
    c.poly([(16, 3), (29, 27), (3, 27)], '#f8f8f4')
    c.ellipse(16, 24, 13, 5, '#f8f8f4')
    c.poly([(16, 3), (9, 16), (5, 24), (8, 25)], '#ffffff')
    c.poly([(16, 3), (29, 27), (25, 28), (17, 9)], '#dedcd2')
    c.rect(11, 19, 20, 29, '#1e2a22')
    c.rect(11, 19, 12, 29, '#33443a')
    c.set(9, 14, '#d8d4c4')
    c.set(22, 15, '#d8d4c4')
    return c.outline()


def night_goggles():
    # 暗視ゴーグル: 黒いバンドに、緑に光るレンズが 2 つ
    c = Canvas()
    c.rect(0, 13, 31, 18, '#2a2a33')
    c.rect(0, 13, 31, 13, '#4a4a58')
    for cx in (9.5, 22.5):
        c.ellipse(cx, 16, 7, 7, '#3a3e46')
        c.ellipse(cx, 16, 5, 5, '#2fe06a')
        c.ellipse(cx - 1.2, 14.8, 2.2, 2.2, '#b8ffcc')
        c.set(int(cx - 2), 13, '#ffffff')
    c.rect(15, 14, 16, 18, '#3a3e46')
    return c.outline()


def denken_bomb():
    # 電研ボム: 黒い丸い爆弾に、緑の基板の配線。導火線の先に火花
    c = Canvas()
    c.ellipse(14, 19, 11, 11, '#2a2e36')
    c.ellipse(11, 15, 4, 3.5, '#4a505c')
    for (x0, y0, x1, y1) in [(7, 21, 13, 21), (13, 21, 13, 26), (15, 15, 21, 15), (21, 15, 21, 22), (9, 25, 9, 27)]:
        c.line(x0, y0, x1, y1, '#3fd06a')
    for (x, y) in [(7, 21), (13, 26), (21, 22), (15, 15)]:
        c.rect(x, y, x + 1, y + 1, '#ffd84a')
    c.rect(19, 6, 24, 10, '#7a828c')
    c.rect(19, 6, 20, 10, '#a8b0ba')
    c.line(23, 5, 26, 2, '#c89a5a')
    c.outline()
    for (x, y, col) in [(27, 1, '#ffffff'), (28, 0, '#ffd84a'), (26, 0, '#ffd84a'), (28, 2, '#ff8a2a'), (29, 1, '#ff8a2a'), (27, 3, '#ff8a2a')]:
        c.set(x, y, col)
    return c


def warp_scroll():
    # 帰還の巻物: 両はしを巻いた紙に、紫のうず
    c = Canvas()
    c.rect(7, 8, 24, 24, '#f2e6c4')
    c.rect(7, 8, 24, 9, '#fff6dc')
    c.rect(7, 23, 24, 24, '#d8c8a0')
    for x0 in (3, 24):
        c.rect(x0, 5, x0 + 4, 27, '#c8a060')
        c.rect(x0, 5, x0 + 1, 27, '#e8c888')
        c.rect(x0 + 4, 5, x0 + 4, 27, '#8a6430')
    ring(c, 15.5, 16, 5.5, 3.8, '#9a3ae0')
    ring(c, 15.5, 16, 3, 1.6, '#c87aff')
    c.rect(15, 15, 16, 16, '#ffffff')
    c.rect(12, 10, 12, 10, '#c87aff')
    return c.outline()


# ------------------------------------------------------------
# レアドロップ品
# ------------------------------------------------------------
def old_page():
    # 古文書のページ: 黄ばんだ紙、右はしが破れている、茶色の文字としみ
    c = Canvas()
    pts = [(5, 3), (24, 3), (26, 7), (24, 10), (27, 14), (24, 18), (27, 22), (25, 26), (26, 29), (5, 29)]
    c.poly(pts, '#e8d49a')
    c.rect(5, 3, 6, 29, '#f6e6b4')
    for y in range(7, 27, 3):
        w = 15 if y % 2 else 12
        c.rect(8, y, 8 + w, y, '#8a6430')
    c.ellipse(20, 23, 3, 2.4, '#c8a868')
    return c.outline('#4a3418')


def test_tube():
    # 光る試薬: 試験管に光る緑の薬、まわりにきらめき
    c = Canvas()
    c.rect(13, 3, 19, 5, '#b07a42')
    c.rect(13, 6, 19, 24, '#d8eef4')
    c.ellipse(16, 24.5, 3.5, 4, '#d8eef4')
    c.rect(14, 13, 18, 24, '#5af07a')
    c.ellipse(16, 24.5, 2.5, 3, '#5af07a')
    c.rect(14, 13, 18, 13, '#c8ffd0')
    c.rect(14, 14, 14, 26, '#a8ffb8')
    c.outline()
    for (x, y) in [(7, 9), (25, 15), (8, 22)]:
        c.rect(x - 1, y, x + 1, y, '#b8ffc8')
        c.rect(x, y - 1, x, y + 1, '#b8ffc8')
        c.set(x, y, '#ffffff')
    return c


def broken_pcb():
    # 壊れた基板: 緑の基板に銅の配線と黒いチップ、まん中を割れ目が走る
    c = Canvas()
    c.rect(3, 6, 28, 26, '#2e8a3e')
    c.rect(3, 6, 28, 7, '#4cb85c')
    for (x0, y0, x1, y1) in [(5, 10, 12, 10), (12, 10, 12, 15), (20, 21, 27, 21), (6, 23, 10, 23), (22, 9, 22, 14)]:
        c.line(x0, y0, x1, y1, '#e0a040')
    c.rect(19, 9, 25, 14, '#1e1e24')
    c.rect(5, 15, 10, 19, '#1e1e24')
    for x in range(19, 26, 2):
        c.set(x, 8, '#c8ced6')
        c.set(x, 15, '#c8ced6')
    crack = [(15, 6), (14, 10), (17, 13), (14, 17), (16, 21), (13, 26)]
    for (a, b) in zip(crack, crack[1:]):
        c.line(a[0], a[1], b[0], b[1], '#14121a')
        c.line(a[0] + 1, a[1], b[0] + 1, b[1], None)
    c.outline()
    for (x, y) in crack:
        c.px.pop((x + 1, y), None)
    c.set(18, 4, '#ffe23a')
    c.set(19, 3, '#ffe23a')
    c.set(17, 3, '#ffffff')
    return c


def keyring():
    # 警備員の鍵束: 鉄の輪に、色のちがう鍵が 3 本
    c = Canvas()
    ring(c, 10, 9, 6.5, 4.6, '#b8c0ca')

    def key(x0, y0, dx, dy, col, dark):
        for i in range(14):
            x, y = x0 + dx * i, y0 + dy * i
            c.rect(round(x), round(y), round(x) + 1, round(y) + 1, col)
        c.ellipse(x0 + dx * 1.5 + 1, y0 + dy * 1.5 + 1, 2.6, 2.6, dark)
        for i in (10, 12):
            c.set(round(x0 + dx * i + 2), round(y0 + dy * i), dark)

    key(13, 12, 0.9, 0.9, '#e0b040', '#a07818')
    key(10, 14, 0.25, 1.0, '#c8ced6', '#8a929c')
    key(15, 9, 1.0, 0.35, '#c87a4a', '#8a4a20')
    return c.outline()


def research_note():
    # 教授の研究ノート: 深緑の表紙、左にリング、白いラベルに式の線
    c = Canvas()
    c.rect(7, 3, 27, 29, '#2e5a44')
    c.rect(26, 3, 27, 29, '#1e3e2e')
    c.rect(7, 28, 27, 29, '#1e3e2e')
    c.rect(11, 8, 23, 15, '#f2f2ea')
    c.rect(13, 10, 21, 10, '#3a3e46')
    c.rect(13, 13, 18, 13, '#3a3e46')
    c.rect(20, 12, 21, 13, '#d8342c')
    for y in range(5, 28, 3):
        c.rect(4, y, 8, y + 1, '#c8ced6')
        c.set(4, y, '#ffffff')
    c.rect(11, 20, 23, 20, '#4a8a6a')
    c.rect(11, 23, 20, 23, '#4a8a6a')
    return c.outline()


def lord_shard():
    # 15号館の主のかけら: 黒紫の結晶のかけらに、光る紫の割れ目
    c = Canvas()
    c.ellipse(16, 16, 14, 14, '#3a1458')
    c.px.clear()
    c.poly([(17, 1), (25, 10), (22, 30), (9, 27), (7, 12)], '#3a1a5e')
    c.poly([(17, 1), (7, 12), (9, 27), (14, 17)], '#5a2a8e')
    c.poly([(17, 1), (25, 10), (14, 17)], '#7a3ab8')
    for (a, b) in [((14, 17), (19, 23)), ((19, 23), (17, 28)), ((14, 17), (10, 21))]:
        c.line(a[0], a[1], b[0], b[1], '#ff5ae8')
    c.set(16, 6, '#ffffff')
    c.set(15, 8, '#e0b0ff')
    c.outline('#0c0614')
    for (x, y) in [(4, 4), (28, 24)]:
        c.set(x, y, '#ff5ae8')
        c.set(x + 1, y, '#e0b0ff')
        c.set(x, y + 1, '#e0b0ff')
    return c


# ------------------------------------------------------------
def item_textures():
    return {
        'heal_kit': heal_kit(),
        'ammo': ammo(),
        'hook': hook(),
        'hook_cast': hook_cast(),
        'ore_potion': ore_potion(),
        'admin_tool': admin_tool(),
        'trophy_15': trophy_15(),
        'map': warp_book(),
        'ammo_pack': ammo_box(),
        'mat_upgrade': mat_upgrade(),
        'mat_special': mat_special(),
        'mat_part': mat_part(),
        'mat_final': mat_final(),
        'acc_basic': acc_basic(),
        'acc_rare': acc_rare(),
        'tool_pick3': tool_pick3(),
        'tool_shovel3': tool_shovel3(),
        'tool_axe': tool_axe(),
        'bike_key': bike_key('#e8742a', '#a84a14'),
        'bike_key_scooter': bike_key('#2fb8d8', '#1a7a96'),
        'bike_key_offroad': bike_key('#4caf50', '#2e7d32'),
        'bike_kit': bike_kit(),
        'it_onigiri': onigiri(),
        'it_speed': it_speed(),
        'it_power': it_power(),
        'it_guard': it_guard(),
        'it_jump': it_jump(),
        'it_night': night_goggles(),
        'it_bomb': denken_bomb(),
        'it_warp': warp_scroll(),
        'rare_2': red_pen(),
        'rare_3': old_page(),
        'rare_4': test_tube(),
        'rare_5': broken_pcb(),
        'rare_6': keyring(),
        'rare_7': research_note(),
        'rare_8': rusty_key(),
        'rare_9': lord_shard(),
    }
