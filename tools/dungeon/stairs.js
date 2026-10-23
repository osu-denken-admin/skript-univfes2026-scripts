// 階段まわりを階ごとに、高さ別の断面で表示
const fs = require('fs');
const base = process.argv[2], oy = 62, ox = -282, oz = 80;
const m = JSON.parse(fs.readFileSync(base + '.json'));
const r = m.regions['15goukan'];
const idx = new Uint16Array(fs.readFileSync(base + '.15goukan.bin').buffer.slice(0));
const { x: X, y: Y, z: Z } = r.dims, pal = r.palette;
const at = (wx, wy, wz) => { const x = wx - ox, y = wy - oy, z = wz - oz; if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 'air'; return pal[idx[(y * Z + z) * X + x]].replace('minecraft:', ''); };
const ch = (b) => { const n = b.split('[')[0]; if (n === 'air' || n === 'light') return '.'; if (n.includes('stairs')) { const f = (b.match(/facing=(\w)/) || [])[1]; const h = b.includes('half=top') ? 'T' : ''; return { n: '^', s: 'v', e: '>', w: '<' }[f] || 'S'; } if (n.includes('slab')) return b.includes('type=top') ? '=' : '_'; if (n.includes('pane') || n === 'glass' || n.includes('stained_glass')) return '|'; if (n.includes('door')) return 'D'; if (n.includes('plate')) return 'p'; return '#'; };
const [x1, x2, z1, z2, y1, y2] = process.argv.slice(3).map(Number);
for (let y = y1; y <= y2; y++) {
  console.log(`--- y=${y}  x ${x1}..${x2}`);
  for (let z = z1; z <= z2; z++) { let row = String(z).padStart(4) + ' '; for (let x = x1; x <= x2; x++) row += ch(at(x, y, z)); console.log(row); }
}
