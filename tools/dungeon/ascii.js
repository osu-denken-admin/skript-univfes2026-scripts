const fs = require('fs');
const m = JSON.parse(fs.readFileSync(process.argv[2]));
const W = m.grid.length, D = m.grid[0].length;
const key = (x, z) => `${x},${z}`;
const sp = new Set(m.spawns.map((p) => key(Math.floor(p.x), Math.floor(p.z))));
const ch = new Set(m.chests.map((p) => key(p.x, p.z)));
console.log(`${m.floor}F ${m.title}  seed=${m.seed}`);
for (let z = 0; z < D; z++) {
  let row = '';
  for (let x = 0; x < W; x++) {
    const wx = m.inner.x1 + x, wz = m.inner.z1 + z, k = key(wx, wz);
    const v = m.grid[x][z];
    if (k === key(Math.floor(m.start.x), Math.floor(m.start.z))) row += 'S';
    else if (k === key(Math.floor(m.bossLoc.x), Math.floor(m.bossLoc.z))) row += 'B';
    else if (k === key(Math.floor(m.mid.x), Math.floor(m.mid.z))) row += 'M';
    else if (sp.has(k)) row += 'e';
    else if (ch.has(k)) row += 'C';
    else row += v === 1 ? '#' : v === 2 ? 'o' : v === 3 ? ':' : ' ';
  }
  console.log((z === 92 - 87 ? '>' : '|') + row + '|');
}
