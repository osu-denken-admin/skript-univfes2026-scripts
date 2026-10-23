// x を固定した縦の断面（行=高さ、列=z）
const fs = require('fs');
const base = process.argv[2], oy = 62, ox = -282, oz = 80;
const m = JSON.parse(fs.readFileSync(base + '.json'));
const r = m.regions['15goukan'];
const idx = new Uint16Array(fs.readFileSync(base + '.15goukan.bin').buffer.slice(0));
const { x: X, y: Y, z: Z } = r.dims, pal = r.palette;
const at = (wx, wy, wz) => { const x = wx - ox, y = wy - oy, z = wz - oz; if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 'air'; return pal[idx[(y * Z + z) * X + x]].replace('minecraft:', ''); };
const ch = (b) => { const n = b.split('[')[0]; if (n === 'air' || n === 'light') return '.'; if (n.includes('stairs')) { const f = (b.match(/facing=(\w+)/) || [])[1]; const top = b.includes('half=top'); return top ? 'T' : ({ north: 'n', south: 's', east: 'e', west: 'w' }[f]); } if (n.includes('slab')) return b.includes('type=top') ? '=' : '_'; if (n.includes('pane') || n === 'glass' || n.includes('stained_glass')) return '|'; return '#'; };
const [xs, z1, z2, y1, y2] = process.argv.slice(3);
for (const x of xs.split(',').map(Number)) {
  console.log(`=== x=${x}  z ${z1}..${z2} (left=north)`);
  for (let y = Number(y2); y >= Number(y1); y--) { let row = String(y).padStart(4) + ' '; for (let z = Number(z1); z <= Number(z2); z++) row += ch(at(x, y, z)); console.log(row); }
}
