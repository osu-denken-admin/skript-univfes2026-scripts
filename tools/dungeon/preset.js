// 生成したレイアウトと闘技場から、ダンジョン設定を一括登録する Skript を作る
const fs = require('fs');
const dir = process.argv[2];

// 階段の「上り」の最初の 3 段（ここを壁でふさぐ）。L = その階の床ブロックの高さ
const STAIR = {
  W: { xs: [-273, -272], zs: [90, 91, 92] },
  E: { xs: [-202, -201], zs: [91, 92, 93] },
};
const stairCells = (side, L) => { const s = STAIR[side]; const out = []; for (const x of s.xs) for (const z of s.zs) for (let y = L + 1; y <= L + 3; y++) out.push({ x, y, z }); return out; };

const L = [];
L.push('# ============================================================');
L.push('# uf_15_layout.sk : 15号館 2〜9 階の内装・階段・闘技場に合わせたダンジョン設定（自動生成）');
L.push('#   tools/dungeon の gen.js / gen_arena.js / preset.js で生成。手で編集しない。');
L.push('#   管理者ツールの「15号館の内装に合わせて全階を設定」で登録される。');
L.push('#   偶数階は西の階段から入って東の階段へ、奇数階は東から入って西へ進む。');
L.push('#   壁（ゲート）の種類: mid = 中ボスの壁 / exit = ボスの壁（上り階段）/ block = 使わない上り階段をふさぐ壁');
L.push('# ============================================================');
L.push('');
L.push('function uf_layout_loc(x: number, y: number, z: number) :: location:');
L.push('    return location({_x}, {_y}, {_z}, world({uf::cfg::world::dungeon}))');
L.push('');
L.push('function uf_layout_apply() :: boolean:');
L.push('    if {uf::cfg::world::dungeon} is not set:');
L.push('        return false');
L.push('    delete {uf::gatekind::*}');
for (let f = 2; f <= 9; f++) {
  const m = JSON.parse(fs.readFileSync(`${dir}/floor_${f}.json`));
  const ar = JSON.parse(fs.readFileSync(`${dir}/arena_${f}.json`));
  const p = (o) => `uf_layout_loc(${o.x}, ${o.y}, ${o.z})`;
  const Lv = m.y;
  L.push(`    # ${f}F ${m.title}（入口 ${m.side} → 出口 ${m.exit}）`);
  L.push(`    delete {uf::floor::${f}::spawn::*}`);
  L.push(`    delete {uf::floor::${f}::chest::*}`);
  L.push(`    delete {uf::floor::${f}::midroom::*}`);
  for (const k of ['mid', 'exit', 'block']) L.push(`    delete {uf::gatecells::${f}::${k}::*}`);
  L.push(`    set {uf::floor::${f}::start} to ${p(m.start)}`);
  L.push(`    set {uf::floor::${f}::cp} to ${p(m.cp)}`);
  L.push(`    set {uf::floor::${f}::p1} to ${p(m.p1)}`);
  L.push(`    set {uf::floor::${f}::p2} to ${p(m.p2)}`);
  L.push(`    set {uf::floor::${f}::marena::player} to ${p(ar.mid.player)}`);
  L.push(`    set {uf::floor::${f}::marena::boss} to ${p(ar.mid.boss)}`);
  L.push(`    set {uf::floor::${f}::barena::player} to ${p(ar.boss.player)}`);
  L.push(`    set {uf::floor::${f}::barena::boss} to ${p(ar.boss.boss)}`);
  for (const s of m.spawns) L.push(`    add ${p(s)} to {uf::floor::${f}::spawn::*}`);
  for (const c of m.chests) L.push(`    add ${p(c)} to {uf::floor::${f}::chest::*}`);
  const gates = { mid: m.midGate, exit: stairCells(m.exit, Lv), block: (f === 9 && m.side === 'E') ? [] : stairCells(m.side, Lv) };
  // 9 階の東は上り階段がない（西だけ）
  if (f === 9) gates.block = [];
  for (const [k, cells] of Object.entries(gates)) for (const c of cells) {
    L.push(`    add ${p(c)} to {uf::gatecells::${f}::${k}::*}`);
    L.push(`    set {uf::gatekind::%uf_lockey(${p(c)})%} to "${f}:${k}"`);
  }
}
L.push('    # 使わない上り階段は、ここでふさいでおく（以後ずっと閉じたまま）');
L.push('    loop integers between 2 and 9:');
L.push('        uf_gateclose(loop-value, "block")');
L.push('        uf_gateclose(loop-value, "exit")');
L.push('        uf_gateclose(loop-value, "mid")');
L.push('    return true');
L.push('');

// ライトブロック: Litematica で貼るとライトが置かれず、もとからあったライトも消えないので、Skript で置き直す
// 範囲は tolitematic.js の領域と同じ
const REGIONS = [];
for (let f = 2; f <= 9; f++) { const y0 = 72 + (f - 2) * 5 + 1; REGIONS.push({ name: `${f}F`, x1: -267, y1: y0, z1: 87, x2: -204, y2: y0 + 3, z2: 125, file: `${dir}/build_${f}.txt` }); }
for (let f = 2; f <= 9; f++) { const a = JSON.parse(fs.readFileSync(`${dir}/arena_${f}.json`)); for (const k of ['mid', 'boss']) REGIONS.push({ name: `${f}F_${k}`, x1: a[k].a.x, y1: a[k].a.y, z1: a[k].a.z, x2: a[k].b.x, y2: a[k].b.y, z2: a[k].b.z, file: `${dir}/build_arena.txt` }); }
const inR = (r, x, y, z) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2 && z >= r.z1 && z <= r.z2;
// build_*.txt を順に読み、最後までライトのまま残る場所を集める（あとの fill / setblock で上書きされたものは除く）
const lightsOf = (file) => {
  const m = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'setblock') { const k = `${p[1]},${p[2]},${p[3]}`; if (/^minecraft:light\[/.test(p[4])) m.set(k, p[4]); else m.delete(k); }
    else if (p[0] === 'fill') {
      const [x1, y1, z1, x2, y2, z2] = p.slice(1, 7).map(Number);
      const box = { x1: Math.min(x1, x2), y1: Math.min(y1, y2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), y2: Math.max(y1, y2), z2: Math.max(z1, z2) };
      for (const k of [...m.keys()]) { const [x, y, z] = k.split(',').map(Number); if (inR(box, x, y, z)) m.delete(k); }
    }
  }
  return m;
};
const lights = [];
const lightSeen = new Set();
const lightCache = {};
for (const r of REGIONS) {
  lightCache[r.file] = lightCache[r.file] || lightsOf(r.file);
  for (const [k, b] of lightCache[r.file]) { const [x, y, z] = k.split(',').map(Number); if (inR(r, x, y, z) && !lightSeen.has(k)) { lightSeen.add(k); lights.push({ x, y, z, lv: Number(b.match(/level=(\d+)/)[1]) }); } }
}
const levels = [...new Set(lights.map((l) => l.lv))].sort((a, b) => a - b);
L.push('# ライトブロック（Litematica で貼るとライトが置かれず、もとからあったライトも消えないため、ここで置き直す）');
L.push('#   内装と闘技場の範囲にあるライトを全部消してから、決まった場所に置く');
L.push('function uf_layout_unlight(a: location, b: location) :: number:');
L.push('    set {_n} to 0');
L.push('    loop all blocks within {_a} and {_b}:');
L.push('        if loop-block is not air:');
L.push('            if "%block data of loop-block%" contains "minecraft:light[":');
L.push('                set loop-block to air');
L.push('                add 1 to {_n}');
L.push('    return {_n}');
L.push('');
L.push('function uf_layout_lights(p: player):');
L.push('    if {uf::cfg::world::dungeon} is not set:');
L.push('        uf_msg({_p}, "&c先に「ワールドとロビー」で15号館（ダンジョン）のワールドを登録してください")');
L.push('        stop');
L.push('    uf_msg({_p}, "&eライトを置き直しています（少し時間がかかります）")');
L.push('    set {_del} to 0');
for (const r of REGIONS) {
  L.push(`    # ${r.name}`);
  L.push(`    add uf_layout_unlight(uf_layout_loc(${r.x1}, ${r.y1}, ${r.z1}), uf_layout_loc(${r.x2}, ${r.y2}, ${r.z2})) to {_del}`);
  L.push('    wait 1 tick');
}
for (const lv of levels) L.push(`    set {_lv::${lv}} to "minecraft:light[level=${lv}]" parsed as block data`);
for (const l of lights) L.push(`    set block at uf_layout_loc(${l.x}, ${l.y}, ${l.z}) to {_lv::${l.lv}}`);
L.push(`    uf_msg({_p}, "&aもとのライト %{_del}% 個を消して、ライト ${lights.length} 個を置きました")`);
L.push('');
fs.writeFileSync(process.argv[3], L.join('\n'));
console.log('lights', lights.length);
console.log('lines', L.length);
