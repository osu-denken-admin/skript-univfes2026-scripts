// 15号館 2〜9 階の内装ジェネレーター
// 出力: <out>/floor_<階>.json（ブロック配置と、ダンジョン設定用の座標）と <out>/build_<階>.txt（コマンド）
const fs = require('fs');
const out = process.argv[2];

// 全階で使える範囲（周囲の西壁 x=-267 と東壁 x=-204 は生成側で置く）
const AREA = { x1: -267, x2: -204, z1: 87, z2: 125 };
const IN = { x1: -266, x2: -205, z1: 87, z2: 125 }; // 部屋を作る範囲
const W = IN.x2 - IN.x1 + 1, D = IN.z2 - IN.z1 + 1;
const DOOR_W = { z1: 92, z2: 94 }; // 西側（階段側）の入口

const FLOORS = [
  { f: 2, y: 72, theme: 'classroom', title: '教室棟', boss: '受付に残る影' },
  { f: 3, y: 77, theme: 'library', title: '図書室', boss: '図書の番人' },
  { f: 4, y: 82, theme: 'lab', title: '化学実験室', boss: '実験室の異形' },
  { f: 5, y: 87, theme: 'server', title: 'サーバールーム', boss: 'サーバールームの主' },
  { f: 6, y: 92, theme: 'storage', title: '資材倉庫', boss: '非常階段の門番' },
  { f: 7, y: 97, theme: 'office', title: '研究室・教授室', boss: '影の教授' },
  { f: 8, y: 102, theme: 'ruin', title: '封鎖区画', boss: '忘れられた研究者' },
  { f: 9, y: 107, theme: 'final', title: '最上階・大講堂', boss: '15号館の主' },
];

const WALL = {
  classroom: () => 'minecraft:white_concrete',
  library: () => 'minecraft:dark_oak_planks',
  lab: () => 'minecraft:white_terracotta',
  server: () => 'minecraft:gray_concrete',
  storage: () => 'minecraft:spruce_planks',
  office: () => 'minecraft:light_gray_concrete',
  ruin: (r) => ['minecraft:stone_bricks', 'minecraft:cracked_stone_bricks', 'minecraft:mossy_stone_bricks'][Math.floor(r() * 3)],
  final: () => 'minecraft:polished_blackstone_bricks',
};

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

function generate(fl, seed) {
  const r = rng(seed);
  // grid: 0=空き 1=壁 2=飾り（通れない） 3=飾り（通れる: 絨毯・クモの巣）
  const g = Array.from({ length: W }, () => new Uint8Array(D));
  const leaves = [];
  const MIN = 8;
  function split(x1, z1, x2, z2, depth) {
    const w = x2 - x1 + 1, d = z2 - z1 + 1;
    const canX = w >= MIN * 2 + 1, canZ = d >= MIN * 2 + 1;
    if ((!canX && !canZ) || (depth >= 2 && r() < 0.25 && w * d < 400)) { leaves.push({ x1, z1, x2, z2 }); return; }
    const vertical = canX && (!canZ || w > d * 1.2 || (w >= d * 0.8 && r() < 0.5));
    if (vertical) {
      const sx = ri(r, x1 + MIN, x2 - MIN);
      for (let z = z1; z <= z2; z++) g[sx][z] = 1;
      const doors = d > 22 ? 2 : 1;
      for (let k = 0; k < doors; k++) { const seg = Math.floor(d / doors); const dz = ri(r, z1 + k * seg + 1, z1 + (k + 1) * seg - 4); for (let i = 0; i < 3; i++) g[sx][dz + i] = 0; }
      split(x1, z1, sx - 1, z2, depth + 1); split(sx + 1, z1, x2, z2, depth + 1);
    } else {
      const sz = ri(r, z1 + MIN, z2 - MIN);
      for (let x = x1; x <= x2; x++) g[x][sz] = 1;
      const doors = w > 22 ? 2 : 1;
      for (let k = 0; k < doors; k++) { const seg = Math.floor(w / doors); const dx = ri(r, x1 + k * seg + 1, x1 + (k + 1) * seg - 4); for (let i = 0; i < 3; i++) g[dx + i][sz] = 0; }
      split(x1, z1, x2, sz - 1, depth + 1); split(x1, sz + 1, x2, z2, depth + 1);
    }
  }
  split(0, 0, W - 1, D - 1, 0);
  // 入口付近は必ず空ける
  for (let x = 0; x <= 2; x++) for (let z = DOOR_W.z1 - IN.z1; z <= DOOR_W.z2 - IN.z1; z++) g[x][z] = 0;
  const startCell = [1, DOOR_W.z1 - IN.z1 + 1];
  const leafOf = (x, z) => leaves.findIndex((l) => x >= l.x1 && x <= l.x2 && z >= l.z1 && z <= l.z2);

  const walk = (x, z) => x >= 0 && z >= 0 && x < W && z < D && (g[x][z] === 0 || g[x][z] === 3);
  function bfs() {
    const dist = Array.from({ length: W }, () => new Int32Array(D).fill(-1));
    const q = [startCell]; dist[startCell[0]][startCell[1]] = 0;
    while (q.length) { const [x, z] = q.shift(); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (walk(nx, nz) && dist[nx][nz] < 0) { dist[nx][nz] = dist[x][z] + 1; q.push([nx, nz]); } } }
    return dist;
  }
  let dist = bfs();
  // 部屋の中心までの距離で、開始・中ボス・ボスの部屋を決める
  const center = (l) => [Math.floor((l.x1 + l.x2) / 2), Math.floor((l.z1 + l.z2) / 2)];
  const startLeaf = leafOf(...startCell);
  const ranked = leaves.map((l, i) => ({ i, d: dist[center(l)[0]][center(l)[1]] })).filter((o) => o.i !== startLeaf);
  if (ranked.some((o) => o.d < 0)) return null;
  ranked.sort((a, b) => a.d - b.d);
  const bossLeaf = ranked[ranked.length - 1].i;
  const midLeaf = ranked[Math.floor(ranked.length * 0.5)].i;
  if (midLeaf === bossLeaf || leaves.length < 6 || leaves.length > 12) return null;

  // 通路として空けておくセル（扉の前後 2 マスと、扉どうし・中心を結ぶ通り道）
  const keep = Array.from({ length: W }, () => new Uint8Array(D));
  const mark = (x, z) => { if (x >= 0 && z >= 0 && x < W && z < D) keep[x][z] = 1; };
  leaves.forEach((l, i) => {
    const doors = [];
    for (let x = l.x1; x <= l.x2; x++) for (let z = l.z1; z <= l.z2; z++) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        if (g[nx][nz] === 0 && leafOf(nx, nz) !== i && leafOf(nx, nz) === -1) doors.push([x, z]);
      }
    }
    if (i === startLeaf) doors.push([0, startCell[1]]);
    const [cx, cz] = center(l);
    for (const [x, z] of doors) {
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) mark(x + a, z + b);
      // L 字の通り道（幅 3）
      for (let xx = Math.min(x, cx); xx <= Math.max(x, cx); xx++) for (let b = -1; b <= 1; b++) mark(xx, z + b);
      for (let zz = Math.min(z, cz); zz <= Math.max(z, cz); zz++) for (let a = -1; a <= 1; a++) mark(cx + a, zz);
    }
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) mark(cx + a, cz + b);
  });

  // 敵の出現地点・宝箱の候補地点を先に確保
  const spawns = [], chests = [];
  const reserve = Array.from({ length: W }, () => new Uint8Array(D));
  leaves.forEach((l, i) => {
    if (i === startLeaf) return;
    const n = (i === bossLeaf) ? 0 : 2;
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 40; t++) {
        const x = ri(r, l.x1 + 1, l.x2 - 1), z = ri(r, l.z1 + 1, l.z2 - 1);
        if (g[x][z] === 0 && !reserve[x][z]) { reserve[x][z] = 1; spawns.push([x, z]); break; }
      }
    }
  });
  const chestRooms = leaves.map((l, i) => i).filter((i) => i !== startLeaf && i !== bossLeaf).sort(() => r() - 0.5).slice(0, 5);
  for (const i of chestRooms) {
    const l = leaves[i];
    for (let t = 0; t < 60; t++) {
      const x = r() < 0.5 ? (r() < 0.5 ? l.x1 : l.x2) : ri(r, l.x1, l.x2);
      const z = (x === l.x1 || x === l.x2) ? ri(r, l.z1, l.z2) : (r() < 0.5 ? l.z1 : l.z2);
      if (g[x][z] === 0 && !keep[x][z] && !reserve[x][z]) { reserve[x][z] = 1; chests.push([x, z]); break; }
    }
  }

  // 飾り
  const deco = []; // [x, z, dy, block, blocking]
  const put = (x, z, dy, b, blocking = true) => { deco.push([x, z, dy, b]); if (dy === 1) g[x][z] = blocking ? 2 : 3; };
  const can = (x, z) => x >= 0 && z >= 0 && x < W && z < D && g[x][z] === 0 && !keep[x][z] && !reserve[x][z];
  leaves.forEach((l, i) => {
    if (i === startLeaf) return;
    const boss = i === bossLeaf;
    for (let x = l.x1 + 1; x <= l.x2 - 1; x++) for (let z = l.z1 + 1; z <= l.z2 - 1; z++) {
      if (!can(x, z)) continue;
      const lx = x - l.x1, lz = z - l.z1;
      switch (fl.theme) {
        case 'classroom':
          if (!boss && lx % 3 === 1 && lz % 3 === 1) { put(x, z, 1, 'minecraft:spruce_slab[type=top]'); if (can(x, z + 1)) put(x, z + 1, 1, 'minecraft:oak_stairs[facing=north]'); }
          break;
        case 'library':
          if (lz % 3 === 0 && (lx % 7) !== 3) { put(x, z, 1, 'minecraft:bookshelf'); deco.push([x, z, 2, 'minecraft:bookshelf'], [x, z, 3, r() < 0.7 ? 'minecraft:bookshelf' : 'minecraft:cobweb']); }
          break;
        case 'lab':
          if (lz % 4 === 1 && lx % 6 !== 0) { put(x, z, 1, 'minecraft:smooth_stone_slab[type=top]'); const t = r(); if (t < 0.15) deco.push([x, z, 2, 'minecraft:brewing_stand']); else if (t < 0.25) deco.push([x, z, 2, 'minecraft:flower_pot']); }
          else if (lz % 4 === 3 && lx % 9 === 4) put(x, z, 1, 'minecraft:cauldron');
          break;
        case 'server':
          if (lz % 3 === 1 && lx % 8 !== 0) { put(x, z, 1, 'minecraft:black_concrete'); deco.push([x, z, 2, lx % 2 ? 'minecraft:redstone_lamp' : 'minecraft:iron_block'], [x, z, 3, 'minecraft:black_concrete']); }
          else if (lz % 3 === 2 && r() < 0.5) put(x, z, 1, 'minecraft:gray_carpet', false);
          break;
        case 'storage':
          if (r() < 0.22) { const h = ri(r, 1, 3); const b = ['minecraft:barrel', 'minecraft:hay_block', 'minecraft:barrel', 'minecraft:scaffolding'][ri(r, 0, 3)]; put(x, z, 1, b); for (let k = 2; k <= h; k++) deco.push([x, z, k, b]); }
          break;
        case 'office':
          if (lx % 5 === 0) { put(x, z, 1, 'minecraft:white_stained_glass_pane'); deco.push([x, z, 2, 'minecraft:white_stained_glass_pane']); }
          else if (lx % 5 === 2 && lz % 4 === 1) { put(x, z, 1, 'minecraft:birch_slab[type=top]'); if (r() < 0.3) deco.push([x, z, 2, 'minecraft:potted_fern']); }
          break;
        case 'ruin':
          if (r() < 0.08) put(x, z, 1, 'minecraft:cobweb', false);
          else if (r() < 0.07) put(x, z, 1, r() < 0.5 ? 'minecraft:cobblestone' : 'minecraft:mossy_cobblestone');
          else if (r() < 0.05) put(x, z, 1, 'minecraft:cobblestone_slab', false);
          if (r() < 0.05) deco.push([x, z, 4, 'minecraft:cobweb']);
          break;
        case 'final':
          if (lx % 6 === 3 && lz % 6 === 3) { put(x, z, 1, 'minecraft:polished_blackstone'); deco.push([x, z, 2, 'minecraft:polished_blackstone'], [x, z, 3, 'minecraft:polished_blackstone'], [x, z, 4, 'minecraft:crying_obsidian']); }
          break;
      }
    }
  });
  // 最上階はボス部屋まで赤い絨毯
  if (fl.theme === 'final') {
    dist = bfs();
    const [bx, bz] = center(leaves[bossLeaf]);
    let [x, z] = [bx, bz];
    while (dist[x][z] > 0) {
      if (g[x][z] === 0) { deco.push([x, z, 1, 'minecraft:red_carpet']); g[x][z] = 3; }
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [x + dx, z + dz]).filter(([nx, nz]) => nx >= 0 && nz >= 0 && nx < W && nz < D && dist[nx][nz] === dist[x][z] - 1);
      if (!nb.length) break; [x, z] = nb[0];
    }
  }

  // 全部屋・出現地点・宝箱・ボスに入口から行けるか確認
  dist = bfs();
  const targets = [...spawns, ...chests, center(leaves[bossLeaf]), center(leaves[midLeaf])];
  if (targets.some(([x, z]) => dist[x][z] < 0)) return null;
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) if (g[x][z] === 0 && dist[x][z] < 0) return null; // 閉じた空間を作らない

  return { g, leaves, startLeaf, midLeaf, bossLeaf, spawns, chests, deco, startCell, seed };
}

function emit(fl, res) {
  const y = fl.y, Y1 = y + 1, Y4 = y + 4;
  const r = rng(res.seed * 7 + 1);
  const wx = (x) => IN.x1 + x, wz = (z) => IN.z1 + z;
  const cmds = [];
  // 1. 床の上 4 段を空気に戻す（light も消える）→ 明かりは天井側に置き直す
  cmds.push(`fill ${AREA.x1} ${Y1} ${AREA.z1} ${AREA.x2} ${Y4} ${AREA.z2} minecraft:air`);
  // 2. 外周の西壁・東壁（西壁に入口）
  for (const x of [AREA.x1, AREA.x2]) for (let z = AREA.z1; z <= AREA.z2; z++) for (let yy = Y1; yy <= Y4; yy++) {
    const isDoor = x === AREA.x1 && z >= DOOR_W.z1 && z <= DOOR_W.z2 && yy <= y + 3;
    if (!isDoor) cmds.push(`setblock ${x} ${yy} ${z} ${WALL[fl.theme](r)}`);
  }
  // 3. 部屋の壁（扉の上は梁を残す）
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    if (res.g[x][z] === 1) for (let yy = Y1; yy <= Y4; yy++) cmds.push(`setblock ${wx(x)} ${yy} ${wz(z)} ${WALL[fl.theme](r)}`);
  }
  // 扉の上の梁: 壁に挟まれた空きセル
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    if (res.g[x][z] !== 0) continue;
    const wallX = (x > 0 && res.g[x - 1][z] === 1) || (x < W - 1 && res.g[x + 1][z] === 1);
    const wallZ = (z > 0 && res.g[x][z - 1] === 1) || (z < D - 1 && res.g[x][z + 1] === 1);
    const lineX = (x > 0 && x < W - 1 && res.g[x - 1][z] === 1 && res.g[x + 1][z] === 1);
    const lineZ = (z > 0 && z < D - 1 && res.g[x][z - 1] === 1 && res.g[x][z + 1] === 1);
    if ((lineX || lineZ) || ((wallX || wallZ) && res.leaves.findIndex((l) => x >= l.x1 && x <= l.x2 && z >= l.z1 && z <= l.z2) === -1)) cmds.push(`setblock ${wx(x)} ${Y4} ${wz(z)} ${WALL[fl.theme](r)}`);
  }
  // 4. 飾り
  for (const [x, z, dy, b] of res.deco) cmds.push(`setblock ${wx(x)} ${y + dy} ${wz(z)} ${b}`);
  // 5. 明かり（天井の 1 段下に light を格子状に。ホラー寄りに少し暗め）
  const lightLevel = { classroom: 13, library: 10, lab: 13, server: 9, storage: 10, office: 12, ruin: 7, final: 8 }[fl.theme];
  for (let x = 0; x < W; x += 4) for (let z = 1; z < D; z += 4) if (res.g[x][z] === 0) cmds.push(`setblock ${wx(x)} ${Y4} ${wz(z)} minecraft:light[level=${lightLevel}]`);
  // 6. 開始部屋の目印
  const [sx, sz] = res.startCell;
  cmds.push(`setblock ${wx(sx)} ${Y1} ${wz(sz + 2)} minecraft:lantern`);

  const L = (x, z) => ({ x: wx(x) + 0.5, y: Y1, z: wz(z) + 0.5 });
  const C = (l) => L(Math.floor((l.x1 + l.x2) / 2), Math.floor((l.z1 + l.z2) / 2));
  const meta = {
    floor: fl.f, y, theme: fl.theme, title: fl.title, boss: fl.boss, seed: res.seed,
    start: L(sx, sz), cp: L(sx, sz), mid: C(res.leaves[res.midLeaf]), bossLoc: C(res.leaves[res.bossLeaf]),
    p1: { x: AREA.x1, y: Y1, z: AREA.z1 }, p2: { x: AREA.x2, y: Y4, z: AREA.z2 },
    spawns: res.spawns.map(([x, z]) => L(x, z)), chests: res.chests.map(([x, z]) => ({ x: wx(x), y: Y1, z: wz(z) })),
    rooms: res.leaves.map((l, i) => ({ x1: wx(l.x1), z1: wz(l.z1), x2: wx(l.x2), z2: wz(l.z2), role: i === res.startLeaf ? 'start' : i === res.bossLeaf ? 'boss' : i === res.midLeaf ? 'mid' : 'room' })),
    grid: res.g.map((col) => Array.from(col)), area: AREA, inner: IN,
  };
  return { cmds, meta };
}

fs.mkdirSync(out, { recursive: true });
const summary = [];
for (const fl of FLOORS) {
  let res = null, seed = fl.f * 1000;
  while (!res) { res = generate(fl, seed); seed++; if (seed > fl.f * 1000 + 5000) throw new Error('no layout for floor ' + fl.f); }
  const { cmds, meta } = emit(fl, res);
  fs.writeFileSync(`${out}/floor_${fl.f}.json`, JSON.stringify(meta));
  fs.writeFileSync(`${out}/build_${fl.f}.txt`, cmds.join('\n') + '\n');
  summary.push(`${fl.f}F ${fl.title}: seed=${res.seed} rooms=${res.leaves.length} spawns=${res.spawns.length} chests=${res.chests.length} cmds=${cmds.length}`);
}
console.log(summary.join('\n'));
