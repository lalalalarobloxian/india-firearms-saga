export interface PlayerProfile {
  currency: number;
  total_kills: number;
  total_waves: number;
  best_score: number;
  best_wave: number;
  games_played: number;
  settings: GameSettings;
}

export interface GameSettings {
  graphics: "low" | "medium" | "high" | "ultra";
  shadows: boolean;
  postProcessing: boolean;
  bloom: boolean;
  volumetric: boolean;
  masterVolume: number;
  sfxVolume: number;
  sensitivity: number;
  fov: number;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: "high",
  shadows: true,
  postProcessing: true,
  bloom: true,
  volumetric: true,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  sensitivity: 1.0,
  fov: 90,
  showFps: false,
};

export type ItemType = "weapon" | "character" | "map";

export interface UnlockedItem {
  id: string;
  item_type: ItemType;
  item_id: string;
}

const PROFILE_KEY = "astra_shastra_profile";
const UNLOCKED_KEY = "astra_shastra_unlocked";

const DEFAULT_PROFILE: PlayerProfile = {
  currency: 500,
  total_kills: 0,
  total_waves: 0,
  best_score: 0,
  best_wave: 0,
  games_played: 0,
  settings: DEFAULT_SETTINGS,
};

function localStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

// --- Profile operations ---

export async function getProfile(): Promise<PlayerProfile> {
  if (!localStorageAvailable()) return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const data = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      currency: typeof data.currency === "number" ? data.currency : DEFAULT_PROFILE.currency,
      total_kills: typeof data.total_kills === "number" ? data.total_kills : 0,
      total_waves: typeof data.total_waves === "number" ? data.total_waves : 0,
      best_score: typeof data.best_score === "number" ? data.best_score : 0,
      best_wave: typeof data.best_wave === "number" ? data.best_wave : 0,
      games_played: typeof data.games_played === "number" ? data.games_played : 0,
      settings: { ...DEFAULT_SETTINGS, ...((data.settings ?? {}) as Partial<GameSettings>) },
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(updates: Partial<PlayerProfile>): Promise<PlayerProfile> {
  const current = await getProfile();
  const merged: PlayerProfile = { ...current, ...updates };
  if (localStorageAvailable()) {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
    } catch {
      // storage full or blocked — non-fatal
    }
  }
  return merged;
}

export async function bankEarnings(amount: number, kills = 0, waves = 0): Promise<number> {
  if (amount <= 0 && kills <= 0 && waves <= 0) return (await getProfile()).currency;
  const profile = await getProfile();
  const next = await saveProfile({
    currency: profile.currency + Math.max(0, Math.round(amount)),
    total_kills: profile.total_kills + kills,
    total_waves: profile.total_waves + waves,
  });
  return next.currency;
}

export async function recordGameResult(result: {
  currencyEarned: number;
  kills: number;
  waves: number;
  score: number;
}): Promise<void> {
  const profile = await getProfile();
  await saveProfile({
    currency: profile.currency + Math.max(0, Math.round(result.currencyEarned)),
    total_kills: profile.total_kills + result.kills,
    total_waves: profile.total_waves + result.waves,
    best_score: Math.max(profile.best_score, result.score),
    best_wave: Math.max(profile.best_wave, result.waves),
    games_played: profile.games_played + 1,
  });
}

// --- Unlock operations ---

export async function getUnlocked(): Promise<Record<ItemType, string[]>> {
  if (!localStorageAvailable()) return { weapon: [], character: [], map: [] };
  try {
    const raw = window.localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return { weapon: [], character: [], map: [] };
    const data = JSON.parse(raw) as Record<ItemType, string[]>;
    return {
      weapon: Array.isArray(data.weapon) ? data.weapon : [],
      character: Array.isArray(data.character) ? data.character : [],
      map: Array.isArray(data.map) ? data.map : [],
    };
  } catch {
    return { weapon: [], character: [], map: [] };
  }
}

export async function purchaseItem(type: ItemType, itemId: string, price: number): Promise<boolean> {
  const profile = await getProfile();
  if (profile.currency < price) return false;

  const unlocked = await getUnlocked();
  if (unlocked[type].includes(itemId)) {
    // already owned — still charge? no, just fail gracefully
    return true;
  }
  unlocked[type].push(itemId);
  if (localStorageAvailable()) {
    try {
      window.localStorage.setItem(UNLOCKED_KEY, JSON.stringify(unlocked));
    } catch {
      return false;
    }
  }
  await saveProfile({ currency: profile.currency - price });
  return true;
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  await saveProfile({ settings });
}
