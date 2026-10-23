// レイアウトを文字で表示: S=開始 G=中ボスの壁 X=出口（階段の壁へ） e=敵 C=宝箱 #=壁 o=飾り
const fs = require('fs');
const m = JSON.parse(fs.readFileSync(process.argv[2]));
const W = m.grid.length, D = m.grid[0].length;
const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
const sp = new Set(m.spawns.map((p) => key(p.x, p.z)));
const ch = new Set(m.chests.map((p) => key(p.x, p.z)));
const gate = new Set(m.midGate.map((p) => key(p.x, p.z)));
console.log(`${m.floor}F ${m.title}  入口=${m.side} 出口=${m.exit}  seed=${m.seed}`);
for (let z = 0; z < D; z++) {
  let row = '';
  for (let x = 0; x < W; x++) {
    const wx = m.inner.x1 + x, wz = m.inner.z1 + z, k = key(wx, wz), v = m.grid[x][z];
    if (k === key(m.start.x, m.start.z)) row += 'S';
    else if (k === key(m.exitCell.x, m.exitCell.z)) row += 'X';
    else if (gate.has(k)) row += 'G';
    else if (sp.has(k)) row += 'e';
    else if (ch.has(k)) row += 'C';
    else row += v === 1 ? '#' : v === 2 ? 'o' : v === 3 ? ':' : ' ';
  }
  const wzz = m.inner.z1 + z;
  const l = (wzz >= 92 && wzz <= 94) ? '=' : '|', rr = (wzz >= 95 && wzz <= 96) ? '=' : '|';
  console.log(l + row + rr);
}
