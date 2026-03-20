// Shop upgrade definitions and cost logic

export const UPGRADE_DEFS = [
  {
    id: 'armor',
    name: 'Armor Plating',
    icon: '🛡',
    color: '#4488ff',
    description: (lvl) => `${lvl * 3} armor hits before HP damage`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 60,
  },
  {
    id: 'repair',
    name: 'Auto-Repair',
    icon: '🔧',
    color: '#44ffaa',
    description: (lvl) => `Repairs ${lvl} armor per wave`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 50,
  },
  {
    id: 'drone',
    name: 'Retrieval Drone',
    icon: '🤖',
    color: '#ffdd00',
    description: (lvl) => `${Math.min(lvl, 3)} drone${lvl > 1 ? 's' : ''} fetch power-ups for you`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 80,
  },
  {
    id: 'harvester',
    name: 'Block Harvester',
    icon: '⛏',
    color: '#ff8800',
    description: (lvl) => `${Math.min(lvl, 3)} harvester${lvl > 1 ? 's' : ''}, ${lvl <= 3 ? 'slow' : lvl <= 6 ? 'medium' : 'fast'} rate`,
    maxLevel: 10,
    cost: (lvl) => (lvl + 1) * 70,
  },
];

export function loadShopUpgrades() {
  try {
    const saved = localStorage.getItem('nebulaHavok_shopUpgrades');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { armor: 0, repair: 0, drone: 0, harvester: 0 };
}

export function saveShopUpgrades(upgrades) {
  try {
    localStorage.setItem('nebulaHavok_shopUpgrades', JSON.stringify(upgrades));
  } catch {}
}