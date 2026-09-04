import { getProfile, saveProfile } from "./economy";

/**
 * Operation Itihaas rewards layer — weapon skins, supply crates and weekly quests.
 * All state is cached in localStorage next to the economy profile.
 */

export type Rarity = "field" | "regiment" | "veteran" | "paramvir";

export interface Skin {
  id: string;
  name: string;
  weapon: string;
  rarity: Rarity;
  /** hex tint applied to the weapon body */
  color: string;
  /** hex tint applied to metal parts */
  accent: string;
}

export interface Crate {
  id: string;
  name: string;
  price: number;
  desc: string;
  pool: string[];
}

export interface Quest {
  id: string;
  label: string;
  metric: "kills" | "waves" | "runs" | "wins" | "score" | "headshots";
  target: number;
  xp: number;
  cash: number;
}

export interface QuestState {
  week: number;
  progress: Record<string, number>;
  claimed: string[];
}

export interface SkinState {
  owned: string[];
  equipped: Record<string, string>;
  keys: number;
}

const SKIN_KEY = "astra_shastra_skins";
const QUEST_KEY = "astra_shastra_quests";

export const RARITY_LABEL: Record<Rarity, string> = {
  field: "Field Issue",
  regiment: "Regimental",
  veteran: "Veteran",
  paramvir: "Paramvir",
};

export const RARITY_WEIGHT: Record<Rarity, number> = {
  field: 58,
  regiment: 26,
  veteran: 12,
  paramvir: 4,
};

export const SKINS: Skin[] = [
  { id: "ak203-jungle", name: "Jungle Warfare", weapon: "ak203", rarity: "field", color: "#3f4a2c", accent: "#8d9668" },
  { id: "ak203-tricolour", name: "Tricolour Vanguard", weapon: "ak203", rarity: "veteran", color: "#e07b1f", accent: "#1f7a4d" },
  { id: "ak203-siachen", name: "Siachen Frost", weapon: "ak203", rarity: "regiment", color: "#c9d6e2", accent: "#6d8399" },
  { id: "insas-desert", name: "Thar Dust", weapon: "insas", rarity: "field", color: "#b39466", accent: "#6b5535" },
  { id: "insas-gorkha", name: "Gorkha Khukri", weapon: "insas", rarity: "veteran", color: "#2e1f1a", accent: "#c0392b" },
  { id: "smle-heritage", name: "Heritage Walnut", weapon: "smle", rarity: "regiment", color: "#6b3f21", accent: "#d4b483" },
  { id: "smle-1857", name: "Ghadar 1857", weapon: "smle", rarity: "paramvir", color: "#3b1f2b", accent: "#e3c14f" },
  { id: "sten-azad", name: "Azad Hind", weapon: "sten", rarity: "regiment", color: "#2b3d2f", accent: "#e08a1f" },
  { id: "mp5-para", name: "Para SF Black", weapon: "mp5", rarity: "field", color: "#1d1f22", accent: "#4c5257" },
  { id: "katta-bazaar", name: "Bazaar Special", weapon: "katta", rarity: "field", color: "#4a3b2f", accent: "#9c8a6a" },
  { id: "khanda-royal", name: "Royal Damascus", weapon: "khanda", rarity: "paramvir", color: "#8a6b1f", accent: "#f0e0a0" },
  { id: "sniper-shikari", name: "Shikari", weapon: "dragunov", rarity: "veteran", color: "#3c3226", accent: "#a8894f" },
  // event-only wraps — sold in the Inauguration Event, never in crates
  { id: "ak203-diya", name: "Diya Festival", weapon: "ak203", rarity: "paramvir", color: "#161327", accent: "#f2c14e" },
  { id: "insas-confetti", name: "Confetti Parade", weapon: "insas", rarity: "veteran", color: "#1f3a5f", accent: "#f27ba0" },
  { id: "khanda-inaugural", name: "Inaugural Damascus", weapon: "khanda", rarity: "paramvir", color: "#5c1f3a", accent: "#ffd98a" },
];

export const CRATES: Crate[] = [
  {
    id: "supply",
    name: "Supply Crate",
    price: 800,
    desc: "Standard issue finishes for service rifles and SMGs.",
    pool: ["ak203-jungle", "ak203-siachen", "insas-desert", "mp5-para", "katta-bazaar", "sten-azad"],
  },
  {
    id: "heritage",
    name: "Heritage Crate",
    price: 1600,
    desc: "Colonial-era arms in collector finishes.",
    pool: ["smle-heritage", "smle-1857", "sten-azad", "insas-gorkha", "khanda-royal"],
  },
  {
    id: "paramvir",
    name: "Paramvir Crate",
    price: 2800,
    desc: "The rarest wraps in the armoury. Keys accepted.",
    pool: ["ak203-tricolour", "smle-1857", "khanda-royal", "sniper-shikari", "insas-gorkha", "ak203-siachen"],
  },
];

export const QUESTS: Quest[] = [
  { id: "q-kills", label: "Neutralise 60 hostiles", metric: "kills", target: 60, xp: 700, cash: 500 },
  { id: "q-waves", label: "Hold 12 waves", metric: "waves", target: 12, xp: 600, cash: 400 },
  { id: "q-runs", label: "Deploy on 5 operations", metric: "runs", target: 5, xp: 450, cash: 300 },
  { id: "q-wins", label: "Complete 2 operations", metric: "wins", target: 2, xp: 900, cash: 750 },
  { id: "q-score", label: "Bank 6,000 score", metric: "score", target: 6000, xp: 800, cash: 600 },
];

function available() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function read<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as object) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (!available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

/* ------------------------- skins ------------------------------------- */

export function getSkinState(): SkinState {
  const s = read<SkinState>(SKIN_KEY, { owned: [], equipped: {}, keys: 0 });
  return {
    owned: Array.isArray(s.owned) ? s.owned : [],
    equipped: s.equipped && typeof s.equipped === "object" ? s.equipped : {},
    keys: typeof s.keys === "number" ? s.keys : 0,
  };
}

export function skinById(id: string) {
  return SKINS.find((s) => s.id === id);
}

export function equipSkin(skinId: string) {
  const skin = skinById(skinId);
  const state = getSkinState();
  if (!skin || !state.owned.includes(skinId)) return state;
  const next = { ...state, equipped: { ...state.equipped, [skin.weapon]: skinId } };
  write(SKIN_KEY, next);
  return next;
}

export function unequipSkin(weapon: string) {
  const state = getSkinState();
  const equipped = { ...state.equipped };
  delete equipped[weapon];
  const next = { ...state, equipped };
  write(SKIN_KEY, next);
  return next;
}

export function grantSkin(skinId: string) {
  const state = getSkinState();
  if (state.owned.includes(skinId)) return state;
  const next = { ...state, owned: [...state.owned, skinId] };
  write(SKIN_KEY, next);
  return next;
}

export function grantKeys(count: number) {
  const state = getSkinState();
  const next = { ...state, keys: state.keys + Math.max(0, Math.round(count)) };
  write(SKIN_KEY, next);
  return next;
}

/** Returns the tint pair for the weapon the player has equipped, if any. */
export function equippedSkinFor(weapon: string): Skin | undefined {
  const id = getSkinState().equipped[weapon];
  return id ? skinById(id) : undefined;
}

function rollFromPool(pool: string[]): Skin {
  const candidates = pool.map(skinById).filter((s): s is Skin => !!s);
  const total = candidates.reduce((sum, s) => sum + RARITY_WEIGHT[s.rarity], 0);
  let roll = Math.random() * total;
  for (const s of candidates) {
    roll -= RARITY_WEIGHT[s.rarity];
    if (roll <= 0) return s;
  }
  return candidates[candidates.length - 1]!;
}

export interface CrateResult {
  skin: Skin;
  duplicate: boolean;
  refund: number;
}

/** Opens a crate, paying with a key when available, otherwise cash. */
export async function openCrate(crateId: string): Promise<CrateResult | null> {
  const crate = CRATES.find((c) => c.id === crateId);
  if (!crate) return null;
  const state = getSkinState();
  if (state.keys > 0) {
    write(SKIN_KEY, { ...state, keys: state.keys - 1 });
  } else {
    const profile = await getProfile();
    if (profile.currency < crate.price) return null;
    await saveProfile({ currency: profile.currency - crate.price });
  }

  const skin = rollFromPool(crate.pool);
  const duplicate = getSkinState().owned.includes(skin.id);
  if (duplicate) {
    const refund = Math.round(crate.price * 0.4);
    const profile = await getProfile();
    await saveProfile({ currency: profile.currency + refund });
    return { skin, duplicate, refund };
  }
  grantSkin(skin.id);
  return { skin, duplicate: false, refund: 0 };
}

/* ------------------------- quests ------------------------------------ */

/** ISO-ish week index so quests reset every Monday. */
export function currentWeek() {
  return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
}

export function getQuests(): QuestState {
  const s = read<QuestState>(QUEST_KEY, { week: currentWeek(), progress: {}, claimed: [] });
  const week = currentWeek();
  if (s.week !== week) {
    const fresh: QuestState = { week, progress: {}, claimed: [] };
    write(QUEST_KEY, fresh);
    return fresh;
  }
  return {
    week,
    progress: s.progress && typeof s.progress === "object" ? s.progress : {},
    claimed: Array.isArray(s.claimed) ? s.claimed : [],
  };
}

export function trackQuests(delta: Partial<Record<Quest["metric"], number>>) {
  const state = getQuests();
  const progress = { ...state.progress };
  for (const q of QUESTS) {
    const add = delta[q.metric];
    if (!add) continue;
    progress[q.id] = Math.min(q.target, (progress[q.id] ?? 0) + Math.max(0, Math.round(add)));
  }
  const next = { ...state, progress };
  write(QUEST_KEY, next);
  return next;
}

export function questDone(state: QuestState, quest: Quest) {
  return (state.progress[quest.id] ?? 0) >= quest.target;
}

export async function claimQuest(id: string): Promise<boolean> {
  const state = getQuests();
  const quest = QUESTS.find((q) => q.id === id);
  if (!quest || state.claimed.includes(id) || !questDone(state, quest)) return false;
  const profile = await getProfile();
  await saveProfile({ currency: profile.currency + quest.cash });
  const { addXp } = await import("./battlepass");
  addXp(quest.xp);
  write(QUEST_KEY, { ...state, claimed: [...state.claimed, id] });
  return true;
}
