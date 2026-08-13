import { supabase } from "@/integrations/supabase/client";

export { supabase };

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
    settings: { ...DEFAULT_SETTINGS, ...((data.settings ?? {}) as Partial<GameSettings>) },
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

/**
 * Persists the profile. Uses an upsert on the singleton row so a fresh
 * install (no row yet) still banks currency instead of silently no-oping.
 */
export async function saveProfile(updates: Partial<PlayerProfile>): Promise<PlayerProfile> {
  const current = await getProfile();
  const merged: PlayerProfile = { ...current, ...updates };

  const { error } = await supabase.from("player_profile").upsert(
    {
      id: 1,
      currency: Math.max(0, Math.round(merged.currency)),
      total_kills: merged.total_kills,
      total_waves: merged.total_waves,
      best_score: merged.best_score,
      best_wave: merged.best_wave,
      games_played: merged.games_played,
      settings: merged.settings as unknown as Record<string, never>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) console.error("Failed to save profile:", error.message);
  return merged;
}

/**
 * Banks currency mid-run (called on every wave clear) so a death never wipes
 * out everything the player earned. Returns the new banked total.
 */
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
