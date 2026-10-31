# -*- coding: utf-8 -*-
"""
身に着けたときの防具の見た目（64×32 の 2 枚: humanoid = 兜・胴・腕・ブーツ、humanoid_leggings = 足・腰）を描く。
持ち物の絵（art.py）と同じ配色で、セットごとに 1 組。Mojang の絵は使わない（このリポジトリは公開なので）
UV の位置は Minecraft の防具の標準（頭 0,0 / 胴 16,16 / 腕 40,16 / 足 0,16。左の手足は右と同じ絵を反転して使う）
"""
import io

from PIL import Image


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


# セット名 → 配色。base=本体 dark=影 light=ハイライト trim=帯・袖口 gem=飾り leg=ズボン boot=ブーツ
SETS = {
    # 制服（紺の制服に金のボタンと赤いネクタイ）
    'uniform': dict(base='#2a3f7a', dark='#1c2a55', light='#4a64b0', trim='#e8c04a', gem='#e8c04a', leg='#1c2a55',
                    boot='#14141c', tie='#c62a3a', front='#f4f6f8'),
    # 白衣（白に水色の襟、灰色のズボン）
    'labcoat': dict(base='#f4f6f8', dark='#c4ccd4', light='#ffffff', trim='#3a8fd6', gem='#9fc7ea', leg='#7a808a',
                    boot='#555a62', tie='#9fc7ea', front='#dfe5ea'),
    # 主の鎧（暗い紫に金のふち、ピンクの宝石）
    'lord': dict(base='#2a1f3a', dark='#140e1f', light='#5b3f8a', trim='#e8c04a', gem='#ff5bd6', leg='#2a1f3a',
                 boot='#140e1f', tie='#5b3f8a', front='#5b3f8a'),
    # ラッキーセット（金色に赤）
    'lucky': dict(base='#f2c230', dark='#b8860b', light='#fff07a', trim='#d62f3a', gem='#3ac25a', leg='#f2c230',
                  boot='#b8860b', tie='#d62f3a', front='#f5d164'),
    # 管理者のスーツ（黒いスーツに白いシャツ、赤いネクタイ・帯、金のボタン）
    'suit': dict(base='#1c1c24', dark='#0c0c12', light='#3a3a48', trim='#4a4a5a', gem='#e8c04a', leg='#1c1c24',
                 boot='#0a0a0e', tie='#c62a3a', front='#f4f6f8'),
    # 特殊な防具（鉄色に水色）
    'special': dict(base='#7f96b0', dark='#4f6680', light='#b8cde0', trim='#3fd0e0', gem='#3fd0e0', leg='#4f6680',
                    boot='#4f6680', tie='#b8cde0', front='#b8cde0'),
}


def _mix(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


class Sheet:
    def __init__(self):
        self.im = Image.new('RGBA', (64, 32), (0, 0, 0, 0))

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.im.putpixel((xx, yy), c)

    def fabric(self, x, y, w, h, c, k=0.93):
        """ほんの少しの織り目（ななめに少し暗く）"""
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.im.putpixel((xx, yy), _mix(c, k) if (xx + yy * 2) % 5 == 0 else c)

    def png(self):
        b = io.BytesIO()
        self.im.save(b, 'PNG')
        return b.getvalue()


def layer1(p):
    s = Sheet()
    base, dark, light, trim, gem = (hx(p[k]) for k in ('base', 'dark', 'light', 'trim', 'gem'))
    boot, tie, front = hx(p['boot']), hx(p['tie']), hx(p['front'])
    # --- 頭（右 0〜7・前 8〜15・左 16〜23・後 24〜31 / y 8〜15、上 8〜15・下 16〜23 / y 0〜7）
    s.fabric(0, 8, 32, 8, base)
    s.fabric(8, 0, 8, 8, light)
    s.rect(16, 0, 8, 8, dark)
    s.rect(0, 12, 32, 2, trim)            # 帽子の帯
    s.rect(0, 14, 32, 2, dark)            # ふち
    s.rect(11, 9, 2, 2, gem)              # 前の飾り
    s.rect(8, 8, 8, 1, light)
    # --- 胴（上 20〜27・下 28〜35 / y 16〜19、右 16〜19・前 20〜27・左 28〜31・後 32〜39 / y 20〜31）
    s.fabric(16, 20, 24, 12, base)
    s.rect(20, 16, 8, 4, light)
    s.rect(28, 16, 8, 4, dark)
    s.rect(20, 20, 8, 2, light)           # 肩まわり
    s.rect(22, 20, 4, 3, front)           # 襟・シャツ
    s.rect(23, 22, 2, 6, tie)             # ネクタイ・中の合わせ
    s.rect(23, 28, 2, 4, dark)
    s.rect(26, 24, 1, 1, gem)
    s.rect(21, 24, 1, 1, gem)
    s.rect(16, 28, 24, 2, trim)           # ベルト
    s.rect(16, 30, 24, 2, dark)
    # --- 腕（上 44〜47・下 48〜51 / y 16〜19、右 40〜43・前 44〜47・左 48〜51・後 52〜55 / y 20〜31）
    s.fabric(40, 20, 16, 12, base)
    s.rect(44, 16, 4, 4, light)
    s.rect(48, 16, 4, 4, dark)
    s.rect(40, 20, 16, 2, light)          # 肩
    s.rect(40, 29, 16, 2, trim)           # 袖口
    s.rect(40, 31, 16, 1, dark)
    # --- ブーツ（足の絵の下 5 段だけ。右 0〜3・前 4〜7・左 8〜11・後 12〜15 / y 20〜31、上 4〜7・下 8〜11 / y 16〜19）
    s.fabric(0, 27, 16, 5, boot)
    s.rect(0, 27, 16, 1, trim)            # 履き口
    s.rect(0, 31, 16, 1, _mix(boot, 0.6))  # 靴底
    s.rect(4, 16, 4, 4, boot)
    s.rect(8, 16, 4, 4, _mix(boot, 0.6))
    return s


def layer2(p):
    s = Sheet()
    leg, trim, dark = hx(p['leg']), hx(p['trim']), hx(p['dark'])
    s.fabric(0, 20, 16, 12, leg)          # 足（右 0〜3・前 4〜7・左 8〜11・後 12〜15）
    s.rect(4, 16, 4, 4, leg)
    s.rect(8, 16, 4, 4, _mix(leg, 0.7))
    s.rect(0, 20, 16, 2, trim)            # 腰のベルトの続き
    s.rect(0, 24, 16, 1, _mix(leg, 0.8))  # ひざの折り目
    s.rect(0, 31, 16, 1, _mix(leg, 0.7))
    # 腰（胴の絵の下の 4 段）
    s.fabric(16, 28, 24, 4, leg)
    s.rect(16, 28, 24, 2, trim)
    s.rect(16, 30, 24, 2, dark)
    s.rect(23, 28, 2, 4, _mix(leg, 0.7))
    return s


def all_armor():
    """{セット名: (humanoid の PNG, humanoid_leggings の PNG)}"""
    return {k: (layer1(p).png(), layer2(p).png()) for k, p in SETS.items()}
