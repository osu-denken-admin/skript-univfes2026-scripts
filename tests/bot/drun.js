// 2F→9F の通し挑戦をボットで確認する
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
function mk(name) { return new Promise((res) => { const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: name, auth: 'offline' }); b.msgs = []; b.on('messagestr', (m) => { b.msgs.push(m); if (m.includes('[電研]')) log(`[${name}] ${m}`); }); b.once('spawn', () => res(b)); }); }
async function waitMsg(b, from, re, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { for (let i = from; i < b.msgs.length; i++) if (re.test(b.msgs[i])) return b.msgs[i]; await sleep(100); } return null; }
const seen = (b, from, re) => b.msgs.slice(from).some((m) => re.test(m));
const waitWindow = (b, ms = 5000) => new Promise((res) => { const t = setTimeout(() => res(null), ms); b.once('windowOpen', (w) => { clearTimeout(t); res(w); }); });
async function clickWin(b, s) { const p = waitWindow(b, 3000); await b.clickWindow(s, 0, 0).catch(() => {}); return p; }
const HOSTILE = new Set(['zombie', 'skeleton', 'spider', 'husk', 'stray', 'wither_skeleton', 'vindicator']);
const mobs = (b) => Object.values(b.entities).filter((e) => HOSTILE.has(e.name) && e.position.distanceTo(b.entity.position) < 70);
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

(async () => {
  con('op UfAdmin'); for (let i = 0; i < 3; i++) con('kill @e[type=!player]');
  const A = await mk('UfAdmin'); await sleep(800);
  const P = await mk('UfPlayer'); await sleep(2500);
  con('gamemode creative UfAdmin'); con('tp UfAdmin -235 63 105'); await sleep(1500);
  A.chat('/ufadmin world dungeon'); await sleep(400);
  A.chat('/ufd lobby'); await sleep(400);
  const tool = A.inventory.items().find((it) => text(it).includes('管理者ツール'));
  if (tool) { await A.equip(tool, 'hand'); await sleep(300); }
  let p = waitWindow(A); A.activateItem(); let w = await p;
  w = await clickWin(A, 12); w = await clickWin(A, 40);
  let from = A.msgs.length; await clickWin(A, 11);
  check('layout + arenas applied', !!(await waitMsg(A, from, /内装に合わせて登録しました/)));
  if (A.currentWindow) A.closeWindow(A.currentWindow);
  // 初回は 2 階からしか始められない
  A.chat('/ufadmin unlock UfPlayer 2'); await sleep(400);
  con('gamemode creative UfPlayer'); con('effect give UfPlayer strength infinite 40 true'); con('tp UfPlayer -235 63 105'); await sleep(1500);
  p = waitWindow(P); P.chat('/dungeon'); w = await p;
  check('reception GUI', w && text(w.title).includes('受付'));
  check('only 2F selectable at first', w && w.slots[10] && w.slots[10].name === 'oak_door' && w.slots[11] && w.slots[11].name === 'iron_bars');
  from = P.msgs.length; await clickWin(P, 10); await sleep(2500);

  for (let f = 2; f <= 9; f++) {
    const lay = JSON.parse(fs.readFileSync(`${LAYOUT}/floor_${f}.json`));
    const ar = JSON.parse(fs.readFileSync(`${LAYOUT}/arena_${f}.json`));
    log(`===== ${f}F`);
    check(`${f}F at start`, near(P, lay.start), P.entity.position.toString());
    const mr = lay.rooms.find((r) => r.role === 'mid');
    const fm = P.msgs.length;
    con(`tp UfPlayer ${(mr.x1 + mr.x2) / 2 + 0.5} ${lay.y + 1} ${(mr.z1 + mr.z2) / 2 + 0.5}`);
    check(`${f}F mid triggered by room`, !!(await waitMsg(P, fm, /中ボスの気配/, 5000)));
    await sleep(800);
    check(`${f}F in mid arena`, near(P, ar.mid.player, 4), P.entity.position.toString());
    await killUntil(P, () => seen(P, fm, /中ボス撃破/), 30000);
    check(`${f}F mid defeated`, seen(P, fm, /中ボス撃破/));
    await sleep(4500);
    check(`${f}F returned to floor`, Math.abs(P.entity.position.y - (lay.y + 1)) < 1.5, P.entity.position.toString());
    await killUntil(P, () => seen(P, fm, /ボスの間へ/), 90000);
    check(`${f}F floor cleared`, seen(P, fm, /ボスの間へ/));
    await sleep(6000);
    check(`${f}F in boss arena`, near(P, ar.boss.player, 4), P.entity.position.toString());
    const done = f < 9 ? /突破！/ : /制覇/;
    await killUntil(P, () => seen(P, fm, done), 40000);
    check(`${f}F boss defeated`, seen(P, fm, done));
    await sleep(6500);
  }
  check('run complete -> back in lobby', near(P, { x: -234.5, y: 63, z: 105.5 }, 3), P.entity.position.toString());
  // 解放済みの階から選べる
  p = waitWindow(P); P.chat('/dungeon'); w = await p;
  check('all floors selectable after full run', w && [10, 11, 12, 13, 14, 15, 16, 17].every((s) => w.slots[s] && w.slots[s].name === 'oak_door'));
  from = P.msgs.length; await clickWin(P, 13); await sleep(2500);
  const l5 = JSON.parse(fs.readFileSync(`${LAYOUT}/floor_5.json`));
  check('start from 5F', near(P, l5.start), P.entity.position.toString());
  // 全滅（1 人で倒れる）→ 1 階へ
  con('gamemode survival UfPlayer'); await sleep(500);
  from = P.msgs.length; con('kill UfPlayer');
  check('wipe ends the run', !!(await waitMsg(P, from, /全滅/, 4000)));
  await sleep(1500); if (P.health <= 0) P.respawn(); await sleep(2500);
  check('after wipe respawn in lobby', near(P, { x: -234.5, y: 63, z: 105.5 }, 3), P.entity.position.toString());
  const pass = results.filter((r) => r[0] === 'PASS').length;
  log(`RESULT: PASS ${pass} / FAIL ${results.length - pass}`);
  results.filter((r) => r[0] === 'FAIL').forEach((r) => log('  FAIL', r[1], r[2]));
  A.quit(); P.quit(); await sleep(800); process.exit(0);
})();
