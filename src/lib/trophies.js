// Trophy system — earned by accomplishments, stored in localStorage
const LS_KEY = 'voidstorm_trophies';

export const TROPHY_DEFS = [
  { id: 'first_blood',    icon: '🩸', name: 'First Blood',      desc: 'Defeat your first enemy' },
  { id: 'wave_10',        icon: '🌊', name: 'Surfer',           desc: 'Reach wave 10' },
  { id: 'wave_25',        icon: '⚡', name: 'Storm Rider',      desc: 'Reach wave 25' },
  { id: 'wave_50',        icon: '🔥', name: 'Inferno',          desc: 'Reach wave 50' },
  { id: 'wave_100',       icon: '💀', name: 'Hell Survivor',    desc: 'Reach wave 100' },
  { id: 'boss_slayer',    icon: '👑', name: 'Boss Slayer',      desc: 'Defeat the first boss' },
  { id: 'boss_rush',      icon: '🏆', name: 'Boss Rush',        desc: 'Complete Boss Mode (defeat all 5 bosses)' },
  { id: 'endless_bosses', icon: '🌀', name: 'Endless Nightmare',desc: 'Defeat a double boss wave in Boss Mode' },
  { id: 'score_100k',     icon: '💎', name: 'Diamond',          desc: 'Score 100,000 points' },
  { id: 'powerup_max',    icon: '🚀', name: 'Maxed Out',        desc: 'Reach tier 10 on any powerup' },
];

export function getEarnedTrophies() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}

export function awardTrophy(id) {
  const earned = getEarnedTrophies();
  if (earned.includes(id)) return false; // already earned
  earned.push(id);
  localStorage.setItem(LS_KEY, JSON.stringify(earned));
  return true; // newly earned
}

export function hasTrophy(id) {
  return getEarnedTrophies().includes(id);
}