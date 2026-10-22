// litematic を読み、領域・パレット・ブロック配列を JSON に書き出す
const path = require('path');
const nbt = require(path.join(process.argv[4], 'prismarine-nbt'));
const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
nbt.parse(buf).then(({ parsed }) => {
  const root = nbt.simplify(parsed);
  const out = { version: root.Version, mcData: root.MinecraftDataVersion, meta: root.Metadata, regions: {} };
  for (const [name, r] of Object.entries(root.Regions)) {
    const sx = r.Size.x, sy = r.Size.y, sz = r.Size.z;
    const ax = Math.abs(sx), ay = Math.abs(sy), az = Math.abs(sz);
    const pal = r.BlockStatePalette.map((p) => p.Name + (p.Properties ? '[' + Object.entries(p.Properties).map(([k, v]) => `${k}=${v}`).join(',') + ']' : ''));
    const bits = Math.max(2, Math.ceil(Math.log2(pal.length)));
    const longs = r.BlockStates; // [hi, lo] pairs after simplify
    const toBig = (l) => (BigInt.asUintN(32, BigInt(l[0])) << 32n) | BigInt.asUintN(32, BigInt(l[1]));
    const arr = longs.map(toBig);
    const mask = (1n << BigInt(bits)) - 1n;
    const total = ax * ay * az;
    const idx = new Uint16Array(total);
    for (let i = 0; i < total; i++) {
      const bitIndex = BigInt(i) * BigInt(bits);
      const li = Number(bitIndex >> 6n), off = bitIndex & 63n;
      let v = arr[li] >> off;
      if (off + BigInt(bits) > 64n) v |= arr[li + 1] << (64n - off);
      idx[i] = Number(v & mask);
    }
    // 位置: Position + Size が負なら負方向に伸びる
    const minx = r.Position.x + (sx < 0 ? sx + 1 : 0), miny = r.Position.y + (sy < 0 ? sy + 1 : 0), minz = r.Position.z + (sz < 0 ? sz + 1 : 0);
    out.regions[name] = { pos: r.Position, size: r.Size, min: { x: minx, y: miny, z: minz }, dims: { x: ax, y: ay, z: az }, palette: pal, tiles: (r.TileEntities || []).length, entities: (r.Entities || []).length };
    fs.writeFileSync(process.argv[3] + '.' + name.replace(/[^\w-]/g, '_') + '.bin', Buffer.from(idx.buffer));
  }
  fs.writeFileSync(process.argv[3] + '.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ version: out.version, mcData: out.mcData, regions: Object.fromEntries(Object.entries(out.regions).map(([k, v]) => [k, { min: v.min, dims: v.dims, palette: v.palette.length, tiles: v.tiles, entities: v.entities }])) }, null, 1));
});
