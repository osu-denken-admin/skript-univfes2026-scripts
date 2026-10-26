// 入りっぱなしのボット。コマンドのファイルに 1 行ずつ書くと実行し、チャット・本・チェスト画面の中身を記録のファイルに書く
// 使い方: node live.js <ホスト> <ポート> <名前> <コマンドのファイル> <記録のファイル>
// コマンド:
//   ふつうの文字        チャットに送る（/ から始めればコマンド）
//   !tool               管理者ツール（本）を手に持って開く
//   !book <スロット>    開いている本の項目を押す（確認の本では yes / no）
//   !win <スロット>     開いているチェスト画面のスロットを押す
//   !close              チェスト画面を閉じる
//   !pos / !inv         位置 / 持ち物を記録する
//   !block <x> <y> <z>  そのブロックの名前を記録する
//   !click <x> <y> <z>  そのブロックを右クリックする
//   !entity <種類>      近く（6 ブロック以内）のその種類のもの（villager など）を右クリックする
//   !use <id>           uf:<id> の付いたアイテムを持って使う（it_speed、bike_key など）
//   !quit               抜ける
// 注意: 本番に入るのは、ユーザーに伝えてからにする（CLAUDE.md）
const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');
const { Vec3 } = require('vec3');
const fs = require('fs');

const [HOST, PORT, NAME, CMD, LOG] = process.argv.slice(2);
const log = (...a) => fs.appendFileSync(LOG, `${new Date().toTimeString().slice(0, 8)} ${a.join(' ')}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (n) => (n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(plain).join('') : (n.text ?? n[''] ?? '') + plain(n.extra));
const simp = (x) => (x && x.type ? nbt.simplify(x) : x);

// 本: 文字と、押せる項目（/ufadmin ui <画面番号> <スロット>）
function flatten(node, click, hover, out) {
  if (node == null) return;
  if (typeof node === 'string') { out.text += node; return; }
  if (Array.isArray(node)) { node.forEach((n) => flatten(n, click, hover, out)); return; }
  const c = node.clickEvent ? node.clickEvent.value : click;
  const h = node.hoverEvent ? plain(node.hoverEvent.contents) : (node.clickEvent ? '' : hover);
  const t = node.text ?? node[''] ?? '';
  out.text += t;
  if (c && t.trim()) { const key = c.split(' ').pop(); if (out.links[key]) out.links[key].text += t; else out.links[key] = { text: t, cmd: c, hover: h }; }
  if (node.extra) flatten(node.extra, c, h, out);
}
function readBook(item) {
  const comp = item.components && item.components.find((x) => x.type === 'written_book_content');
  if (!comp) return null;
  const out = { text: '', links: {} };
  comp.data.pages.forEach((p) => { flatten(simp(p.content), null, '', out); out.text += '\n'; });
  return out;
}
const itemName = (it) => { if (!it) return ''; const c = it.components && it.components.find((x) => x.type === 'custom_name'); return c ? plain(simp(c.data)) : it.name; };

const bot = mineflayer.createBot({ host: HOST, port: Number(PORT), username: NAME, auth: 'offline' });
let book = null, slotBook = null;
// 画面下（アクションバー）は毎秒届くので記録しない
bot.on('messagestr', (m, pos) => { if (pos !== 'game_info') log('[chat]', m); });
bot.on('kicked', (r) => log('[kicked]', JSON.stringify(r)));
bot.on('error', (e) => log('[error]', e.message));
bot.on('end', () => { log('[end]'); process.exit(0); });
bot.on('death', () => log('[death]'));
bot._client.on('packet', (d, meta) => {
  if (meta.name === 'set_slot' && d.item && d.item.components) { const r = readBook(d.item); if (r) slotBook = r; }
  if (meta.name === 'open_book') {
    book = slotBook;
    log('[book]', book ? book.text.replace(/\n+/g, ' / ') : '(読めない)');
    if (book) for (const [k, l] of Object.entries(book.links)) log(`   [${k}] ${l.text.trim()} … ${l.hover.replace(/\n/g, ' / ').slice(0, 120)}`);
  }
});
bot.on('windowOpen', (w) => {
  log('[window]', plain(simp(typeof w.title === 'string' ? (() => { try { return JSON.parse(w.title); } catch { return w.title; } })() : w.title)));
  for (let i = 0; i < w.inventoryStart; i++) if (w.slots[i]) log(`   [${i}] ${itemName(w.slots[i])}`);
});
// 入ったらすぐクリエイティブにする（サバイバルのまま立っていると、夜にモンスターに倒され続けて全員のチャットに死亡が流れる。2026-10-26）
bot.once('spawn', () => { log('[spawn]', bot.entity.position.toString(), 'version', bot.version); bot.chat('/gamemode creative'); run(); });

async function exec(line) {
  const [c, ...a] = line.split(' ');
  if (c === '!tool') {
    const it = bot.inventory.items().find((i) => itemName(i).includes('管理者ツール'));
    if (!it) return log('[!] 管理者ツールを持っていない');
    try { bot.deactivateItem(); } catch {}
    await bot.equip(it, 'hand'); await sleep(300);
    // 近くのブロックを見ているときは「空中を右クリック」が受け付けられないので、そのブロックを右クリックする
    const b = bot.blockAtCursor(4);
    if (b && b.name !== 'air') await bot.activateBlock(b).catch((e) => log('[!]', e.message));
    else { bot.activateItem(); await sleep(300); bot.deactivateItem(); }
  } else if (c === '!book') {
    const l = book && book.links[a[0]];
    if (!l) return log('[!] 本にその項目がない', a[0]);
    bot.chat(l.cmd);
  } else if (c === '!win') {
    if (!bot.currentWindow) return log('[!] 画面が開いていない');
    await bot.clickWindow(Number(a[0]), 0, 0).catch((e) => log('[!]', e.message));
  } else if (c === '!close') { if (bot.currentWindow) bot.closeWindow(bot.currentWindow); }
  else if (c === '!pos') log('[pos]', bot.entity.position.toString(), bot.game.dimension, bot.game.gameMode);
  else if (c === '!inv') bot.inventory.items().forEach((i) => log('[inv]', i.slot, itemName(i), 'x' + i.count));
  else if (c === '!block') { const b = bot.blockAt(new Vec3(+a[0], +a[1], +a[2])); log('[block]', a.join(' '), b ? `${b.name} ${JSON.stringify(b.getProperties())}` : '(読み込まれていない)'); }
  else if (c === '!click') {
    const b = bot.blockAt(new Vec3(+a[0], +a[1], +a[2]));
    if (!b) return log('[!] ブロックが読み込まれていない');
    await bot.lookAt(b.position.offset(0.5, 0.5, 0.5), true); await bot.activateBlock(b).catch((e) => log('[!]', e.message));
  } else if (c === '!use') {
    // uf:<id> の付いたアイテムを持って使う（前を向いてから。近くのブロックを見ていればそのブロックを右クリック）
    const it = bot.inventory.items().find((i) => JSON.stringify(i).includes(`uf:${a[0]}"`) || JSON.stringify(i).includes(`uf:${a[0]}\\`));
    if (!it) return log('[!] 持っていない', a[0]);
    try { bot.deactivateItem(); } catch {}
    await bot.equip(it, 'hand'); await bot.look(bot.entity.yaw, 0, true); await sleep(300);
    const b = bot.blockAtCursor(4);
    if (b && b.name !== 'air') await bot.activateBlock(b).catch((e) => log('[!]', e.message));
    else { bot.activateItem(); await sleep(300); bot.deactivateItem(); }
  } else if (c === '!entity') {
    const e = bot.nearestEntity((x) => x.name === a[0] && x.position.distanceTo(bot.entity.position) < 6);
    if (!e) return log('[!] 近くにいない', a[0]);
    await bot.lookAt(e.position.offset(0, e.height * 0.8, 0), true); await bot.activateEntity(e).catch((err) => log('[!]', err.message));
  } else if (c === '!quit') { bot.quit(); }
  else bot.chat(line);
}
// コマンドのファイルに足された行を順に実行する
async function run() {
  let done = fs.existsSync(CMD) ? fs.readFileSync(CMD, 'utf8').length : 0;
  for (;;) {
    await sleep(300);
    const s = fs.existsSync(CMD) ? fs.readFileSync(CMD, 'utf8') : '';
    if (s.length <= done) continue;
    const lines = s.slice(done).split('\n');
    const last = lines.pop();
    done = s.length - last.length;
    for (const line of lines) { if (!line.trim()) continue; log('>>', line); try { await exec(line.trim()); } catch (e) { log('[!]', e.message); } await sleep(500); }
  }
}
