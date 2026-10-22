// 各階の中ボス・ボス用の闘技場（上空）を作る
// 出力: <out>/arena_<階>.json（入口と出現地点の座標）と <out>/build_arena.txt（コマンド）
const fs = require('fs');
const out = process.argv[2];
const ORIGIN = { x: -300, y: 200, z: -60 }; // 闘技場を並べる場所（上空・15号館の北）
const STEP_X = 40, STEP_Z = 45, H = 8;

const THEME = {
  2: { floor: 'minecraft:smooth_quartz', wall: 'minecraft:white_concrete', pillar: 'minecraft:quartz_pillar', light: 'minecraft:sea_lantern', accent: 'minecraft:black_concrete' },
  3: { floor: 'minecraft:dark_oak_planks', wall: 'minecraft:bookshelf', pillar: 'minecraft:stripped_dark_oak_log', light: 'minecraft:lantern', accent: 'minecraft:red_carpet' },
  4: { floor: 'minecraft:white_terracotta', wall: 'minecraft:light_gray_stained_glass', pillar: 'minecraft:iron_block', light: 'minecraft:sea_lantern', accent: 'minecraft:lime_concrete' },
  5: { floor: 'minecraft:gray_concrete', wall: 'minecraft:black_concrete', pillar: 'minecraft:iron_block', light: 'minecraft:redstone_lamp[lit=true]', accent: 'minecraft:cyan_concrete' },
  6: { floor: 'minecraft:spruce_planks', wall: 'minecraft:barrel', pillar: 'minecraft:stripped_spruce_log', light: 'minecraft:lantern', accent: 'minecraft:hay_block' },
  7: { floor: 'minecraft:birch_planks', wall: 'minecraft:light_gray_concrete', pillar: 'minecraft:polished_andesite', light: 'minecraft:sea_lantern', accent: 'minecraft:green_concrete' },
  8: { floor: 'minecraft:mossy_stone_bricks', wall: 'minecraft:cracked_stone_bricks', pillar: 'minecraft:mossy_cobblestone', light: 'minecraft:soul_lantern', accent: 'minecraft:cobweb' },
  9: { floor: 'minecraft:polished_blackstone', wall: 'minecraft:polished_blackstone_bricks', pillar: 'minecraft:crying_obsidian', light: 'minecraft:soul_lantern', accent: 'minecraft:red_carpet' },
};

const cmds = [];
const res = {};
function arena(f, kind, col, row, size) {
  const t = THEME[f];
  const x1 = ORIGIN.x + col * STEP_X, z1 = ORIGIN.z + row * STEP_Z, y = ORIGIN.y;
  const x2 = x1 + size + 1, z2 = z1 + size + 1; // 外周の壁を含む
  // 床・天井・壁
  cmds.push(`fill ${x1} ${y} ${z1} ${x2} ${y} ${z2} ${t.floor}`);
  cmds.push(`fill ${x1} ${y + H + 1} ${z1} ${x2} ${y + H + 1} ${z2} ${t.wall === 'minecraft:light_gray_stained_glass' ? 'minecraft:white_terracotta' : t.wall}`);
  cmds.push(`fill ${x1} ${y + 1} ${z1} ${x2} ${y + H} ${z1} ${t.wall}`);
  cmds.push(`fill ${x1} ${y + 1} ${z2} ${x2} ${y + H} ${z2} ${t.wall}`);
  cmds.push(`fill ${x1} ${y + 1} ${z1} ${x1} ${y + H} ${z2} ${t.wall}`);
  cmds.push(`fill ${x2} ${y + 1} ${z1} ${x2} ${y + H} ${z2} ${t.wall}`);
  cmds.push(`fill ${x1 + 1} ${y + 1} ${z1 + 1} ${x2 - 1} ${y + H} ${z2 - 1} minecraft:air`);
  // 柱（四隅の内側）と照明
  const inset = Math.floor(size / 4);
  for (const [px, pz] of [[x1 + inset, z1 + inset], [x2 - inset, z1 + inset], [x1 + inset, z2 - inset], [x2 - inset, z2 - inset]]) {
    cmds.push(`fill ${px} ${y + 1} ${pz} ${px} ${y + H} ${pz} ${t.pillar}`);
    cmds.push(`setblock ${px} ${y + H} ${pz} ${t.light}`);
  }
  // 天井の明かり（敵が自然に湧かないよう全体を明るく）
  for (let x = x1 + 2; x < x2; x += 4) for (let z = z1 + 2; z < z2; z += 4) cmds.push(`setblock ${x} ${y + H} ${z} minecraft:light[level=15]`);
  // 中央の円（目印）
  const cx = Math.floor((x1 + x2) / 2), cz = Math.floor((z1 + z2) / 2);
  const r = Math.floor(size / 6);
  for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= r + 0.3 && d >= r - 0.7) cmds.push(`setblock ${x} ${y} ${z} ${t.pillar.includes('[') ? t.pillar : t.pillar}`);
  }
  if (t.accent.includes('carpet') || t.accent === 'minecraft:cobweb') {
    for (let z = cz + 2; z < z2 - 1; z++) cmds.push(`setblock ${cx} ${y + 1} ${z} ${t.accent === 'minecraft:cobweb' ? 'minecraft:air' : t.accent}`);
    if (t.accent === 'minecraft:cobweb') for (const [ax, az] of [[x1 + 1, z1 + 1], [x2 - 1, z1 + 1], [x1 + 1, z2 - 1], [x2 - 1, z2 - 1]]) cmds.push(`setblock ${ax} ${y + H} ${az} minecraft:cobweb`);
  } else {
    for (const [ax, az] of [[x1 + 1, z1 + 1], [x2 - 1, z1 + 1], [x1 + 1, z2 - 1], [x2 - 1, z2 - 1]]) cmds.push(`setblock ${ax} ${y} ${az} ${t.accent}`);
  }
  return {
    a: { x: x1, y, z: z1 }, b: { x: x2, y: y + H + 1, z: z2 },
    player: { x: cx + 0.5, y: y + 1, z: z2 - 3 + 0.5 }, boss: { x: cx + 0.5, y: y + 1, z: z1 + Math.floor(size / 3) + 0.5 },
  };
}
fs.mkdirSync(out, { recursive: true });
for (let f = 2; f <= 9; f++) {
  res[f] = { mid: arena(f, 'mid', f - 2, 0, 25), boss: arena(f, 'boss', f - 2, 1, 33) };
  fs.writeFileSync(`${out}/arena_${f}.json`, JSON.stringify(res[f]));
}
fs.writeFileSync(`${out}/build_arena.txt`, cmds.join('\n') + '\n');
console.log('arena commands', cmds.length, 'bounds x', ORIGIN.x, '..', ORIGIN.x + 7 * STEP_X + 35, 'z', ORIGIN.z, '..', ORIGIN.z + STEP_Z + 35, 'y', ORIGIN.y, '..', ORIGIN.y + H + 1);
