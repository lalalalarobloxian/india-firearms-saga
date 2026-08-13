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

/** Per-map arena layout so no two theatres are shaped alike. */
interface Layout {
  walls: "full" | "low" | "partial" | "none";
  bastions: boolean;
  pavilion: boolean;
  cover: number;
  /** spawn ring radius factor */
  ring: number;
}

const LAYOUTS: Record<string, Layout> = {
  amber: { walls: "full", bastions: true, pavilion: true, cover: 22, ring: 0.9 },
  jhansi: { walls: "full", bastions: true, pavilion: false, cover: 18, ring: 0.85 },
  redfort: { walls: "full", bastions: false, pavilion: true, cover: 14, ring: 0.92 },
  siachen: { walls: "none", bastions: false, pavilion: false, cover: 24, ring: 1 },
  thal: { walls: "low", bastions: false, pavilion: false, cover: 30, ring: 1 },
  kerala: { walls: "none", bastions: false, pavilion: false, cover: 16, ring: 0.95 },
  konark: { walls: "low", bastions: false, pavilion: false, cover: 12, ring: 0.95 },
  andaman: { walls: "partial", bastions: true, pavilion: false, cover: 20, ring: 1 },
};

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
  /** virtual axes fed by touch sticks / gamepad (-1..1) */
  private axisX = 0;
  private axisY = 0;
  private sprintHeld = false;
  private crouchHeld = false;
  private padPrev = new Map<number, boolean>();
  private padConnected = false;
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

    const layout = LAYOUTS[m.id] ?? LAYOUTS["amber"]!;
    const half = ARENA / 2;

    // perimeter walls with merlons (shape depends on the theatre)
    const wallH = layout.walls === "low" ? 2.6 : 9;
    const sides: [number, number][] =
      layout.walls === "none"
        ? []
        : layout.walls === "partial"
          ? [
              [0, -half],
              [-half, 0],
            ]
          : [
              [0, -half],
              [0, half],
              [-half, 0],
              [half, 0],
            ];
    for (const [dx, dz] of sides) {
      const horizontal = dz !== 0;
      const w = horizontal ? ARENA + 4 : 3;
      const d = horizontal ? 3 : ARENA + 4;
      this.addBox(w, wallH, d, dx, wallH / 2, dz, stoneMat);
      if (layout.walls === "low") continue;
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
    for (const [sx, sz] of (layout.bastions ? [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] : []) as [number, number][]) {
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

    // central pavilion — pillars + roof, gives vertical play
    if (layout.pavilion) {
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
    }

    // scattered cover crates / sandbags / rocks
    const coverMat = m.theme === "snow" || m.theme === "desert" ? darkMat : accentMat;
    for (let i = 0; i < layout.cover; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(14, half - 6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = rand(1.1, 2.4);
      this.addBox(rand(1.6, 3.2), h, rand(1.6, 3.2), x, h / 2, z, coverMat, true, Math.random() * Math.PI);
    }

    this.buildTheme(m, stoneMat, accentMat, darkMat);
    this.buildLandmarks(m, stoneMat, accentMat, darkMat);

    // spawn points around the ring
    this.spawnPoints = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = (half - 6) * layout.ring;
      this.spawnPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
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

  /**
   * Map-specific landmarks — the silhouette that makes each theatre read as a
   * different place even though the arena footprint is shared.
   */
  private buildLandmarks(
    m: MapDef,
    stoneMat: THREE.Material,
    accentMat: THREE.Material,
    darkMat: THREE.Material,
  ) {
    const half = ARENA / 2;
    const sandbagRing = (cx: number, cz: number, radius: number, rows: number) => {
      for (let r = 0; r < rows; r++) {
        const count = Math.floor(radius * 5);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + r * 0.2;
          this.addBox(
            1.5,
            0.55,
            0.85,
            cx + Math.cos(a) * radius,
            0.28 + r * 0.55,
            cz + Math.sin(a) * radius,
            darkMat,
            r === 0,
            a,
          );
        }
      }
    };

    if (m.id === "jhansi") {
      // granite keep with a cannon platform on each face
      this.addBox(18, 12, 18, 0, 6, -6, stoneMat);
      const merlonY = 12.6;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.addBox(1.6, 1.3, 1.6, Math.cos(a) * 9.4, merlonY, -6 + Math.sin(a) * 9.4, stoneMat, false);
      }
      for (const sx of [-1, 1]) {
        this.addBox(9, 2.2, 6, sx * 20, 1.1, 12, stoneMat);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 5.4, 14), darkMat);
        barrel.position.set(sx * 20, 2.9, 10.6);
        barrel.rotation.set(-Math.PI / 2 + 0.18, 0, 0);
        barrel.castShadow = true;
        this.worldGroup.add(barrel);
      }
    } else if (m.id === "redfort") {
      // Diwan-i-Aam: long scalloped arcade of sandstone bays
      for (let bay = 0; bay < 9; bay++) {
        const x = -24 + bay * 6;
        for (const z of [-14, 6]) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), stoneMat);
          col.position.set(x, 3.5, z);
          col.castShadow = true;
          this.worldGroup.add(col);
          this.colliders.push({
            box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 3.5, z), new THREE.Vector3(1.4, 7, 1.4)),
          });
          const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.42, 8, 18, Math.PI), accentMat);
          arch.position.set(x + 3, 7, z);
          this.worldGroup.add(arch);
        }
      }
      for (const z of [-14, 6]) this.addBox(56, 1.1, 4.4, 3, 7.9, z, stoneMat, false);
      this.addBox(12, 1.2, 12, 3, 0.6, -4, accentMat);
    } else if (m.id === "thal") {
      // Longewala post: sandbag horseshoe, burnt-out armour hulks, track
      sandbagRing(0, 6, 9, 3);
      for (let i = 0; i < 7; i++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(20, half - 3);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        this.addBox(6.4, 2, 3.2, x, 1, z, darkMat, true, a);
        this.addBox(3.2, 1.1, 2.6, x, 2.4, z, darkMat, false, a);
        const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.4, 10), darkMat);
        gun.position.set(x + Math.cos(a) * 3.2, 2.5, z + Math.sin(a) * 3.2);
        gun.rotation.set(Math.PI / 2, 0, -a);
        this.worldGroup.add(gun);
      }
    } else if (m.id === "siachen") {
      // glacier ridge line and an ice wall along the northern approach
      for (let i = 0; i < 26; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(rand(2, 5), rand(8, 22), 5),
          new THREE.MeshStandardMaterial({ color: 0xdfeaf4, roughness: 0.35, metalness: 0.05 }),
        );
        const a = rand(0, Math.PI * 2);
        const r = rand(half + 4, half + 46);
        spike.position.set(Math.cos(a) * r, rand(1, 5), Math.sin(a) * r);
        spike.castShadow = true;
        this.worldGroup.add(spike);
      }
      for (let i = 0; i < 8; i++) {
        this.addBox(7, 3.2, 2.6, -21 + i * 6, 1.6, -half + 6, new THREE.MeshStandardMaterial({ color: 0xeaf3fb, roughness: 0.4 }));
      }
      sandbagRing(0, 10, 6, 2);
    } else if (m.id === "kerala") {
      // backwater canal with moored snake boats
      for (let i = 0; i < 5; i++) {
        const hull = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.9, 12, 4, 10),
          new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 }),
        );
        const a = rand(0, Math.PI * 2);
        const r = rand(half - 12, half + 10);
        hull.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
        hull.rotation.set(Math.PI / 2, 0, a);
        hull.castShadow = true;
        this.worldGroup.add(hull);
      }
      for (let i = 0; i < 22; i++) {
        const reed = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, rand(2.4, 4.5), 5),
          new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.9 }),
        );
        reed.position.set(rand(-half, half), 1.4, rand(-half, half));
        this.worldGroup.add(reed);
      }
    } else if (m.id === "konark") {
      // stepped temple plinth with a stone chariot at the entrance
      for (let s = 0; s < 4; s++) {
        this.addBox(30 - s * 5, 1.1, 30 - s * 5, 0, 0.55 + s * 1.1, 0, stoneMat);
      }
      for (const sx of [-1, 1]) {
        const horse = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 5), stoneMat);
        horse.position.set(sx * 5, 5.4, 18);
        horse.castShadow = true;
        this.worldGroup.add(horse);
      }
    } else if (m.id === "andaman") {
      // coastal battery emplacements facing the water line
      for (let i = 0; i < 4; i++) {
        const x = -21 + i * 14;
        this.addBox(9, 2.6, 7, x, 1.3, half - 10, darkMat);
        const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 7, 12), darkMat);
        gun.position.set(x, 3.1, half - 14);
        gun.rotation.set(-Math.PI / 2 + 0.12, 0, 0);
        gun.castShadow = true;
        this.worldGroup.add(gun);
      }
      for (let i = 0; i < 30; i++) {
        this.addBox(2.2, 0.7, 1.2, rand(-half, half), 0.35, rand(-half, -half + 16), darkMat, true, rand(0, Math.PI));
      }
    } else {
      // amber: pillared hall (Diwan-i-Khas) plus a step-well courtyard
      for (let gx = 0; gx < 4; gx++) {
        for (let gz = 0; gz < 3; gz++) {
          const x = -18 + gx * 12;
          const z = -20 + gz * 10;
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 6, 10), stoneMat);
          col.position.set(x, 3, z);
          col.castShadow = true;
          this.worldGroup.add(col);
          this.colliders.push({
            box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 3, z), new THREE.Vector3(1.3, 6, 1.3)),
          });
        }
      }
      for (let s = 0; s < 5; s++) {
        this.addBox(16 - s * 2.4, 0.7, 16 - s * 2.4, 20, -0.35 - s * 0.7, 20, accentMat, false);
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
    else if ((this.keys.has("shiftleft") || this.sprintHeld) && !this.ads) s *= 1.55;
    if (this.ads) s *= 0.6;
    if (this.weapon.category === "melee") s *= 1.15;
    return s;
  }

  /* ---------------- input -------------------------------------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code.toLowerCase();
    this.keys.add(code);
    if (code === "keyb") {
      if (this.buyPhase) this.toggleBuy(!this.buyOpen);
      e.preventDefault();
      return;
    }
    if (this.buyOpen) return;
    if (code.startsWith("digit")) {
      const n = Number(code.slice(5)) - 1;
      if (n >= 0 && n < this.weapons.length) this.selectWeapon(n);
    }
    if (code === "keyr") this.startReload();
    if (code === "keyg") {
      const gi = this.weapons.findIndex((w) => w.category === "grenade");
      if (gi >= 0) this.selectWeapon(gi);
    }
    if (code === "keyv") {
      const mi = this.weapons.findIndex((w) => w.category === "melee");
      if (mi >= 0) this.selectWeapon(mi);
    }
    if (code === "space" && this.onGround && !this.dead) {
      this.vel.y = 7.4;
      this.onGround = false;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code.toLowerCase());

  private onMouseDown = (e: MouseEvent) => {
    if (this.buyOpen) return;
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) {
      this.rightDown = true;
      if (this.weapon.category !== "grenade") this.ads = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDown = false;
      if (this.weapon.category === "grenade" && this.throwCharge > 0) this.throwGrenade();
    }
    if (e.button === 2) {
      this.rightDown = false;
      this.ads = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    const sens = 0.0022 * this.settings.sensitivity * (this.ads ? 1 / Math.sqrt(this.weapon.zoom) : 1);
    this.yaw -= e.movementX * sens;
    this.pitch = clamp(this.pitch - e.movementY * sens, -1.5, 1.5);
  };

  private onWheel = (e: WheelEvent) => {
    if (this.buyOpen) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.selectWeapon((this.wIndex + dir + this.weapons.length) % this.weapons.length);
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = this.camera.aspect;
    this.viewCamera.updateProjectionMatrix();
    this.post?.setSize(w, h);
  };

  private attachInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  lock() {
    void this.renderer.domElement.requestPointerLock?.();
  }

  /* ---------------- touch + controller API ---------------------------- */

  /** left virtual stick / gamepad left stick, values -1..1 */
  setMoveAxis(x: number, y: number) {
    this.axisX = clamp(x, -1, 1);
    this.axisY = clamp(y, -1, 1);
    this.sprintHeld = Math.hypot(x, y) > 0.85;
  }

  /** touch look pad / right stick — pixels or scaled units */
  lookDelta(dx: number, dy: number) {
    const sens = 0.0045 * this.settings.sensitivity * (this.ads ? 1 / Math.sqrt(this.weapon.zoom) : 1);
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.5, 1.5);
  }

  setFire(down: boolean) {
    if (this.buyOpen) return;
    if (!down && this.mouseDown && this.weapon.category === "grenade" && this.throwCharge > 0) {
      this.throwGrenade();
    }
    this.mouseDown = down;
  }

  setAds(down: boolean) {
    this.ads = down && this.weapon.category !== "grenade";
  }

  setCrouch(down: boolean) {
    this.crouchHeld = down;
  }

  jump() {
    if (this.onGround && !this.dead) {
      this.vel.y = 7.4;
      this.onGround = false;
    }
  }

  reloadNow() {
    this.startReload();
  }

  cycleWeapon(dir: number) {
    this.selectWeapon((this.wIndex + dir + this.weapons.length) % this.weapons.length);
  }

  selectSlot(i: number) {
    if (i >= 0 && i < this.weapons.length) this.selectWeapon(i);
  }

  equipCategory(cat: "grenade" | "melee") {
    const i = this.weapons.findIndex((w) => w.category === cat);
    if (i >= 0) this.selectWeapon(i);
  }

  get hasController() {
    return this.padConnected;
  }

  private padButton(gp: Gamepad, index: number) {
    const pressed = !!gp.buttons[index]?.pressed;
    const was = this.padPrev.get(index) ?? false;
    this.padPrev.set(index, pressed);
    return { pressed, justPressed: pressed && !was };
  }

  private updateGamepad(dt: number) {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);
    this.padConnected = !!gp;
    if (!gp || this.buyOpen || this.dead) return;

    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dead(gp.axes[0] ?? 0);
    const ly = dead(gp.axes[1] ?? 0);
    if (lx || ly) this.setMoveAxis(lx, ly);
    else if (!this.touchActive) this.setMoveAxis(0, 0);

    const rx = dead(gp.axes[2] ?? 0);
    const ry = dead(gp.axes[3] ?? 0);
    if (rx || ry) {
      const speed = 260 * dt * (this.ads ? 0.55 : 1);
      this.lookDelta(rx * speed, ry * speed);
    }

    const rt = (gp.buttons[7]?.value ?? 0) > 0.35 || !!gp.buttons[7]?.pressed;
    const lt = (gp.buttons[6]?.value ?? 0) > 0.35 || !!gp.buttons[6]?.pressed;
    this.setFire(rt);
    this.setAds(lt);

    if (this.padButton(gp, 0).justPressed) this.jump();
    if (this.padButton(gp, 2).justPressed) this.reloadNow();
    if (this.padButton(gp, 1).justPressed) this.equipCategory("melee");
    if (this.padButton(gp, 3).justPressed) this.equipCategory("grenade");
    if (this.padButton(gp, 5).justPressed) this.cycleWeapon(1);
    if (this.padButton(gp, 4).justPressed) this.cycleWeapon(-1);
    this.setCrouch(!!gp.buttons[10]?.pressed);
  }

  /** true while a finger owns the movement stick, so the pad doesn't fight it */
  touchActive = false;

  private selectWeapon(i: number) {
    if (i === this.wIndex || this.dead) return;
    this.wIndex = i;
    this.reloading = false;
    this.ads = false;
    this.throwCharge = 0;
    this.updateViewVisibility();
    this.audio.noise(0.07, 0.14, 2600, 2);
  }

  /* ---------------- shooting ----------------------------------------- */

  private startReload() {
    const w = this.weapon;
    if (w.category === "grenade" || w.id === "khanda") return;
    if (this.reloading || this.ammo[this.wIndex]! >= w.magSize || this.reserve[this.wIndex]! <= 0) return;
    this.reloading = true;
    const speed = this.character.ability === "fast_reload" ? 1 - this.character.abilityValue : 1;
    this.reloadEnd = this.time + w.reloadTime * speed;
    this.audio.reload();
  }

  private finishReload() {
    const w = this.weapon;
    const need = w.magSize - this.ammo[this.wIndex]!;
    const take = Math.min(need, this.reserve[this.wIndex]!);
    this.ammo[this.wIndex]! += take;
    this.reserve[this.wIndex]! -= take;
    this.reloading = false;
  }

  private damageMultiplier() {
    return 1 + this.damageBonus;
  }

  private tryFire() {
    const w = this.weapon;
    if (this.dead || this.reloading || this.buyOpen) return;
    const interval = 60 / w.rpm;
    if (this.time - this.lastShot < interval) return;

    if (w.category === "grenade") {
      if (this.mouseDown) this.throwCharge = Math.min(1, this.throwCharge + 0.02);
      return;
    }
    if (w.id === "khanda") {
      this.lastShot = this.time;
      this.meleeSwing = 0.28;
      this.audio.swing();
      this.meleeHit(w);
      return;
    }
    if (this.ammo[this.wIndex]! <= 0) {
      this.startReload();
      return;
    }
    if (w.mode !== "auto" && this.lastShot > 0 && this.mouseHeldSince) return;

    this.lastShot = this.time;
    this.ammo[this.wIndex]! -= 1;
    this.shotsFired += 1;
    this.mouseHeldSince = w.mode !== "auto";
    this.audio.shot(w);
    this.muzzleLight.position.copy(this.pos);
    this.muzzleLight.intensity = 9;
    this.recoilPitch += w.recoil * (this.ads ? 0.55 : 1);
    this.recoilYaw += (Math.random() - 0.5) * w.recoil * 0.8;
    this.shake = Math.max(this.shake, w.kick * 0.4);

    const pellets = w.pellets ?? 1;
    const spread = this.ads ? w.adsSpread : w.spread;
    for (let p = 0; p < pellets; p++) this.fireRay(w, spread);
    if (w.mode === "bolt") this.boltCycle = 0.35;
    if (this.ammo[this.wIndex]! === 0) this.startReload();
  }

  private mouseHeldSince = false;
  private boltCycle = 0;

  private fireRay(w: WeaponDef, spread: number) {
    const dir = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0))
      .normalize();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    const origin = this.pos.clone();
    this.raycaster.set(origin, dir);
    this.raycaster.far = w.range;

    const targets: THREE.Object3D[] = [];
    for (const e of this.enemies) if (!e.dead) targets.push(e.hitBody, e.hitHead);
    const hits = this.raycaster.intersectObjects(targets, false);
    const worldHits = this.raycaster.intersectObjects(this.worldGroup.children, true);
    const worldDist = worldHits[0]?.distance ?? Infinity;

    const hit = hits[0];
    if (hit && hit.distance < worldDist) {
      const enemy = this.enemies.find((e) => e.hitBody === hit.object || e.hitHead === hit.object);
      if (enemy) {
        const head = hit.object === enemy.hitHead;
        const falloff = clamp(1 - hit.distance / w.range, 0.42, 1);
        const dmg = w.damage * (head ? w.headMult : 1) * falloff * this.damageMultiplier();
        this.shotsHit += 1;
        this.hitmark = 0.16;
        this.audio.hit(head);
        this.damageEnemy(enemy, dmg, head, hit.point);
      }
      this.spawnTracer(origin, hit.point);
    } else if (worldHits[0]) {
      this.spawnTracer(origin, worldHits[0].point);
      this.spawnImpact(worldHits[0].point, worldHits[0].face?.normal ?? new THREE.Vector3(0, 1, 0));
    } else {
      this.spawnTracer(origin, origin.clone().add(dir.multiplyScalar(w.range)));
    }
  }

  private meleeHit(w: WeaponDef) {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0));
    let landed = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = e.h.root.position.clone().setY(this.pos.y).sub(this.pos);
      const dist = to.length();
      if (dist > w.range) continue;
      if (forward.dot(to.normalize()) < 0.45) continue;
      landed = true;
      this.shotsFired += 1;
      this.shotsHit += 1;
      this.hitmark = 0.2;
      this.damageEnemy(e, w.damage * this.damageMultiplier(), false, e.h.root.position.clone().setY(1.4));
      this.audio.hit(false);
    }
    if (!landed) this.shotsFired += 1;
  }

  /* ---------------- grenades ------------------------------------------ */

  private throwGrenade() {
    const w = this.weapon;
    if (this.ammo[this.wIndex]! <= 0) {
      this.throwCharge = 0;
      return;
    }
    this.ammo[this.wIndex]! -= 1;
    const power = 12 + this.throwCharge * 14;
    this.throwCharge = 0;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch + 0.12, this.yaw, 0));
    const origin = this.pos.clone().add(dir.clone().multiplyScalar(0.7));
    this.spawnGrenade(origin, dir.multiplyScalar(power), w);
    this.audio.noise(0.15, 0.2, 1400, 2);
    this.net?.sendEvent({
      type: "grenade",
      x: origin.x,
      y: origin.y,
      z: origin.z,
      vx: dir.x * power,
      vy: dir.y * power,
      vz: dir.z * power,
      kind: w.id,
    } as Omit<NetEvent, "from">);
    this.lastShot = this.time;
  }

  private spawnGrenade(origin: THREE.Vector3, vel: THREE.Vector3, w: WeaponDef) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      w.id === "smoke" ? new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12) : new THREE.SphereGeometry(0.08, 12, 10),
      new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.45, metalness: 0.6 }),
    );
    group.add(body);
    group.position.copy(origin);
    this.scene.add(group);
    this.projectiles.push({ mesh: group, vel: vel.clone(), fuse: w.fuse ?? 3, weapon: w });
  }

  private explode(pos: THREE.Vector3, w: WeaponDef) {
    if (w.id === "smoke") {
      this.spawnSmoke(pos, w.blastRadius ?? 8);
      this.audio.noise(0.8, 0.4, 700, 1.2);
      return;
    }
    this.audio.explode();
    const radius = w.blastRadius ?? 8;
    const flash = new THREE.PointLight(0xffb060, 40, radius * 4, 2);
    flash.position.copy(pos);
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 120);

    for (let i = 0; i < 34; i++) {
      this.spawnParticle(pos, 0xffb347, rand(0.08, 0.22), rand(6, 16), 0.6, 12);
    }
    for (let i = 0; i < 20; i++) {
      this.spawnParticle(pos, 0x4a4a4a, rand(0.1, 0.3), rand(2, 6), 1.4, 3);
    }

    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.h.root.position.distanceTo(pos);
      if (d < radius) {
        const dmg = w.damage * (1 - d / radius) * this.damageMultiplier();
        this.damageEnemy(e, dmg, false, e.h.root.position.clone().setY(1.2));
      }
    }
    const pd = this.pos.distanceTo(pos);
    if (pd < radius) {
      this.takeDamage(w.damage * 0.5 * (1 - pd / radius));
      this.shake = Math.max(this.shake, 0.7);
    }
    this.shake = Math.max(this.shake, clamp(1 - pd / (radius * 2), 0, 0.8));
  }

  private spawnSmoke(pos: THREE.Vector3, radius: number) {
    const count = 240;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * radius * 0.8;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = pos.x + Math.cos(a) * r;
      positions[i * 3 + 1] = pos.y + Math.random() * radius * 0.6;
      positions[i * 3 + 2] = pos.z + Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xd8d8d8, size: 2.4, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.scene.add(points);
    this.smokes.push({ pos: pos.clone(), radius, life: 14, points });
  }

  /* ---------------- particles & impacts ------------------------------- */

  private spawnParticle(pos: THREE.Vector3, color: number, size: number, speed: number, life: number, gravity: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vel: new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(speed),
      life,
      gravity,
      spin: rand(-8, 8),
    });
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.75 }),
    );
    this.scene.add(line);
    let opacity = 0.75;
    const fade = () => {
      opacity -= 0.12;
      (line.material as THREE.LineBasicMaterial).opacity = opacity;
      if (opacity <= 0 || this.disposed) {
        this.scene.remove(line);
        geo.dispose();
      } else requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  private spawnImpact(point: THREE.Vector3, normal: THREE.Vector3) {
    for (let i = 0; i < 5; i++) this.spawnParticle(point, 0xbfae90, 0.05, rand(1.5, 4), 0.6, 9);
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.07, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1512, transparent: true, opacity: 0.85 }),
    );
    decal.position.copy(point).add(normal.clone().multiplyScalar(0.02));
    decal.lookAt(point.clone().add(normal));
    this.scene.add(decal);
    this.decals.push(decal);
    if (this.decals.length > 90) {
      const old = this.decals.shift();
      if (old) this.scene.remove(old);
    }
  }

  /* ---------------- enemies & waves ----------------------------------- */

  private enemyStyleForWave(wave: number) {
    const t = this.map.theme;
    const era = t === "snow" ? "modern" : t === "desert" ? "modern" : t === "fort" || t === "temple" ? "historic" : "colonial";
    if (era === "modern") {
      return {
        cloth: 0x4a5340,
        skin: 0x8a5a3b,
        accent: 0x2a2f24,
        head: "helmet" as const,
        weapon: (wave % 4 === 0 ? "lmg" : "rifle") as "lmg" | "rifle",
        names: ["Rifleman", "Marksman", "Support Gunner"],
      };
    }
    if (era === "colonial") {
      return {
        cloth: 0x8c3a34,
        skin: 0x8a5a3b,
        accent: 0xd9c49a,
        head: "cap" as const,
        weapon: "rifle" as const,
        names: ["Sepoy", "Line Infantry", "Skirmisher"],
      };
    }
    return {
      cloth: 0x3f4a63,
      skin: 0x8a5a3b,
      accent: 0xc9a227,
      head: (Math.random() < 0.5 ? "turban" : "helmet") as "turban" | "helmet",
      weapon: (Math.random() < 0.35 ? "sword" : "musket") as "sword" | "musket",
      names: ["Musketeer", "Fort Guard", "Swordsman"],
    };
  }

  private spawnEnemy() {
    const style = this.enemyStyleForWave(this.wave);
    const melee = style.weapon === "sword";
    const h = buildHumanoid({
      cloth: style.cloth,
      skin: style.skin,
      accent: style.accent,
      head: style.head,
      weapon: style.weapon,
      scale: rand(0.96, 1.06),
    });
    const spawn = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)]!;
    h.root.position.copy(spawn).add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3)));
    this.scene.add(h.root);

    const hitBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.38, 0.9, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitBody.position.y = 1.15;
    h.root.add(hitBody);
    const hitHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitHead.position.y = 1.72;
    h.root.add(hitHead);

    const diff = this.mission.difficulty;
    const scale = 1 + (this.wave - 1) * 0.12;
    const maxHp = (melee ? 130 : 100) * diff * Math.min(scale, 3);
    this.enemies.push({
      h,
      hitBody,
      hitHead,
      hp: maxHp,
      maxHp,
      speed: (melee ? 4.6 : 3.1) * rand(0.9, 1.15),
      fireCooldown: rand(0.5, 2.2),
      burst: 0,
      damage: (melee ? 22 : 9) * diff,
      accuracy: clamp(0.34 + this.wave * 0.03, 0.3, 0.78),
      range: melee ? 2.2 : 60,
      strafe: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: rand(0.8, 2.4),
      dead: false,
      deathTime: 0,
      name: style.names[Math.floor(Math.random() * style.names.length)] ?? "Hostile",
      reward: melee ? 120 : 90,
      melee,
    });
  }

  private damageEnemy(e: Enemy, dmg: number, head: boolean, at: THREE.Vector3) {
    e.hp -= dmg;
    for (let i = 0; i < 6; i++) this.spawnParticle(at, 0x8c1c1c, 0.06, rand(2, 5), 0.5, 10);
    if (e.hp > 0) return;
    e.dead = true;
    e.deathTime = this.time;
    e.h.root.rotation.z = rand(-0.4, 0.4);
    this.kills += 1;
    if (head) this.headshots += 1;
    this.score += head ? 150 : 100;
    const gain = e.reward * (this.character.ability === "double_currency" ? 1 + this.character.abilityValue : 1);
    this.cash += Math.round(gain);
    this.earned += Math.round(gain * 0.5);
    this.waveEnemiesLeft = Math.max(0, this.waveEnemiesLeft - 1);
    this.pushFeed(`${this.playerName} ▸ ${e.name}`, head);
    this.net?.sendEvent({ type: "kill", name: this.playerName, target: e.name, head } as Omit<NetEvent, "from">);
    this.audio.pickup();
  }

  private pushFeed(text: string, head: boolean) {
    this.killfeed = [{ id: ++this.feedId, text, head }, ...this.killfeed].slice(0, 5);
  }

  private takeDamage(dmg: number) {
    if (this.dead) return;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.6);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.lowHealth = 0.5;
    this.audio.hurt();
    this.shake = Math.max(this.shake, 0.25);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.finishRun();
      document.exitPointerLock?.();
      this.net?.sendEvent({ type: "down", name: this.playerName } as Omit<NetEvent, "from">);
    }
  }

  private startWave() {
    this.buyPhase = false;
    this.buyOpen = false;
    const count = Math.min(24, 4 + this.wave * 2);
    this.spawnQueue = count;
    this.waveEnemiesLeft = count;
    this.spawnTimer = 0;
    this.banner = `WAVE ${this.wave} · ${this.mission.faction.toUpperCase()}`;
    this.bannerUntil = this.time + 2.6;
    this.audio.wave();
    this.applyCharacter(false);
  }

  private endWave() {
    this.wave += 1;
    if (this.mode === "mission" && this.wave > this.mission.waves) {
      this.won = true;
      this.dead = true;
      this.earned += this.mission.reward;
      this.finishRun();
      document.exitPointerLock?.();
      return;
    }
    this.cash += 300 + this.wave * 60;
    this.earned += 120 + this.wave * 25;
    this.buyPhase = true;
    this.buyTimer = 15;
    this.banner = "WAVE CLEARED · PRESS B TO BUY";
    this.bannerUntil = this.time + 3.4;
    this.bankProgress();
    if (this.net?.isHost) this.net.sendEvent({ type: "wave", wave: this.wave } as Omit<NetEvent, "from">);
  }

  private finished = false;
  private banked = 0;
  private bankedKills = 0;
  private bankedWaves = 0;

  /** Banks whatever has been earned so far — running this every wave means a
   *  death can never wipe out a whole session's progress. */
  private bankProgress() {
    const cash = Math.round(this.earned) - this.banked;
    const kills = this.kills - this.bankedKills;
    const waves = Math.max(0, this.wave - 1) - this.bankedWaves;
    if (cash <= 0 && kills <= 0 && waves <= 0) return;
    this.banked += Math.max(0, cash);
    this.bankedKills += Math.max(0, kills);
    this.bankedWaves += Math.max(0, waves);
    void import("./economy").then(({ bankEarnings }) =>
      bankEarnings(Math.max(0, cash), Math.max(0, kills), Math.max(0, waves)),
    );
  }

  private finishRun() {
    if (this.finished) return;
    this.finished = true;
    void import("./economy").then(({ recordGameResult }) =>
      recordGameResult({
        currencyEarned: Math.max(0, Math.round(this.earned) - this.banked),
        kills: Math.max(0, this.kills - this.bankedKills),
        waves: Math.max(0, Math.max(0, this.wave - 1) - this.bankedWaves),
        score: this.score,
      }),
    );
    this.banked = Math.round(this.earned);
    this.bankedKills = this.kills;
    this.bankedWaves = Math.max(0, this.wave - 1);
  }

  /* ---------------- shop ---------------------------------------------- */

  toggleBuy(open: boolean) {
    if (!this.buyPhase && open) return;
    this.buyOpen = open;
    if (open) document.exitPointerLock?.();
    else this.lock();
    this.emitHud(true);
  }

  buy(itemId: string): boolean {
    const item = ROUND_SHOP.find((i) => i.id === itemId);
    if (!item || this.cash < item.price) return false;
    this.cash -= item.price;
    if (item.id === "armor") this.armor = Math.min(100, this.armor + 100);
    if (item.id === "health") this.hp = 100;
    if (item.id === "ammo") this.reserve = this.weapons.map((w, i) => Math.max(this.reserve[i] ?? 0, w.reserve));
    if (item.id === "frag" || item.id === "smoke") {
      const wid = item.id === "frag" ? "grenade36" : "smoke";
      let idx = this.weapons.findIndex((w) => w.id === wid);
      if (idx < 0) {
        const def = ALL_WEAPONS.find((w) => w.id === wid);
        if (def) {
          this.weapons.push(def);
          this.ammo.push(0);
          this.reserve.push(0);
          const vm = buildViewModel(def);
          vm.group.visible = false;
          this.viewScene.add(vm.group);
          this.views.push(vm);
          idx = this.weapons.length - 1;
        }
      }
      if (idx >= 0) this.ammo[idx] = (this.ammo[idx] ?? 0) + 2;
    }
    if (item.id === "damage") this.damageBonus += 0.1;
    this.audio.pickup();
    this.emitHud(true);
    return true;
  }

  /* ---------------- multiplayer --------------------------------------- */

  handleNetEvent(e: NetEvent) {
    if (e.type === "kill") this.pushFeed(`${e.name} ▸ ${e.target}`, e.head);
    if (e.type === "down") this.pushFeed(`${e.name} is down`, false);
    if (e.type === "wave" && !this.net?.isHost && e.wave > this.wave) {
      this.wave = e.wave;
      this.buyPhase = true;
      this.buyTimer = 15;
    }
    if (e.type === "grenade") {
      const def = ALL_WEAPONS.find((w) => w.id === e.kind);
      if (def)
        this.spawnGrenade(new THREE.Vector3(e.x, e.y, e.z), new THREE.Vector3(e.vx, e.vy, e.vz), def);
    }
  }

  private nameSprite(text: string, color: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    ctx.font = "600 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text.slice(0, 14), 128, 42);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }),
    );
    sprite.scale.set(2.6, 0.65, 1);
    sprite.position.y = 2.3;
    return sprite;
  }

  private syncPeers(dt: number) {
    const net = this.net;
    if (!net) return;
    net.sendState({
      x: this.pos.x,
      y: this.pos.y - 1.7,
      z: this.pos.z,
      yaw: this.yaw,
      hp: this.hp,
      armor: this.armor,
      weapon: this.weapon.name,
      kills: this.kills,
      down: this.dead,
      moving: this.vel.length(),
      aiming: this.ads,
    });

    for (const [id, peer] of net.peers) {
      let avatar = this.avatars.get(id);
      if (!avatar) {
        const character = CHARACTERS.find((c) => c.id === peer.character) ?? CHARACTERS[0]!;
        const h = buildHumanoid({
          cloth: character.accent,
          skin: 0x8a5a3b,
          accent: 0xf1f5f9,
          head: "pagri",
          weapon: "rifle",
        });
        const label = this.nameSprite(peer.name, 0x8ce99a);
        h.root.add(label);
        this.scene.add(h.root);
        avatar = { h, label, target: new THREE.Vector3(peer.x, peer.y, peer.z) };
        this.avatars.set(id, avatar);
      }
      avatar.target.set(peer.x, peer.y, peer.z);
      avatar.h.root.position.lerp(avatar.target, clamp(dt * 10, 0, 1));
      avatar.h.root.rotation.y = peer.yaw + Math.PI;
      avatar.h.root.visible = !peer.down;
      animateHumanoid(avatar.h, peer.moving, this.time, peer.aiming);
      this.peerKills.set(id, peer.kills);
    }
    for (const [id, avatar] of this.avatars) {
      if (!net.peers.has(id)) {
        this.scene.remove(avatar.h.root);
        this.avatars.delete(id);
      }
    }
  }

  /* ---------------- simulation ---------------------------------------- */

  private losBlocked(from: THREE.Vector3, to: THREE.Vector3) {
    for (const s of this.smokes) {
      const line = to.clone().sub(from);
      const t = clamp(s.pos.clone().sub(from).dot(line) / line.lengthSq(), 0, 1);
      const closest = from.clone().add(line.multiplyScalar(t));
      if (closest.distanceTo(s.pos) < s.radius * 0.7) return true;
    }
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    this.raycaster.set(from, dir);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.worldGroup.children, true);
    return hits.length > 0 && (hits[0]?.distance ?? dist) < dist - 0.6;
  }

  private movePlayer(dt: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has("keyw")) wish.add(forward);
    if (this.keys.has("keys")) wish.sub(forward);
    if (this.keys.has("keya")) wish.sub(right);
    if (this.keys.has("keyd")) wish.add(right);
    if (this.axisX || this.axisY) {
      wish.add(right.clone().multiplyScalar(this.axisX));
      wish.add(forward.clone().multiplyScalar(-this.axisY));
    }
    this.crouching = this.keys.has("controlleft") || this.keys.has("keyc") || this.crouchHeld;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(this.moveSpeed());

    const accel = this.onGround ? 14 : 4;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, accel * dt);
    this.vel.y -= 22 * dt;

    const step = this.vel.clone().multiplyScalar(dt);
    const radius = 0.4;
    const eye = this.crouching ? 1.15 : 1.7;

    // axis-separated collision resolution
    for (const axis of ["x", "z"] as const) {
      const next = this.pos.clone();
      next[axis] += step[axis];
      const feet = next.y - eye;
      const boxPlayer = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(next.x, feet + 0.9, next.z),
        new THREE.Vector3(radius * 2, 1.8, radius * 2),
      );
      let blocked = false;
      for (const c of this.colliders) {
        if (c.box.intersectsBox(boxPlayer) && c.box.max.y - feet > 0.55) {
          blocked = true;
          break;
        }
      }
      if (!blocked) this.pos[axis] = next[axis];
      else this.vel[axis] = 0;
    }

    // vertical
    this.pos.y += step.y;
    let groundY = 0;
    const feetBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(this.pos.x, this.pos.y - eye + 0.2, this.pos.z),
      new THREE.Vector3(radius * 2, 0.5, radius * 2),
    );
    for (const c of this.colliders) {
      if (
        this.pos.x > c.box.min.x - radius &&
        this.pos.x < c.box.max.x + radius &&
        this.pos.z > c.box.min.z - radius &&
        this.pos.z < c.box.max.z + radius &&
        c.box.max.y <= this.pos.y - eye + 0.6
      ) {
        groundY = Math.max(groundY, c.box.max.y);
      }
    }
    void feetBox;
    if (this.pos.y - eye <= groundY) {
      this.pos.y = groundY + eye;
      this.vel.y = 0;
      this.onGround = true;
    } else this.onGround = false;

    const lim = ARENA / 2 - 2.4;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.dead) {
        e.h.root.position.y = Math.max(0.15, e.h.root.position.y - dt * 2.5);
        e.h.root.rotation.x = Math.min(Math.PI / 2, e.h.root.rotation.x + dt * 3);
        continue;
      }
      const toPlayer = this.pos.clone().setY(e.h.root.position.y).sub(e.h.root.position);
      const dist = toPlayer.length();
      toPlayer.normalize();
      const sees = !this.dead && dist < e.range && !this.losBlocked(
        e.h.root.position.clone().setY(1.5),
        this.pos.clone(),
      );

      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafe *= -1;
        e.strafeTimer = rand(0.9, 2.6);
      }

      const desired = new THREE.Vector3();
      const keep = e.melee ? 1.6 : 16;
      if (dist > keep) desired.add(toPlayer);
      else if (dist < keep * 0.6) desired.sub(toPlayer);
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(e.strafe * (sees ? 0.8 : 0.2));
      desired.add(side);
      if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(e.speed * dt);

      const next = e.h.root.position.clone().add(desired);
      const nb = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(next.x, next.y + 0.9, next.z),
        new THREE.Vector3(0.8, 1.8, 0.8),
      );
      let blocked = false;
      for (const c of this.colliders) {
        if (c.box.intersectsBox(nb) && c.box.max.y > next.y + 0.5) {
          blocked = true;
          break;
        }
      }
      if (!blocked) e.h.root.position.copy(next);
      else e.h.root.position.add(side.multiplyScalar(dt * e.speed));
      e.h.root.position.y = 0;

      e.h.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
      animateHumanoid(e.h, desired.length() / Math.max(dt, 0.001), this.time, sees && !e.melee);

      if (!sees) continue;
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        if (e.melee) {
          if (dist < 2.6) {
            this.takeDamage(e.damage);
            this.audio.swing();
            e.fireCooldown = 1.1;
          } else e.fireCooldown = 0.3;
        } else {
          e.fireCooldown = rand(0.9, 2.1);
          const hitChance = e.accuracy * clamp(1 - dist / 90, 0.3, 1) * (this.crouching ? 0.85 : 1);
          this.spawnTracer(e.h.root.position.clone().setY(1.4), this.pos.clone().add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))));
          this.audio.noise(0.12, 0.16, 2400, 3);
          if (Math.random() < hitChance) this.takeDamage(e.damage);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => {
      if (e.dead && this.time - e.deathTime > 8) {
        this.scene.remove(e.h.root);
        return false;
      }
      return true;
    });
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.vel.y -= 20 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.x += dt * 6;
      if (p.mesh.position.y < 0.08) {
        p.mesh.position.y = 0.08;
        p.vel.y *= -0.35;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.fuse -= dt;
      if (p.fuse <= 0) {
        this.explode(p.mesh.position.clone(), p.weapon);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]!;
      s.life -= dt;
      const mat = s.points.material as THREE.PointsMaterial;
      mat.opacity = clamp(s.life / 4, 0, 0.55);
      if (s.life <= 0) {
        this.scene.remove(s.points);
        this.smokes.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.rotation.x += p.spin * dt;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = clamp(p.life, 0, 1);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private updateViewModel(dt: number) {
    const vm = this.view;
    if (!vm) return;
    const w = this.weapon;
    const sway = this.vel.length() * 0.006;
    const bob = Math.sin(this.time * 9) * sway;
    const targetPos = this.ads
      ? new THREE.Vector3(0, w.scoped ? -0.135 : -0.075, -0.16)
      : new THREE.Vector3(0.19, -0.19, -0.3);
    if (this.meleeSwing > 0) {
      this.meleeSwing -= dt;
      targetPos.x -= Math.sin(this.meleeSwing * 12) * 0.35;
      targetPos.y += Math.sin(this.meleeSwing * 9) * 0.2;
    }
    if (this.throwCharge > 0) targetPos.z += 0.16 * this.throwCharge;
    vm.group.position.lerp(targetPos.add(new THREE.Vector3(bob, bob * 0.5, 0)), clamp(dt * 12, 0, 1));
    const targetRot = new THREE.Euler(
      this.recoilPitch * 3 + (this.reloading ? 0.5 : 0) + (this.throwCharge > 0 ? -0.6 * this.throwCharge : 0),
      this.ads ? 0 : -0.06 + this.recoilYaw,
      this.reloading ? 0.45 : this.meleeSwing > 0 ? -0.8 : 0,
    );
    vm.group.rotation.x += (targetRot.x - vm.group.rotation.x) * clamp(dt * 10, 0, 1);
    vm.group.rotation.y += (targetRot.y - vm.group.rotation.y) * clamp(dt * 10, 0, 1);
    vm.group.rotation.z += (targetRot.z - vm.group.rotation.z) * clamp(dt * 10, 0, 1);
    if (vm.bolt) {
      this.boltCycle = Math.max(0, this.boltCycle - dt);
      vm.bolt.position.z = -w.length * 0.2 + this.boltCycle * 0.35;
    }
  }

  /* ---------------- HUD ----------------------------------------------- */

  private emitHud(force = false) {
    if (!force && this.time - this.hudTime < 0.08) return;
    this.hudTime = this.time;
    const w = this.weapon;
    const teammates: HudTeammate[] = [
      {
        name: this.playerName,
        character: this.character.name,
        hp: this.hp,
        kills: this.kills,
        down: this.dead,
        self: true,
      },
    ];
    if (this.net) {
      for (const [, p] of this.net.peers) {
        teammates.push({ name: p.name, character: p.character, hp: p.hp, kills: p.kills, down: p.down, self: false });
      }
    }
    this.onHud({
      hp: Math.round(this.hp),
      armor: Math.round(this.armor),
      ammo: this.ammo[this.wIndex] ?? 0,
      reserve: this.reserve[this.wIndex] ?? 0,
      weapon: w.name,
      weaponEra: w.era,
      slots: this.weapons.map((wp, i) => ({
        id: wp.id,
        name: wp.name,
        ammo: this.ammo[i] ?? 0,
        reserve: this.reserve[i] ?? 0,
        grenade: wp.category === "grenade",
        melee: wp.category === "melee",
        active: i === this.wIndex,
      })),
      wave: this.wave,
      waveTotal: this.mode === "mission" ? this.mission.waves : 0,
      enemies: this.enemies.filter((e) => !e.dead).length + this.spawnQueue,
      kills: this.kills,
      headshots: this.headshots,
      accuracy: this.shotsFired ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0,
      score: this.score,
      cash: Math.round(this.cash),
      earned: Math.round(this.earned),
      dead: this.dead && !this.won,
      won: this.won,
      reloading: this.reloading,
      hitmark: this.hitmark,
      killfeed: this.killfeed,
      banner: this.bannerUntil > this.time ? this.banner : null,
      objective: this.mission.objective,
      mission: this.mission.name,
      character: this.character.name,
      buyPhase: this.buyPhase,
      buyTime: Math.max(0, Math.ceil(this.buyTimer)),
      teammates,
      fps: this.fps,
      showFps: this.settings.showFps,
      zoom: this.ads ? w.zoom : 1,
      scoped: !!w.scoped && this.ads,
      lowHealth: this.lowHealth,
    });
  }

  /* ---------------- loop ---------------------------------------------- */

  private animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    this.frames += 1;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.frames = 0;
      this.fpsTime = 0;
    }

    if (!this.mouseDown) this.mouseHeldSince = false;
    this.hitmark = Math.max(0, this.hitmark - dt);
    this.lowHealth = Math.max(0, this.lowHealth - dt * 0.8);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.recoilPitch *= 1 - Math.min(1, dt * 7);
    this.recoilYaw *= 1 - Math.min(1, dt * 7);
    this.muzzleLight.intensity *= 1 - Math.min(1, dt * 14);
    this.updateGamepad(dt);

    if (!this.dead && !this.buyOpen) {
      this.movePlayer(dt);
      if (this.mouseDown) this.tryFire();
      if (this.reloading && this.time >= this.reloadEnd) this.finishReload();
      if (this.character.ability === "health_regen" && this.hp < 80) {
        this.hp = Math.min(80, this.hp + this.character.abilityValue * dt);
      }
    }

    // wave state machine
    if (!this.dead) {
      if (this.buyPhase) {
        this.buyTimer -= dt;
        if (this.buyTimer <= 0) this.startWave();
      } else {
        if (this.spawnQueue > 0) {
          this.spawnTimer -= dt;
          if (this.spawnTimer <= 0 && this.enemies.filter((e) => !e.dead).length < 14) {
            this.spawnEnemy();
            this.spawnQueue -= 1;
            this.spawnTimer = rand(0.5, 1.4);
          }
        } else if (this.enemies.every((e) => e.dead)) {
          this.endWave();
        }
      }
    }

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateViewModel(dt);
    this.syncPeers(dt);
    updateShaderMeshes(this.scene, this.time, dt);

    // camera
    const shake = this.shake;
    this.camera.position.copy(this.pos).add(
      new THREE.Vector3(rand(-shake, shake) * 0.3, rand(-shake, shake) * 0.3, 0),
    );
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw + this.recoilYaw, 0, "YXZ");
    const targetFov = this.settings.fov / (this.ads ? this.weapon.zoom : 1);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    this.renderer.clear();
    if (this.post) {
      this.post.setScene(this.scene, this.camera);
      this.post.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.renderer.clearDepth();
    if (!(this.weapon.scoped && this.ads)) this.renderer.render(this.viewScene, this.viewCamera);

    this.emitHud();
  };

  /* ---------------- lifecycle ----------------------------------------- */

  restart() {
    this.enemies.forEach((e) => this.scene.remove(e.h.root));
    this.enemies = [];
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.smokes.forEach((s) => this.scene.remove(s.points));
    this.smokes = [];
    this.hp = 100;
    this.armor = 0;
    this.dead = false;
    this.won = false;
    this.finished = false;
    this.wave = 1;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.score = 0;
    this.cash = 800;
    this.earned = 0;
    this.banked = 0;
    this.bankedKills = 0;
    this.bankedWaves = 0;
    this.killfeed = [];
    this.buyPhase = true;
    this.buyTimer = 8;
    this.initLoadout();
    this.pos.set(0, 1.7, 18);
    this.vel.set(0, 0, 0);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    document.exitPointerLock?.();
    this.post?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
