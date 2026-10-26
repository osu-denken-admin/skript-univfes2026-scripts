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
  // 読み込み直しで uf_15_layout.sk が 15号館の座標の区域を入れていることがあるので、先に消す（平らな世界全体をダンジョンにする）
  b.chat('/zzareadel dungeon1'); b.chat('/zzareadel dungeon2'); await sleep(600);
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

  // 特殊能力が効く（uf_19_gear.sk）: 2 階の武器のはじめからの能力「疾風」は、叩くと自分が速くなる
  con('kill @e[type=!player]'); await sleep(500);
  con('effect clear UfMob'); con('gamemode survival UfMob'); await sleep(500);
  b.chat('/ufadmin give dgw_2'); await sleep(800);
  from = b.msgs.length;
  b.chat('/zzfight 2 normal 2'); await waitMsg(from, /^fight/, 3000); await sleep(1000);
  const sw = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:dgw_2'));
  if (sw) await b.equip(sw, 'hand');
  const mob = Object.values(b.entities).find((e) => e !== b.entity && ['zombie', 'skeleton'].includes(e.name) && e.position.distanceTo(b.entity.position) < 6);
  if (mob) { await b.lookAt(mob.position.offset(0, mob.height * 0.8, 0), true); b.attack(mob); }
  await sleep(800);
  const SPEED = b.registry.effectsByName.Speed.id;
  check('weapon ability haste gives speed on hit', Object.keys(b.entity.effects || {}).map(Number).includes(SPEED), mob ? mob.name : 'no mob');
  b.chat('/zzend 2'); await sleep(1000);
  con('effect clear UfMob'); await sleep(3500);
  // 鍛冶屋で「俊足」を付けたくつを履くと速くなる
  for (const id of ['dga_uniform_boots', 'mat_special', 'rare_2']) b.chat(`/ufadmin give ${id}`);
  await sleep(1200);
  const boots = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:dga_uniform_boots'));
  if (boots) await b.equip(boots, 'hand');
  const sw2 = await new Promise((res) => { const t = setTimeout(() => res(null), 4000); b.once('windowOpen', (w) => { clearTimeout(t); res(w); }); b.chat('/upgrade'); });
  if (sw2) { const p2 = new Promise((res) => { const t = setTimeout(() => res(null), 4000); b.once('windowOpen', (w) => { clearTimeout(t); res(w); }); }); await b.clickWindow(13, 0, 0).catch(() => {}); const w2 = await p2; if (w2) { from = b.msgs.length; await b.clickWindow(10, 0, 0).catch(() => {}); await waitMsg(from, /特殊能力「俊足」を付けた/, 3000); } }
  await sleep(800); if (b.currentWindow) b.closeWindow(b.currentWindow);
  const boots2 = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:dga_uniform_boots'));
  if (boots2) await b.equip(boots2, 'feet');
  con('effect clear UfMob'); await sleep(3000);
  check('armor ability swift gives speed when worn', Object.keys(b.entity.effects || {}).map(Number).includes(SPEED) && !!boots2 && JSON.stringify(boots2).includes('ufab:swift'));
  await b.unequip('feet').catch(() => {});
  con('gamemode creative UfMob'); await sleep(500);

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
  // バイク（uf_13_bike.sk）。テストの世界はサバイバルとダンジョンが同じワールドなので、ダンジョンの登録を外して試す
  con('kill @e[type=!player]'); con('tp UfMob 40.5 -60 40.5 0 0'); await sleep(1500);
  b.chat('/zzworld dungeon none'); b.chat('/zzworld survival world'); b.chat('/zzmod tools on'); await sleep(800);
  for (const [dx, dz, blk] of [[1, 0, 'short_grass'], [-1, 0, 'poppy'], [0, 1, 'oxeye_daisy'], [0, -1, 'oak_leaves']]) con(`setblock ${40 + dx} -60 ${40 + dz} minecraft:${blk}`);
  con('setblock 41 -60 41 minecraft:stone'); await sleep(800);
  b.chat('/ufadmin give bike_key'); b.chat('/ufadmin give bike_kit'); await sleep(1200);
  // uf:<id> の付いたアイテムを持って、まっすぐ前を向いて使う（下の草花を見たままだと「空中を右クリック」が無視される）
  const useItem = async (id) => {
    const it = b.inventory.items().find((i) => JSON.stringify(i).includes(`uf:${id}`));
    if (!it) return false;
    try { b.deactivateItem(); } catch {}
    await b.equip(it, 'hand'); await b.look(b.entity.yaw, 0, true); await sleep(300);
    b.activateItem(); await sleep(300); b.deactivateItem(); return true;
  };
  await useItem('bike_key'); await sleep(1500);
  const horse = () => Object.values(b.entities).find((e) => e.name === 'horse' && e.position.distanceTo(b.entity.position) < 3);
  check('bike key summons a bike and rides it', !!horse() && (!!b.vehicle || b.entity.position.y > -59.9), `${b.entity.position}`);
  // ブロックの車体（block display 8 個）が馬についてくる
  const parts = () => Object.values(b.entities).filter((e) => e.name === 'block_display' && e.position.distanceTo(b.entity.position) < 4);
  check('bike body is made of 8 block parts', parts().length === 8, `${parts().length}`);
  const yawDiff = (a, c) => { let d = Math.abs(a - c) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
  // 本物のプレイヤーと同じく「乗り物を動かす」通信を送って、馬を東へ 2 ブロック動かし、東を向かせる
  const h0 = horse(); const y0 = h0 ? h0.yaw : 0;
  for (let i = 1; i <= 8; i++) { try { b._client.write('vehicle_move', { x: 40.5 + i * 0.25, y: -60, z: 40.5, yaw: -90, pitch: 0, onGround: true }); } catch (e) { log('vehicle_move', e.message); } await sleep(60); }
  await sleep(1200);
  const h = horse();
  check('horse moved by the rider', !!h && h.position.x > 42, h ? `${h.position}` : 'no horse');
  check('bike body follows the bike', !!h && parts().length === 8 && parts().every((e) => e.position.distanceTo(h.position) < 0.3), parts().map((e) => e.position.toString()).slice(0, 2).join(' '));
  // 乗っている本人には馬の向きが送られてこないので、本人の向きの通信を送り、部品の向きが変わるかで見る（馬は乗り手の向きに合わせて回る）
  const py0 = parts().length ? parts()[0].yaw : 0;
  try { b._client.write('look', { yaw: 90, pitch: 0, flags: 1 }); } catch (e) { try { b._client.write('look', { yaw: 90, pitch: 0, onGround: true }); } catch (e2) { log('look', e2.message); } }
  await sleep(1200);
  check('bike body turns with the bike', parts().length === 8 && yawDiff(parts()[0].yaw, py0) > 1 && parts().every((e) => yawDiff(e.yaw, parts()[0].yaw) < 0.05), `${py0.toFixed(2)} -> ${parts().map((e) => e.yaw.toFixed(2)).join(',')}`);
  await sleep(1000);
  const V = require('vec3').Vec3;
  const cleared = [[41, 40], [39, 40], [40, 41], [40, 39]].map(([x, z]) => b.blockAt(new V(x, -60, z))).map((bl) => (bl ? bl.name : 'null'));
  check('riding clears grass, flowers and leaves', cleared.every((n) => n === 'air'), cleared.join(','));
  const st = b.blockAt(new V(41, -60, 41));
  check('riding does not break other blocks', !!st && st.name === 'stone', st && st.name);
  b.dismount(); con('tp UfMob 40.5 -60 43.5 0 0'); await sleep(2500);
  check('bike disappears after getting off', !Object.values(b.entities).some((e) => e.name === 'horse' && e.position.distanceTo(b.entity.position) < 8));
  check('bike body disappears after getting off', !Object.values(b.entities).some((e) => e.name === 'block_display' && e.position.distanceTo(b.entity.position) < 8));
  from = b.msgs.length;
  await useItem('bike_kit');
  check('bike kit upgrades the bike (or says it is at max)', !!(await waitMsg(from, /バイクを強化した（段階 \d）|すでに最大まで強化/, 3000)));
  b.chat('/zzworld dungeon world'); await sleep(800);
  from = b.msgs.length;
  await useItem('bike_key');
  check('bike cannot be called in the dungeon', !!(await waitMsg(from, /ダンジョンの中ではバイクを呼べません/, 3000)));

  // 同じワールドの中のダンジョンの区域（uf_00_core.sk の uf_inworld）。区域の中だけダンジョン、外はサバイバル
  b.chat('/zzworld dungeon world'); b.chat('/zzworld survival world'); b.chat('/zzarea dungeon1 100 -64 100 120 -40 120'); await sleep(1000);
  con('tp UfMob 60.5 -60 60.5 0 0'); await sleep(1500);
  from = b.msgs.length;
  await useItem('bike_key'); await sleep(1500);
  check('outside the dungeon area the bike can be called in the same world', !!horse() && !(await waitMsg(from, /ダンジョンの中ではバイクを呼べません/, 300)));
  b.dismount(); await sleep(2500);
  b.chat('/ufadmin give it_bomb'); await sleep(800);
  from = b.msgs.length;
  await useItem('it_bomb');
  check('outside the dungeon area the bomb cannot be used', !!(await waitMsg(from, /ダンジョンの中でだけ使えます/, 3000)));
  con('tp UfMob 110.5 -60 110.5 0 0'); await sleep(1500);
  from = b.msgs.length;
  await useItem('bike_key');
  check('inside the dungeon area the bike cannot be called', !!(await waitMsg(from, /ダンジョンの中ではバイクを呼べません/, 3000)));
  b.chat('/zzareadel dungeon1'); await sleep(500);

  // 9 階の完成記念品（初回突破の報酬）
  from = b.msgs.length;
  b.chat('/zzreward 9'); await sleep(2000);
  const trophy = b.inventory.items().find((i) => JSON.stringify(i).includes('uf:trophy_15'));
  check('9F first clear gives the trophy with the name', !!trophy && JSON.stringify(trophy).includes('UfMob'));
  check('9F first clear is announced to everyone', !!(await waitMsg(from, /15号館を制覇した/, 2000)));
  check('9F first clear gives the final upgrade part', b.inventory.items().some((i) => JSON.stringify(i).includes('uf:mat_final')));

  const p = results.filter((x) => x[0] === 'PASS').length;
  const fl = results.filter((x) => x[0] === 'FAIL');
  log(`RESULT: PASS ${p} / FAIL ${fl.length}`);
  for (const x of fl) log('  FAIL', x[1], x[2]);
  b.quit(); await sleep(1000); process.exit(0);
})();
