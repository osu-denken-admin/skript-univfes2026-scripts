// 生成したレイアウトから、ダンジョン設定を一括登録する Skript を作る
const fs = require('fs');
const dir = process.argv[2];
const L = [];
L.push('# ============================================================');
L.push('# uf_15_layout.sk : 15号館 2〜9 階の内装に合わせたダンジョン設定（自動生成）');
L.push('#   tools/gen.js で生成した内装の座標を、管理者ツールのボタン 1 つで登録する。');
L.push('#   座標は「15号館（ダンジョン）」として登録したワールドに対して設定される。');
L.push('#   内装を作り直したら、このファイルも作り直すこと（手で編集しない）。');
L.push('# ============================================================');
L.push('');
L.push('function uf_layout_loc(x: number, y: number, z: number) :: location:');
L.push('    return location({_x}, {_y}, {_z}, world({uf::cfg::world::dungeon}))');
L.push('');
L.push('function uf_layout_apply() :: boolean:');
L.push('    if {uf::cfg::world::dungeon} is not set:');
L.push('        return false');
for (let f = 2; f <= 9; f++) {
  const m = JSON.parse(fs.readFileSync(`${dir}/floor_${f}.json`));
  const p = (o) => `uf_layout_loc(${o.x}, ${o.y}, ${o.z})`;
  L.push(`    # ${f}F ${m.title}`);
  L.push(`    delete {uf::floor::${f}::spawn::*}`);
  L.push(`    delete {uf::floor::${f}::chest::*}`);
  L.push(`    set {uf::floor::${f}::start} to ${p(m.start)}`);
  L.push(`    set {uf::floor::${f}::cp} to ${p(m.cp)}`);
  L.push(`    set {uf::floor::${f}::mid} to ${p(m.mid)}`);
  L.push(`    set {uf::floor::${f}::boss} to ${p(m.bossLoc)}`);
  L.push(`    set {uf::floor::${f}::p1} to ${p(m.p1)}`);
  L.push(`    set {uf::floor::${f}::p2} to ${p(m.p2)}`);
  for (const s of m.spawns) L.push(`    add ${p(s)} to {uf::floor::${f}::spawn::*}`);
  for (const c of m.chests) L.push(`    add ${p(c)} to {uf::floor::${f}::chest::*}`);
}
L.push('    return true');
L.push('');
fs.writeFileSync(process.argv[3], L.join('\n'));
console.log('lines', L.length);
