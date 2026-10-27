// 武具の強さ・スキン（uf_19_gear.sk・uf_24_skin.sk）と、地下カジノ（uf_25_casinohall.sk）のテスト。平らなワールドでよい
// 使い方: node power.js <サーバーの cmds.txt>
//   先に、同じフォルダの -zz_mobtest.sk を、テストサーバーの plugins/Skript/scripts/zz_mobtest.sk として入れておく
// 注意: OP を付け、ワールドを書き換えるので、必ずローカルのテストサーバー（127.0.0.1:25599）だけで実行すること。
const mineflayer = require('mineflayer');
const fs = require('fs');
const { Vec3 } = require('vec3');

const CMD = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const con = (c) => fs.appendFileSync(CMD, c + '\n');
const results = [];
const check = (n, c, d = '') => { results.push([c ? 'PASS' : 'FAIL', n, d]); log(c ? 'PASS' : 'FAIL', n, d); return c; };
const NAME = 'UfPow';

const comp = (it, type) => (it && it.components || []).find((c) => c.type === type);
const cmdOf = (it) => { const c = comp(it, 'custom_model_data'); return c ? c.data.floats[0] : 0; };
const loreOf = (it) => JSON.stringify(comp(it, 'lore') || '');

async function join() {
  const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: NAME, auth: 'offline', version: '1.21.4' });
  b.msgs = [];
  b.on('messagestr', (m, pos) => { if (pos === 'game_info') return; b.msgs.push(m); if (process.env.DEBUG) log('[chat]', m); });
  // リソースパックは受け取ったことにする（届いたかだけ見る）
  b.packs = [];
  b._client.on('add_resource_pack', (d) => { b.packs.push(d.url); });
  await new Promise((r) => b.once('spawn', r));
  await sleep(1500);
  return b;
}

(async () => {
  con('op ' + NAME); await sleep(800);
  let b = await join();
  const waitMsg = async (from, re, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const m = b.msgs.slice(from).find((x) => re.test(x)); if (m) return m; await sleep(200); } return null; };
  con('gamemode creative ' + NAME); con('gamerule doMobSpawning false'); con('time set day'); con('clear ' + NAME);
  b.chat('/zzworld dungeon world'); b.chat('/zzmod dungeon on'); b.chat('/zzmod casino on'); b.chat('/zzmod weapons on');
  b.chat('/zzareadel dungeon1'); b.chat('/zzareadel dungeon2');
  await sleep(1000);

  // --- 武具の説明・スキン・壊れない ---
  for (const id of ['dgw_2', 'dgw_9', 'dgb_5', 'dga_lord_chest', 'cg_sword', 'cg_helmet', 'gun_handgun', 'melee_adv']) b.chat('/ufadmin give ' + id);
  await sleep(1500);
  const find = (id) => b.inventory.items().find((i) => JSON.stringify(i.components || '').includes('uf:' + id));
  const expectCmd = { dgw_2: 1002, dgw_9: 1009, dgb_5: 1105, dga_lord_chest: 1232, cg_sword: 1301, cg_helmet: 1303, gun_handgun: 1501, melee_adv: 1402 };
  for (const [id, n] of Object.entries(expectCmd)) {
    const it = find(id);
    check(`${id}: skin number ${n}`, it && cmdOf(it) === n, it ? String(cmdOf(it)) : 'missing');
  }
  check('dgw_9: unbreakable', !!comp(find('dgw_9'), 'unbreakable'));
  check('dgw_9: attack shown (30)', /攻撃力: 30/.test(loreOf(find('dgw_9'))), loreOf(find('dgw_9')).slice(0, 200));
  check('dga_lord_chest: defense shown (10%)', /受けるダメージ -10/.test(loreOf(find('dga_lord_chest'))));
  check('cg_sword: attack shown (32)', /攻撃力: 32/.test(loreOf(find('cg_sword'))));

  // --- ダメージ: dgw_2（鉄の剣 3 → 8）で 1 回叩くと、溜めた一撃なら体力のバーで 8（= 16 HP）減る ---
  con(`tp ${NAME} 0 -60 0 -90 0`); await sleep(800);
  con('kill @e[type=!player]');
  con('summon husk 3 -60 0 {NoAI:1b,Silent:1b,Health:200f,attributes:[{id:"minecraft:max_health",base:200d}],Tags:["uftest"]}');
  // uf_gearon は dungeon のモジュール。区域がないのでワールド全体がダンジョン
  await sleep(1200);
  const husk = () => Object.values(b.entities).find((e) => e.name === 'husk');
  const hp = (e) => { const m = e.metadata; for (const k of [9]) if (typeof m[k] === 'number') return m[k]; return null; };
  await b.equip(find('dgw_2'), 'hand'); await sleep(1500);
  let h = husk();
  const h0 = hp(h);
  await b.lookAt(h.position.offset(0, 1, 0), true); b.attack(h); await sleep(800);
  const h1 = hp(husk());
  // 鉄の剣の溜めた一撃は 6 HP。8/3 倍で 16 HP（会心は 2 倍で 32、ジャンプ中の会心は付けない）
  check('dgw_2 hits about 16 HP (was 6.6)', h0 - h1 >= 15 && h0 - h1 <= 33, `${h0} -> ${h1} (${h0 - h1})`);
  await b.equip(find('dgw_9'), 'hand'); await sleep(1500);
  const h2 = hp(husk());
  b.attack(husk()); await sleep(800);
  const h3 = hp(husk());
  // ネザライトの剣 8 HP → 30/4 倍で 60 HP
  check('dgw_9 hits about 60 HP (was 10.4)', h2 - h3 >= 55 && h2 - h3 <= 125, `${h2} -> ${h3} (${h2 - h3})`);

  // --- 前に手に入れた武具の作り直し（スキン番号なし・鋭さ 3 → 入り直すと番号つき・鋭さ 3 のまま）---
  con(`give ${NAME} iron_sword[enchantments={levels:{"minecraft:sharpness":3}},lore=['{"text":"uf:dgw_3","color":"dark_gray"}','{"text":"uflv:2","color":"dark_gray"}']]`);
  await sleep(1000);
  b.quit(); await sleep(1500);
  b = await join(); await sleep(2500);
  const old = find('dgw_3');
  const ench = JSON.stringify(comp(old, 'enchantments') || '');
  check('old dgw_3 rebuilt with skin number', old && cmdOf(old) === 1003, old ? String(cmdOf(old)) : 'missing');
  check('old dgw_3 keeps level 2', /uflv:2/.test(loreOf(old)), loreOf(old).slice(0, 300));
  check('old dgw_3 keeps sharpness', /sharpness/.test(ench) || /"id":\d+,"level":3/.test(ench), ench.slice(0, 200));
  check('rebuild message', b.msgs.some((m) => /武具 \d+ 個を新しくした/.test(m)));
  check('resource pack is sent on join', b.packs.some((u) => /uf_pack\.zip$/.test(u)), b.packs.join(','));

  // --- 地下カジノ ---
  con(`tp ${NAME} -271.5 70 95.5`); await sleep(1500);
  let from = b.msgs.length;
  b.chat('/zzchall build');
  check('casino hall built', !!(await waitMsg(from, /地下カジノを作りました/, 20000)));
  con(`tp ${NAME} -271.5 56 99.5 180 0`); await sleep(2000);
  const blk = (x, y, z) => { const k = b.blockAt(new Vec3(x, y, z)); return k ? k.name : '?'; };
  check('slot machine screen', blk(-276, 57, 98) === 'sea_lantern', blk(-276, 57, 98));
  check('slot button', /button/.test(blk(-275, 57, 98)), blk(-275, 57, 98));
  check('entrance is open', blk(-273, 57, 93) === 'air' && blk(-272, 56, 93) === 'air', blk(-273, 57, 93));
  check('roulette wheel', blk(-260, 56, 109) === 'gold_block');
  check('gacha', blk(-240, 57, 94) === 'ender_chest');
  check('room interior is air', blk(-250, 58, 120) === 'air');
  check('casino NPC placed', Object.values(b.entities).some((e) => e.name === 'villager' && e.position.distanceTo(new Vec3(-261.5, 56, 95.5)) < 1.5));
  check('labels placed', Object.values(b.entities).filter((e) => e.name === 'text_display').length >= 10, String(Object.values(b.entities).filter((e) => e.name === 'text_display').length));

  b.chat('/ufadmin chips ' + NAME + ' set 5000'); await sleep(800);
  const chips = async () => { const f0 = b.msgs.length; b.chat('/ufadmin info ' + NAME); const m = await waitMsg(f0, /chip (\d+)/, 4000); return m ? Number(m.match(/chip (\d+)/)[1]) : null; };
  // 賭け金のボタン（10 → 50）
  con(`tp ${NAME} -265.5 56 98.5 180 30`); await sleep(1200);
  from = b.msgs.length;
  await b.activateBlock(b.blockAt(new Vec3(-266, 57, 97)));
  check('bet button changes the bet', !!(await waitMsg(from, /賭け金を \d+ チップ/, 3000)));
  // スロット
  con(`tp ${NAME} -273.5 56 98.5 90 0`); await sleep(1200);
  const c0 = await chips();
  from = b.msgs.length;
  await b.activateBlock(b.blockAt(new Vec3(-275, 57, 98)));
  const sm = await waitMsg(from, /当たり|はずれ/, 3000);
  check('slot machine plays', !!sm, sm || '');
  const c1 = await chips();
  check('slot uses the bet', c1 < c0 || c1 > c0, `${c0} -> ${c1}`);
  // ルーレット（赤のボタン）
  con(`tp ${NAME} -260.5 56 106.5 0 40`); await sleep(1200);
  from = b.msgs.length;
  await b.activateBlock(b.blockAt(new Vec3(-261, 57, 108)));
  check('roulette red button plays', !!(await waitMsg(from, /ルーレットの結果/, 3000)));
  // 交換のカウンター → カジノの画面
  con(`tp ${NAME} -261.5 56 98.5 180 30`); await sleep(1200);
  await b.activateBlock(b.blockAt(new Vec3(-262, 57, 97))); await sleep(1500);
  const title = b.currentWindow ? JSON.stringify(b.currentWindow.title) : '';
  check('exchange counter opens the casino', /地下カジノ/.test(title), title.slice(0, 80));
  if (b.currentWindow) b.closeWindow(b.currentWindow);
  await sleep(500);
  // /casino はカジノの区域（この部屋）の中で使える
  from = b.msgs.length;
  b.chat('/casino'); await sleep(1500);
  check('/casino works in the hall', b.currentWindow && /地下カジノ/.test(JSON.stringify(b.currentWindow.title)));
  if (b.currentWindow) b.closeWindow(b.currentWindow);
  con(`tp ${NAME} 0 -60 0`); await sleep(1000);
  from = b.msgs.length;
  b.chat('/casino');
  check('/casino refused outside', !!(await waitMsg(from, /15号館の地下で利用できます/, 3000)));
  // 埋め戻す
  con(`tp ${NAME} -271.5 70 95.5`); await sleep(1000);
  from = b.msgs.length;
  b.chat('/zzchall fill');
  check('casino hall filled', !!(await waitMsg(from, /埋め戻しました/, 20000)));
  con(`tp ${NAME} -271.5 70 99.5`); await sleep(1500);
  check('filled with dirt', blk(-250, 58, 120) === 'dirt', blk(-250, 58, 120));

  const fail = results.filter((r) => r[0] === 'FAIL');
  log(`RESULT ${results.length - fail.length}/${results.length}`);
  for (const f of fail) log('FAIL', f[1], f[2]);
  b.quit(); await sleep(500); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
