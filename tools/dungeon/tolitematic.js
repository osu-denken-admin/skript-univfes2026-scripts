// build_*.txt（fill / setblock）から .litematic を作る。MODE=floors（2〜9 階の内装、原点 -267,73,87）/ arenas（闘技場、原点 -300,200,-60）
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const nbt = require(path.join(process.argv[4], 'prismarine-nbt'));
const dir = process.argv[2], outFile = process.argv[3], MODE = process.argv[5] || 'floors';
// 領域の一覧: { name, x1, y1, z1, x2, y2, z2, file }
const SPECS = [];
let ORIGIN, NAME, DESC;
if (MODE === 'floors') {
  ORIGIN = { x: -267, y: 73, z: 87 }; NAME = '15goukan_dungeon'; DESC = '15号館 2〜9階 ダンジョン内装。原点を (-267, 73, 87) に合わせて貼る';
  for (let f = 2; f <= 9; f++) { const y0 = 72 + (f - 2) * 5 + 1; SPECS.push({ name: `${f}F`, x1: -267, y1: y0, z1: 87, x2: -204, y2: y0 + 3, z2: 125, file: `${dir}/build_${f}.txt` }); }
} else {
  ORIGIN = { x: -300, y: 200, z: -60 }; NAME = '15goukan_arenas'; DESC = '15号館ダンジョンの闘技場（上空）。原点を (-300, 200, -60) に合わせて貼る';
  for (let f = 2; f <= 9; f++) { const a = JSON.parse(fs.readFileSync(`${dir}/arena_${f}.json`)); for (const k of ['mid', 'boss']) SPECS.push({ name: `${f}F_${k}`, x1: a[k].a.x, y1: a[k].a.y, z1: a[k].a.z, x2: a[k].b.x, y2: a[k].b.y, z2: a[k].b.z, file: `${dir}/build_arena.txt` }); }
}

function parseState(s) {
  const m = s.match(/^([a-z0-9_:]+)(?:\[(.*)\])?$/);
  const props = {};
  if (m[2]) for (const kv of m[2].split(',')) { const [k, v] = kv.split('='); props[k] = v; }
  return { name: m[1].includes(':') ? m[1] : 'minecraft:' + m[1], props };
}
const long = (big) => [Number(BigInt.asIntN(32, big >> 32n)), Number(BigInt.asIntN(32, big & 0xffffffffn))];

const regions = {};
let totalBlocks = 0, totalVol = 0, maxX = 0, maxY = 0, maxZ = 0;
for (const sp of SPECS) {
  const AX1 = sp.x1, AX2 = sp.x2, AZ1 = sp.z1, AZ2 = sp.z2, y0 = sp.y1;
  const SX = AX2 - AX1 + 1, SY = sp.y2 - sp.y1 + 1, SZ = AZ2 - AZ1 + 1;
  totalVol += SX * SY * SZ; maxX = Math.max(maxX, AX2 - ORIGIN.x + 1); maxY = Math.max(maxY, sp.y2 - ORIGIN.y + 1); maxZ = Math.max(maxZ, AZ2 - ORIGIN.z + 1);
  const vol = new Array(SX * SY * SZ).fill('minecraft:air');
  const set = (x, y, z, b) => { if (x < AX1 || x > AX2 || z < AZ1 || z > AZ2 || y < y0 || y >= y0 + SY) return; vol[((y - y0) * SZ + (z - AZ1)) * SX + (x - AX1)] = b; };
  for (const line of fs.readFileSync(sp.file, 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'fill') { const [x1, y1, z1, x2, y2, z2] = p.slice(1, 7).map(Number); for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) set(x, y, z, p[7]); }
    else if (p[0] === 'setblock') set(Number(p[1]), Number(p[2]), Number(p[3]), p[4]);
  }
  const palette = ['minecraft:air'];
  const pIdx = new Map([['minecraft:air', 0]]);
  const ids = vol.map((b) => { if (!pIdx.has(b)) { pIdx.set(b, palette.length); palette.push(b); } return pIdx.get(b); });
  totalBlocks += ids.filter((i) => i !== 0).length;
  const bits = Math.max(2, Math.ceil(Math.log2(palette.length)));
  const nLongs = Math.ceil(ids.length * bits / 64);
  const arr = new Array(nLongs).fill(0n);
  ids.forEach((v, i) => {
    const bi = BigInt(i) * BigInt(bits), li = Number(bi >> 6n), off = bi & 63n, val = BigInt(v);
    arr[li] = BigInt.asUintN(64, arr[li] | (val << off));
    if (off + BigInt(bits) > 64n) arr[li + 1] = BigInt.asUintN(64, arr[li + 1] | (val >> (64n - off)));
  });
  regions[sp.name] = {
    type: 'compound', value: {
      Position: { type: 'compound', value: { x: { type: 'int', value: AX1 - ORIGIN.x }, y: { type: 'int', value: y0 - ORIGIN.y }, z: { type: 'int', value: AZ1 - ORIGIN.z } } },
      Size: { type: 'compound', value: { x: { type: 'int', value: SX }, y: { type: 'int', value: SY }, z: { type: 'int', value: SZ } } },
      BlockStatePalette: { type: 'list', value: { type: 'compound', value: palette.map((s) => { const st = parseState(s); const v = { Name: { type: 'string', value: st.name } }; if (Object.keys(st.props).length) v.Properties = { type: 'compound', value: Object.fromEntries(Object.entries(st.props).map(([k, x]) => [k, { type: 'string', value: x }])) }; return v; }) } },
      BlockStates: { type: 'longArray', value: arr.map(long) },
      TileEntities: { type: 'list', value: { type: 'compound', value: [] } },
      Entities: { type: 'list', value: { type: 'compound', value: [] } },
      PendingBlockTicks: { type: 'list', value: { type: 'compound', value: [] } },
      PendingFluidTicks: { type: 'list', value: { type: 'compound', value: [] } },
    },
  };
}
const now = Date.now();
const root = {
  type: 'compound', name: '', value: {
    MinecraftDataVersion: { type: 'int', value: 4189 },
    Version: { type: 'int', value: 7 },
    SubVersion: { type: 'int', value: 1 },
    Metadata: { type: 'compound', value: {
      Name: { type: 'string', value: NAME },
      Author: { type: 'string', value: 'osu-denken' },
      Description: { type: 'string', value: DESC },
      RegionCount: { type: 'int', value: SPECS.length },
      TotalVolume: { type: 'int', value: totalVol },
      TotalBlocks: { type: 'int', value: totalBlocks },
      EnclosingSize: { type: 'compound', value: { x: { type: 'int', value: maxX }, y: { type: 'int', value: maxY }, z: { type: 'int', value: maxZ } } },
      TimeCreated: { type: 'long', value: long(BigInt(now)) },
      TimeModified: { type: 'long', value: long(BigInt(now)) },
    } },
    Regions: { type: 'compound', value: regions },
  },
};
const raw = nbt.writeUncompressed(root);
fs.writeFileSync(outFile, zlib.gzipSync(raw));
console.log('wrote', outFile, 'blocks', totalBlocks, 'bytes', fs.statSync(outFile).size);
