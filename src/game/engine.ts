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

/* ------------------------------------------------------------------ */
/*  Game                                                               */
/* ------------------------------------------------------------------ */

export class Game {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private viewCamera: THREE.PerspectiveCamera;
  private viewScene = new THREE.Scene();
  private post: PostProcessing | null = null;
  private clock = new THREE.Clock();
  private audio = new Audio();
  private raycaster = new THREE.Raycaster();
  private onHud: (s: HudState) => void;

  private settings: GameSettings;
  private map: MapDef;
  private character: CharacterDef;
  private mission: MissionDef;
  private mode: "survival" | "mission";
  private net: Multiplayer | null;
  private playerName: string;

  // world
  private colliders: Collider[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private projectiles: Projectile[] = [];
  private smokes: Smoke[] = [];
  private decals: THREE.Mesh[] = [];
  private spawnPoints: THREE.Vector3[] = [];
  private worldGroup = new THREE.Group();
  private muzzleLight: THREE.PointLight;

  // player
  private pos = new THREE.Vector3(0, 1.7, 18);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = true;
  private crouching = false;
  private hp = 100;
  private armor = 0;
  private dead = false;
  private won = false;
  private damageBonus = 0;

  // weapons
  private weapons: WeaponDef[] = [];
  private views: (ViewModel | null)[] = [];
  private ammo: number[] = [];
  private reserve: number[] = [];
  private wIndex = 0;
  private lastShot = 0;
  private reloading = false;
  private reloadEnd = 0;
  private ads = false;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private meleeSwing = 0;
  private throwCharge = 0;

  // round / stats
  private wave = 1;
  private waveEnemiesLeft = 0;
  private spawnQueue = 0;
  private spawnTimer = 0;
  private buyPhase = true;
  private buyTimer = 8;
  buyOpen = false;
  private cash = 800;
  private earned = 0;
  private kills = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private score = 0;
  private banner: string | null = null;
  private bannerUntil = 0;
  private hitmark = 0;
  private killfeed: { id: number; text: string; head: boolean }[] = [];
  private feedId = 0;
  private lowHealth = 0;
  private shake = 0;

  // multiplayer avatars
  private avatars = new Map<string, { h: Humanoid; label: THREE.Sprite; target: THREE.Vector3 }>();
  private peerKills = new Map<string, number>();

  // input
  private keys = new Set<string>();
  private mouseDown = false;
  private rightDown = false;
  private disposed = false;
  private frames = 0;
  private fpsTime = 0;
  private fps = 0;
  private hudTime = 0;
  private time = 0;

  constructor(container: HTMLElement, opts: GameOptions, onHud: (s: HudState) => void) {
    this.container = container;
    this.onHud = onHud;
    this.settings = { ...DEFAULT_SETTINGS, ...opts.settings };
    this.map = MAPS.find((m) => m.id === opts.mapId) ?? MAPS[0]!;
    this.character = CHARACTERS.find((c) => c.id === opts.characterId) ?? CHARACTERS[0]!;
    this.mode = opts.mode;
    this.mission =
      opts.mode === "mission"
        ? (MISSIONS.find((m) => m.id === opts.missionId) ?? MISSIONS[0]!)
        : { ...SURVIVAL, mapId: this.map.id };
    this.net = opts.net ?? null;
    this.playerName = opts.playerName ?? "Jawan";
    this.audio.master = this.settings.masterVolume;
    this.audio.sfx = this.settings.sfxVolume;

    const ids = opts.loadout.length ? opts.loadout : ["insas", "katta", "grenade36"];
    this.weapons = ids
      .map((id) => ALL_WEAPONS.find((w) => w.id === id))
      .filter((w): w is WeaponDef => !!w);
    if (!this.weapons.length) this.weapons = [ALL_WEAPONS[0]!];

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: this.settings.graphics !== "low", powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.graphics === "ultra" ? 2 : 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.05, 600);
    this.viewCamera = new THREE.PerspectiveCamera(58, aspect, 0.01, 10);

    this.muzzleLight = new THREE.PointLight(0xffd08a, 0, 16, 2);
    this.scene.add(this.muzzleLight);

    this.buildWorld();
    this.buildViewScene();
    this.initLoadout();

    if (this.settings.postProcessing) {
      this.post = new PostProcessing(this.renderer, this.scene, this.camera, container.clientWidth, container.clientHeight);
      this.post.applySettings(this.settings);
    }

    this.attachInput();
    this.banner = this.mode === "mission" ? this.mission.name.toUpperCase() : "DEFEND THE FORT";
    this.bannerUntil = 3.2;
    this.animate();
  }

  /* ---------------- world -------------------------------------------- */

  private addBox(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    solid = true,
    rotY = 0,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.worldGroup.add(mesh);
    if (solid) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(Math.abs(w * Math.cos(rotY)) + Math.abs(d * Math.sin(rotY)), h, Math.abs(d * Math.cos(rotY)) + Math.abs(w * Math.sin(rotY))),
      );
      this.colliders.push({ box });
    }
    return mesh;
  }

  private buildWorld() {
    const m = this.map;
    this.scene.clear();
    this.scene.add(this.muzzleLight);
    this.colliders = [];
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    this.scene.background = skyTexture(m.sky[0], m.sky[1]);
    this.scene.fog = new THREE.Fog(m.fog, m.theme === "snow" ? 40 : 70, m.theme === "jungle" ? 150 : 240);

    const hemi = new THREE.HemisphereLight(m.sky[0], m.ground, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(m.sun, 2.1);
    sun.position.set(40, 55, 25);
    sun.castShadow = this.settings.shadows;
    sun.shadow.mapSize.set(this.settings.graphics === "ultra" ? 2048 : 1024, this.settings.graphics === "ultra" ? 2048 : 1024);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.far = 180;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(m.fog, 0.35));

    // ground
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture(m.ground, m.theme === "snow" ? 20 : 40),
      roughness: m.theme === "snow" ? 0.6 : 0.95,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.worldGroup.add(ground);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(m.stone, 3),
      roughness: 0.85,
      metalness: 0.05,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: m.accent, roughness: 0.6, metalness: 0.25 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x30323a, roughness: 0.75, metalness: 0.2 });

    // perimeter walls with merlons
    const half = ARENA / 2;
    const wallH = 9;
    for (const [dx, dz] of [
      [0, -half],
      [0, half],
      [-half, 0],
      [half, 0],
    ] as [number, number][]) {
      const horizontal = dz !== 0;
      const w = horizontal ? ARENA + 4 : 3;
      const d = horizontal ? 3 : ARENA + 4;
      this.addBox(w, wallH, d, dx, wallH / 2, dz, stoneMat);
      const count = 14;
      for (let i = 0; i <= count; i++) {
        const t = (i / count - 0.5) * ARENA;
        this.addBox(
          horizontal ? 2 : 3,
          1.5,
          horizontal ? 3 : 2,
          horizontal ? t : dx,
          wallH + 0.75,
          horizontal ? dz : t,
          stoneMat,
          false,
        );
      }
    }

    // corner bastions
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as [number, number][]) {
      const x = sx * (half - 3);
      const z = sz * (half - 3);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 13, 18), stoneMat);
      tower.position.set(x, 6.5, z);
      tower.castShadow = tower.receiveShadow = true;
      this.worldGroup.add(tower);
      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 6.5, z), new THREE.Vector3(9, 13, 9)),
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
      dome.position.set(x, 13, z);
      this.worldGroup.add(dome);
      const finial = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 10), accentMat);
      finial.position.set(x, 18, z);
      this.worldGroup.add(finial);
    }

    // central pavilion (all themes) — pillars + roof, gives vertical play
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * 8;
      const pz = Math.sin(a) * 8;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 6.5, 12), stoneMat);
      pillar.position.set(px, 3.25, pz);
      pillar.castShadow = true;
      this.worldGroup.add(pillar);
      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, 3.25, pz), new THREE.Vector3(1.4, 6.5, 1.4)),
      });
    }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 11.5, 1.1, 8), stoneMat);
    roof.position.y = 7.1;
    roof.castShadow = roof.receiveShadow = true;
    this.worldGroup.add(roof);
    const cupola = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
    cupola.position.y = 7.6;
    this.worldGroup.add(cupola);

    // scattered cover crates / sandbags / rocks
    const coverMat = m.theme === "snow" || m.theme === "desert" ? darkMat : accentMat;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(14, half - 6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = rand(1.1, 2.4);
      this.addBox(rand(1.6, 3.2), h, rand(1.6, 3.2), x, h / 2, z, coverMat, true, Math.random() * Math.PI);
    }

    this.buildTheme(m, stoneMat, accentMat, darkMat);

    // spawn points around the ring
    this.spawnPoints = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.spawnPoints.push(new THREE.Vector3(Math.cos(a) * (half - 6), 0, Math.sin(a) * (half - 6)));
    }

    // atmosphere
    if (this.settings.volumetric) {
      const atmos =
        m.theme === "snow"
          ? createAtmosphereParticles(900, 0xffffff, 90, 0.22, 3)
          : m.theme === "desert"
            ? createAtmosphereParticles(700, 0xe8d4a0, 100, 0.14, 5)
            : m.theme === "jungle" || m.theme === "coastal"
              ? createAtmosphereParticles(400, 0xd8ffe8, 80, 0.1, 1.5)
              : createAtmosphereParticles(350, 0xffe8c0, 80, 0.09, 1.2);
      this.scene.add(atmos);
      if (m.theme === "temple" || m.theme === "fort") {
        this.scene.add(createGodRays(m.sun, new THREE.Vector3(0, 0, 0)));
      }
    }

    this.pos.set(0, 1.7, 18);
    this.vel.set(0, 0, 0);
  }

  private buildTheme(
    m: MapDef,
    stoneMat: THREE.Material,
    accentMat: THREE.Material,
    darkMat: THREE.Material,
  ) {
    const half = ARENA / 2;
    const palm = (x: number, z: number) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.34, rand(6, 9), 8),
        new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 }),
      );
      trunk.position.set(x, trunk.geometry.parameters.height / 2, z);
      trunk.rotation.z = rand(-0.12, 0.12);
      trunk.castShadow = true;
      this.worldGroup.add(trunk);
      this.colliders.push({
        box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 3, z), new THREE.Vector3(0.8, 6, 0.8)),
      });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b32, roughness: 0.85, side: THREE.DoubleSide });
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4, 1, true), leafMat);
        const a = (i / 7) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.2, trunk.geometry.parameters.height, z + Math.sin(a) * 1.2);
        leaf.rotation.set(Math.PI / 2.4, 0, -a);
        leaf.castShadow = true;
        this.worldGroup.add(leaf);
      }
    };

    if (m.theme === "snow") {
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(16, half - 8);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        this.addBox(5, 2.2, 3.4, x, 1.1, z, darkMat, true, a);
        const slit = this.addBox(4.4, 0.5, 0.4, x, 1.7, z - 1.7, new THREE.MeshStandardMaterial({ color: 0x0d0f12 }), false, a);
        slit.rotation.y = a;
      }
      for (let i = 0; i < 14; i++) {
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(rand(1.5, 3.6), 0),
          new THREE.MeshStandardMaterial({ color: 0xe8f0f6, roughness: 0.5 }),
        );
        rock.position.set(rand(-half, half), rand(0.4, 1.2), rand(-half, half));
        rock.castShadow = rock.receiveShadow = true;
        this.worldGroup.add(rock);
      }
    } else if (m.theme === "desert") {
      for (let i = 0; i < 18; i++) {
        const dune = new THREE.Mesh(
          new THREE.SphereGeometry(rand(4, 9), 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: m.ground, roughness: 1 }),
        );
        dune.position.set(rand(-140, 140), -0.6, rand(-140, 140));
        dune.scale.y = rand(0.18, 0.4);
        dune.receiveShadow = true;
        this.worldGroup.add(dune);
      }
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(12, half - 5);
        this.addBox(2.2, 0.6, 1.1, Math.cos(a) * r, 0.3, Math.sin(a) * r, darkMat, true, a);
        this.addBox(2.2, 0.6, 1.1, Math.cos(a) * r, 0.9, Math.sin(a) * r + 0.3, darkMat, false, a);
      }
    } else if (m.theme === "jungle" || m.theme === "coastal") {
      const water = createWaterMesh(320, m.theme === "coastal" ? 0x1f6f8f : 0x2f6f4f);
      water.position.y = m.theme === "coastal" ? -0.35 : -0.5;
      this.scene.add(water);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(18, half + 22);
        palm(Math.cos(a) * r, Math.sin(a) * r);
      }
      if (this.settings.volumetric) {
        const grass = createGrassField(ARENA * 0.9, 0x3f7a3a);
        this.worldGroup.add(grass);
      }
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(18, half - 8);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        this.addBox(4, 0.3, 4, x, 1.9, z, new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 }));
        for (const [ox, oz] of [
          [-1.7, -1.7],
          [1.7, -1.7],
          [-1.7, 1.7],
          [1.7, 1.7],
        ] as [number, number][]) {
          const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2, 8), new THREE.MeshStandardMaterial({ color: 0x5a432a }));
          stilt.position.set(x + ox, 0.95, z + oz);
          this.worldGroup.add(stilt);
        }
      }
    } else if (m.theme === "temple") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 20;
        const z = Math.sin(a) * 20;
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.55, 10, 26), stoneMat);
        wheel.position.set(x, 3.3, z);
        wheel.rotation.y = a + Math.PI / 2;
        wheel.castShadow = true;
        this.worldGroup.add(wheel);
        for (let s = 0; s < 8; s++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6, 0.28), stoneMat);
          spoke.position.set(x, 3.3, z);
          spoke.rotation.set(0, a + Math.PI / 2, (s / 8) * Math.PI);
          this.worldGroup.add(spoke);
        }
        this.colliders.push({
          box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 3.3, z), new THREE.Vector3(6.4, 6.6, 1.4)),
        });
      }
      const shikhara = new THREE.Mesh(new THREE.ConeGeometry(6, 16, 6), stoneMat);
      shikhara.position.set(0, 15, -22);
      shikhara.castShadow = true;
      this.worldGroup.add(shikhara);
      this.addBox(16, 7, 16, 0, 3.5, -22, stoneMat);
    } else {
      // fort: ramps, galleries and jharokha balconies
      for (const sx of [-1, 1]) {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 20), stoneMat);
        ramp.position.set(sx * (half - 9), 3.2, 0);
        ramp.rotation.x = -0.32;
        ramp.castShadow = ramp.receiveShadow = true;
        this.worldGroup.add(ramp);
        for (let i = 0; i < 8; i++) {
          const step = 3.4 - i * 0.42;
          this.colliders.push({
            box: new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(sx * (half - 9), step / 2, -8 + i * 2.4),
              new THREE.Vector3(6, step, 2.6),
            ),
          });
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = -18 + i * 9;
        this.addBox(7, 5, 5, x, 2.5, -half + 8, stoneMat);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.5, 8, 16, Math.PI), accentMat);
        arch.position.set(x, 5, -half + 5.4);
        this.worldGroup.add(arch);
      }
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = rand(20, half - 6);
        const torch = new THREE.PointLight(0xff9a3c, 1.4, 14, 2);
        torch.position.set(Math.cos(a) * r, 3.4, Math.sin(a) * r);
        this.worldGroup.add(torch);
      }
    }
  }

  /* ---------------- weapons ------------------------------------------ */

  private buildViewScene() {
    this.viewScene.clear();
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.4, 2, 2);
    this.viewScene.add(key);
    const fill = new THREE.DirectionalLight(this.map.fog, 0.9);
    fill.position.set(-1.5, -0.5, -1);
    this.viewScene.add(fill);
    this.viewScene.add(new THREE.AmbientLight(0xffffff, 0.55));
    this.views = this.weapons.map((w) => {
      const vm = buildViewModel(w);
      vm.group.visible = false;
      this.viewScene.add(vm.group);
      return vm;
    });
  }

  private initLoadout() {
    this.ammo = this.weapons.map((w) => (w.category === "grenade" ? w.magSize : w.magSize));
    this.reserve = this.weapons.map((w) => w.reserve);
    this.wIndex = this.weapons.findIndex((w) => w.category !== "grenade" && w.category !== "melee");
    if (this.wIndex < 0) this.wIndex = 0;
    this.applyCharacter(true);
    this.updateViewVisibility();
  }

  private applyCharacter(initial: boolean) {
    const c = this.character;
    if (c.ability === "extra_armor") this.armor = Math.min(100, this.armor + c.abilityValue);
    if (initial) {
      if (c.ability === "damage_boost") this.damageBonus += c.abilityValue;
      if (c.ability === "speed_boost") this.damageBonus += 0.1;
    }
  }

  private get weapon() {
    return this.weapons[this.wIndex]!;
  }

  private get view() {
    return this.views[this.wIndex] ?? null;
  }

  private updateViewVisibility() {
    this.views.forEach((v, i) => {
      if (v) v.group.visible = i === this.wIndex;
    });
  }

  private moveSpeed() {
    let s = 5.6;
    if (this.character.ability === "speed_boost") s *= 1 + this.character.abilityValue;
    if (this.character.ability === "fast_reload") s *= 1.1;
    if (this.crouching) s *= 0.52;
    else if (this.keys.has("shiftleft") && !this.ads) s *= 1.55;
    if (this.ads) s *= 0.6;
    if (this.weapon.category === "melee") s *= 1.15;
    return s;
  }
