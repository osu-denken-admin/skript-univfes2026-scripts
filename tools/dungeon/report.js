// 生成した各階のレイアウトを、部員に見せる案内図ページ（HTML）にする
const fs = require('fs');
const dir = process.argv[2], outFile = process.argv[3];
const DESC = {
  2: { mood: '机と椅子が並んだまま放置された教室が続く。黒板の前で何かが待っている。', deco: '机（スプルースのハーフ）と椅子（オークの階段）を格子状に配置', wall: '白コンクリート' },
  3: { mood: '天井まで届く本棚が迷路をつくる。棚の上にはクモの巣。', deco: '3 段の本棚の列。ところどころにクモの巣', wall: 'ダークオークの板材' },
  4: { mood: '実験台の上に薬品とフラスコが残された化学実験室。', deco: '実験台（なめらかな石のハーフ）、醸造台、植木鉢、大釜', wall: '白のテラコッタ' },
  5: { mood: '冷却ファンの止まったラックが並ぶ。点かないランプが規則正しく続く。', deco: '黒コンクリートと鉄ブロックのラック、消えたレッドストーンランプ、灰色のカーペット', wall: '灰色コンクリート' },
  6: { mood: '積み上げられた樽と干し草で視界が悪い倉庫。', deco: '樽・干し草・足場をランダムに 1〜3 段積む', wall: 'トウヒの板材' },
  7: { mood: 'ガラスの仕切りで区切られた研究室。机には鉢植えが残る。', deco: 'ガラス板の仕切り、白樺の机、シダの鉢植え', wall: '薄灰色コンクリート' },
  8: { mood: '立入禁止の区画。崩れた石と一面のクモの巣。最も暗い階。', deco: '丸石・苔むした丸石の瓦礫、クモの巣（床と天井）', wall: '石レンガ・ひび割れ・苔むした石レンガの混合' },
  9: { mood: '黒い石柱が並ぶ大講堂。赤い絨毯がボス部屋まで続く。', deco: '磨かれたブラックストーンの柱（上部に泣く黒曜石）、ボス部屋までの赤い絨毯', wall: '磨かれたブラックストーンレンガ' },
};
const floors = [];
for (let f = 2; f <= 9; f++) {
  const m = JSON.parse(fs.readFileSync(`${dir}/floor_${f}.json`));
  const W = m.grid.length, D = m.grid[0].length;
  let grid = '';
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) grid += m.grid[x][z];
  const rel = (p) => [Math.floor(p.x) - m.inner.x1, Math.floor(p.z) - m.inner.z1];
  floors.push({
    f, y: m.y, title: m.title, boss: m.boss, theme: m.theme, W, D, grid,
    start: rel(m.start), side: m.side, exit: m.exit, gate: m.midGate.filter((c) => c.y === m.y + 1).map(rel),
    spawns: m.spawns.map(rel), chests: m.chests.map(rel),
    rooms: m.rooms.map((r) => ({ x1: r.x1 - m.inner.x1, z1: r.z1 - m.inner.z1, x2: r.x2 - m.inner.x1, z2: r.z2 - m.inner.z1, role: r.role })),
    ...DESC[f],
  });
}
const data = JSON.stringify(floors);

const html = `<title>15号館ダンジョン案内図</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* 館内の避難経路図を下敷きにした案内図。左に階の切り替え、右に平面図と説明 */
:root {
  --paper: #f3f5f2; --ink: #17222b; --muted: #5d6a72; --line: #c9d1cf;
  --wall: #2a3640; --room: #ffffff; --deco: #9aa7ad;
  --exit: #11804a; --exit-tint: #d6efe0; --alarm: #c4302b; --alarm-tint: #f6dcda;
  --amber: #b9770e; --amber-tint: #f6e8cc; --chest: #d4a017; --panel: #ffffff;
  --display: "Dela Gothic One", "Hiragino Kaku Gothic StdN", "Yu Gothic", sans-serif;
  --body: "Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "Consolas", monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #10171c; --ink: #e5ece9; --muted: #98a6ad; --line: #2b3840;
  --wall: #c9d4d8; --room: #1a242b; --deco: #4f5e66;
  --exit: #3fbf7f; --exit-tint: #173a2a; --alarm: #ff6b61; --alarm-tint: #42201f;
  --amber: #e7a948; --amber-tint: #3c2e15; --chest: #f0c440; --panel: #151e24; color-scheme: dark; } }
:root[data-theme="dark"] {
  --paper: #10171c; --ink: #e5ece9; --muted: #98a6ad; --line: #2b3840;
  --wall: #c9d4d8; --room: #1a242b; --deco: #4f5e66;
  --exit: #3fbf7f; --exit-tint: #173a2a; --alarm: #ff6b61; --alarm-tint: #42201f;
  --amber: #e7a948; --amber-tint: #3c2e15; --chest: #f0c440; --panel: #151e24; color-scheme: dark; }
body { background: var(--paper); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.7; }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 28px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 24px; }
header { display: grid; gap: 6px; border-bottom: 3px solid var(--ink); padding-bottom: 14px; }
.kicker { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; color: var(--muted); }
h1 { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 5vw, 44px); line-height: 1.15; margin: 0; text-wrap: balance; }
.lead { margin: 0; max-width: 62ch; color: var(--muted); }
.main { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 24px; align-items: start; }
.floors { display: grid; gap: 6px; position: sticky; top: calc(env(safe-area-inset-top, 0px) + 12px); }
.floors button { font: inherit; display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 4px; cursor: pointer; }
.floors button b { font-family: var(--display); font-weight: 400; font-size: 22px; }
.floors button span { font-size: 11px; color: var(--muted); line-height: 1.3; }
.floors button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.floors button[aria-pressed="true"] span { color: var(--paper); opacity: .8; }
.floors button:focus-visible { outline: 3px solid var(--exit); outline-offset: 2px; }
.sheet { display: grid; gap: 18px; min-width: 0; }
.sheet-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; }
.sheet-head h2 { font-family: var(--display); font-weight: 400; font-size: 30px; margin: 0; }
.sheet-head .boss { color: var(--alarm); font-weight: 700; }
.mono { font-family: var(--mono); font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.plan { background: var(--panel); border: 1px solid var(--line); border-radius: 4px; padding: 12px; overflow-x: auto; }
.plan svg { display: block; width: 100%; min-width: 560px; height: auto; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; vertical-align: -1px; margin-right: 6px; border-radius: 2px; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.cols section { min-width: 0; }
h3 { font-size: 13px; letter-spacing: .08em; color: var(--muted); margin: 0 0 6px; font-weight: 700; }
.cols p { margin: 0; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; margin: 0; font-variant-numeric: tabular-nums; }
dt { color: var(--muted); }
dd { margin: 0; }
.notes { border-top: 1px solid var(--line); padding-top: 18px; display: grid; gap: 8px; }
.notes ul { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; max-width: 72ch; }
@media (max-width: 720px) {
  .main { grid-template-columns: 1fr; }
  .floors { position: static; grid-template-columns: repeat(4, 1fr); }
  .floors button { grid-template-columns: 1fr; text-align: center; padding: 6px 4px; }
  .floors button span { display: none; }
}
@media (prefers-reduced-motion: no-preference) { .plan svg { transition: opacity .2s; } }
</style>

<div class="wrap">
  <header>
    <div class="kicker">大阪産業大学 電子計算研究部 ／ 大学祭 Minecraft サーバー</div>
    <h1>15号館 ダンジョン案内図（案）</h1>
    <p class="lead">1 階の受付から 2 階に入り、9 階まで階段を歩いて上っていくダンジョンです。建物の両端の階段を交互に使い、各階の途中にある「中ボスの壁」と、上り階段をふさぐ「ボスの壁」をクリックすると上空の闘技場で戦います。勝つと元の場所に戻り、壁が消えて先へ進めます。テストサーバーで、ボットが 2→9 階を通しで突破できることを確認済みです。</p>
  </header>
  <div class="main">
    <nav class="floors" id="floors" aria-label="階の切り替え"></nav>
    <div class="sheet">
      <div class="sheet-head"><h2 id="fname"></h2><span class="boss" id="fboss"></span><span class="mono" id="fy"></span></div>
      <div class="plan"><svg id="plan" role="img" aria-label="平面図"></svg></div>
      <div class="legend">
        <span><i style="background:var(--exit)"></i>開始・復帰地点（敵なし）</span>
        <span><i style="background:var(--amber)"></i>中ボスの壁（クリックで中ボス戦）</span>
        <span><i style="background:var(--alarm)"></i>出口：ボスの壁がある上り階段</span>
        <span><i style="background:var(--alarm);border-radius:50%"></i>敵の出現地点</span>
        <span><i style="background:var(--chest)"></i>宝箱の候補</span>
        <span><i style="background:var(--deco)"></i>家具・障害物</span>
        <span><i style="background:var(--wall)"></i>壁</span>
      </div>
      <div class="cols">
        <section><h3>雰囲気</h3><p id="fmood"></p></section>
        <section><h3>置いてあるもの</h3><p id="fdeco"></p></section>
        <section><h3>数字</h3><dl id="fstats"></dl></section>
      </div>
      <div class="notes">
        <h3>進み方</h3>
        <ul>
          <li>1 階の受付で開始する階を選ぶ。最初は 2 階だけ。突破した階の次の階からも始められるようになる。</li>
          <li>偶数階は西の階段から入って東の階段へ、奇数階は東から入って西へ。建物の両端の階段を交互に上っていく。</li>
          <li>階の途中にある中ボスの壁（泣く黒曜石・オレンジ）をクリックすると、パーティー全員が上空の中ボス闘技場（25 × 25）へ。勝つと元の場所に戻り、壁が消える。</li>
          <li>出口の上り階段をふさぐボスの壁（強化深層岩）をクリックすると、ボス闘技場（33 × 33）へ。勝つと元の場所に戻り、階段が現れる。上って次の階のフロアに入ると、その階が始まる。</li>
          <li>反対側の上り階段は白い壁でずっとふさいである。エレベーターで別の階へ行っても、自分の階に戻される。</li>
          <li>全員が倒れたら、その回は終了して 1 階へ。解放と報酬は残る。</li>
          <li>闘技場は各階に 1 組ずつ、階のテーマに合わせた素材で上空（y 200）に並べた。複数のパーティーが別々の階を同時に進められる。</li>
        </ul>
        <h3>全階共通のつくり</h3>
        <ul>
          <li>フロアの出入口は両端の階段の 2 か所だけ。エレベーターホール側の出入口は壁でふさいだ。</li>
          <li>開始地点の部屋（入口側）には敵を出さない。死んで復活するのもこの部屋。</li>
          <li>フロアを東西に分ける壁の出入口が、中ボスの壁になっている。</li>
          <li>部屋どうしは幅 3 マスの出入口でつながる。家具は出入口と通り道をふさがない位置にだけ置いた。</li>
          <li>天井の照明は少し暗め（上の階ほど暗い）。自然に敵が湧かない明るさは保っている。</li>
          <li>挑戦中のパーティー以外がフロアに入ると、ロビーに戻される（管理者は除く）。</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<script>
const FLOORS = ${data};
const ns = 'http://www.w3.org/2000/svg';
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const S = 12;
function el(name, attrs, parent) { const e = document.createElementNS(ns, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
function draw(fl) {
  const svg = document.getElementById('plan');
  svg.innerHTML = '';
  const pad = 26, w = fl.W * S, h = fl.D * S;
  svg.setAttribute('viewBox', '0 0 ' + (w + pad * 2) + ' ' + (h + pad * 2));
  const g = el('g', { transform: 'translate(' + pad + ',' + pad + ')' }, svg);
  el('rect', { x: 0, y: 0, width: w, height: h, fill: css('--room'), stroke: css('--wall'), 'stroke-width': 3 }, g);
  const tint = { start: '--exit-tint' };
  for (const r of fl.rooms) if (tint[r.role]) el('rect', { x: r.x1 * S, y: r.z1 * S, width: (r.x2 - r.x1 + 1) * S, height: (r.z2 - r.z1 + 1) * S, fill: css(tint[r.role]) }, g);
  for (let z = 0; z < fl.D; z++) for (let x = 0; x < fl.W; x++) {
    const v = fl.grid[z * fl.W + x];
    if (v === '1') el('rect', { x: x * S, y: z * S, width: S, height: S, fill: css('--wall') }, g);
    else if (v === '2') el('rect', { x: x * S + 2, y: z * S + 2, width: S - 4, height: S - 4, fill: css('--deco'), rx: 1 }, g);
    else if (v === '3') el('rect', { x: x * S + 3, y: z * S + 3, width: S - 6, height: S - 6, fill: css('--deco'), opacity: .5 }, g);
  }
  for (const [x, z] of fl.chests) el('rect', { x: x * S + 1, y: z * S + 1, width: S - 2, height: S - 2, fill: css('--chest'), stroke: css('--ink'), 'stroke-width': 1 }, g);
  for (const [x, z] of fl.spawns) el('circle', { cx: x * S + S / 2, cy: z * S + S / 2, r: S / 2.8, fill: css('--alarm') }, g);
  const mark = (p, color, label) => {
    el('circle', { cx: p[0] * S + S / 2, cy: p[1] * S + S / 2, r: S * 1.15, fill: color }, g);
    const t = el('text', { x: p[0] * S + S / 2, y: p[1] * S + S / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: css('--room'), 'font-family': 'sans-serif' }, g); t.textContent = label;
  };
  for (const [x, z] of fl.gate) el('rect', { x: x * S, y: z * S, width: S, height: S, fill: css('--amber') }, g);
  mark(fl.start, css('--exit'), 'S');
  // 西の階段（z 92〜94）と東の階段（z 95〜96）。入口は緑、出口（ボスの壁）は赤
  const wz = (92 - 87) * S + S * 1.5, ez = (95 - 87) * S + S;
  const arrow = (x1, x2, y, color) => el('path', { d: 'M ' + x1 + ' ' + y + ' L ' + x2 + ' ' + y + ' M ' + (x2 - Math.sign(x2 - x1) * 6) + ' ' + (y - 6) + ' L ' + x2 + ' ' + y + ' L ' + (x2 - Math.sign(x2 - x1) * 6) + ' ' + (y + 6), stroke: color, 'stroke-width': 3, fill: 'none' }, g);
  const label = (x, y, t, color, anchor) => { const e = el('text', { x, y, 'font-size': 11, fill: color, 'font-family': 'sans-serif', 'text-anchor': anchor }, g); e.textContent = t; };
  if (fl.side === 'W') { arrow(-pad + 4, -4, wz, css('--exit')); label(-pad + 2, wz - 10, '入口', css('--exit'), 'start'); arrow(w + 4, w + pad - 4, ez, css('--alarm')); label(w + pad - 2, ez - 10, '出口', css('--alarm'), 'end'); }
  else { arrow(w + pad - 4, w + 4, ez, css('--exit')); label(w + pad - 2, ez - 10, '入口', css('--exit'), 'end'); arrow(-4, -pad + 4, wz, css('--alarm')); label(-pad + 2, wz - 10, '出口', css('--alarm'), 'start'); }
  const t3 = el('text', { x: w - 2, y: -8, 'text-anchor': 'end', 'font-size': 11, fill: css('--muted'), 'font-family': 'sans-serif' }, g); t3.textContent = '↑ 北（z 87）';
}
function show(f) {
  const fl = FLOORS.find((x) => x.f === f) || FLOORS[0];
  document.querySelectorAll('#floors button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.f) === fl.f)));
  document.getElementById('fname').textContent = fl.f + '階 ' + fl.title;
  document.getElementById('fboss').textContent = 'ボス：' + fl.boss;
  document.getElementById('fy').textContent = '床 y=' + fl.y + '　x -267〜-204 / z 87〜125';
  document.getElementById('fmood').textContent = fl.mood;
  document.getElementById('fdeco').textContent = fl.deco + '。壁：' + fl.wall + '。';
  const dl = document.getElementById('fstats');
  dl.innerHTML = '';
  for (const [k, v] of [['部屋', fl.rooms.length + ' 部屋'], ['敵の出現地点', fl.spawns.length + ' か所'], ['宝箱の候補', fl.chests.length + ' か所'], ['通し挑戦', 'ボットで確認済み']]) {
    const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd);
  }
  draw(fl);
  try { localStorage.setItem('floor', String(fl.f)); } catch (e) {}
}
const nav = document.getElementById('floors');
for (const fl of FLOORS) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.f = fl.f; b.id = 'floor-' + fl.f;
  b.innerHTML = '<b>' + fl.f + 'F</b><span>' + fl.title + '</span>';
  b.addEventListener('click', () => { show(fl.f); history.replaceState(null, '', '#f' + fl.f); });
  nav.appendChild(b);
}
let first = 2;
const m = location.hash.match(/^#f([2-9])$/);
if (m) first = Number(m[1]); else { try { const s = Number(localStorage.getItem('floor')); if (s >= 2 && s <= 9) first = s; } catch (e) {} }
show(first);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => show(Number(document.querySelector('#floors [aria-pressed="true"]').dataset.f)));
new MutationObserver(() => show(Number(document.querySelector('#floors [aria-pressed="true"]').dataset.f))).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
</script>
`;
fs.writeFileSync(outFile, html);
console.log('wrote', outFile, html.length);
