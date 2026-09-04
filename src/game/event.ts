import { grantItem, type ItemType } from "./economy";
import { grantKeys, grantSkin } from "./rewards";

/**
 * Inauguration Event — a limited-time shop paid for with confetti picked up
 * during runs. The buy window closes at EVENT_END, but anything already
 * bought stays owned and usable forever.
 */

export const EVENT_NAME = "Inauguration Event";
export const EVENT_TAGLINE = "Opening celebrations for Operation Itihaas";
/** Buy window closes at this instant (fixed for every player). */
export const EVENT_END = Date.parse("2026-09-30T18:30:00.000Z");

export type EventKind = "map" | "weapon" | "skin" | "key";

export interface EventItem {
  id: string;
  kind: EventKind;
  /** id inside the relevant catalogue (map/weapon/skin id, or key count) */
  ref: string;
  name: string;
  desc: string;
  price: number;
}

export const EVENT_CATALOGUE: EventItem[] = [
  {
    id: "ev-map-konark",
    kind: "map",
    ref: "konark",
    name: "Konark Sun Court",
    desc: "Event theatre — the wheel-carved temple court, free of its usual unlock cost.",
    price: 45,
  },
  {
    id: "ev-map-andaman",
    kind: "map",
    ref: "andaman",
    name: "Andaman Landing",
    desc: "Event theatre — coral sand, palms and the Azad Hind beachhead.",
    price: 60,
  },
  {
    id: "ev-wpn-ghatak",
    kind: "weapon",
    ref: "ghatak",
    name: "Ghatak Carbine",
    desc: "Event weapon — special-forces carbine unlocked outright.",
    price: 55,
  },
  {
    id: "ev-wpn-barrett",
    kind: "weapon",
    ref: "barrett",
    name: "Vidhwansak Anti-Materiel",
    desc: "Event weapon — the heaviest rifle in the armoury.",
    price: 80,
  },
  {
    id: "ev-skin-diya",
    kind: "skin",
    ref: "ak203-diya",
    name: "Diya Festival wrap",
    desc: "Event-only Paramvir wrap for the AK-203, lamp-gold on midnight lacquer.",
    price: 70,
  },
  {
    id: "ev-skin-confetti",
    kind: "skin",
    ref: "insas-confetti",
    name: "Confetti Parade wrap",
    desc: "Event-only Veteran wrap for the INSAS in inauguration colours.",
    price: 50,
  },
  {
    id: "ev-skin-inaugural",
    kind: "skin",
    ref: "khanda-inaugural",
    name: "Inaugural Damascus",
    desc: "Event-only Paramvir wrap for the Khanda, etched for opening day.",
    price: 65,
  },
  {
    id: "ev-keys-3",
    kind: "key",
    ref: "3",
    name: "3 Crate Keys",
    desc: "Skip the cash and roll the Supply Depot crates three times.",
    price: 30,
  },
];

export interface EventState {
  confetti: number;
  owned: string[];
}

const KEY = "astra_shastra_event";

function available() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getEventState(): EventState {
  if (!available()) return { confetti: 0, owned: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { confetti: 0, owned: [] };
    const data = JSON.parse(raw) as Partial<EventState>;
    return {
      confetti: typeof data.confetti === "number" ? data.confetti : 0,
      owned: Array.isArray(data.owned) ? data.owned : [],
    };
  } catch {
    return { confetti: 0, owned: [] };
  }
}

function writeState(state: EventState) {
  if (!available()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked */
  }
}

/** True while the limited buy window is open. */
export function eventActive(now = Date.now()) {
  return now < EVENT_END;
}

export function eventTimeLeft(now = Date.now()) {
  return Math.max(0, EVENT_END - now);
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "closed";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
}

/** Adds confetti collected in a run. */
export function addConfetti(count: number): EventState {
  const state = getEventState();
  const next = { ...state, confetti: state.confetti + Math.max(0, Math.round(count)) };
  writeState(next);
  return next;
}

export function eventOwned(itemId: string) {
  return getEventState().owned.includes(itemId);
}

/** Buys an event item with confetti. Ownership is permanent. */
export async function buyEventItem(itemId: string): Promise<boolean> {
  const item = EVENT_CATALOGUE.find((i) => i.id === itemId);
  if (!item || !eventActive()) return false;
  const state = getEventState();
  if (state.owned.includes(itemId) || state.confetti < item.price) return false;

  if (item.kind === "skin") grantSkin(item.ref);
  else if (item.kind === "key") grantKeys(Number(item.ref) || 1);
  else await grantItem(item.kind as ItemType, item.ref);

  writeState({ confetti: state.confetti - item.price, owned: [...state.owned, itemId] });
  return true;
}
