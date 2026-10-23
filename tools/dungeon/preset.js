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
fs.writeFileSync(process.argv[3], L.join('\n'));
console.log('lines', L.length);
