// ダンジョンの敵（uf_18_mobs.sk）のテスト。平らなワールドでよい
// 使い方: node mobs.js <サーバーの cmds.txt>
//   先に、同じフォルダの -zz_mobtest.sk を、テストサーバーの plugins/Skript/scripts/zz_mobtest.sk として入れておく
// 注意: OP を付け、敵を出すので、必ずローカルのテストサーバー（127.0.0.1:25599）だけで実行すること。
const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');
const fs = require('fs');

const CMD = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const con = (c) => fs.appendFileSync(CMD, c + '\n');
const results = [];
const check = (n, c, d = '') => { results.push([c ? 'PASS' : 'FAIL', n, d]); log(c ? 'PASS' : 'FAIL', n, d); return c; };

// 階ごとに、技で出るはずのメッセージ（ボス・中ボス）
const BOSS_MSG = { 2: /手下を呼んだ|力をためている/, 3: /矢が降ってくる|手下を呼んだ/, 4: /毒の霧|手下を呼んだ/, 5: /電気が集まっている|力をためている|手下を呼んだ/, 6: /力をためている/, 7: /手下を呼んだ|力をためている/, 8: /暗くなった|手下を呼んだ|毒の霧/, 9: /力をためている/ };
const MID_MSG = { 2: /手下を呼んだ/, 3: /矢が降ってくる|手下を呼んだ/, 4: /毒の霧/, 5: /電気が集まっている|手下を呼んだ/, 6: /力をためている/, 7: null, 8: /暗くなった/, 9: /力をためている/ };

(async () => {
  con('op UfMob'); await sleep(1000);
  const b = mineflayer.createBot({ host: '127.0.0.1', port: 25599, username: 'UfMob', auth: 'offline' });
  // 画面下（アクションバー）。Skript 2.13 はオーバーレイのチャット、2.16 は action_bar パケットで届く
  b.msgs = []; b.actionbar = '';
  const plain = (n) => (n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(plain).join('') : (n.text ?? n[''] ?? '') + plain(n.extra));
  b._client.on('action_bar', (d) => { b.actionbar = plain(d.text && d.text.type ? nbt.simplify(d.text) : d.text); });
  b.on('messagestr', (m, pos) => { if (pos === 'game_info') { b.actionbar = m; return; } b.msgs.push(m); if (process.env.DEBUG || /BAD|roster|怒った|最後の力/.test(m)) log('[chat]', m); });
  await new Promise((r) => b.once('spawn', r));
  await sleep(2000);
  con('gamemode creative UfMob'); con('gamerule doMobSpawning false'); con('time set day');
  con('tp UfMob 0 -60 0'); await sleep(1500);
  const waitMsg = async (from, re, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const m = b.msgs.slice(from).find((x) => re.test(x)); if (m) return m; await sleep(200); } return null; };

  let from = b.msgs.length;
  b.chat('/zzroster');
  const r = await waitMsg(from, /roster n=/, 5000);
  check('roster: every entity type, item and color can be read', !!r && /bad=0/.test(r), r || 'no reply');

  // 電研ボムと帰還の巻物（uf_20_items2.sk）
  con('kill @e[type=!player]'); await sleep(500);
  from = b.msgs.length;
  // 近くの敵や足元のブロックを見たままだと「空中を右クリック」が受け付けられないので、敵は 6 ブロック先に出す
  b.chat('/zzfight 2 normal 6'); await waitMsg(from, /^fight/, 3000); await sleep(1500);
  const target = () => Object.values(b.entities).find((e) => e !== b.entity && e.type !== 'player' && ['zombie', 'skeleton'].includes(e.name) && e.position.distanceTo(b.entity.position) < 10);
  for (let i = 0; i < 4; i++) b.chat('/ufadmin give it_bomb');
  b.chat('/ufadmin give it_warp');
  con('effect give @e[type=zombie] slowness 30 10'); con('effect give @e[type=skeleton] slowness 30 10');
  await sleep(1500);
  const points = async () => { const f0 = b.msgs.length; b.chat('/points'); const m = await waitMsg(f0, /ポイント: (\d+)/, 4000); return m ? Number(m.match(/ポイント: (\d+)/)[1]) : null; };
  const pt0 = await points();
  const bomb = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:it_bomb'));
  if (bomb) await b.equip(bomb, 'hand');
  for (let i = 0; i < 4 && target(); i++) {
    const t = target();
    await b.lookAt(t.position.offset(0, 0.5, 0), true); b.activateItem(); await sleep(400); b.deactivateItem(); await sleep(1400);
  }
  check('bomb kills a dungeon enemy', !target());
  await sleep(500);
  const pt1 = await points();
  check('bomb kill counts for the reward', pt0 !== null && pt1 !== null && pt1 > pt0, `${pt0} -> ${pt1}`);
  con('tp UfMob 20 -60 0'); await sleep(1200);
  const warp = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:it_warp'));
  if (warp) await b.equip(warp, 'hand');
  await b.look(b.entity.yaw, 0, true); await sleep(300);
  from = b.msgs.length;
  b.activateItem(); await sleep(300); b.deactivateItem();
  const warped = !!(await waitMsg(from, /復帰地点に戻った/, 3000)); await sleep(800);
  check('warp scroll returns to the checkpoint', warped && Math.abs(b.entity.position.x - 0.5) < 1.5 && Math.abs(b.entity.position.z - 0.5) < 1.5, b.entity.position.toString());
  b.chat('/zzend 2'); await sleep(1500);

  for (let f = 2; f <= 9; f++) {
    for (const tier of ['mid', 'boss']) {
      con(`kill @e[type=!player]`); await sleep(500);
      from = b.msgs.length;
      b.chat(`/zzfight ${f} ${tier}`);
      await waitMsg(from, /^fight/, 3000); await sleep(1500);
      check(`${f}F ${tier}: health bar shows`, /◆.*\[.*\] \d+ \/ \d+/.test(b.actionbar), b.actionbar);
      const re = tier === 'boss' ? BOSS_MSG[f] : MID_MSG[f];
      if (re) { const m = await waitMsg(from, re, 22000); check(`${f}F ${tier}: uses a skill`, !!m, m || ''); }
      from = b.msgs.length;
      b.chat(`/zzhp ${f} 0.4`);
      check(`${f}F ${tier}: gets angry below half`, !!(await waitMsg(from, /が怒った/, 4000)));
      if (f === 9 && tier === 'boss') {
        from = b.msgs.length;
        b.chat('/zzhp 9 0.2');
        check('9F boss: third phase below a quarter', !!(await waitMsg(from, /最後の力/, 4000)));
      }
      b.chat(`/zzend ${f}`); await sleep(2500);
      check(`${f}F ${tier}: health bar removed after the run ends`, b.actionbar.includes('ポイント'), b.actionbar);
      const left = Object.values(b.entities).filter((e) => e !== b.entity && e.type !== 'player' && e.type !== 'orb' && e.name !== 'item' && e.name !== 'arrow' && e.position.distanceTo(b.entity.position) < 30);
      check(`${f}F ${tier}: enemies removed`, left.length === 0, left.map((e) => e.name).join(','));
    }
  }
  const p = results.filter((x) => x[0] === 'PASS').length;
  const fl = results.filter((x) => x[0] === 'FAIL');
  log(`RESULT: PASS ${p} / FAIL ${fl.length}`);
  for (const x of fl) log('  FAIL', x[1], x[2]);
  b.quit(); await sleep(1000); process.exit(0);
})();
