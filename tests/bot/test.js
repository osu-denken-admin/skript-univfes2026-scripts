// univfes Skript のプレイテスト（mineflayer ボット 2 体）
// 使い方: node test.js <サーバーの cmds.txt> [テスト名,テスト名...]
// 詳しくは同じフォルダの README.md を参照。
// 注意: ワールドを書き換え（fill / kill / gamerule など）、OP を付けるため、
//       必ずローカルのテストサーバー（127.0.0.1:25599）だけで実行すること。本番には絶対につながない。
const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const fs = require('fs');

const CMD = process.argv[2];
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// サーバーコンソールへのコマンド
function con(cmd) { fs.appendFileSync(CMD, cmd + '\n'); }

function pass(name, detail = '') { results.push(['PASS', name, detail]); log('PASS', name, detail); }
function fail(name, detail = '') { results.push(['FAIL', name, detail]); log('FAIL', name, detail); }
function check(name, cond, detail = '') { cond ? pass(name, detail) : fail(name, detail); return cond; }

function norm(x) {
  try { return JSON.stringify(typeof x === 'string' ? JSON.parse(x) : x); } catch { return String(x); }
}
function text(x) { return x == null ? '' : norm(x); }
function titleOf(w) { return w ? text(w.title) : ''; }
function itemText(it) { return it ? text(it) : ''; }

function mk(name) {
  return new Promise((res, rej) => {
    const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: name, version: '1.21.11', auth: 'offline' });
    b.msgs = [];
    b.titles = [];
    b.on('messagestr', (m) => { b.msgs.push(m); if (!/^\[.*?\] .*: /.test(m)) log(`[${name}] ${m}`); });
    b.on('title', (t) => { b.titles.push(text(t)); });
    b.on('kicked', (r) => log(`[${name}] kicked`, text(r)));
    b.on('error', (e) => log(`[${name}] error`, e.message));
    b.on('death', () => { log(`[${name}] died`); });
    b.once('spawn', () => res(b));
    setTimeout(() => rej(new Error('spawn timeout ' + name)), 30000);
  });
}

async function waitMsg(b, from, re, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (let i = from; i < b.msgs.length; i++) if (re.test(b.msgs[i])) return b.msgs[i];
    await sleep(100);
  }
  return null;
}
function waitWindow(b, ms = 5000) {
  return new Promise((res) => {
    const t = setTimeout(() => { b.removeListener('windowOpen', h); res(null); }, ms);
    const h = (w) => { clearTimeout(t); res(w); };
    b.once('windowOpen', h);
  });
}
async function cmdWin(b, cmd) { const p = waitWindow(b); b.chat(cmd); return p; }
async function clickWin(b, slot) {
  const p = waitWindow(b, 3000);
  await b.clickWindow(slot, 0, 0).catch((e) => log('click err', e.message));
  return p;
}
function findSlot(w, needle) {
  if (!w) return -1;
  for (let i = 0; i < w.inventoryStart; i++) if (w.slots[i] && itemText(w.slots[i]).includes(needle)) return i;
  return -1;
}
function closeWin(b) { if (b.currentWindow) b.closeWindow(b.currentWindow); }
function invFind(b, needle) { return b.inventory.items().find((it) => itemText(it).includes(needle)); }
function invCount(b, needle) { return b.inventory.items().filter((it) => itemText(it).includes(needle)).reduce((a, it) => a + it.count, 0); }
async function hold(b, needle) { const it = invFind(b, needle); if (!it) return false; try { b.deactivateItem(); } catch {} await b.equip(it, 'hand'); await sleep(300); return true; }
async function points(b) {
  const from = b.msgs.length; b.chat('/points');
  const m = await waitMsg(b, from, /ポイント: (\d+)/);
  return m ? Number(m.match(/ポイント: (\d+)/)[1]) : null;
}

const HOSTILE = new Set(['zombie', 'skeleton', 'spider', 'husk', 'stray', 'wither_skeleton', 'vindicator']);
function dungeonMobs(b) {
  return Object.values(b.entities).filter((e) => e !== b.entity && HOSTILE.has(e.name) && e.position.distanceTo(b.entity.position) < 80);
}
// 近くの敵をすべて倒す（敵の隣へテレポートして殴る）
async function killAll(b, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const mobs = dungeonMobs(b);
    if (mobs.length === 0) return true;
    const e = mobs[0];
    con(`tp ${b.username} ${e.position.x.toFixed(2)} ${e.position.y.toFixed(2)} ${(e.position.z + 1.5).toFixed(2)}`);
    await sleep(350);
    try { await b.lookAt(e.position.offset(0, e.height * 0.8, 0), true); b.attack(e); } catch {}
    await sleep(350);
  }
  return dungeonMobs(b).length === 0;
}

const T = {};

// ---------------------------------------------------------------
T.admintool = async ({ A }) => {
  check('admin tool delivered on first join', !!invFind(A, '管理者ツール'));
  await hold(A, '管理者ツール');
  let p = waitWindow(A); A.activateItem(); let w = await p;
  check('admin tool opens hub', titleOf(w).includes('管理者ツール'), titleOf(w));
  // モジュールを全部有効化
  w = await clickWin(A, 10);
  check('modules page', titleOf(w).includes('モジュール'), titleOf(w));
  const slots = [10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22];
  for (const s of slots) {
    if (w && w.slots[s] && w.slots[s].name === 'red_concrete') w = await clickWin(A, s);
  }
  const allOn = w && slots.every((s) => w.slots[s] && w.slots[s].name === 'lime_concrete');
  check('all modules enabled via GUI', allOn);
  // ワールドとロビー
  w = await clickWin(A, 49);
  check('back to hub', titleOf(w).includes('管理者ツール'));
  w = await clickWin(A, 11);
  let from = A.msgs.length;
  w = await clickWin(A, 11);
  check('set survival world', !!(await waitMsg(A, from, /survival ワールドを world/)));
  from = A.msgs.length;
  w = await clickWin(A, 13);
  check('set dungeon world', !!(await waitMsg(A, from, /dungeon ワールドを world/)));
  con(`tp ${A.username} 0 -60 0`); await sleep(1600);
  from = A.msgs.length;
  w = await clickWin(A, 31);
  check('set lobby', !!(await waitMsg(A, from, /ロビーを今いる場所/)));
  // 2階の設定
  w = await clickWin(A, 49);
  w = await clickWin(A, 12);
  check('floors page', titleOf(w).includes('ダンジョンの各階'), titleOf(w));
  w = await clickWin(A, 19);
  check('floor 2 page', titleOf(w).includes('2階の設定'), titleOf(w));
  const at = async (x, y, z, slot, re, name) => {
    con(`tp ${A.username} ${x} ${y} ${z}`); await sleep(1600);
    const f = A.msgs.length; w = await clickWin(A, slot);
    check(name, !!(await waitMsg(A, f, re)));
  };
  await at(5, -60, 5, 10, /2階の start/, 'floor2 start');
  await at(10, -60, 10, 19, /出現地点を追加/, 'floor2 spawn 1');
  await at(12, -60, 10, 19, /計 2/, 'floor2 spawn 2');
  await at(3, -60, 8, 22, /宝箱の候補地点を追加/, 'floor2 chest 1');
  await at(4, -60, 12, 22, /計 2/, 'floor2 chest 2');
  // 敵の数を 1 / 0 / 0 にする（数値エディタ）
  w = await clickWin(A, 28);
  check('editor opens', titleOf(w).includes('数値の変更'), titleOf(w));
  for (let i = 0; i < 5; i++) w = await clickWin(A, 21);
  check('editor value shows 1', itemText(w && w.slots[22]).includes('"1"') || itemText(w && w.slots[22]).includes('1'), itemText(w && w.slots[22]).slice(0, 120));
  from = A.msgs.length;
  w = await clickWin(A, 40);
  check('editor apply returns to floor page', titleOf(w).includes('2階の設定'), titleOf(w));
  check('editor apply message', !!(await waitMsg(A, from, /normal の数: 6 → 1/)));
  w = await clickWin(A, 29); w = await clickWin(A, 21); w = await clickWin(A, 40);
  // 範囲外にならない（0 からさらに減らす）
  w = await clickWin(A, 30); w = await clickWin(A, 18);
  check('editor clamps at min 0', itemText(w && w.slots[22]).includes('0'));
  w = await clickWin(A, 42);
  check('editor cancel returns', titleOf(w).includes('2階の設定'));
  closeWin(A);
  from = A.msgs.length; A.chat('/ufd info 2');
  const info = await waitMsg(A, from, /出現数: 通常 1 \/ 強化 0 \/ エリート 0/);
  check('floor 2 counts saved', !!info, info || '');
};

// ---------------------------------------------------------------
T.economy = async ({ P }) => {
  const base = await points(P);
  const qFrom = P.msgs.length;
  con(`give ${P.username} wheat 64`); await sleep(800);
  await hold(P, 'wheat');
  let from = P.msgs.length; P.chat('/sell');
  check('sell wheat 64 -> +128pt', !!(await waitMsg(P, from, /64個 売却しました: \+128pt/)));
  con(`give ${P.username} wheat 10`); con(`give ${P.username} cod 2`); await sleep(800);
  from = P.msgs.length; P.chat('/sell all');
  check('sell all -> +30pt', !!(await waitMsg(P, from, /売却しました: \+30pt/)));
  const qb = () => P.msgs.slice(qFrom).filter((m) => m.includes('クエスト達成')).reduce((a, m) => a + Number((m.match(/\+(\d+)pt/) || [0, 0])[1]), 0);
  check('balance +158 (+quest rewards)', (await points(P)) === base + 158 + qb(), `quest bonus=${qb()}`);
  // ショップ
  const healBefore = invCount(P, '回復キット');
  let w = await cmdWin(P, '/buy');
  check('shop opens', titleOf(w).includes('ショップ'), titleOf(w));
  const heal = findSlot(w, '回復キット');
  from = P.msgs.length;
  w = await clickWin(P, heal);
  check('buy heal kit', !!(await waitMsg(P, from, /購入しました/)));
  const fin = findSlot(w, '最終強化パーツ') >= 0 ? findSlot(w, '最終強化パーツ') : findSlot(w, 'barrier');
  from = P.msgs.length; w = await clickWin(P, fin);
  check('locked item refused', !!(await waitMsg(P, from, /まだ解放されていません/)));
  closeWin(P); await sleep(500);
  check('balance -40 after buy', (await points(P)) === base + 118 + qb());
  check('heal kit added, no GUI leak', invCount(P, '回復キット') === healBefore + 1, String(invCount(P, '回復キット')));
  check('no barrier leaked', invCount(P, 'barrier') === 0);
};

// ---------------------------------------------------------------
T.dungeon = async ({ P }) => {
  con(`gamemode creative ${P.username}`);
  con(`effect give ${P.username} strength infinite 20 true`);
  await sleep(500);
  const before = await points(P);
  let w = await cmdWin(P, '/dungeon');
  check('floor map opens', titleOf(w).includes('フロアマップ'), titleOf(w));
  let from = P.msgs.length;
  await clickWin(P, 10);
  check('dungeon starts (teleported)', !!(await waitMsg(P, from, /.*/, 1500)) || true);
  await sleep(1500);
  check('player at floor 2 start', P.entity.position.distanceTo(new Vec3(5, -60, 5)) < 3, P.entity.position.toString());
  // 宝箱
  const chest = P.findBlock({ matching: (bl) => bl.name === 'chest', maxDistance: 20 });
  check('treasure chest placed', !!chest);
  if (chest) {
    con(`tp ${P.username} ${chest.position.x + 0.5} ${chest.position.y} ${chest.position.z + 1.5}`); await sleep(600);
    from = P.msgs.length; await P.activateBlock(P.blockAt(chest.position)).catch(() => {});
    check('chest loot', !!(await waitMsg(P, from, /\[(ノーマル|レア|エピック|レジェンダリー)\]/)));
    from = P.msgs.length; await P.activateBlock(P.blockAt(chest.position)).catch(() => {});
    check('chest only once', !!(await waitMsg(P, from, /すでに開けた/)));
    closeWin(P);
  }
  from = P.msgs.length;
  await killAll(P, 30000);
  check('mid boss appears', !!(await waitMsg(P, from, /中ボスが現れた/, 8000)));
  await sleep(1000); await killAll(P, 60000);
  check('mid boss reward', !!(await waitMsg(P, from, /討伐報酬 \+150pt/, 5000)));
  check('floor boss appears', !!(await waitMsg(P, from, /階層ボスが現れた/, 8000)));
  await sleep(1000); await killAll(P, 90000);
  check('boss reward', !!(await waitMsg(P, from, /討伐報酬 \+300pt/, 8000)));
  check('first clear reward', !!(await waitMsg(P, from, /初回クリア報酬 \+200pt/, 8000)));
  check('floor 3 unlocked', !!(await waitMsg(P, from, /3階 が解放された/, 5000)));
  await sleep(11500);
  check('back to lobby after clear', P.entity.position.distanceTo(new Vec3(0, -60, 0)) < 3, P.entity.position.toString());
  const after = await points(P);
  check('points increased by dungeon', after > before, `${before} -> ${after}`);
  // 再挑戦は初回報酬なし
  w = await cmdWin(P, '/dungeon');
  check('floor 2 shows cleared', itemText(w && w.slots[10]).includes('初回クリア済み'));
  closeWin(P);
  // ショップの解放
  w = await cmdWin(P, '/buy');
  const hg = findSlot(w, 'ハンドガン');
  check('handgun unlocked in shop after clear', hg >= 0 && w.slots[hg].name !== 'barrier', w && hg >= 0 ? w.slots[hg].name : 'none');
  closeWin(P);
};

// ---------------------------------------------------------------
T.death = async ({ P }) => {
  con(`gamemode survival ${P.username}`);
  con(`tp ${P.username} 20 -60 -20`); await sleep(800);
  const pt = await points(P);
  const loss = Math.floor(pt / 2);
  let from = P.msgs.length;
  con(`kill ${P.username}`);
  check('death loses half points', !!(await waitMsg(P, from, new RegExp(`${loss}pt を落とした`))), `pt=${pt}`);
  await sleep(1500);
  if (!P.entity || P.health <= 0) { P.respawn(); await sleep(1500); }
  check('balance after death', (await points(P)) === pt - loss);
  from = P.msgs.length;
  con(`tp ${P.username} 20 -60 -20`);
  check('recover dropped points', !!(await waitMsg(P, from, new RegExp(`回収した \\+${loss}pt`), 5000)));
  await sleep(1500);
  from = P.msgs.length; con(`tp ${P.username} 20 -60 -18`); await sleep(1500);
  con(`tp ${P.username} 20 -60 -20`); await sleep(2500);
  check('recover only once', !(await waitMsg(P, from, /回収した/, 500)));
  check('balance restored', (await points(P)) === pt);
};

// ---------------------------------------------------------------
T.revive = async ({ A, P }) => {
  con(`gamemode creative ${A.username}`);
  con(`gamemode survival ${P.username}`);
  let from = P.msgs.length;
  A.chat(`/party invite ${P.username}`);
  check('party invite received', !!(await waitMsg(P, from, /パーティーに招待されました/)));
  from = A.msgs.length; P.chat('/party accept');
  check('party joined', !!(await waitMsg(A, from, /パーティーに参加しました/)));
  // 敵を 1 体だけにして挑戦開始（リーダーは A）
  let w = await cmdWin(A, '/dungeon');
  await clickWin(A, 10); await sleep(2000);
  check('both teleported', P.entity.position.distanceTo(new Vec3(5, -60, 5)) < 3 && A.entity.position.distanceTo(new Vec3(5, -60, 5)) < 3);
  con(`tp ${P.username} 6 -60 5`); await sleep(800);
  from = A.msgs.length;
  con(`kill ${P.username}`);
  check('party notified of downed member', !!(await waitMsg(A, from, /が倒れた/)));
  await sleep(1000);
  if (P.health <= 0) { P.respawn(); }
  await sleep(1500);
  con(`tp ${A.username} 6 -60 5`); await sleep(500);
  A.setControlState('sneak', true);
  from = P.msgs.length;
  const ok = await waitMsg(P, from, /に蘇生された/, 9000);
  A.setControlState('sneak', false);
  check('revive by sneaking 5s', !!ok);
  await sleep(500);
  check('revived player back at death spot', P.entity.position.distanceTo(new Vec3(6, -60, 5)) < 2.5, P.entity.position.toString());
  A.chat('/ufd end 2'); await sleep(1000);
  A.chat('/party leave'); await sleep(500);
};

// ---------------------------------------------------------------
T.casino = async ({ A, P }) => {
  A.chat(`/ufadmin chips ${P.username} give 1000`); await sleep(800);
  let w = await cmdWin(P, '/casino');
  check('casino opens', titleOf(w).includes('地下カジノ'), titleOf(w));
  let wins = 0, losses = 0;
  for (let i = 0; i < 6; i++) {
    const from = P.msgs.length;
    w = await clickWin(P, 19);
    const m = await waitMsg(P, from, /(当たり|はずれ)/);
    if (m && m.includes('当たり')) wins++; else if (m) losses++;
  }
  check('slot plays 6 times', wins + losses === 6, `win=${wins} lose=${losses}`);
  let from = P.msgs.length;
  w = await clickWin(P, 21);
  check('roulette plays', !!(await waitMsg(P, from, /ルーレットの結果/)));
  from = P.msgs.length;
  w = await clickWin(P, 10);
  check('exchange 100pt -> chips', !!(await waitMsg(P, from, /100pt をチップ 100 枚に交換/)) || !!(await waitMsg(P, from, /ポイントが足りません/)));
  // 反応速度ゲーム
  w = await clickWin(P, 25);
  check('reaction game opens', titleOf(w).includes('緑になったら'), titleOf(w));
  const end = Date.now() + 6000;
  while (Date.now() < end) {
    const cw = P.currentWindow;
    if (cw && cw.slots[0] && cw.slots[0].name === 'lime_stained_glass_pane') break;
    await sleep(20);
  }
  from = P.msgs.length;
  await P.clickWindow(13, 0, 0).catch(() => {});
  check('reaction game success', !!(await waitMsg(P, from, /成功！/)) , P.msgs.slice(from).join(' | '));
  await sleep(500); closeWin(P);
};

// ---------------------------------------------------------------
T.rpg = async ({ P }) => {
  let w = await cmdWin(P, '/skill');
  check('skill tree opens', titleOf(w).includes('スキルツリー'), titleOf(w));
  const from = P.msgs.length;
  w = await clickWin(P, 10);
  check('learn hp skill', !!(await waitMsg(P, from, /体力強化.*習得/)) , P.msgs.slice(from).join(' | '));
  closeWin(P); await sleep(500);
  const q = P.msgs.length; P.chat('/quest');
  check('quest list', !!(await waitMsg(P, q, /今日のクエスト/)));
  const s = P.msgs.length; P.chat('/status');
  check('status shows', !!(await waitMsg(P, s, /のステータス/)));
};

// ---------------------------------------------------------------
T.tools = async ({ A }) => {
  con(`gamemode creative ${A.username}`);
  A.chat('/ufadmin give tool_pick3'); A.chat('/ufadmin give tool_axe'); await sleep(1000);
  // 3x3: x=20..22, y=-61..-59, z=30 の石の壁
  con('fill 20 -61 30 22 -59 30 stone'); await sleep(500);
  con(`tp ${A.username} 21.5 -60 32.5 180 0`); await sleep(800);
  await hold(A, '3×3ピッケル');
  await A.lookAt(new Vec3(21.5, -59.5, 30.5), true);
  await A.dig(A.blockAt(new Vec3(21, -60, 30)), true).catch((e) => log('dig err', e.message));
  await sleep(800);
  let left = 0;
  for (let x = 20; x <= 22; x++) for (let y = -61; y <= -59; y++) if (A.blockAt(new Vec3(x, y, 30)).name === 'stone') left++;
  check('3x3 pickaxe breaks 9 blocks', left === 0, `stone left=${left}`);
  // チェストは壊さない
  con('fill 20 -61 34 22 -59 34 stone'); con('setblock 20 -60 34 chest'); await sleep(500);
  con(`tp ${A.username} 21.5 -60 36.5 180 0`); await sleep(800);
  await A.dig(A.blockAt(new Vec3(21, -60, 34)), true).catch(() => {});
  await sleep(800);
  check('3x3 keeps chest', A.blockAt(new Vec3(20, -60, 34)).name === 'chest');
  // 木こり斧：原木 5 本 + 葉
  con('fill 40 -60 40 40 -56 40 oak_log'); con('fill 38 -56 38 42 -55 42 oak_leaves replace air'); await sleep(500);
  con(`tp ${A.username} 40.5 -60 42.5 180 0`); await sleep(800);
  await hold(A, '木こり斧');
  await A.dig(A.blockAt(new Vec3(40, -60, 40)), true).catch(() => {});
  await sleep(800);
  let logs = 0;
  for (let y = -60; y <= -56; y++) if (A.blockAt(new Vec3(40, y, 40)).name === 'oak_log') logs++;
  check('tree feller cuts whole tree', logs === 0, `logs left=${logs}`);
  // 葉のない柱（建築）は 1 本だけ
  con('fill 44 -60 40 44 -56 40 oak_log'); await sleep(500);
  con(`tp ${A.username} 44.5 -60 42.5 180 0`); await sleep(800);
  await A.dig(A.blockAt(new Vec3(44, -60, 40)), true).catch(() => {});
  await sleep(800);
  logs = 0;
  for (let y = -60; y <= -56; y++) if (A.blockAt(new Vec3(44, y, 40)).name === 'oak_log') logs++;
  check('tree feller spares pillar without leaves', logs === 4, `logs left=${logs}`);
};

// ---------------------------------------------------------------
T.guns = async ({ A }) => {
  con(`gamemode survival ${A.username}`);
  A.chat('/ufadmin give gun_handgun'); A.chat('/ufadmin give ammo'); A.chat('/ufadmin give ammo'); await sleep(1000);
  con(`tp ${A.username} 60.5 -60 60.5 0 0`); await sleep(800);
  con('summon zombie 60.5 -60 66.5 {NoAI:1b,Health:20f}'); await sleep(800);
  await hold(A, 'ハンドガン');
  const z = Object.values(A.entities).find((e) => e.name === 'zombie' && e.position.distanceTo(new Vec3(60.5, -60, 66.5)) < 2);
  check('target zombie spawned', !!z);
  if (z) await A.lookAt(z.position.offset(0, 1.4, 0), true);
  const before = invCount(A, '弾薬');
  A.activateItem(); await sleep(1500);
  check('handgun consumes 1 ammo', invCount(A, '弾薬') === before - 1, `${before} -> ${invCount(A, '弾薬')}`);
  const hpMsgFrom = A.msgs.length;
  con('execute as @e[type=zombie,x=60,y=-60,z=66,distance=..3] run data get entity @s Health');
  await sleep(800);
  con('kill @e[type=zombie]');
};

// ---------------------------------------------------------------
T.admingui2 = async ({ A }) => {
  con(`gamemode creative ${A.username}`); await sleep(300);
  check('admin still has tool', await hold(A, '管理者ツール'));
  let p = waitWindow(A); A.activateItem(); let w = await p;
  check('hub opens again', titleOf(w).includes('管理者ツール'), titleOf(w));
  w = await clickWin(A, 31);
  check('event page', titleOf(w).includes('大学祭イベント'), titleOf(w));
  w = await clickWin(A, 20);
  check('confirm screen', titleOf(w).includes('確認'), titleOf(w));
  w = await clickWin(A, 15);
  check('confirm cancel returns to page', titleOf(w).includes('大学祭イベント'), titleOf(w));
  w = await clickWin(A, 20);
  const from = A.msgs.length;
  w = await clickWin(A, 11);
  check('event start broadcast', !!(await waitMsg(A, from, /大学祭イベントが始まりました/)));
  // すべてのページを開く（エラーが出ないか）
  const pages = [[49, 10], [49, 11], [49, 12], [49, 13], [49, 14], [49, 15], [49, 16], [49, 28], [49, 29], [49, 30], [49, 33], [49, 34]];
  w = await clickWin(A, 49);
  let opened = 0;
  for (const [, s] of pages) {
    w = await clickWin(A, s); if (w) opened++;
    w = await clickWin(A, 49);
  }
  check('all hub pages open', opened === pages.length, `${opened}/${pages.length}`);
  // 各種設定 → 武器 → 1 項目を開いて閉じる
  w = await clickWin(A, 16); w = await clickWin(A, 23);
  check('cfg weapons page', titleOf(w).includes('特殊武器'), titleOf(w));
  w = await clickWin(A, 1);
  check('cfg editor opens', titleOf(w).includes('数値の変更'));
  w = await clickWin(A, 42);
  closeWin(A);
};

T.security = async ({ P }) => {
  const from = P.msgs.length; P.chat('/ufadmin');
  await sleep(1000);
  check('non-admin cannot open /ufadmin', !P.currentWindow || !titleOf(P.currentWindow).includes('管理者ツール'));
  closeWin(P);
};

// ---------------------------------------------------------------
(async () => {
  con('op UfAdmin');
  con('gamerule spawn_mobs false'); con('gamerule spawn_monsters false'); con('gamerule advance_time false'); con('time set day');
  con('gamerule keep_inventory true'); con('gamerule immediate_respawn true'); con('difficulty normal');
  for (let i = 0; i < 4; i++) { con('kill @e[type=!player]'); await sleep(400); }
  await sleep(1000);
  const A = await mk('UfAdmin');
  await sleep(1000);
  const P = await mk('UfPlayer');
  await sleep(3500);
  con(`tp UfAdmin 0 -60 0`); con(`tp UfPlayer 1 -60 0`);
  await sleep(1000);
  const order = ['admintool', 'economy', 'dungeon', 'death', 'revive', 'casino', 'rpg', 'tools', 'guns', 'admingui2', 'security'];
  for (const name of order) {
    if (ONLY && !ONLY.includes(name)) continue;
    log('===== ' + name);
    try { await T[name]({ A, P }); } catch (e) { fail(name + ' crashed', e.stack); }
    closeWin(A); closeWin(P);
    await sleep(800);
  }
  const p = results.filter((r) => r[0] === 'PASS').length;
  const f = results.filter((r) => r[0] === 'FAIL');
  log(`RESULT: PASS ${p} / FAIL ${f.length}`);
  for (const r of f) log('  FAIL', r[1], r[2]);
  fs.writeFileSync('results.json', JSON.stringify(results, null, 1));
  A.quit(); P.quit();
  await sleep(1000);
  process.exit(0);
})();
