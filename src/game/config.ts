// ===================================================================
// Game configuration: weapons, grenades, melee, characters, maps
// ===================================================================

export type FireMode = "auto" | "semi" | "bolt";
export type WeaponCategory = "rifle" | "smg" | "sniper" | "melee" | "grenade";

export interface WeaponDef {
  id: string;
  name: string;
  era: string;
  caliber: string;
  mode: FireMode;
  category: WeaponCategory;
  damage: number;
  headMult: number;
  rpm: number;
  magSize: number;
  reserve: number;
  reloadTime: number;
  spread: number;
  adsSpread: number;
  recoil: number;
  kick: number;
  range: number;
  pellets?: number;
  zoom: number;
  scoped?: boolean;
  color: number;
  woodColor: number;
  length: number;
  desc: string;
  price: number;
  /** Explosive radius for grenades */
  blastRadius?: number;
  /** Fuse time in seconds for grenades */
  fuse?: number;
}

// ---- Starter weapons (free) --------------------------------------------
const INSAS: WeaponDef = {
  id: "insas",
  name: "INSAS 1B1",
  era: "1998 · OFB",
  caliber: "5.56×45mm",
  mode: "auto",
  category: "rifle",
  damage: 26,
  headMult: 3.4,
  rpm: 650,
  magSize: 20,
  reserve: 160,
  reloadTime: 2.1,
  spread: 0.028,
  adsSpread: 0.006,
  recoil: 0.011,
  kick: 0.05,
  range: 220,
  zoom: 1.35,
  color: 0x2c2f33,
  woodColor: 0x3a3f45,
  length: 0.95,
  desc: "Indian Small Arms System. Controlled bursts, flat recoil.",
  price: 0,
};

// ---- Unlockable weapons ------------------------------------------------
const AK203: WeaponDef = {
  id: "ak203",
  name: "AK-203 Korwa",
  era: "2021 · Amethi",
  caliber: "7.62×39mm",
  mode: "auto",
  category: "rifle",
  damage: 34,
  headMult: 3.2,
  rpm: 600,
  magSize: 30,
  reserve: 180,
  reloadTime: 2.3,
  spread: 0.034,
  adsSpread: 0.008,
  recoil: 0.016,
  kick: 0.07,
  range: 200,
  zoom: 1.3,
  color: 0x23262a,
  woodColor: 0x5a3a1e,
  length: 0.9,
  desc: "Indo-Russian Kalashnikov. Heavy punch, wandering recoil.",
  price: 1200,
};

const STEN: WeaponDef = {
  id: "sten",
  name: "Sten Mk.V (Ishapore)",
  era: "1944 · Rifle Factory Ishapore",
  caliber: "9×19mm",
  mode: "auto",
  category: "smg",
  damage: 19,
  headMult: 2.6,
  rpm: 900,
  magSize: 32,
  reserve: 224,
  reloadTime: 1.9,
  spread: 0.045,
  adsSpread: 0.016,
  recoil: 0.008,
  kick: 0.035,
  range: 90,
  zoom: 1.15,
  color: 0x35383c,
  woodColor: 0x6b4423,
  length: 0.72,
  desc: "Wartime submachine gun. Spray at close quarters.",
  price: 600,
};

const SMLE: WeaponDef = {
  id: "smle",
  name: "Lee–Enfield SMLE Mk.III*",
  era: "1857–1947 · British Indian Army",
  caliber: ".303 British",
  mode: "bolt",
  category: "sniper",
  damage: 95,
  headMult: 2.2,
  rpm: 55,
  magSize: 10,
  reserve: 60,
  reloadTime: 3.0,
  spread: 0.012,
  adsSpread: 0.0009,
  recoil: 0.035,
  kick: 0.16,
  range: 400,
  zoom: 3.6,
  scoped: true,
  color: 0x2a2622,
  woodColor: 0x7a4a20,
  length: 1.25,
  desc: "Bolt-action marksman rifle. One shot, one kill.",
  price: 2000,
};

const TORADAR: WeaponDef = {
  id: "toradar",
  name: "Toradar Matchlock",
  era: "c. 1590 · Mughal Empire",
  caliber: "Lead ball, 18mm",
  mode: "bolt",
  category: "rifle",
  damage: 120,
  headMult: 2,
  rpm: 30,
  magSize: 1,
  reserve: 24,
  reloadTime: 3.4,
  spread: 0.03,
  adsSpread: 0.01,
  recoil: 0.06,
  kick: 0.24,
  range: 120,
  pellets: 3,
  zoom: 1.1,
  color: 0x1f1c19,
  woodColor: 0x8a5a2b,
  length: 1.45,
  desc: "Hand-cannon of the Mughal armouries. Devastating, ponderous.",
  price: 1500,
};

// ---- New firearms ------------------------------------------------------
const GHAL: WeaponDef = {
  id: "ghatak",
  name: "Ghatak AR",
  era: "2019 · ARDE",
  caliber: "5.56×45mm",
  mode: "auto",
  category: "rifle",
  damage: 30,
  headMult: 3.0,
  rpm: 700,
  magSize: 30,
  reserve: 210,
  reloadTime: 2.0,
  spread: 0.026,
  adsSpread: 0.005,
  recoil: 0.013,
  kick: 0.06,
  range: 240,
  zoom: 1.4,
  color: 0x1a1a1e,
  woodColor: 0x2a2a2e,
  length: 0.88,
  desc: "DRDO assault rifle. Precision fire with crisp trigger pull.",
  price: 1800,
};

const MP5: WeaponDef = {
  id: "mp5",
  name: "MP5A3 (SPG)",
  era: "2002 · SPG Detail",
  caliber: "9×19mm",
  mode: "auto",
  category: "smg",
  damage: 22,
  headMult: 2.8,
  rpm: 800,
  magSize: 30,
  reserve: 240,
  reloadTime: 1.8,
  spread: 0.038,
  adsSpread: 0.012,
  recoil: 0.007,
  kick: 0.03,
  range: 100,
  zoom: 1.2,
  color: 0x1e1e22,
  woodColor: 0x333338,
  length: 0.68,
  desc: "Special Protection Group SMG. Accurate, fast handling.",
  price: 900,
};

const BARRETT: WeaponDef = {
  id: "barrett",
  name: "Barrett M95",
  era: "2008 · MARCOS",
  caliber: ".50 BMG",
  mode: "bolt",
  category: "sniper",
  damage: 180,
  headMult: 1.8,
  rpm: 30,
  magSize: 5,
  reserve: 25,
  reloadTime: 3.5,
  spread: 0.008,
  adsSpread: 0.0005,
  recoil: 0.08,
  kick: 0.3,
  range: 600,
  zoom: 5.0,
  scoped: true,
  color: 0x121214,
  woodColor: 0x1a1a1c,
  length: 1.5,
  desc: "Anti-material sniper. Devastating at any range.",
  price: 3500,
};

const BHALU: WeaponDef = {
  id: "bhalu",
  name: "Bhalu LMG",
  era: "2020 · OFB",
  caliber: "7.62×51mm",
  mode: "auto",
  category: "rifle",
  damage: 40,
  headMult: 2.5,
  rpm: 650,
  magSize: 100,
  reserve: 300,
  reloadTime: 4.0,
  spread: 0.04,
  adsSpread: 0.012,
  recoil: 0.02,
  kick: 0.09,
  range: 250,
  zoom: 1.25,
  color: 0x252528,
  woodColor: 0x4a3320,
  length: 1.1,
  desc: "Belt-fed light machine gun. Suppress everything that moves.",
  price: 3000,
};

// ---- Melee -------------------------------------------------------------
const KATTA: WeaponDef = {
  id: "katta",
  name: "Desi Katta",
  era: "Timeless · Village forge",
  caliber: "12-gauge scrap",
  mode: "semi",
  category: "melee",
  damage: 70,
  headMult: 1.5,
  rpm: 80,
  magSize: 1,
  reserve: 0,
  reloadTime: 1.2,
  spread: 0.06,
  adsSpread: 0.02,
  recoil: 0.04,
  kick: 0.12,
  range: 8,
  zoom: 1.0,
  color: 0x3a2a18,
  woodColor: 0x6b4423,
  length: 0.4,
  desc: "Hand-forged shotgun-pistol. Also a brutal melee strike.",
  price: 400,
};

const KHANDA: WeaponDef = {
  id: "khanda",
  name: "Khanda Sword",
  era: "Ancient · Rajput",
  caliber: "Steel blade",
  mode: "semi",
  category: "melee",
  damage: 90,
  headMult: 2.0,
  rpm: 120,
  magSize: 0,
  reserve: 0,
  reloadTime: 0,
  spread: 0,
  adsSpread: 0,
  recoil: 0.02,
  kick: 0.08,
  range: 4,
  zoom: 1.0,
  color: 0xc8c8d0,
  woodColor: 0x4a3020,
  length: 1.0,
  desc: "Double-edged Rajput broadsword. Slash through ranks.",
  price: 800,
};

// ---- Grenades ----------------------------------------------------------
const GRENADE_36: WeaponDef = {
  id: "grenade36",
  name: "No.36 Mills Bomb",
  era: "1915 · British India",
  caliber: "Fragmentation",
  mode: "semi",
  category: "grenade",
  damage: 120,
  headMult: 1,
  rpm: 60,
  magSize: 3,
  reserve: 0,
  reloadTime: 0,
  spread: 0.15,
  adsSpread: 0.15,
  recoil: 0.03,
  kick: 0.1,
  range: 50,
  zoom: 1.0,
  color: 0x3d4a35,
  woodColor: 0x2a2a2a,
  length: 0.12,
  desc: "Classic fragmentation grenade. Throw and duck.",
  price: 300,
  blastRadius: 8,
  fuse: 3.5,
};

const SMOKE: WeaponDef = {
  id: "smoke",
  name: "Smoke Grenade",
  era: "Modern",
  caliber: "Smoke screen",
  mode: "semi",
  category: "grenade",
  damage: 0,
  headMult: 1,
  rpm: 60,
  magSize: 2,
  reserve: 0,
  reloadTime: 0,
  spread: 0.15,
  adsSpread: 0.15,
  recoil: 0.03,
  kick: 0.1,
  range: 50,
  zoom: 1.0,
  color: 0x555555,
  woodColor: 0x333333,
  length: 0.12,
  desc: "Deploy a smoke screen to break enemy sightlines.",
  price: 250,
  blastRadius: 10,
  fuse: 2.5,
};

export const ALL_WEAPONS: WeaponDef[] = [
  INSAS,
  AK203,
  STEN,
  SMLE,
  TORADAR,
  GHAL,
  MP5,
  BARRETT,
  BHALU,
  KATTA,
  KHANDA,
  GRENADE_36,
  SMOKE,
];

// Backward-compatible export: default loadout (starters + melee + grenade)
export const WEAPONS: WeaponDef[] = ALL_WEAPONS;

// Weapons that start unlocked
export const STARTER_WEAPON_IDS = ["insas", "katta", "grenade36"];

// ===================================================================
// Characters — freedom fighters with unique passive abilities
// ===================================================================

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  era: string;
  desc: string;
  /** passive ability key consumed by the engine */
  ability:
    | "damage_boost"
    | "fast_reload"
    | "extra_armor"
    | "health_regen"
    | "speed_boost"
    | "double_currency";
  /** ability magnitude */
  abilityValue: number;
  accent: number;
  price: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "shivaji",
    name: "Chhatrapati Shivaji",
    title: "Founder of the Maratha Empire",
    era: "1630–1680",
    desc: "Master of guerrilla hill warfare. +15% weapon damage.",
    ability: "damage_boost",
    abilityValue: 0.15,
    accent: 0xff9933,
    price: 0,
  },
  {
    id: "bhagat",
    name: "Bhagat Singh",
    title: "The Revolutionary",
    era: "1907–1931",
    desc: "Fearless and fast. +20% reload speed, +10% move speed.",
    ability: "fast_reload",
    abilityValue: 0.2,
    accent: 0xe63946,
    price: 800,
  },
  {
    id: "rani",
    name: "Rani Lakshmibai",
    title: "Queen of Jhansi",
    era: "1828–1858",
    desc: "Unbreakable defender. Start each wave with +25 armor.",
    ability: "extra_armor",
    abilityValue: 25,
    accent: 0xf4a261,
    price: 600,
  },
  {
    id: "ashoka",
    name: "Emperor Ashoka",
    title: "The Great Mauryan",
    era: "268–232 BCE",
    desc: "Conqueror's endurance. Regenerate 2 HP/sec up to 80.",
    ability: "health_regen",
    abilityValue: 2,
    accent: 0x2a9d8f,
    price: 1000,
  },
  {
    id: "gandhi",
    name: "Mahatma Gandhi",
    title: "Father of the Nation",
    era: "1869–1948",
    desc: "Diplomatic fortune. Earn 50% more currency per kill.",
    ability: "double_currency",
    abilityValue: 0.5,
    accent: 0xc69963,
    price: 500,
  },
  {
    id: "subhas",
    name: "Subhas Chandra Bose",
    title: "Netaji · INA Leader",
    era: "1897–1945",
    desc: "Lightning offensive. +15% move speed, +10% damage.",
    ability: "speed_boost",
    abilityValue: 0.15,
    accent: 0x457b9d,
    price: 1200,
  },
];

export const STARTER_CHARACTER_IDS = ["shivaji"];

// ===================================================================
// Maps
// ===================================================================

export interface MapDef {
  id: string;
  name: string;
  year: string;
  blurb: string;
  sky: [number, number];
  fog: number;
  sun: number;
  ground: number;
  stone: number;
  accent: number;
  /** price to unlock the map */
  price: number;
  /** visual theme affects shader params */
  theme: "fort" | "snow" | "jungle" | "desert" | "coastal" | "temple";
}

export const MAPS: MapDef[] = [
  {
    id: "amber",
    name: "Amber Fort · Jaipur",
    year: "1592 CE",
    blurb: "Sandstone ramparts above Maota Lake. Rajput bastions and pillared halls.",
    sky: [0x8fb6d8, 0xf1d7a8],
    fog: 0xe4c9a0,
    sun: 0xffe0b0,
    ground: 0xc7a878,
    stone: 0xd8a86e,
    accent: 0xb5652f,
    price: 0,
    theme: "fort",
  },
  {
    id: "jhansi",
    name: "Jhansi Ramparts",
    year: "1858 CE",
    blurb: "The revolt at the fort walls. Smoke, cannon emplacements, granite courtyards.",
    sky: [0x5c6570, 0xd9a072],
    fog: 0x9a8776,
    sun: 0xffb377,
    ground: 0x7d6f5f,
    stone: 0x8b8378,
    accent: 0x8a3b28,
    price: 0,
    theme: "fort",
  },
  {
    id: "siachen",
    name: "Siachen Outpost",
    year: "1984 CE",
    blurb: "Highest battlefield on earth. Concrete bunkers, glacier haze, thin light.",
    sky: [0x243447, 0xa8c4dd],
    fog: 0xc6d6e4,
    sun: 0xdceaff,
    ground: 0xdbe6ee,
    stone: 0x6f7b85,
    accent: 0x2f5d7c,
    price: 500,
    theme: "snow",
  },
  {
    id: "redfort",
    name: "Red Fort · Delhi",
    year: "1648 CE",
    blurb: "Mughal power centre. Massive sandstone walls, marble pavilions, Yamuna breeze.",
    sky: [0xb04a3a, 0xf2c27a],
    fog: 0xe8b88a,
    sun: 0xffd0a0,
    ground: 0xbf6b4a,
    stone: 0xc94c3a,
    accent: 0xd4af37,
    price: 800,
    theme: "fort",
  },
  {
    id: "kerala",
    name: "Kerala Backwaters",
    year: "1700 CE",
    blurb: "Tropical waterways and palm groves. Naval skirmish amid stilts and boats.",
    sky: [0x2d5a3d, 0xa8d8a8],
    fog: 0x88aa88,
    sun: 0xf0ffd0,
    ground: 0x4a6b3a,
    stone: 0x6b8e5a,
    accent: 0x2a7a4a,
    price: 1000,
    theme: "jungle",
  },
  {
    id: "thal",
    name: "Thar Desert Outpost",
    year: "1971 CE",
    blurb: "Blazing dunes and sandbag bunkers. Long sightlines, shimmering heat haze.",
    sky: [0xd4a868, 0xf5e6c8],
    fog: 0xe8d4a0,
    sun: 0xfff5d0,
    ground: 0xd4b070,
    stone: 0xc49a5a,
    accent: 0x8a5a2a,
    price: 700,
    theme: "desert",
  },
  {
    id: "konark",
    name: "Konark Sun Temple",
    year: "1250 CE",
    blurb: "Stone chariot of the sun god. Carved wheels, temple tanks, ancient energy.",
    sky: [0x4a3050, 0xe8a050],
    fog: 0xc89870,
    sun: 0xffc868,
    ground: 0xa88860,
    stone: 0xb89868,
    accent: 0xd4943a,
    price: 1200,
    theme: "temple",
  },
  {
    id: "andaman",
    name: "Andaman Coast",
    year: "1943 CE",
    blurb: "Tropical island stronghold. Netaji's INA base amid palms and coral sand.",
    sky: [0x1a4a6a, 0x8acce8],
    fog: 0xa0cce0,
    sun: 0xf0fff8,
    ground: 0xc8c0a0,
    stone: 0x8a8a78,
    accent: 0x2a8a6a,
    price: 1500,
    theme: "coastal",
  },
];

export const STARTER_MAP_IDS = ["amber", "jhansi"];
