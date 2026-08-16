import { getProfile, grantItem, saveProfile, type ItemType } from "./economy";

/**
 * Operation Itihaas battle pass — XP, ranks and claimable tiers.
 * Progress is cached in localStorage alongside the economy profile.
 */

export interface BattlePassState {
  xp: number;
  claimed: number[];
}

export interface Reward {
  kind: "cash" | "unlock" | "title";
  label: string;
  amount?: number;
  itemType?: ItemType;
  itemId?: string;
}

export interface Tier {
  tier: number;
  reward: Reward;
}

const BP_KEY = "astra_shastra_battlepass";

/** Indian Army style rank ladder — one rank every two levels. */
export const RANKS = [
  "Recruit",
  "Sipahi",
  "Lance Naik",
  "Naik",
  "Havildar",
  "Naib Subedar",
  "Subedar",
  "Subedar Major",
  "Lieutenant",
  "Captain",
  "Major",
  "Colonel",
  "Brigadier",
  "Major General",
  "Lieutenant General",
  "General",
  "Field Marshal",
];

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number) {
  return 600 + (level - 1) * 220;
}

export function levelFromXp(xp: number) {
  let level = 1;
  let remaining = xp;
  while (level < 50 && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, into: remaining, need: xpForLevel(level) };
}

export function rankFor(level: number) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))]!;
}

export const TIERS: Tier[] = [
  { tier: 1, reward: { kind: "cash", label: "₹400 supply drop", amount: 400 } },
  { tier: 2, reward: { kind: "unlock", label: "Bhagat Singh", itemType: "character", itemId: "bhagat" } },
  { tier: 3, reward: { kind: "cash", label: "₹600 supply drop", amount: 600 } },
  { tier: 4, reward: { kind: "unlock", label: "Sten Mk.V", itemType: "weapon", itemId: "sten" } },
  { tier: 5, reward: { kind: "title", label: 'Title · "Sherdil"' } },
  { tier: 6, reward: { kind: "unlock", label: "Red Fort theatre", itemType: "map", itemId: "redfort" } },
  { tier: 7, reward: { kind: "cash", label: "₹900 supply drop", amount: 900 } },
  { tier: 8, reward: { kind: "unlock", label: "Rani Lakshmibai", itemType: "character", itemId: "rani" } },
  { tier: 9, reward: { kind: "cash", label: "₹1,100 supply drop", amount: 1100 } },
  { tier: 10, reward: { kind: "unlock", label: "Lee-Enfield SMLE", itemType: "weapon", itemId: "enfield" } },
  { tier: 11, reward: { kind: "title", label: 'Title · "Paramvir"' } },
  { tier: 12, reward: { kind: "unlock", label: "Thar Desert theatre", itemType: "map", itemId: "thal" } },
  { tier: 13, reward: { kind: "cash", label: "₹1,500 supply drop", amount: 1500 } },
  { tier: 14, reward: { kind: "unlock", label: "Subhas Chandra Bose", itemType: "character", itemId: "bose" } },
  { tier: 15, reward: { kind: "unlock", label: "AK-203 Korwa", itemType: "weapon", itemId: "ak203" } },
  { tier: 16, reward: { kind: "cash", label: "₹2,000 supply drop", amount: 2000 } },
  { tier: 17, reward: { kind: "unlock", label: "Siachen outpost", itemType: "map", itemId: "siachen" } },
  { tier: 18, reward: { kind: "title", label: 'Title · "Itihaas Veteran"' } },
  { tier: 19, reward: { kind: "cash", label: "₹2,600 supply drop", amount: 2600 } },
  { tier: 20, reward: { kind: "title", label: 'Title · "Field Marshal"' } },
];

function available(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getBattlePass(): BattlePassState {
  if (!available()) return { xp: 0, claimed: [] };
  try {
    const raw = window.localStorage.getItem(BP_KEY);
    if (!raw) return { xp: 0, claimed: [] };
    const data = JSON.parse(raw) as Partial<BattlePassState>;
    return {
      xp: typeof data.xp === "number" ? data.xp : 0,
      claimed: Array.isArray(data.claimed) ? data.claimed.filter((n) => typeof n === "number") : [],
    };
  } catch {
    return { xp: 0, claimed: [] };
  }
}

function write(state: BattlePassState) {
  if (!available()) return;
  try {
    window.localStorage.setItem(BP_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked — progress stays in memory for this run */
  }
}

/** Adds XP and returns the new state plus whether a level was gained. */
export function addXp(amount: number): { state: BattlePassState; levelUp: boolean } {
  const state = getBattlePass();
  const before = levelFromXp(state.xp).level;
  const next: BattlePassState = { ...state, xp: state.xp + Math.max(0, Math.round(amount)) };
  write(next);
  return { state: next, levelUp: levelFromXp(next.xp).level > before };
}

export function xpForRun(result: { kills: number; waves: number; score: number; won?: boolean }) {
  return (
    result.kills * 18 +
    result.waves * 140 +
    Math.round(result.score * 0.08) +
    (result.won ? 500 : 0)
  );
}

export function claimable(state: BattlePassState) {
  const { level } = levelFromXp(state.xp);
  return TIERS.filter((t) => t.tier <= level && !state.claimed.includes(t.tier));
}

/** Claims a single unlocked tier, paying out its reward. */
export async function claimTier(tier: number): Promise<boolean> {
  const state = getBattlePass();
  const entry = TIERS.find((t) => t.tier === tier);
  if (!entry) return false;
  if (state.claimed.includes(tier)) return false;
  if (levelFromXp(state.xp).level < tier) return false;

  if (entry.reward.kind === "cash" && entry.reward.amount) {
    const profile = await getProfile();
    await saveProfile({ currency: profile.currency + entry.reward.amount });
  }
  if (entry.reward.kind === "unlock" && entry.reward.itemType && entry.reward.itemId) {
    await grantItem(entry.reward.itemType, entry.reward.itemId);
  }
  write({ ...state, claimed: [...state.claimed, tier] });
  return true;
}

export async function claimAll(): Promise<number> {
  let count = 0;
  for (const t of claimable(getBattlePass())) {
    if (await claimTier(t.tier)) count += 1;
  }
  return count;
}
