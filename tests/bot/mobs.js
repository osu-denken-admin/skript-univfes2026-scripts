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
  b.on('messagestr', (m, pos) => { if (pos === 'game_info') { b.actionbar = m; return; } b.msgs.push(m); if (/BAD|roster|怒った|最後の力/.test(m)) log('[chat]', m); });
  await new Promise((r) => b.once('spawn', r));
  await sleep(2000);
  con('gamemode creative UfMob'); con('gamerule doMobSpawning false'); con('time set day');
  con('tp UfMob 0 -60 0'); await sleep(1500);
  const waitMsg = async (from, re, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const m = b.msgs.slice(from).find((x) => re.test(x)); if (m) return m; await sleep(200); } return null; };

  let from = b.msgs.length;
  b.chat('/zzroster');
  const r = await waitMsg(from, /roster n=/, 5000);
  check('roster: every entity type, item and color can be read', !!r && /bad=0/.test(r), r || 'no reply');

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
