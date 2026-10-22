// 各階の build_<f>.txt（fill / setblock）を、8 つの領域を持つ 1 つの .litematic にまとめる
// 原点 = 2 階の領域の北西・下の角 (-267, 73, 87)。3 階以降は y を 5 ずつ上にずらした領域として入る
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const nbt = require(path.join(process.argv[4], 'prismarine-nbt'));
const dir = process.argv[2], outFile = process.argv[3];
const AX1 = -267, AX2 = -204, AZ1 = 87, AZ2 = 125;
const SX = AX2 - AX1 + 1, SY = 4, SZ = AZ2 - AZ1 + 1;
const ORIGIN = { x: AX1, y: 73, z: AZ1 };

function parseState(s) {
  const m = s.match(/^([a-z0-9_:]+)(?:\[(.*)\])?$/);
  const props = {};
  if (m[2]) for (const kv of m[2].split(',')) { const [k, v] = kv.split('='); props[k] = v; }
  return { name: m[1].includes(':') ? m[1] : 'minecraft:' + m[1], props };
}
const long = (big) => [Number(BigInt.asIntN(32, big >> 32n)), Number(BigInt.asIntN(32, big & 0xffffffffn))];

const regions = {};
let totalBlocks = 0;
for (let f = 2; f <= 9; f++) {
  const y0 = 72 + (f - 2) * 5 + 1; // その階の床の 1 段上
  const vol = new Array(SX * SY * SZ).fill('minecraft:air');
  const set = (x, y, z, b) => { if (x < AX1 || x > AX2 || z < AZ1 || z > AZ2 || y < y0 || y >= y0 + SY) return; vol[((y - y0) * SZ + (z - AZ1)) * SX + (x - AX1)] = b; };
  for (const line of fs.readFileSync(`${dir}/build_${f}.txt`, 'utf8').split('\n')) {
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
  regions[`${f}F`] = {
    type: 'compound', value: {
      Position: { type: 'compound', value: { x: { type: 'int', value: 0 }, y: { type: 'int', value: y0 - ORIGIN.y }, z: { type: 'int', value: 0 } } },
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
      Name: { type: 'string', value: '15goukan_dungeon' },
      Author: { type: 'string', value: 'osu-denken' },
      Description: { type: 'string', value: '15号館 2〜9階 ダンジョン内装。原点を (-267, 73, 87) に合わせて貼る' },
      RegionCount: { type: 'int', value: 8 },
      TotalVolume: { type: 'int', value: SX * SY * SZ * 8 },
      TotalBlocks: { type: 'int', value: totalBlocks },
      EnclosingSize: { type: 'compound', value: { x: { type: 'int', value: SX }, y: { type: 'int', value: 35 + SY }, z: { type: 'int', value: SZ } } },
      TimeCreated: { type: 'long', value: long(BigInt(now)) },
      TimeModified: { type: 'long', value: long(BigInt(now)) },
    } },
    Regions: { type: 'compound', value: regions },
  },
};
const raw = nbt.writeUncompressed(root);
fs.writeFileSync(outFile, zlib.gzipSync(raw));
console.log('wrote', outFile, 'blocks', totalBlocks, 'bytes', fs.statSync(outFile).size);
