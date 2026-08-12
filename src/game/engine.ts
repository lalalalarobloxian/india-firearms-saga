import * as THREE from "three";
import {
  ALL_WEAPONS,
  CHARACTERS,
  MAPS,
  type CharacterDef,
  type MapDef,
  type WeaponDef,
} from "./config";
import { DEFAULT_SETTINGS, type GameSettings } from "./economy";
import {
  PostProcessing,
  createAtmosphereParticles,
  createGodRays,
  createGrassField,
  createWaterMesh,
  updateShaderMeshes,
} from "./graphics";
import { animateHumanoid, buildHumanoid, buildViewModel, type Humanoid, type ViewModel } from "./models";
import { MISSIONS, SURVIVAL, type MissionDef } from "./missions";
import type { Multiplayer, NetEvent } from "./multiplayer";
import { groundTexture, skyTexture, stoneTexture } from "./textures";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface HudSlot {
  id: string;
  name: string;
  ammo: number;
  reserve: number;
  grenade: boolean;
  melee: boolean;
  active: boolean;
}

export interface HudTeammate {
  name: string;
  character: string;
  hp: number;
  kills: number;
  down: boolean;
  self: boolean;
}

export interface HudState {
  hp: number;
  armor: number;
  ammo: number;
  reserve: number;
  weapon: string;
  weaponEra: string;
  slots: HudSlot[];
  wave: number;
  waveTotal: number;
  enemies: number;
  kills: number;
  headshots: number;
  accuracy: number;
  score: number;
  cash: number;
  earned: number;
  dead: boolean;
  won: boolean;
  reloading: boolean;
  hitmark: number;
  killfeed: { id: number; text: string; head: boolean }[];
  banner: string | null;
  objective: string;
  mission: string;
  character: string;
  buyPhase: boolean;
  buyTime: number;
  teammates: HudTeammate[];
  fps: number;
  showFps: boolean;
  zoom: number;
  scoped: boolean;
  lowHealth: number;
}

export interface GameOptions {
  mapId: string;
  characterId: string;
  /** weapon ids in slot order */
  loadout: string[];
  settings: GameSettings;
  mode: "survival" | "mission";
  missionId?: string;
  net?: Multiplayer | null;
  playerName?: string;
}

export interface ShopItem {
  id: string;
  label: string;
  detail: string;
  price: number;
}

export const ROUND_SHOP: ShopItem[] = [
  { id: "armor", label: "Kevlar Vest", detail: "+100 armour", price: 650 },
  { id: "health", label: "Field Medkit", detail: "Full health", price: 450 },
  { id: "ammo", label: "Ammo Crate", detail: "Refill all reserves", price: 300 },
  { id: "frag", label: "Mills Bomb ×2", detail: "Fragmentation grenades", price: 320 },
  { id: "smoke", label: "Smoke ×2", detail: "Break sightlines", price: 220 },
  { id: "damage", label: "Ordnance Ticket", detail: "+10% damage this run", price: 900 },
];

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Collider {
  box: THREE.Box3;
}

interface Enemy {
  h: Humanoid;
  hitBody: THREE.Mesh;
  hitHead: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  burst: number;
  damage: number;
  accuracy: number;
  range: number;
  strafe: number;
  strafeTimer: number;
  dead: boolean;
  deathTime: number;
  name: string;
  reward: number;
  melee: boolean;
}

interface Projectile {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  fuse: number;
  weapon: WeaponDef;
}

interface Smoke {
  pos: THREE.Vector3;
  radius: number;
  life: number;
  points: THREE.Points;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  gravity: number;
  spin: number;
}

const ARENA = 62;

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */

class Audio {
  private ctx: AudioContext | null = null;
  master = 0.7;
  sfx = 0.8;

  private ac() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private gainNode(vol: number) {
    const ctx = this.ac();
    const g = ctx.createGain();
    g.gain.value = vol * this.master * this.sfx;
    g.connect(ctx.destination);
    return g;
  }

  noise(duration: number, vol: number, filterFreq: number, decay = 1) {
    const ctx = this.ac();
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    src.connect(filter).connect(this.gainNode(vol));
    src.start();
  }

  tone(freq: number, duration: number, vol: number, type: OscillatorType = "sine", slideTo?: number) {
    const ctx = this.ac();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const g = this.gainNode(vol);
    g.gain.setValueAtTime(vol * this.master * this.sfx, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  shot(w: WeaponDef) {
    if (w.category === "sniper") {
      this.noise(0.4, 0.55, 2600, 2.4);
      this.tone(90, 0.35, 0.3, "sawtooth", 40);
    } else if (w.id === "katta") {
      this.noise(0.35, 0.5, 1800, 2);
      this.tone(70, 0.3, 0.25, "square", 35);
    } else if (w.category === "smg") {
      this.noise(0.11, 0.3, 4200, 3);
    } else {
      this.noise(0.17, 0.4, 3200, 2.6);
      this.tone(120, 0.12, 0.16, "sawtooth", 60);
    }
  }

  swing() {
    this.noise(0.22, 0.28, 900, 1.6);
    this.tone(520, 0.14, 0.1, "triangle", 200);
  }

  explode() {
    this.noise(1.1, 0.9, 900, 1.6);
    this.tone(60, 0.9, 0.5, "sawtooth", 25);
  }

  hit(head: boolean) {
    this.tone(head ? 1500 : 900, 0.07, 0.22, "square", head ? 900 : 600);
  }

  reload() {
    this.noise(0.09, 0.22, 2200, 2);
    setTimeout(() => this.noise(0.09, 0.2, 1600, 2), 200);
  }

  pickup() {
    this.tone(660, 0.1, 0.16, "triangle");
    setTimeout(() => this.tone(990, 0.12, 0.16, "triangle"), 90);
  }

  hurt() {
    this.tone(180, 0.22, 0.3, "sawtooth", 90);
  }

  wave() {
    this.tone(220, 0.5, 0.22, "sine", 440);
    setTimeout(() => this.tone(330, 0.6, 0.2, "sine", 550), 220);
  }
}
