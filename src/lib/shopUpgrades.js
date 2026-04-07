// Shop upgrade definitions and cost logic

export const UPGRADE_DEFS = [
  {
    id: 'armor',
    name: 'Armor Plating',
    icon: '🛡',
    color: '#4488ff',
    description: (lvl) => `${lvl * 3} armor hits before HP damage`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 70,
  },
  {
    id: 'repair',
    name: 'Auto-Repair',
    icon: '🔧',
    color: '#44ffaa',
    description: (lvl) => `Repairs ${lvl} armor per wave`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 120,
  },
  {
    id: 'drone',
    name: 'Retrieval Drone',
    icon: '🤖',
    color: '#ffdd00',
    description: (lvl) => `1 drone, ${lvl <= 3 ? 'slow' : lvl <= 6 ? 'medium' : lvl <= 8 ? 'fast' : 'ultra'} fetch speed (Lv${lvl})`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 700,
  },
  {
    id: 'harvester',
    name: 'Block Harvester',
    icon: '⛏',
    color: '#ff8800',
    description: (lvl) => `1 harvester, ${lvl <= 3 ? 'slow' : lvl <= 6 ? 'medium' : lvl <= 8 ? 'fast' : 'ultra'} harvest speed (Lv${lvl})`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 1800,
  },
  {
    id: 'speed',
    name: 'Thruster Boost',
    icon: '▶',
    color: '#ff8800',
    description: (lvl) => `+${(lvl * 1.5).toFixed(1)} move speed (base 4.5)`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 170,
  },
  {
    id: 'rapidfire',
    name: 'Rapid Fire',
    icon: '⚡',
    color: '#ff4488',
    description: (lvl) => `Fire rate +${lvl === 1 ? 10 : lvl * 8}% reduction to shot delay`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 210,
  },
  {
    id: 'shield',
    name: 'Energy Shield',
    icon: '🛡',
    color: '#00ccff',
    description: (lvl) => `Starts each wave with ${lvl * 3} shield HP`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 240,
  },
  {
    id: 'wingman',
    name: 'Wingman',
    icon: '✈',
    color: '#44aaff',
    description: (lvl) => lvl >= 10 ? '2 super wingmen' : lvl >= 5 ? `1 super + ${lvl - 5} basic wingmen` : `${lvl} basic wingmen`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 380,
  },
  {
    id: 'atkDmg',
    name: 'Attack Damage',
    icon: '💥',
    color: '#ff44cc',
    description: (lvl) => `+${lvl}% to ALL weapon damage`,
    maxLevel: 30,
    cost: (lvl) => 400 + Math.floor(lvl * 1.18 * 120), // 400, 541, 682, ...
  },
  {
    id: 'atkSpd',
    name: 'Attack Speed',
    icon: '⏩',
    color: '#44e0ff',
    description: (lvl) => `+${lvl}% to ALL fire rates`,
    maxLevel: 30,
    cost: (lvl) => 400 + Math.floor(lvl * 1.18 * 120),
  },
];

export function loadShopUpgrades() {
  try {
    const saved = localStorage.getItem('nebulaHavok_shopUpgrades');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { armor: 0, repair: 0, drone: 0, harvester: 0, speed: 0, rapidfire: 0, shield: 0, wingman: 0, atkDmg: 0, atkSpd: 0 };
}

export function saveShopUpgrades(upgrades) {
  try {
    localStorage.setItem('nebulaHavok_shopUpgrades', JSON.stringify(upgrades));
  } catch {}
}