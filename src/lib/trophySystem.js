// Trophy tracking system
const TROPHY_STORAGE_KEY = 'gameTrophies';

export const TROPHIES = {
  // Difficulty completions
  easy_complete: { name: 'Bronze Warrior', icon: '🥉', category: 'difficulty' },
  challenging_complete: { name: 'Silver Champion', icon: '🥈', category: 'difficulty' },
  hell_complete: { name: 'Golden Master', icon: '🏆', category: 'difficulty' },
  
  // Gun milestones
  gun_level_10: { name: 'Gun Master', icon: '⚡', category: 'milestone' },
  
  // Combat milestones
  enemies_500: { name: 'Monster Hunter', icon: '👹', category: 'milestone' },
};

export function loadTrophies() {
  const saved = localStorage.getItem(TROPHY_STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

export function saveTrophies(trophies) {
  localStorage.setItem(TROPHY_STORAGE_KEY, JSON.stringify(trophies));
}

export function addTrophy(trophyKey) {
  const trophies = loadTrophies();
  if (!trophies.includes(trophyKey)) {
    trophies.push(trophyKey);
    saveTrophies(trophies);
    return true; // newly earned
  }
  return false; // already had it
}

export function hasTrophy(trophyKey) {
  return loadTrophies().includes(trophyKey);
}

export function getTrophyData(trophyKey) {
  return TROPHIES[trophyKey];
}

export function getDifficultyTrophies() {
  const trophies = loadTrophies();
  return ['easy_complete', 'challenging_complete', 'hell_complete'].filter(t => trophies.includes(t));
}