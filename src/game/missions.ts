export interface MissionDef {
  id: string;
  name: string;
  year: string;
  mapId: string;
  /** short objective line shown on the HUD */
  objective: string;
  brief: string;
  /** number of waves to survive to win the mission */
  waves: number;
  /** enemy faction label used in the kill feed */
  faction: string;
  /** difficulty multiplier applied to enemy hp / fire rate */
  difficulty: number;
  reward: number;
}

/**
 * Co-operative "real war scenario" operations drawn from Indian military history.
 * Each one maps onto one of the arenas and has a fixed wave objective.
 */
export const MISSIONS: MissionDef[] = [
  {
    id: "longewala",
    name: "Operation Longewala",
    year: "5 December 1971",
    mapId: "thal",
    objective: "Hold the Longewala post until first light — 6 assault waves",
    brief:
      "120 men of 23 Punjab against an armoured column in the Thar. Dig in behind the sandbags, keep the desert track covered and hold until dawn air support arrives.",
    waves: 6,
    faction: "Armoured Column",
    difficulty: 1.1,
    reward: 900,
  },
  {
    id: "tigerhill",
    name: "Operation Vijay · Tiger Hill",
    year: "4 July 1999",
    mapId: "siachen",
    objective: "Clear the ridge line — 7 waves of entrenched intruders",
    brief:
      "A near-vertical climb at 16,700 feet. Grenades and precision fire clear the sangars one by one. Thin air, thinner cover.",
    waves: 7,
    faction: "Ridge Intruders",
    difficulty: 1.25,
    reward: 1200,
  },
  {
    id: "jhansi1858",
    name: "Defence of Jhansi",
    year: "March 1858",
    mapId: "jhansi",
    objective: "Defend the ramparts beside the Rani — 5 waves",
    brief:
      "The siege of Jhansi. Cannon smoke over the granite courtyards while the Rani rallies the defenders on the wall.",
    waves: 5,
    faction: "Siege Column",
    difficulty: 1.0,
    reward: 700,
  },
  {
    id: "ina1943",
    name: "INA Andaman Landing",
    year: "December 1943",
    mapId: "andaman",
    objective: "Secure the coastal battery — 6 waves",
    brief:
      "Netaji's Azad Hind forces move on the island garrison. Palms, coral sand and enfilading fire from the water line.",
    waves: 6,
    faction: "Island Garrison",
    difficulty: 1.15,
    reward: 1000,
  },
  {
    id: "kerala1700",
    name: "Backwater Ambush",
    year: "1700 CE",
    mapId: "kerala",
    objective: "Break the naval raid — 5 waves",
    brief:
      "Travancore levies meet a river raiding party amid stilt houses and paddy water. Watch the reeds.",
    waves: 5,
    faction: "River Raiders",
    difficulty: 1.05,
    reward: 800,
  },
  {
    id: "delhi1648",
    name: "Red Fort Standoff",
    year: "1648 CE",
    mapId: "redfort",
    objective: "Hold the Diwan-i-Aam — 7 waves",
    brief:
      "Mughal household troops against a palace coup. Marble pavilions, long sandstone galleries and matchlock volleys.",
    waves: 7,
    faction: "Rebel Guard",
    difficulty: 1.2,
    reward: 1100,
  },
  {
    id: "saragarhi",
    name: "Battle of Saragarhi",
    year: "12 September 1897",
    mapId: "amber",
    objective: "21 Sikhs against 10,000 — hold the post for 8 waves",
    brief:
      "Havildar Ishar Singh and twenty men of the 36th Sikhs refuse to surrender the signalling post. Reload fast, pick your lanes, make every round count.",
    waves: 8,
    faction: "Tribal Lashkar",
    difficulty: 1.35,
    reward: 1500,
  },
  {
    id: "kalinga",
    name: "Kalinga Campaign",
    year: "261 BCE",
    mapId: "konark",
    objective: "Hold the temple plinth — 6 waves",
    brief:
      "The war that broke Ashoka's heart. Stone chariot wheels, sun-bleached courtyards and wave after wave of Kalingan levies.",
    waves: 6,
    faction: "Kalingan Levy",
    difficulty: 1.1,
    reward: 950,
  },
];

export const SURVIVAL: MissionDef = {
  id: "survival",
  name: "Endless Defence",
  year: "All eras",
  mapId: "amber",
  objective: "Survive as many waves as you can",
  brief: "Wave after wave, no end. Bank as much currency as you can before the fort falls.",
  waves: 999,
  faction: "Hostiles",
  difficulty: 1,
  reward: 0,
};
