const fs = require('fs');
const base = process.argv[2], oy = 62, ox = -282, oz = 80;
const m = JSON.parse(fs.readFileSync(base + '.json'));
const r = m.regions['15goukan'];
const idx = new Uint16Array(fs.readFileSync(base + '.15goukan.bin').buffer.slice(0));
const { x: X, y: Y, z: Z } = r.dims, pal = r.palette;
const at = (wx, wy, wz) => { const x = wx - ox, y = wy - oy, z = wz - oz; if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 'out'; return pal[idx[(y * Z + z) * X + x]].replace('minecraft:', '').split('[')[0]; };
for (let L = 72; L <= 107; L += 5) {
  const sum = (xs, zs) => { const c = {}; for (const x of xs) for (const z of zs) for (let y = L + 1; y <= L + 3; y++) { const b = at(x, y, z); c[b] = (c[b] || 0) + 1; } return JSON.stringify(c); };
  console.log(`L=${L} W:`, sum([-273, -272], [90, 91, 92]), ' E:', sum([-202, -201], [91, 92, 93]));
}
