import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

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

// --- Profile operations ---

export async function getProfile(): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from("player_profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return { ...DEFAULT_PROFILE };
  }

  if (!data) {
    return { ...DEFAULT_PROFILE };
  }

  return {
    currency: data.currency,
    total_kills: data.total_kills,
    total_waves: data.total_waves,
    best_score: data.best_score,
    best_wave: data.best_wave,
    games_played: data.games_played,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  };
}

const DEFAULT_PROFILE: PlayerProfile = {
  currency: 500,
  total_kills: 0,
  total_waves: 0,
  best_score: 0,
  best_wave: 0,
  games_played: 0,
  settings: DEFAULT_SETTINGS,
};

export async function saveProfile(updates: Partial<PlayerProfile>): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.currency !== undefined) payload.currency = updates.currency;
  if (updates.total_kills !== undefined) payload.total_kills = updates.total_kills;
  if (updates.total_waves !== undefined) payload.total_waves = updates.total_waves;
  if (updates.best_score !== undefined) payload.best_score = updates.best_score;
  if (updates.best_wave !== undefined) payload.best_wave = updates.best_wave;
  if (updates.games_played !== undefined) payload.games_played = updates.games_played;
  if (updates.settings !== undefined) payload.settings = updates.settings;

  const { error } = await supabase.from("player_profile").update(payload).eq("id", 1);
  if (error) console.error("Failed to save profile:", error.message);
}

export async function recordGameResult(result: {
  currencyEarned: number;
  kills: number;
  waves: number;
  score: number;
}): Promise<void> {
  const profile = await getProfile();
  await saveProfile({
    currency: profile.currency + result.currencyEarned,
    total_kills: profile.total_kills + result.kills,
    total_waves: profile.total_waves + result.waves,
    best_score: Math.max(profile.best_score, result.score),
    best_wave: Math.max(profile.best_wave, result.waves),
    games_played: profile.games_played + 1,
  });
}

// --- Unlock operations ---

export async function getUnlocked(): Promise<Record<ItemType, string[]>> {
  const { data, error } = await supabase.from("unlocked_items").select("*");
  if (error) {
    console.error("Failed to load unlocks:", error.message);
    return { weapon: [], character: [], map: [] };
  }
  const result: Record<ItemType, string[]> = { weapon: [], character: [], map: [] };
  for (const item of data ?? []) {
    const typed = item as unknown as UnlockedItem;
    if (result[typed.item_type]) {
      result[typed.item_type].push(typed.item_id);
    }
  }
  return result;
}

export async function purchaseItem(type: ItemType, itemId: string, price: number): Promise<boolean> {
  const profile = await getProfile();
  if (profile.currency < price) return false;

  const { error: insertError } = await supabase
    .from("unlocked_items")
    .insert({ item_type: type, item_id: itemId });
  if (insertError) {
    console.error("Purchase insert failed:", insertError.message);
    return false;
  }

  await saveProfile({ currency: profile.currency - price });
  return true;
}

export async function saveSettings(settings: GameSettings): Promise<void> {
  await saveProfile({ settings });
}
