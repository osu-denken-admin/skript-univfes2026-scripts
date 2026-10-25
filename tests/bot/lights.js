// 管理者ツールの「15号館のライトを置き直す」を確かめる（平らなワールドでよい）
// 使い方: node lights.js <サーバーの cmds.txt>
// 注意: ワールドを書き換え、OP を付けるため、必ずローカルのテストサーバー（127.0.0.1:25599）だけで実行すること。
const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');

const CMD = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const con = (c) => fs.appendFileSync(CMD, c + '\n');
const results = [];
const check = (n, c, d = '') => { results.push([c ? 'PASS' : 'FAIL', n, d]); log(c ? 'PASS' : 'FAIL', n, d); return c; };

// 置かれるはずのライト（uf_15_layout.sk から読む）
const SK = fs.readFileSync(path.join(__dirname, '../../uf_15_layout.sk'), 'utf8');
const LIGHTS = [...SK.matchAll(/set block at uf_layout_loc\((-?\d+), (-?\d+), (-?\d+)\) to \{_lv::(\d+)\}/g)].map((m) => ({ x: +m[1], y: +m[2], z: +m[3], lv: +m[4] }));
const isLight = new Set(LIGHTS.map((l) => `${l.x},${l.y},${l.z}`));

// 本（管理者ツール）の項目を読む。test.js と同じ
function flattenText(node, click, out) {
  if (node == null) return;
  if (typeof node === 'string') { out.text += node; return; }
  if (Array.isArray(node)) { node.forEach((n) => flattenText(n, click, out)); return; }
  const c = node.clickEvent ? node.clickEvent.value : click;
  const t = node.text ?? node[''] ?? '';
  out.text += t;
  if (c && t.trim()) { const key = c.split(' ').pop(); if (!out.links[key]) out.links[key] = { cmd: c }; }
  if (node.extra) flattenText(node.extra, c, out);
}
function readBook(item) {
  const comp = item.components.find((x) => x.type === 'written_book_content');
  if (!comp) return null;
  const out = { text: '', links: {} };
  comp.data.pages.forEach((p) => { flattenText(p.content.type ? nbt.simplify(p.content) : p.content, null, out); out.text += '\n'; });
  return out;
}
function mk(name) {
  return new Promise((res, rej) => {
    const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: name, auth: 'offline' });
    b.msgs = []; b.book = null; b.nbooks = 0;
    b.on('messagestr', (m) => { b.msgs.push(m); log(`[${name}] ${m}`); });
    let slotBook = null;
    b._client.on('packet', (d, meta) => {
      if (meta.name === 'set_slot' && d.item && d.item.components) { const r = readBook(d.item); if (r) slotBook = r; }
      if (meta.name === 'open_book') { b.book = slotBook; b.nbooks++; }
    });
    b.once('spawn', () => res(b));
    setTimeout(() => rej(new Error('spawn timeout')), 30000);
  });
}
async function waitMsg(b, from, re, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { for (let i = from; i < b.msgs.length; i++) if (re.test(b.msgs[i])) return b.msgs[i]; await sleep(100); }
  return null;
}
async function waitBook(b, n, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (b.nbooks > n) return b.book; await sleep(50); } return null; }
async function clickBook(b, slot) { const l = b.book && b.book.links[String(slot)]; if (!l) { log('no book link', slot); return null; } const n = b.nbooks; b.chat(l.cmd); return waitBook(b, n, 3000); }
async function openTool(b) {
  const it = b.inventory.items().find((i) => JSON.stringify(i).includes('管理者ツール'));
  if (!it) return null;
  await b.equip(it, 'hand'); await sleep(300);
  const n = b.nbooks; b.activateItem(); const w = await waitBook(b, n); b.deactivateItem(); return w;
}
// その場所へ行って、ブロックを読む（チャンクを読み込ませるため）
async function blockAt(b, x, y, z) {
  con(`tp ${b.username} ${x + 0.5} ${y + 3} ${z + 0.5}`);
  for (let i = 0; i < 40; i++) { await sleep(150); const bl = b.blockAt(new Vec3(x, y, z)); if (bl && b.entity.position.distanceTo(new Vec3(x, y, z)) < 6) return bl; }
  return null;
}
const levelOf = (bl) => (bl ? Number(bl.getProperties().level) : null);

// 余計なライト（範囲の中 → 消える / 範囲の外 → 残る）
const STRAY_IN = [{ x: -266, y: 74, z: 88 }, { x: -205, y: 110, z: 124 }, { x: -299, y: 205, z: -59 }, { x: 13, y: 201, z: 18 }];
const STRAY_OUT = [{ x: -266, y: 72, z: 88 }, { x: -268, y: 74, z: 88 }, { x: -20, y: 199, z: -15 }];

(async () => {
  check('lights listed in uf_15_layout.sk', LIGHTS.length === 1817, `${LIGHTS.length}`);
  check('stray positions are not in the list', [...STRAY_IN, ...STRAY_OUT].every((p) => !isLight.has(`${p.x},${p.y},${p.z}`)));
  con('op UfAdmin');
  await sleep(1500);
  const A = await mk('UfAdmin');
  await sleep(3000);
  con('gamemode creative UfAdmin');
  // ダンジョンのワールドを登録（管理者ツール → ワールドとロビー → 15号館）
  let w = await openTool(A);
  check('admin tool opens', !!w && w.text.includes('管理者ツール'));
  w = await clickBook(A, 11);
  let from = A.msgs.length;
  w = await clickBook(A, 13);
  check('set dungeon world', !!(await waitMsg(A, from, /dungeon ワールドを world/)));
  // 余計なライトと、ライトの場所をふさぐ石を置く（コンソールの setblock は読み込まれたチャンクにしか置けないので、そばへ行く）
  const L0 = LIGHTS[0], L9 = LIGHTS[LIGHTS.length - 1];
  for (const p of [...STRAY_IN, ...STRAY_OUT]) { await blockAt(A, p.x, p.y, p.z); con(`setblock ${p.x} ${p.y} ${p.z} minecraft:light[level=15]`); await sleep(300); }
  await blockAt(A, L0.x, L0.y, L0.z); con(`setblock ${L0.x} ${L0.y} ${L0.z} minecraft:stone`); await sleep(300);
  const pre = await blockAt(A, STRAY_IN[2].x, STRAY_IN[2].y, STRAY_IN[2].z);
  check('stray light set up', !!pre && pre.name === 'light', pre && pre.name);
  con(`tp UfAdmin 0 -60 0`); await sleep(1500);
  // ライトを置き直す（各階 → ライトの置き直し → 確認の本で実行）
  w = await clickBook(A, 49);
  w = await clickBook(A, 12);
  check('floors page has the lights button', !!w && w.text.includes('ライトを置き直す'));
  w = await clickBook(A, 42);
  check('confirm book', !!w && w.text.includes('ライトブロックを置き直す'));
  from = A.msgs.length;
  const t0 = Date.now();
  await clickBook(A, 'yes');
  let m = await waitMsg(A, from, /ライト \d+ 個を置きました/, 120000);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  check('lights placed message', !!m, `${m} (${sec} 秒)`);
  check('stray lights inside the regions were counted', !!m && /もとのライト 4 個/.test(m));
  // 結果の確認
  for (const p of STRAY_IN) { const bl = await blockAt(A, p.x, p.y, p.z); check(`stray light removed ${p.x} ${p.y} ${p.z}`, !!bl && bl.name === 'air', bl && bl.name); }
  for (const p of STRAY_OUT) { const bl = await blockAt(A, p.x, p.y, p.z); check(`light outside kept ${p.x} ${p.y} ${p.z}`, !!bl && bl.name === 'light', bl && bl.name); }
  const samples = [L0, L9, ...Array.from({ length: 10 }, (_, i) => LIGHTS[Math.floor((i + 0.5) * LIGHTS.length / 10)])];
  for (const l of samples) { const bl = await blockAt(A, l.x, l.y, l.z); check(`light placed ${l.x} ${l.y} ${l.z} level ${l.lv}`, !!bl && bl.name === 'light' && levelOf(bl) === l.lv, bl && `${bl.name} ${levelOf(bl)}`); }
  // もう一度押すと、置いた 1817 個を全部消して置き直す（ライトの見分けができている）
  con(`tp UfAdmin 0 -60 0`); await sleep(1000);
  w = await openTool(A); w = await clickBook(A, 12); w = await clickBook(A, 42);
  from = A.msgs.length;
  await clickBook(A, 'yes');
  m = await waitMsg(A, from, /ライト \d+ 個を置きました/, 120000);
  check('second run removes exactly the placed lights', !!m && /もとのライト 1817 個/.test(m), m);
  const p = results.filter((r) => r[0] === 'PASS').length;
  const f = results.filter((r) => r[0] === 'FAIL');
  log(`RESULT: PASS ${p} / FAIL ${f.length}`);
  for (const r of f) log('  FAIL', r[1], r[2]);
  A.quit();
  await sleep(1000);
  process.exit(0);
})();
