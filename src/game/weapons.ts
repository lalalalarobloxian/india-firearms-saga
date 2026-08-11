export type FireMode = "auto" | "semi" | "bolt";

export interface WeaponDef {
  id: string;
  name: string;
  era: string;
  caliber: string;
  mode: FireMode;
  damage: number;
  headMult: number;
  rpm: number;
  magSize: number;
  reserve: number;
  reloadTime: number;
  spread: number; // radians of hip-fire cone
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
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "insas",
    name: "INSAS 1B1",
    era: "1998 · Ordnance Factory Board",
    caliber: "5.56×45mm",
    mode: "auto",
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
  },
  {
    id: "ak203",
    name: "AK-203 Korwa",
    era: "2021 · Amethi, Uttar Pradesh",
    caliber: "7.62×39mm",
    mode: "auto",
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
  },
  {
    id: "sten",
    name: "Sten Mk.V (Ishapore)",
    era: "1944 · Rifle Factory Ishapore",
    caliber: "9×19mm",
    mode: "auto",
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
  },
  {
    id: "smle",
    name: "Lee–Enfield SMLE Mk.III*",
    era: "1857–1947 · British Indian Army",
    caliber: ".303 British",
    mode: "bolt",
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
  },
  {
    id: "toradar",
    name: "Toradar Matchlock",
    era: "c. 1590 · Mughal Empire",
    caliber: "Lead ball, 18mm",
    mode: "bolt",
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
  },
];

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
  },
];