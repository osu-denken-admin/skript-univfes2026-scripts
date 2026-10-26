// univfes Skript のプレイテスト（mineflayer ボット 2 体）
// 使い方: node test.js <サーバーの cmds.txt> [テスト名,テスト名...]
// 詳しくは同じフォルダの README.md を参照。
// 注意: ワールドを書き換え（fill / kill / gamerule など）、OP を付けるため、
//       必ずローカルのテストサーバー（127.0.0.1:25599）だけで実行すること。本番には絶対につながない。
const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');
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
    const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: name, version: process.env.MC_VERSION || false, auth: 'offline' });
    b.msgs = [];
    b.titles = [];
    b.on('messagestr', (m) => { b.msgs.push(m); if (!/^\[.*?\] .*: /.test(m)) log(`[${name}] ${m}`); });
    b.on('title', (t) => { b.titles.push(text(t)); });
    // アクションバー。Skript 2.16 は action_bar パケット（mineflayer はイベントにしないので文字だけ取り出す）、
    // 2.13 はオーバーレイのチャット（messagestr の game_info）で届く
    b.actionbar = '';
    b.on('messagestr', (m, pos) => { if (pos === 'game_info') b.actionbar = m; });
    // 届いた粒子の位置（回収マーカーが本人にだけ見えるかを確かめる）
    b.particles = [];
    b._client.on('world_particles', (d) => { b.particles.push({ x: d.x, y: d.y, z: d.z }); if (b.particles.length > 5000) b.particles.shift(); });
    const plain = (n) => (n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(plain).join('') : (n.text ?? n[''] ?? '') + plain(n.extra));
    b._client.on('action_bar', (d) => { b.actionbar = plain(d.text && d.text.type ? nbt.simplify(d.text) : d.text); });
    b.on('kicked', (r) => log(`[${name}] kicked`, text(r)));
    b.on('error', (e) => log(`[${name}] error`, e.message));
    b.on('death', () => { log(`[${name}] died`); });
    // サーバーが開いた本（管理者ツール）を記録する
    b.book = null; b.nbooks = 0;
    let slotBook = null;
    b._client.on('packet', (d, meta) => {
      if (meta.name === 'set_slot' && d.item && d.item.components) { const r = readBook(d.item); if (r) slotBook = r; }
      if (meta.name === 'open_book') { b.book = slotBook; b.nbooks++; }
    });
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

// ---- 管理者ツールの本 ----
// 本の文字を「表示文字列」と「押せる項目」にする。項目は /ufadmin ui <画面番号> <スロット|yes|no>
function flattenText(node, click, hover, out) {
  if (node == null) return;
  if (typeof node === 'string') { out.text += node; return; }
  if (Array.isArray(node)) { node.forEach((n) => flattenText(n, click, hover, out)); return; }
  const c = node.clickEvent ? node.clickEvent.value : click;
  const h = node.hoverEvent ? JSON.stringify(node.hoverEvent.contents) : (node.clickEvent ? '' : hover);
  const t = node.text ?? node[''] ?? '';
  out.text += t;
  if (c && t.trim()) {
    const key = c.split(' ').pop();
    if (out.links[key]) out.links[key].text += t; else out.links[key] = { text: t, cmd: c, hover: h };
  }
  if (node.extra) flattenText(node.extra, c, h, out);
}
function readBook(item) {
  const comp = item.components.find((x) => x.type === 'written_book_content');
  if (!comp) return null;
  const out = { text: '', links: {} };
  comp.data.pages.forEach((p) => { flattenText(p.content.type ? nbt.simplify(p.content) : p.content, null, '', out); out.text += '\n'; });
  return out;
}
// チェスト画面の代わりに、本を { title: 本の文字, links: スロット → 項目 } で返す
const bookWin = (bk) => (bk ? { title: bk.text, links: bk.links } : null);
async function waitBook(b, n, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (b.nbooks > n) return bookWin(b.book); await sleep(50); }
  return null;
}
async function openTool(b) {
  if (!(await hold(b, '管理者ツール'))) return null;
  const n = b.nbooks; b.activateItem(); const w = await waitBook(b, n); b.deactivateItem(); return w;
}
// 本の項目を押す（slot はスロット番号、確認の本では 'yes' / 'no'）
async function clickBook(b, slot) {
  const l = b.book && b.book.links[String(slot)];
  if (!l) { log('no book link', slot); return null; }
  const n = b.nbooks; b.chat(l.cmd); return waitBook(b, n, 3000);
}
const modOn = (w, s) => !!(w && w.links[s] && w.links[s].hover.includes('クリックで無効'));
function invFind(b, needle) { return b.inventory.items().find((it) => itemText(it).includes(needle)); }
function invCount(b, needle) { return b.inventory.items().filter((it) => itemText(it).includes(needle)).reduce((a, it) => a + it.count, 0); }
async function hold(b, needle) { const it = invFind(b, needle); if (!it) return false; try { b.deactivateItem(); } catch {} await b.equip(it, 'hand'); await sleep(300); return true; }
async function points(b) {
  const from = b.msgs.length; b.chat('/points');
  const m = await waitMsg(b, from, /ポイント: (\d+)/);
  return m ? Number(m.match(/ポイント: (\d+)/)[1]) : null;
}

// しゃがむ。1.21.2〜1.21.5 では mineflayer の setControlState だけではサーバーに届かないため、パケットも直接送る
function sneak(b, on) {
  b.setControlState('sneak', on);
  try { b._client.write('player_input', { inputs: { shift: on } }); } catch {}
  try { b._client.write('entity_action', { entityId: b.entity.id, actionId: on ? 0 : 1, jumpBoost: 0 }); } catch {}
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
  let w = await openTool(A);
  check('admin tool opens hub', titleOf(w).includes('管理者ツール'), titleOf(w).slice(0, 80));
  check('hub links have hover text', !!w && Object.values(w.links).every((l) => l.hover.length > 2));
  // モジュールを全部有効化
  w = await clickBook(A, 10);
  check('modules page', titleOf(w).includes('モジュール'), titleOf(w).slice(0, 80));
  const slots = [10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22];
  for (const s of slots) {
    if (w && w.links[s] && !modOn(w, s)) w = await clickBook(A, s);
  }
  check('all modules enabled via GUI', !!w && slots.every((s) => modOn(w, s)));
  // ワールドとロビー
  w = await clickBook(A, 49);
  check('back to hub', titleOf(w).includes('管理者ツール'));
  w = await clickBook(A, 11);
  let from = A.msgs.length;
  w = await clickBook(A, 11);
  check('set survival world', !!(await waitMsg(A, from, /survival ワールドを world/)));
  from = A.msgs.length;
  w = await clickBook(A, 13);
  check('set dungeon world', !!(await waitMsg(A, from, /dungeon ワールドを world/)));
  con(`tp ${A.username} 0 -60 0`); await sleep(1600);
  from = A.msgs.length;
  w = await clickBook(A, 31);
  check('set lobby', !!(await waitMsg(A, from, /ロビーを今いる場所/)));
  // 古い本を押しても操作されない
  const stale = A.book.links['31'].cmd.replace(/ui (\d+)/, (m, id) => `ui ${Number(id) - 1}`);
  from = A.msgs.length; A.chat(stale);
  check('stale book click only reopens', !!(await waitMsg(A, from, /古い画面/)) && !A.msgs.slice(from).some((m) => /ロビーを今いる場所/.test(m)));
  await sleep(500);
  // 2階の設定
  w = await clickBook(A, 49);
  w = await clickBook(A, 12);
  check('floors page', titleOf(w).includes('ダンジョンの各階'), titleOf(w).slice(0, 80));
  w = await clickBook(A, 19);
  check('floor 2 page', titleOf(w).includes('2階の設定'), titleOf(w).slice(0, 80));
  // 前の設定（15号館の内装に合わせた登録など）が残っていても数えられるよう、先に消す（確認の本で実行）
  await clickBook(A, 20); w = await clickBook(A, 'yes');
  await clickBook(A, 23); w = await clickBook(A, 'yes');
  // 説明（ホバー）の「:」は全角になる
  check('floor 2 spawns/chests cleared via confirm book', /登録数： 0/.test(JSON.stringify(w && w.links['19'])) && /登録数： 0/.test(JSON.stringify(w && w.links['22'])));
  const at = async (x, y, z, slot, re, name) => {
    con(`tp ${A.username} ${x} ${y} ${z}`); await sleep(1600);
    const f = A.msgs.length; w = await clickBook(A, slot);
    check(name, !!(await waitMsg(A, f, re)));
  };
  await at(5, -60, 5, 10, /2階の start/, 'floor2 start');
  await at(10, -60, 10, 19, /出現地点を追加/, 'floor2 spawn 1');
  await at(12, -60, 10, 19, /計 2/, 'floor2 spawn 2');
  await at(3, -60, 8, 22, /宝箱の候補地点を追加/, 'floor2 chest 1');
  await at(4, -60, 12, 22, /計 2/, 'floor2 chest 2');
  // 敵の数を 1 / 0 / 0 にする（数値エディタ）
  w = await clickBook(A, 28);
  check('editor opens', titleOf(w).includes('数値の変更'), titleOf(w).slice(0, 80));
  // 前の値に関係なく 1 にする（-1000 で下限の 0、+1 で 1）
  w = await clickBook(A, 18); w = await clickBook(A, 23);
  check('editor value shows 1', /変更後: 1\b/.test(w ? w.title : ''), w ? w.title.slice(0, 120) : '');
  from = A.msgs.length;
  w = await clickBook(A, 40);
  check('editor apply returns to floor page', titleOf(w).includes('2階の設定'), titleOf(w).slice(0, 80));
  check('editor apply message', !!(await waitMsg(A, from, /normal の数: \d+ → 1/)));
  w = await clickBook(A, 29); w = await clickBook(A, 18); w = await clickBook(A, 40);
  // 範囲外にならない（0 からさらに減らす）
  w = await clickBook(A, 30); w = await clickBook(A, 18); w = await clickBook(A, 18);
  check('editor clamps at min 0', /変更後: 0\b/.test(w ? w.title : ''));
  w = await clickBook(A, 40);
  // やめると変わらない
  w = await clickBook(A, 28); w = await clickBook(A, 26);
  w = await clickBook(A, 42);
  check('editor cancel returns', titleOf(w).includes('2階の設定'));
  from = A.msgs.length; A.chat('/ufd info 2');
  const info = await waitMsg(A, from, /出現数: 通常 1 \/ 強化 0 \/ エリート 0/);
  check('floor 2 counts saved', !!info, info || '');
};

// ---------------------------------------------------------------
T.economy = async ({ P }) => {
  // 前の回の持ち物が残っていると売却額が変わるので、空にしてから始める
  con(`clear ${P.username}`); await sleep(800);
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
  // 画面下（アクションバー）にポイントが出る。スコアは出さない
  await sleep(1500);
  const bal = await points(P);
  check('action bar shows points', P.actionbar.includes(`ポイント: ${bal}pt`) && !P.actionbar.includes('スコア'), P.actionbar);
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
T.dungeon = async ({ A, P }) => {
  // 平らなテスト用ワールドには壁（ゲート）がないので、中ボス・ボスは管理者の /ufd skip で進める。
  // 15号館での壁・闘技場・階段を使った通し挑戦は drun.js で確認する。
  con(`gamemode creative ${P.username}`);
  con(`effect give ${P.username} strength infinite 20 true`);
  await sleep(500);
  const before = await points(P);
  let w = await cmdWin(P, '/dungeon');
  check('reception opens', titleOf(w).includes('受付'), titleOf(w));
  let from = P.msgs.length;
  await clickWin(P, 10);
  await sleep(2500);
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
  const mid = await points(P);
  await killAll(P, 30000);
  check('kill rewards', (await points(P)) > mid);
  from = P.msgs.length;
  // ボスのレアドロップを必ず出す（uf_19_gear.sk の uf_mobdrop）
  A.chat('/ufadmin cfg drop::boss::rare 100'); A.chat('/ufadmin cfg drop::boss::mat_special 100'); await sleep(600);
  A.chat('/ufd skip 2'); await sleep(800);
  A.chat('/ufd skip 2');
  check('floor boss appears', !!(await waitMsg(P, from, /受付に残る影 が現れた/, 6000)));
  await sleep(800);
  // 剣は手に持つ（前は頭の防具の場所に入っていた）
  // 2 階のボスは黒い革の装備に鉄の剣（uf_18_mobs.sk の表）
  const boss = Object.values(P.entities).find((e) => e.equipment && e.equipment[0] && e.equipment[0].name === 'iron_sword' && e.position.distanceTo(P.entity.position) < 80);
  const eq = (i) => (boss && boss.equipment && boss.equipment[i] ? boss.equipment[i].name : 'none');
  check('boss holds the sword in hand, not on head', eq(0) === 'iron_sword' && eq(5) === 'leather_helmet', `hand=${eq(0)} head=${eq(5)}`);
  await killAll(P, 60000);
  check('boss reward', !!(await waitMsg(P, from, /討伐報酬 \+300pt/, 8000)));
  check('first clear reward', !!(await waitMsg(P, from, /初回突破報酬 \+200pt/, 8000)));
  check('boss drops upgrade materials (2 for sure)', !!(await waitMsg(P, from, /ドロップ: 武器強化素材 ×2/, 3000)));
  check('boss drops the floor rare item', !!(await waitMsg(P, from, /レアドロップ！ 先生の赤ペン ×1/, 3000)) && !!invFind(P, '先生の赤ペン'));
  check('boss drops special material', !!(await waitMsg(P, from, /レアドロップ！ 特殊素材 ×1/, 3000)));
  check('first clear gives the floor weapon', !!(await waitMsg(P, from, /武具を手に入れた！ さしぼうソード/, 4000)) && !!invFind(P, 'さしぼうソード'));
  check('floor 3 unlocked', !!(await waitMsg(P, from, /3階 が解放された/, 5000)));
  check('3F not ready -> run ends', !!(await waitMsg(P, from, /3階は準備中/, 8000)));
  await sleep(1500);
  check('back to lobby after clear', P.entity.position.distanceTo(new Vec3(0, -60, 0)) < 3, P.entity.position.toString());
  await sleep(1500);
  check('action bar shows the next goal', P.actionbar.includes('次の目標: 3階を突破'), P.actionbar);
  const after = await points(P);
  check('points increased by dungeon', after > before, `${before} -> ${after}`);
  w = await cmdWin(P, '/dungeon');
  check('floor 2 shows cleared', itemText(w && w.slots[10]).includes('突破済み'));
  closeWin(P);
  w = await cmdWin(P, '/buy');
  const hg = findSlot(w, 'ハンドガン');
  check('handgun unlocked in shop after clear', hg >= 0 && w.slots[hg].name !== 'barrier', w && hg >= 0 ? w.slots[hg].name : 'none');
  closeWin(P);
};

// ---------------------------------------------------------------
T.death = async ({ A, P }) => {
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
  // 回収マーカー: 死亡地点に、本人にだけ見える粒子が出る
  con(`tp ${P.username} 5 -60 -5`); await sleep(1000);
  P.particles = []; A.particles = [];
  await sleep(2500);
  const nearDeath = (b) => b.particles.filter((q) => Math.abs(q.x - 20.5) < 1.5 && Math.abs(q.z + 19.5) < 1.5).length;
  check('recovery marker is shown to the owner', nearDeath(P) > 0, `${nearDeath(P)}`);
  check('recovery marker is not shown to others', nearDeath(A) === 0, `${nearDeath(A)}`);
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
  // 敵に押されて死亡地点がずれないよう、二人ともクリエイティブ（/kill は効く）
  con(`gamemode creative ${A.username}`);
  con(`gamemode creative ${P.username}`);
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
  sneak(A, true);
  from = P.msgs.length;
  const ok = await waitMsg(P, from, /に蘇生された/, 9000);
  sneak(A, false);
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
  // 追加のゲーム（uf_21_casino2.sk）
  A.chat(`/ufadmin chips ${P.username} give 1000`); await sleep(800);
  w = await cmdWin(P, '/casino');
  check('casino has dice, high-low and gacha', findSlot(w, 'サイコロ') === 37 && findSlot(w, 'ハイ＆ロー') === 39 && findSlot(w, 'ガチャ') === 41);
  w = await clickWin(P, 37);
  check('dice opens', titleOf(w).includes('サイコロ'), titleOf(w).slice(0, 60));
  from = P.msgs.length;
  w = await clickWin(P, 3);
  check('dice rolls', !!(await waitMsg(P, from, /サイコロの目: \d/)) && !!(await waitMsg(P, from, /(当たり|はずれ)/)));
  w = await clickWin(P, 8);
  check('dice back to casino', titleOf(w).includes('地下カジノ'), titleOf(w).slice(0, 60));
  w = await clickWin(P, 39);
  check('high-low opens', titleOf(w).includes('ハイ＆ロー'), titleOf(w).slice(0, 60));
  const side = w && w.slots[11] && w.slots[11].name !== 'barrier' ? 11 : 15;
  from = P.msgs.length;
  w = await clickWin(P, side);
  check('high-low plays', !!(await waitMsg(P, from, /次のカード: \d+/)) && !!(await waitMsg(P, from, /(当たり|はずれ)/)));
  w = P.currentWindow && titleOf(P.currentWindow).includes('地下カジノ') ? P.currentWindow : await cmdWin(P, '/casino');
  w = await clickWin(P, 39);
  from = P.msgs.length;
  closeWin(P);
  check('closing high-low before choosing refunds the bet', !!(await waitMsg(P, from, /賭け金 \d+ チップを返した/)));
  w = await cmdWin(P, '/casino');
  from = P.msgs.length;
  const count = () => P.inventory.items().reduce((a, i) => a + i.count, 0);
  const before = count();
  w = await clickWin(P, 41);
  check('gacha gives a prize', !!(await waitMsg(P, from, /\[ガチャ\]/)));
  await sleep(500);
  check('gacha prize is in the inventory', count() > before, `${before} -> ${count()}`);
  closeWin(P); await sleep(500);
  // 的当て: 動く的（target ブロック）をクリックし続ける
  w = await cmdWin(P, '/casino');
  check('casino has target and timed games', findSlot(w, '的当て') === 47 && findSlot(w, '時間制限チャレンジ') === 51);
  from = P.msgs.length;
  w = await clickWin(P, 47);
  check('target game opens', titleOf(w).includes('的当て'), titleOf(w).slice(0, 60));
  const tEnd = Date.now() + 17000;
  while (Date.now() < tEnd && !P.msgs.slice(from).some((m) => /的当て \d+ 個/.test(m))) {
    const cw = P.currentWindow;
    const ts = cw ? cw.slots.findIndex((it, i) => i < 36 && it && it.name === 'target') : -1;
    if (ts >= 0) await P.clickWindow(ts, 0, 0).catch(() => {});
    await sleep(150);
  }
  check('target game pays out when the goal is reached', !!(await waitMsg(P, from, /的当て \d+ 個！ 大当たり/, 3000)), P.msgs.slice(from).filter((m) => /的当て/.test(m)).join(' | '));
  await sleep(800);
  // 時間制限チャレンジ: 1→9 を順に押す
  w = await cmdWin(P, '/casino');
  from = P.msgs.length;
  w = await clickWin(P, 51);
  check('timed challenge opens', titleOf(w).includes('時間制限チャレンジ'), titleOf(w).slice(0, 60));
  if (w) {
    const order = [];
    for (let i = 9; i <= 17; i++) if (w.slots[i] && w.slots[i].name === 'paper') order[w.slots[i].count] = i;
    for (let n = 1; n <= 9; n++) { if (order[n] !== undefined) await P.clickWindow(order[n], 0, 0).catch(() => {}); await sleep(120); }
  }
  check('timed challenge clears in order', !!(await waitMsg(P, from, /クリア！ チップ \+\d+/, 3000)));
  await sleep(500);
  // 押し間違えると負け
  w = await cmdWin(P, '/casino');
  from = P.msgs.length;
  w = await clickWin(P, 51);
  if (w) { const s2 = [9, 10, 11, 12, 13, 14, 15, 16, 17].find((i) => w.slots[i] && w.slots[i].count === 2); if (s2 !== undefined) await P.clickWindow(s2, 0, 0).catch(() => {}); }
  check('timed challenge fails on a wrong number', !!(await waitMsg(P, from, /押し間違え！ 1 を押すところだった/, 3000)));
  closeWin(P); await sleep(500);
  // カジノ限定ショップ（uf_23_chipshop.sk）
  w = await cmdWin(P, '/casino');
  w = await clickWin(P, 49);
  check('casino-only shop opens', titleOf(w).includes('カジノ限定ショップ'), titleOf(w).slice(0, 60));
  check('casino-only shop lists gear and handy items', findSlot(w, 'ディーラーの剣') >= 0 && findSlot(w, 'ラッキーハット') >= 0 && findSlot(w, '3×3ピッケル') >= 0 && findSlot(w, 'エリトラ') >= 0);
  from = P.msgs.length;
  w = await clickWin(P, findSlot(w, '名札'));
  check('buy a name tag with chips', !!(await waitMsg(P, from, /交換しました: 名札/, 3000)) && P.inventory.items().some((i) => i.name === 'name_tag'));
  from = P.msgs.length;
  w = await clickWin(P, findSlot(w, 'エリトラ'));
  check('not enough chips for the elytra', !!(await waitMsg(P, from, /チップが足りません/, 3000)));
  w = await clickWin(P, 49);
  check('back from the casino-only shop', titleOf(w).includes('地下カジノ'), titleOf(w).slice(0, 60));
  closeWin(P);
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
  check('admin still has tool', !!invFind(A, '管理者ツール'));
  let w = await openTool(A);
  check('hub opens again', titleOf(w).includes('管理者ツール'), titleOf(w).slice(0, 80));
  check('event button is gone', !(w && w.links['31']));
  // 確認画面（NPC の画面の「近くの NPC を消す」）
  w = await clickBook(A, 38);
  check('npc page', titleOf(w).includes('NPC'), titleOf(w).slice(0, 80));
  w = await clickBook(A, 31);
  check('confirm screen', titleOf(w).includes('確認'), titleOf(w).slice(0, 80));
  w = await clickBook(A, 'no');
  check('confirm cancel returns to page', titleOf(w).includes('NPC'), titleOf(w).slice(0, 80));
  w = await clickBook(A, 31);
  const from = A.msgs.length;
  w = await clickBook(A, 'yes');
  check('confirm yes runs the action', !!(await waitMsg(A, from, /近くの NPC を 0 人消しました/)));
  // すべてのページを開く（エラーが出ないか）
  // カジノの管理 → カジノ限定ショップ
  w = await clickBook(A, 49); w = await clickBook(A, 14);
  w = await clickBook(A, 40);
  check('admin casino-only shop page', titleOf(w).includes('カジノ限定ショップ'), titleOf(w).slice(0, 60));
  w = await clickBook(A, 49);
  const pages = [10, 11, 12, 13, 14, 15, 16, 28, 29, 30, 33, 34, 35, 37, 38];
  w = await clickBook(A, 49);
  let opened = 0;
  for (const s of pages) {
    w = await clickBook(A, s); if (w) opened++;
    w = await clickBook(A, 49);
  }
  check('all hub pages open', opened === pages.length, `${opened}/${pages.length}`);
  // 各種設定 → 武器 → 1 項目を開いて閉じる
  w = await clickBook(A, 16); w = await clickBook(A, 23);
  check('cfg weapons page', titleOf(w).includes('特殊武器'), titleOf(w).slice(0, 80));
  w = await clickBook(A, 1);
  check('cfg editor opens', titleOf(w).includes('数値の変更'));
  w = await clickBook(A, 42);
  const n = A.nbooks;
  await clickBook(A, 53);
  check('close does not reopen the book', A.nbooks === n);
};

// ダンジョン産の武具（防具のセットの効果、武器の強化）
T.gear = async ({ A }) => {
  closeWin(A);
  for (const pt of ['helmet', 'chest', 'legs', 'boots']) A.chat(`/ufadmin give dga_lord_${pt}`);
  await sleep(1500);
  const slot = { helmet: 'head', chest: 'torso', legs: 'legs', boots: 'feet' };
  for (const [pt, dest] of Object.entries(slot)) {
    const it = A.inventory.items().find((i) => itemText(i).includes(`uf:dga_lord_${pt}`));
    if (it) await A.equip(it, dest).catch((e) => log('equip', e.message));
    await sleep(300);
  }
  await sleep(2800);
  const fx = Object.keys(A.entity.effects || {}).map(Number);
  const E = A.registry.effectsByName;
  check('full lord set gives strength and fire resistance', fx.includes(E.Strength ? E.Strength.id : E.strength.id) && fx.includes(E.FireResistance ? E.FireResistance.id : E.fire_resistance.id), JSON.stringify(fx));
  // 鍛冶屋（uf_22_smith.sk）: 強化 → 能力を付ける → もう一度強化しても能力が残る → 交換
  for (const id of ['dgw_4', 'mat_upgrade', 'mat_upgrade', 'mat_special', 'rare_7', 'mat_part', 'mat_part', 'mat_part']) A.chat(`/ufadmin give ${id}`);
  await sleep(1500);
  await hold(A, 'フラスコアックス');
  let w = await cmdWin(A, '/upgrade');
  check('smith opens', titleOf(w).includes('鍛冶屋'), titleOf(w).slice(0, 60));
  let from = A.msgs.length;
  w = await clickWin(A, 11);
  check('dungeon weapon can be upgraded at the smith', !!(await waitMsg(A, from, /強化成功！ 強化レベル 0 → 1/)));
  check('upgraded weapon keeps its name', !!invFind(A, 'フラスコアックス') && itemText(A.heldItem).includes('uflv:1'));
  w = await clickWin(A, 13);
  check('ability picker opens', titleOf(w).includes('付ける能力を選ぶ'), titleOf(w).slice(0, 60));
  from = A.msgs.length;
  w = await clickWin(A, 15);
  check('ability is set with a rare item', !!(await waitMsg(A, from, /特殊能力「会心」を付けた/)));
  check('ability is written on the weapon', itemText(A.heldItem).includes('ufab:crit') && itemText(A.heldItem).includes('uflv:1'));
  from = A.msgs.length;
  w = await clickWin(A, 11);
  check('upgrading keeps the ability', !!(await waitMsg(A, from, /強化レベル 1 → 2/)) && itemText(A.heldItem).includes('ufab:crit') && itemText(A.heldItem).includes('uflv:2'));
  from = A.msgs.length;
  w = await clickWin(A, 15);
  check('3 weapon parts trade for a final upgrade part', !!(await waitMsg(A, from, /最終強化パーツ 1 個と交換した/)));
  closeWin(A); await sleep(500);
  // 防具の能力
  for (const id of ['dga_uniform_helmet', 'mat_special', 'rare_3']) A.chat(`/ufadmin give ${id}`);
  await sleep(1200);
  await hold(A, '制服（かぶと）');
  w = await cmdWin(A, '/upgrade');
  w = await clickWin(A, 13);
  from = A.msgs.length;
  w = await clickWin(A, 11);
  check('armor gets an armor ability', !!(await waitMsg(A, from, /特殊能力「鉄壁」を付けた/)) && itemText(A.heldItem).includes('ufab:guard'));
  closeWin(A);
  for (const dest of ['head', 'torso', 'legs', 'feet']) await A.unequip(dest).catch(() => {});
  // ラッキーセット（カジノ限定）: 4 つで採掘が速くなり、幸運が付く
  for (const pt of ['helmet', 'chest', 'legs', 'boots']) A.chat(`/ufadmin give cg_${pt}`);
  await sleep(1500);
  for (const [pt, dest] of Object.entries(slot)) {
    const it = A.inventory.items().find((i) => itemText(i).includes(`uf:cg_${pt}`));
    if (it) await A.equip(it, dest).catch((e) => log('equip', e.message));
    await sleep(300);
  }
  await sleep(2800);
  const fx2 = Object.keys(A.entity.effects || {}).map(Number);
  check('lucky set gives haste and luck', fx2.includes(E.Haste.id) && fx2.includes(E.Luck.id), JSON.stringify(fx2));
  for (const dest of ['head', 'torso', 'legs', 'feet']) await A.unequip(dest).catch(() => {});
};

// ショップの気軽なアイテム（uf_20_items2.sk）
T.items = async ({ A }) => {
  closeWin(A);
  A.chat('/ufadmin give it_speed'); await sleep(1000);
  await hold(A, 'スピードドリンク');
  let from = A.msgs.length;
  A.activateItem(); await sleep(2400); A.deactivateItem();
  check('speed drink message', !!(await waitMsg(A, from, /足が速くなった/, 3000)));
  check('speed drink gives speed', Object.keys(A.entity.effects || {}).map(Number).includes(A.registry.effectsByName.Speed.id));
  A.chat('/ufadmin give it_warp'); await sleep(1000);
  await hold(A, '帰還の巻物');
  from = A.msgs.length;
  A.activateItem(); await sleep(300); A.deactivateItem();
  check('warp scroll only works during a run', !!(await waitMsg(A, from, /挑戦中にだけ使えます/, 3000)));
  A.chat(`/ufadmin points ${A.username} give 100`); await sleep(800);
  let w = await cmdWin(A, '/buy');
  check('shop lists the new items', findSlot(w, 'おにぎり') >= 0 && findSlot(w, 'スピードドリンク') >= 0, w ? '' : 'no shop');
  const s0 = findSlot(w, 'おにぎり');
  from = A.msgs.length;
  if (s0 >= 0) await A.clickWindow(s0, 0, 0).catch(() => {});
  check('buy onigiri', !!(await waitMsg(A, from, /購入しました: ?おにぎり/, 3000)));
  closeWin(A); await sleep(500);
  w = await openTool(A);
  w = await clickBook(A, 33);
  check('items page 1 of 2', titleOf(w).includes('1 / 2'), titleOf(w).slice(0, 40));
  w = await clickBook(A, 50);
  check('items page 2 has the new items', titleOf(w).includes('2 / 2') && titleOf(w).includes('帰還の巻物'), titleOf(w).slice(0, 40));
  closeWin(A);
};

// ランキングの掲示板（壁を見ながら置く → 文字が出る → 消す）
T.boards = async ({ A }) => {
  closeWin(A);
  con('fill 4 -60 -4 6 -57 -4 minecraft:stone');
  con(`tp ${A.username} 5.5 -60 -1.5 180 0`); await sleep(1500);
  // 壁を見て右クリックしたときと同じく、壁のブロックを右クリックして管理者ツールを開く
  await hold(A, '管理者ツール');
  const wall = A.blockAt(new Vec3(5, -59, -4));
  let n = A.nbooks; await A.activateBlock(wall).catch(() => {});
  let w = await waitBook(A, n);
  check('admin tool opens while looking at a wall', !!w);
  w = await clickBook(A, 37);
  check('boards page', titleOf(w).includes('ランキングの掲示板'), titleOf(w).slice(0, 60));
  let from = A.msgs.length;
  w = await clickBook(A, 10);
  check('board placed', !!(await waitMsg(A, from, /ダンジョン討伐数 の掲示板を置きました/)));
  await sleep(1500);
  const disp = () => Object.values(A.entities).find((e) => e.name === 'text_display' && e.position.distanceTo(new Vec3(5.5, -58, -3)) < 2);
  const d = disp();
  const meta = d ? JSON.stringify(d.metadata) : '';
  check('board shows title and ranking', meta.includes('ダンジョン討伐数') && meta.includes('UfPlayer'), d ? d.position.toString() : 'no display');
  check('board is on the wall face', !!d && Math.abs(d.position.z - (-2.99)) < 0.05, d ? d.position.toString() : '');
  w = await clickBook(A, 19);
  from = A.msgs.length;
  await clickBook(A, 'yes');
  check('board removed', !!(await waitMsg(A, from, /掲示板を消しました/)));
  await sleep(1000);
  check('board entity gone', !disp());
};

// NPC（置く → 話しかけると受付の画面 → 消す）
T.npc = async ({ A, P }) => {
  closeWin(A); closeWin(P);
  con(`tp ${A.username} 8.5 -60 8.5 0 0`); await sleep(1500);
  let w = await openTool(A);
  w = await clickBook(A, 38);
  check('npc page', titleOf(w).includes('NPC'), titleOf(w).slice(0, 60));
  let from = A.msgs.length;
  w = await clickBook(A, 11);
  check('npc placed', !!(await waitMsg(A, from, /ダンジョン受付.*を置きました/)));
  con(`tp ${A.username} 12.5 -60 8.5`);
  con(`tp ${P.username} 8.5 -60 10.5 180 0`); await sleep(1500);
  const v = Object.values(P.entities).find((e) => e.name === 'villager' && e.position.distanceTo(P.entity.position) < 4);
  check('npc villager exists', !!v);
  const pos0 = v ? v.position.clone() : null;
  if (v) {
    await P.lookAt(v.position.offset(0, 1.5, 0), true);
    const p = waitWindow(P, 4000); await P.activateEntity(v).catch(() => {}); w = await p;
    check('talking to npc opens reception', titleOf(w).includes('受付'), titleOf(w).slice(0, 60));
    closeWin(P);
    P.attack(v); await sleep(800);
    check('npc does not move or die', !!P.entities[v.id] && v.position.distanceTo(pos0) < 0.1);
  }
  con(`tp ${P.username} 1 -60 0`);
  con(`tp ${A.username} 8.5 -60 9.5`); await sleep(1200);
  w = await openTool(A); w = await clickBook(A, 38); w = await clickBook(A, 31);
  from = A.msgs.length;
  await clickBook(A, 'yes');
  check('npc removed', !!(await waitMsg(A, from, /近くの NPC を 1 人消しました/)));
};

// OP の付け外し（プレイヤーの詳細で付ける → OP の一覧で外す）
T.ops = async ({ A, P }) => {
  closeWin(A);
  let w = await openTool(A);
  check('hub has ops list (op only)', !!(w && w.links['35'] && w.links['35'].text.includes('OP の一覧')));
  w = await clickBook(A, 28);
  const key = w && Object.keys(w.links).find((k) => w.links[k].text.includes('UfPlayer'));
  w = key ? await clickBook(A, key) : null;
  check('player page has OP button', !!(w && w.links['33'] && w.links['33'].text.includes('OP を付ける')), w && w.links['33'] ? w.links['33'].text : '');
  await clickBook(A, 33);
  let from = A.msgs.length;
  await clickBook(A, 'yes');
  check('op given via admin tool', !!(await waitMsg(A, from, /UfPlayer に OP を付けました/)));
  w = await clickBook(A, 49); w = await clickBook(A, 49);
  w = await clickBook(A, 35);
  const pk = w && Object.keys(w.links).find((k) => w.links[k].text.includes('UfPlayer'));
  const self = w && Object.values(w.links).find((l) => l.text.includes('UfAdmin'));
  check('ops list shows UfPlayer, not self as removable', !!pk && !self, w ? w.title.slice(0, 120) : '');
  await clickBook(A, pk);
  from = A.msgs.length;
  await clickBook(A, 'yes');
  check('op removed via ops list', !!(await waitMsg(A, from, /UfPlayer の OP を外しました/)));
  // 外したあとは、P は管理メニューを開けない（security でも確かめる）
  const n = P.nbooks; P.chat('/ufadmin'); await sleep(1000);
  check('deopped player cannot open /ufadmin', P.nbooks === n);
};

T.security = async ({ P }) => {
  const n = P.nbooks;
  P.chat('/ufadmin'); P.chat('/ufadmin ui 1 10');
  await sleep(1000);
  check('non-admin cannot open /ufadmin', P.nbooks === n && (!P.currentWindow || !titleOf(P.currentWindow).includes('管理者ツール')));
  closeWin(P);
};

// ---------------------------------------------------------------
(async () => {
  con('op UfAdmin');
  // ゲームルール名は 1.21.11 で変わったので、新旧どちらも送る（合わない方はエラーになるだけ）
  con('gamerule spawn_mobs false'); con('gamerule spawn_monsters false'); con('gamerule advance_time false');
  con('gamerule keep_inventory true'); con('gamerule immediate_respawn true');
  con('gamerule doMobSpawning false'); con('gamerule doDaylightCycle false');
  con('gamerule keepInventory true'); con('gamerule doImmediateRespawn true');
  con('time set day'); con('difficulty normal');
  for (let i = 0; i < 4; i++) { con('kill @e[type=!player]'); await sleep(400); }
  await sleep(1000);
  const A = await mk('UfAdmin');
  await sleep(1000);
  const P = await mk('UfPlayer');
  await sleep(3500);
  con(`tp UfAdmin 0 -60 0`); con(`tp UfPlayer 1 -60 0`);
  await sleep(1000);
  const order = ['admintool', 'economy', 'dungeon', 'death', 'revive', 'casino', 'rpg', 'tools', 'guns', 'admingui2', 'gear', 'items', 'boards', 'npc', 'ops', 'security'];
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
