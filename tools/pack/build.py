# -*- coding: utf-8 -*-
"""
武具のスキン（リソースパック）を作る。Minecraft Java 版 1.21.4（pack_format 46）
  python tools/pack/build.py
  → pack/uf_pack.zip を作り、uf_24_skin.sk の uf_packhash を新しい SHA-1 に書き換える

仕組み:
  武具には見た目の番号（custom model data。uf_24_skin.sk の uf_skinid）が付いている
  assets/minecraft/items/<元のアイテム>.json で、番号ごとに uf:item/<id> のモデルへ切り替える（番号がなければ元の見た目）
  絵（32×32）は art.py で、名前に合わせて 1 つずつ描く（Mojang の絵は使わない。このリポジトリは公開なので）
"""
import hashlib
import io
import json
import os
import re
import sys
import zipfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'pack', 'uf_pack.zip')
SKIN_SK = os.path.join(ROOT, 'uf_24_skin.sk')


from art import all_textures
from armor import all_armor


def flipx(png):
    """弓の絵を左右反転する。バニラの弓は先（矢の向き）が左上、art.py は右上に描いてあり、手に持つと上を向いてしまうため"""
    im = Image.open(io.BytesIO(png)).transpose(Image.FLIP_LEFT_RIGHT)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return b.getvalue()


# 見た目の番号（uf_24_skin.sk の uf_skinid と合わせる）と、元のアイテム
def entries():
    E = []  # (元のアイテム, 番号, id, 種類)
    weap = {2: 'iron_sword', 3: 'iron_sword', 4: 'iron_axe', 5: 'diamond_sword', 6: 'diamond_axe',
            7: 'diamond_sword', 8: 'netherite_sword', 9: 'netherite_sword'}
    for f, base in weap.items():
        E.append((base, 1000 + f, 'dgw_%d' % f, 'handheld'))
        E.append(('bow', 1100 + f, 'dgb_%d' % f, 'bow'))
    mats = {'uniform': 'leather', 'labcoat': 'iron', 'lord': 'netherite'}
    base_n = {'uniform': 1210, 'labcoat': 1220, 'lord': 1230}
    pn = {'helmet': ('helmet', 1), 'chest': ('chestplate', 2), 'legs': ('leggings', 3), 'boots': ('boots', 4)}
    for s, m in mats.items():
        for part, (vn, k) in pn.items():
            E.append(('%s_%s' % (m, vn), base_n[s] + k, 'dga_%s_%s' % (s, part), 'generated'))
    E.append(('diamond_sword', 1301, 'cg_sword', 'handheld'))
    E.append(('bow', 1302, 'cg_bow', 'bow'))
    for part, (vn, k) in pn.items():
        E.append(('golden_%s' % vn, 1302 + k, 'cg_%s' % part, 'generated'))
    E.append(('iron_sword', 1401, 'melee_basic', 'handheld'))
    E.append(('diamond_sword', 1402, 'melee_adv', 'handheld'))
    E.append(('carrot_on_a_stick', 1501, 'gun_handgun', 'generated'))
    E.append(('carrot_on_a_stick', 1502, 'gun_rifle', 'generated'))
    E.append(('carrot_on_a_stick', 1503, 'gun_shotgun', 'generated'))
    E.append(('warped_fungus_on_a_stick', 1504, 'gun_energy', 'generated'))
    E.append(('iron_chestplate', 1601, 'armor_special', 'generated'))
    # 管理者の装備（2001 から。uf_28_adminkit.sk）
    E.append(('netherite_sword', 2001, 'ad_sword', 'handheld'))
    for part, (vn, k) in pn.items():
        E.append(('leather_%s' % vn, 2010 + k, 'ad_%s' % part, 'generated'))
    # 武具以外のアイテム（1700 から。uf_24_skin.sk の uf_refreshgear は、1700 からの番号のアイテムを作り直さずに番号だけ付ける）
    # 帰還の書（id は map。前のフロアマップは回収コンパスだったが、本にしたのでスキンを付けられる）
    E.append(('honey_bottle', 1701, 'heal_kit', 'generated'))
    E.append(('iron_nugget', 1702, 'ammo', 'generated'))
    E.append(('fishing_rod', 1703, 'hook', 'rod'))
    E.append(('potion', 1704, 'ore_potion', 'generated'))
    E.append(('book', 1705, 'map', 'generated'))
    E.append(('book', 1706, 'admin_tool', 'generated'))
    E.append(('heart_of_the_sea', 1707, 'trophy_15', 'generated'))
    # ショップの弾薬パックの絵（アイテムとしてはない。uf_03_shop.sk の uf_shopicon）
    E.append(('iron_nugget', 1708, 'ammo_pack', 'generated'))
    E.append(('potion', 1709, 'sp_potion', 'generated'))
    E.append(('amethyst_shard', 1711, 'mat_upgrade', 'generated'))
    E.append(('prismarine_crystals', 1712, 'mat_special', 'generated'))
    E.append(('netherite_scrap', 1713, 'mat_part', 'generated'))
    E.append(('nether_star', 1714, 'mat_final', 'generated'))
    E.append(('feather', 1721, 'acc_basic', 'generated'))
    E.append(('nautilus_shell', 1722, 'acc_rare', 'generated'))
    E.append(('diamond_pickaxe', 1731, 'tool_pick3', 'handheld'))
    E.append(('diamond_shovel', 1732, 'tool_shovel3', 'handheld'))
    E.append(('diamond_axe', 1733, 'tool_axe', 'handheld'))
    E.append(('saddle', 1741, 'bike_key', 'generated'))
    E.append(('saddle', 1742, 'bike_key_scooter', 'generated'))
    E.append(('saddle', 1743, 'bike_key_offroad', 'generated'))
    E.append(('piston', 1744, 'bike_kit', 'generated'))
    E.append(('baked_potato', 1801, 'it_onigiri', 'generated'))
    E.append(('potion', 1802, 'it_speed', 'generated'))
    E.append(('potion', 1803, 'it_power', 'generated'))
    E.append(('potion', 1804, 'it_guard', 'generated'))
    E.append(('rabbit_foot', 1805, 'it_jump', 'generated'))
    E.append(('spyglass', 1806, 'it_night', 'generated'))
    E.append(('fire_charge', 1807, 'it_bomb', 'generated'))
    E.append(('paper', 1808, 'it_warp', 'generated'))
    rare = {2: 'red_dye', 3: 'paper', 4: 'glow_ink_sac', 5: 'redstone', 6: 'tripwire_hook', 7: 'writable_book',
            8: 'iron_nugget', 9: 'echo_shard'}
    for f, base in rare.items():
        E.append((base, 1900 + f, 'rare_%d' % f, 'handheld' if f == 2 else 'generated'))
    return E


def tex_name(uid):
    # 防具の cg_<部位> は絵の名前 cg_<部位>、ほかは id のまま
    return uid


def vanilla_model(base):
    """元のアイテムの見た目（番号がないとき）。1.21.4 の items/*.json と同じ形"""
    if base == 'bow':
        return {
            'type': 'minecraft:condition', 'property': 'minecraft:using_item',
            'on_false': {'type': 'minecraft:model', 'model': 'minecraft:item/bow'},
            'on_true': {
                'type': 'minecraft:range_dispatch', 'property': 'minecraft:use_duration', 'scale': 0.05,
                'entries': [
                    {'threshold': 0.65, 'model': {'type': 'minecraft:model', 'model': 'minecraft:item/bow_pulling_1'}},
                    {'threshold': 0.9, 'model': {'type': 'minecraft:model', 'model': 'minecraft:item/bow_pulling_2'}},
                ],
                'fallback': {'type': 'minecraft:model', 'model': 'minecraft:item/bow_pulling_0'},
            },
        }
    if base.startswith('leather_'):
        return {'type': 'minecraft:model', 'model': 'minecraft:item/' + base,
                'tints': [{'type': 'minecraft:dye', 'default': -6265536}]}
    # 下の 4 つは、ふつうの絵 1 枚ではない（ここを間違えると、ふつうのアイテムの見た目まで変わる）
    if base == 'potion':
        return {'type': 'minecraft:model', 'model': 'minecraft:item/potion',
                'tints': [{'type': 'minecraft:potion', 'default': -13083194}]}
    if base == 'fishing_rod':
        return {'type': 'minecraft:condition', 'property': 'minecraft:fishing_rod/cast',
                'on_false': {'type': 'minecraft:model', 'model': 'minecraft:item/fishing_rod'},
                'on_true': {'type': 'minecraft:model', 'model': 'minecraft:item/fishing_rod_cast'}}
    if base == 'spyglass':
        return {'type': 'minecraft:select', 'property': 'minecraft:display_context',
                'cases': [{'when': ['gui', 'ground', 'fixed'],
                           'model': {'type': 'minecraft:model', 'model': 'minecraft:item/spyglass'}}],
                'fallback': {'type': 'minecraft:model', 'model': 'minecraft:item/spyglass_in_hand'}}
    if base == 'piston':
        return {'type': 'minecraft:model', 'model': 'minecraft:block/piston_inventory'}
    return {'type': 'minecraft:model', 'model': 'minecraft:item/' + base}


def custom_model(uid, kind):
    if kind == 'bow':
        return {
            'type': 'minecraft:condition', 'property': 'minecraft:using_item',
            'on_false': {'type': 'minecraft:model', 'model': 'uf:item/' + uid},
            'on_true': {
                'type': 'minecraft:range_dispatch', 'property': 'minecraft:use_duration', 'scale': 0.05,
                'entries': [
                    {'threshold': 0.65, 'model': {'type': 'minecraft:model', 'model': 'uf:item/%s_pulling_1' % uid}},
                    {'threshold': 0.9, 'model': {'type': 'minecraft:model', 'model': 'uf:item/%s_pulling_2' % uid}},
                ],
                'fallback': {'type': 'minecraft:model', 'model': 'uf:item/%s_pulling_0' % uid},
            },
        }
    if kind == 'rod':
        # 投げている間は <id>_cast の絵
        return {'type': 'minecraft:condition', 'property': 'minecraft:fishing_rod/cast',
                'on_false': {'type': 'minecraft:model', 'model': 'uf:item/' + uid},
                'on_true': {'type': 'minecraft:model', 'model': 'uf:item/%s_cast' % uid}}
    return {'type': 'minecraft:model', 'model': 'uf:item/' + uid}


def build():
    T = all_textures()
    files = {}
    files['pack.mcmeta'] = json.dumps({'pack': {'pack_format': 46, 'description': '電子計算研究部 15号館の武具'}},
                                      ensure_ascii=False, indent=1)
    by_base = {}
    for base, n, uid, kind in entries():
        by_base.setdefault(base, []).append((n, uid, kind))
        tn = tex_name(uid)
        if tn not in T:
            raise SystemExit('絵がない: ' + tn)
        parent = {'handheld': 'minecraft:item/handheld', 'generated': 'minecraft:item/generated',
                  'bow': 'minecraft:item/bow', 'rod': 'minecraft:item/handheld_rod'}[kind]
        files['assets/uf/models/item/%s.json' % uid] = json.dumps({'parent': parent, 'textures': {'layer0': 'uf:item/' + tn}})
        files['assets/uf/textures/item/%s.png' % tn] = flipx(T[tn].png()) if kind == 'bow' else T[tn].png()
        if kind == 'rod':
            files['assets/uf/models/item/%s_cast.json' % uid] = json.dumps(
                {'parent': parent, 'textures': {'layer0': 'uf:item/%s_cast' % tn}})
            files['assets/uf/textures/item/%s_cast.png' % tn] = T['%s_cast' % tn].png()
        if kind == 'bow':
            for i in range(3):
                files['assets/uf/models/item/%s_pulling_%d.json' % (uid, i)] = json.dumps(
                    {'parent': 'minecraft:item/bow', 'textures': {'layer0': 'uf:item/%s_pulling_%d' % (tn, i)}})
                files['assets/uf/textures/item/%s_pulling_%d.png' % (tn, i)] = flipx(T['%s_pulling_%d' % (tn, i)].png())
    # 身に着けたときの防具の見た目（セットごと。装備の見た目は uf_24_skin.sk の uf_wornmodel が指す uf:<セット名>）
    for name, (l1, l2) in all_armor().items():
        files['assets/uf/equipment/%s.json' % name] = json.dumps(
            {'layers': {'humanoid': [{'texture': 'uf:' + name}], 'humanoid_leggings': [{'texture': 'uf:' + name}]}})
        files['assets/uf/textures/entity/equipment/humanoid/%s.png' % name] = l1
        files['assets/uf/textures/entity/equipment/humanoid_leggings/%s.png' % name] = l2
    for base, lst in by_base.items():
        lst.sort()
        files['assets/minecraft/items/%s.json' % base] = json.dumps({'model': {
            'type': 'minecraft:range_dispatch', 'property': 'minecraft:custom_model_data', 'index': 0,
            'entries': [{'threshold': n, 'model': custom_model(uid, kind)} for (n, uid, kind) in lst],
            'fallback': vanilla_model(base),
        }}, indent=1)
    # 毎回同じ中身なら同じ zip になるように（日時を固定）
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            data = files[name]
            z.writestr(info, data.encode('utf-8') if isinstance(data, str) else data)
    data = buf.getvalue()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(data)
    sha1 = hashlib.sha1(data).hexdigest()
    sk = open(SKIN_SK, encoding='utf-8').read()
    sk2 = re.sub(r'(function uf_packhash\(\) :: text:\n    return ")[0-9a-f]{40}(")', r'\g<1>%s\g<2>' % sha1, sk)
    if sk2 == sk and sha1 not in sk:
        raise SystemExit('uf_24_skin.sk の uf_packhash が見つからない')
    with open(SKIN_SK, 'w', encoding='utf-8', newline='\n') as f:
        f.write(sk2)
    print('pack/uf_pack.zip', len(data), 'bytes, sha1', sha1, ',', len(files), 'files')
    return T


if __name__ == '__main__':
    T = build()
    # 確認用の一覧（引数に出力先のパスを渡すと、全部の絵を並べた PNG を作る）
    if len(sys.argv) > 1:
        names = sorted(k for k in T if '_pulling_' not in k or k.endswith('_pulling_2'))
        cols = 8
        rows = (len(names) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * 136, rows * 136), (70, 72, 82, 255))
        for i, k in enumerate(names):
            im = Image.open(io.BytesIO(T[k].png())).resize((128, 128), Image.NEAREST)
            sheet.paste(im, ((i % cols) * 136 + 4, (i // cols) * 136 + 4), im)
        sheet.save(sys.argv[1])
        print('sheet', sys.argv[1], names)
