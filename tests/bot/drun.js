// 15号館を「壁をクリック → 闘技場 → 戻る → 階段を上る」で 2→9 階まで進めるか確認する
const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const fs = require('fs');
const CMD = process.argv[2], LAYOUT = process.argv[3];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const con = (c) => fs.appendFileSync(CMD, c + '\n');
const results = [];
const check = (n, c, d = '') => { results.push([c ? 'PASS' : 'FAIL', n, d]); log(c ? 'PASS' : 'FAIL', n, d); return c; };
const text = (x) => { try { return JSON.stringify(typeof x === 'string' ? JSON.parse(x) : x); } catch { return String(x); } };
function mk(name) { return new Promise((res) => { const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: name, auth: 'offline' }); b.msgs = []; b.on('messagestr', (m) => { b.msgs.push(m); if (m.includes('[電研]')) log(`[${name}] ${m}`); }); trackBook(b); b.once('spawn', () => res(b)); }); }
// 管理者ツールの本：開いた本の項目（/ufadmin ui <画面番号> <スロット>）を覚えておき、スロット番号で押す
function trackBook(b) {
  let links = {}; b.book = {}; b.nbooks = 0;
  b._client.on('packet', (d, meta) => {
    if (meta.name === 'set_slot' && d.item && d.item.components && d.item.components.some((c) => c.type === 'written_book_content')) {
      links = {}; for (const m of JSON.stringify(d.item).matchAll(/\/ufadmin ui \d+ (\w+)/g)) links[m[1]] = m[0];
    }
    if (meta.name === 'open_book') { b.book = links; b.nbooks++; }
  });
}
async function waitBook(b, n, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (b.nbooks > n) return true; await sleep(50); } return false; }
async function clickBook(b, s) { const c = b.book[String(s)]; if (!c) return false; const n = b.nbooks; b.chat(c); return waitBook(b, n); }
async function waitMsg(b, from, re, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { for (let i = from; i < b.msgs.length; i++) if (re.test(b.msgs[i])) return b.msgs[i]; await sleep(100); } return null; }
const seen = (b, from, re) => b.msgs.slice(from).some((m) => re.test(m));
const waitWindow = (b, ms = 5000) => new Promise((res) => { const t = setTimeout(() => res(null), ms); b.once('windowOpen', (w) => { clearTimeout(t); res(w); }); });
async function clickWin(b, s) { const p = waitWindow(b, 3000); await b.clickWindow(s, 0, 0).catch(() => {}); return p; }
const HOSTILE = new Set(['zombie', 'skeleton', 'spider', 'husk', 'stray', 'wither_skeleton', 'vindicator']);
const mobs = (b) => Object.values(b.entities).filter((e) => HOSTILE.has(e.name) && e.position.distanceTo(b.entity.position) < 40);
async function killUntil(b, stop, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (stop()) return true;
    const list = mobs(b);
    if (list.length) {
      const e = list.sort((a, c) => a.position.distanceTo(b.entity.position) - c.position.distanceTo(b.entity.position))[0];
      con(`tp ${b.username} ${e.position.x.toFixed(2)} ${e.position.y.toFixed(2)} ${e.position.z.toFixed(2)}`);
      await sleep(300);
      try { await b.lookAt(e.position.offset(0, e.height * 0.8, 0), true); b.attack(e); } catch {}
    }
    await sleep(300);
  }
  return stop();
}
const near = (b, p, d = 2.5) => b.entity.position.distanceTo(new Vec3(p.x, p.y, p.z)) < d;
const blk = (b, x, y, z) => { const bl = b.blockAt(new Vec3(x, y, z)); return bl ? bl.name : 'null'; };
// 壁の前に立ってクリック
async function clickBlock(b, stand, target) {
  con(`tp ${b.username} ${stand.x} ${stand.y} ${stand.z}`); await sleep(900);
  const bl = b.blockAt(new Vec3(target.x, target.y, target.z));
  if (!bl) return false;
  await b.lookAt(new Vec3(target.x + 0.5, target.y + 0.5, target.z + 0.5), true);
  await b.activateBlock(bl).catch(() => {});
  return true;
}
const STAIR = { W: { cell: (L) => ({ x: -273, y: L + 1, z: 92 }), stand: (L) => ({ x: -272.5, y: L + 1, z: 93.5 }) },
                E: { cell: (L) => ({ x: -202, y: L + 1, z: 93 }), stand: (L) => ({ x: -201.5, y: L + 1, z: 94.5 }) } };

(async () => {
  con('op UfAdmin'); for (let i = 0; i < 3; i++) con('kill @e[type=!player]');
  const A = await mk('UfAdmin'); await sleep(800);
  const P = await mk('UfPlayer'); await sleep(2500);
  con('gamemode creative UfAdmin'); con('tp UfAdmin -235 63 105'); await sleep(1500);
  A.chat('/ufadmin module dungeon on'); A.chat('/ufadmin module death on'); A.chat('/ufadmin module party on');
  A.chat('/ufadmin world dungeon'); await sleep(400);
  A.chat('/ufd lobby'); await sleep(400);
  const tool = A.inventory.items().find((it) => text(it).includes('管理者ツール'));
  if (tool) { await A.equip(tool, 'hand'); await sleep(300); }
  let n = A.nbooks; A.activateItem(); await waitBook(A, n); A.deactivateItem();
  await clickBook(A, 12); await clickBook(A, 40);
  let from = A.msgs.length; await clickBook(A, 'yes');
  check('layout + gates applied', !!(await waitMsg(A, from, /内装に合わせて登録しました/)));
  await sleep(1500);
  let p, w;
  // 壁の状態
  const l2 = JSON.parse(fs.readFileSync(`${LAYOUT}/floor_2.json`));
  con('tp UfAdmin -240 74 100'); await sleep(1500);
  check('2F mid gate closed (crying obsidian)', blk(A, l2.midGate[0].x, l2.midGate[0].y, l2.midGate[0].z) === 'crying_obsidian');
  con('tp UfAdmin -230 74 92'); await sleep(1500);
  check('2F east stair gate closed (reinforced deepslate)', blk(A, -202, 73, 93) === 'reinforced_deepslate');
  check('2F west up-stairs blocked (white concrete)', blk(A, -273, 73, 92) === 'white_concrete', blk(A, -273, 73, 92));

  A.chat('/ufadmin unlock UfPlayer 2'); await sleep(400);
  con('gamemode creative UfPlayer'); con('effect give UfPlayer strength infinite 40 true'); con('tp UfPlayer -235 63 105'); await sleep(1500);
  p = waitWindow(P); P.chat('/dungeon'); w = await p;
  from = P.msgs.length; await clickWin(P, 10); await sleep(2500);

  for (let f = 2; f <= 9; f++) {
    const lay = JSON.parse(fs.readFileSync(`${LAYOUT}/floor_${f}.json`));
    const ar = JSON.parse(fs.readFileSync(`${LAYOUT}/arena_${f}.json`));
    const Lv = lay.y;
    log(`===== ${f}F (${lay.side} -> ${lay.exit})`);
    check(`${f}F at entry side start`, near(P, lay.start, 3), P.entity.position.toString());
    const fm = P.msgs.length;
    // 中ボスを倒す前に階段の壁を調べても開かない（2 階だけ確認）
    if (f === 2) {
      await clickBlock(P, STAIR[lay.exit].stand(Lv), STAIR[lay.exit].cell(Lv));
      check('exit gate refuses before mid boss', !!(await waitMsg(P, fm, /固く閉ざされている/, 3000)));
      await clickBlock(P, STAIR[lay.side].stand(Lv), STAIR[lay.side].cell(Lv));
      check('wrong-way stairs blocked', !!(await waitMsg(P, fm, /崩れていて通れない/, 3000)));
      // エレベーターで 4 階へ行こうとしても戻される
      con(`tp UfPlayer -240 83 105`);
      check('elevator skip sent back', !!(await waitMsg(P, fm, /挑戦中の2階に戻ります/, 4000)));
    }
    // 中ボスの壁（入口側の面から）
    const g = lay.midGate[0];
    const standX = lay.side === 'W' ? g.x - 1.5 : g.x + 2.5;
    // 2 階では、もう 1 つのパーティー（UfAdmin 1 人）が同じ階に入り、先に中ボスの闘技場を使う
    if (f === 2) {
      con('tp UfAdmin -235 63 105'); await sleep(1200);
      p = waitWindow(A); A.chat('/dungeon'); w = await p;
      let am = A.msgs.length; await clickWin(A, 10); await sleep(2500);
      check('second party enters the same floor', near(A, lay.start, 3) && !seen(A, am, /満員|挑戦中です/), A.entity.position.toString());
      am = A.msgs.length;
      await clickBlock(A, { x: standX, y: Lv + 1, z: g.z + 0.5 }, g);
      check('second party takes the mid arena', !!(await waitMsg(A, am, /壁の向こうから/, 4000)));
      const pm = P.msgs.length;
      await clickBlock(P, { x: standX, y: Lv + 1, z: g.z + 0.5 }, g);
      check('arena busy -> wait', !!(await waitMsg(P, pm, /ほかのパーティーが戦っている/, 4000)) && !near(P, ar.mid.player, 6), P.entity.position.toString());
      A.chat('/dungeon leave');
      check('told when the arena is free', !!(await waitMsg(P, pm, /闘技場が空いた/, 5000)));
      await sleep(1000);
    }
    await clickBlock(P, { x: standX, y: Lv + 1, z: g.z + 0.5 }, g);
    check(`${f}F mid gate click -> mid arena`, !!(await waitMsg(P, fm, /壁の向こうから/, 4000)));
    await sleep(800);
    check(`${f}F in mid arena`, near(P, ar.mid.player, 4), P.entity.position.toString());
    await killUntil(P, () => seen(P, fm, /中ボス撃破/), 30000);
    // ボットが倒しきれないとき（強い中ボス）は、管理者の「次の段階へ」で倒した扱いにする（壁の向こうへ出るところを確かめるため）
    if (!seen(P, fm, /中ボス撃破/)) { log(`${f}F mid boss not beaten by the bot -> /ufd skip`); A.chat(`/ufd skip ${f}`); await waitMsg(P, fm, /中ボス撃破/, 5000); }
    await sleep(4000);
    // 勝つと壁の向こう側に出る（壁は閉じたまま）
    const past = lay.side === 'W' ? P.entity.position.x > g.x + 1 : P.entity.position.x < g.x;
    check(`${f}F past the mid gate`, past && Math.abs(P.entity.position.y - (Lv + 1)) < 1.5 && Math.abs(P.entity.position.x - g.x) < 3, P.entity.position.toString());
    check(`${f}F mid gate stays closed`, /obsidian/.test(blk(P, g.x, g.y, g.z)), blk(P, g.x, g.y, g.z));
    // ボスの壁（出口側の上り階段）
    const ex = STAIR[lay.exit];
    await clickBlock(P, ex.stand(Lv), ex.cell(Lv));
    check(`${f}F stair gate click -> boss arena`, !!(await waitMsg(P, fm, /が現れた！/, 4000)));
    await sleep(800);
    check(`${f}F in boss arena`, near(P, ar.boss.player, 4), P.entity.position.toString());
    const done = f < 9 ? /突破！/ : /制覇/;
    await killUntil(P, () => seen(P, fm, done), 40000);
    if (!seen(P, fm, done)) { log(`${f}F boss not beaten by the bot -> /ufd skip`); A.chat(`/ufd skip ${f}`); await waitMsg(P, fm, done, 5000); }
    check(`${f}F boss defeated`, seen(P, fm, done));
    if (f === 9) { await sleep(5000); break; }
    await sleep(4500);
    // 勝つと次の階の開始地点へ移る（階段の壁は閉じたまま）
    const nl = JSON.parse(fs.readFileSync(`${LAYOUT}/floor_${f + 1}.json`));
    check(`${f}F boss win -> ${f + 1}F start`, near(P, nl.start, 3), P.entity.position.toString());
    check(`${f + 1}F began`, mobs(P).length > 0, `mobs=${mobs(P).length}`);
    const c = ex.cell(Lv);
    check(`${f}F stair gate stays closed`, blk(P, c.x, c.y, c.z) === 'reinforced_deepslate', blk(P, c.x, c.y, c.z));
    await sleep(1000);
  }
  check('run complete -> lobby', near(P, { x: -234.5, y: 63, z: 105.5 }, 3), P.entity.position.toString());
  const pass = results.filter((r) => r[0] === 'PASS').length;
  log(`RESULT: PASS ${pass} / FAIL ${results.length - pass}`);
  results.filter((r) => r[0] === 'FAIL').forEach((r) => log('  FAIL', r[1], r[2]));
  A.quit(); P.quit(); await sleep(800); process.exit(0);
})();
