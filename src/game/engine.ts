import * as THREE from "three";
import { WEAPONS, MAPS, type WeaponDef, type MapDef } from "./weapons";
import { groundTexture, skyTexture, stoneTexture } from "./textures";

export interface HudState {
  health: number;
  armor: number;
  mag: number;
  reserve: number;
  weapon: string;
  weaponIndex: number;
  caliber: string;
  reloading: boolean;
  wave: number;
  enemiesLeft: number;
  score: number;
  kills: number;
  headshots: number;
  accuracy: number;
  ads: boolean;
  dead: boolean;
  waveBanner: string | null;
  feed: { id: number; text: string; head: boolean }[];
  hitAt: number;
  killAt: number;
  hurtAt: number;
}

type Collider = { box: THREE.Box3 };

interface Enemy {
  root: THREE.Group;
  head: THREE.Mesh;
  body: THREE.Mesh;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  fireDelay: number;
  cd: number;
  accuracy: number;
  name: string;
  dead: boolean;
  deadAt: number;
  vel: THREE.Vector3;
  strafe: number;
  strafeT: number;
}

const PLAYER_HEIGHT = 1.68;
const CROUCH_HEIGHT = 1.05;
const PLAYER_RADIUS = 0.36;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private container: HTMLElement;
  private onHud: (s: HudState) => void;
  private disposed = false;

  private colliders: Collider[] = [];
  private worldMeshes: THREE.Object3D[] = [];
  private enemies: Enemy[] = [];
  private spawnPoints: THREE.Vector3[] = [];
  private mapDef: MapDef;

  // player
  private pos = new THREE.Vector3(0, PLAYER_HEIGHT, 34);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = true;
  private crouch = false;
  private eye = PLAYER_HEIGHT;
  private health = 100;
  private armor = 50;
  private dead = false;
  private bob = 0;

  // weapons
  private wIndex = 0;
  private mags: number[] = [];
  private reserves: number[] = [];
  private lastShot = 0;
  private reloadEnd = 0;
  private reloading = false;
  private ads = false;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private punch = 0;
  private viewModel = new THREE.Group();
  private muzzle = new THREE.Object3D();
  private muzzleLight: THREE.PointLight;
  private muzzleFlash: THREE.Mesh;
  private flashUntil = 0;

  // stats
  private wave = 0;
  private score = 0;
  private kills = 0;
  private headshots = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private feed: { id: number; text: string; head: boolean }[] = [];
  private feedId = 0;
  private waveBanner: string | null = null;
  private bannerUntil = 0;
  private betweenWaves = 0;
  private hitAt = 0;
  private killAt = 0;
  private hurtAt = 0;

  private keys = new Set<string>();
  private mouseDown = false;
  private semiLatch = false;
  private tracers: { mesh: THREE.Line; until: number }[] = [];
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; until: number; g: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private audio: AudioContext | null = null;

  private raycaster = new THREE.Raycaster();
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement, mapId: string, onHud: (s: HudState) => void) {
    this.container = container;
    this.onHud = onHud;
    this.mapDef = MAPS.find((m) => m.id === mapId) ?? MAPS[0]!;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(90, container.clientWidth / container.clientHeight, 0.05, 800);
    this.camera.add(this.viewModel);
    this.scene.add(this.camera);
    // gentle fill light so the weapon model reads against dark scenes
    const viewLight = new THREE.PointLight(0xfff0d8, 3.2, 6, 2);
    viewLight.position.set(0.3, 0.25, 0.2);
    this.camera.add(viewLight);

    this.muzzleLight = new THREE.PointLight(0xffb257, 0, 14, 2);
    this.scene.add(this.muzzleLight);
    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.9 }),
    );
    this.muzzleFlash.visible = false;
    this.viewModel.add(this.muzzleFlash);

    for (const w of WEAPONS) {
      this.mags.push(w.magSize);
      this.reserves.push(w.reserve);
    }

    this.buildWorld();
    this.buildViewModel();
    this.bind();
    this.nextWave();
    (window as unknown as Record<string, unknown>)["__astra"] = this;
    this.loop();
  }

  /* ------------------------------- world -------------------------------- */

  private addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    solid = true,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.worldMeshes.push(mesh);
    if (solid) {
      this.colliders.push({
        box: new THREE.Box3(
          new THREE.Vector3(x - w / 2, y, z - d / 2),
          new THREE.Vector3(x + w / 2, y + h, z + d / 2),
        ),
      });
    }
    return mesh;
  }

  private buildWorld() {
    const m = this.mapDef;
    const sky = skyTexture(m.sky[0], m.sky[1]);
    this.scene.environment = sky;
    this.scene.environmentIntensity = 0.55;
    this.scene.fog = new THREE.Fog(m.fog, 40, 220);

    // sky dome (gradient shader — reliable across GPUs)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(m.sky[0]) },
        bottom: { value: new THREE.Color(m.sky[1]) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 bottom;
        varying vec3 vWorld;
        void main() {
          float h = clamp(normalize(vWorld).y * 1.6 + 0.15, 0.0, 1.0);
          vec3 c = mix(bottom, top, pow(h, 0.65));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 20), skyMat);
    dome.renderOrder = -1;
    this.scene.add(dome);

    const hemi = new THREE.HemisphereLight(m.sky[0], m.ground, 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(m.sun, 2.4);
    sun.position.set(45, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    cam.left = -70;
    cam.right = 70;
    cam.top = 70;
    cam.bottom = -70;
    cam.far = 220;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(m.fog, 0.25));

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture(m.ground, 40),
      roughness: 0.95,
      metalness: 0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.worldMeshes.push(ground);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: stoneTexture(m.stone, 3),
      roughness: 0.9,
      metalness: 0.02,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: m.accent, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 0.8 });

    const S = 46; // half-size of arena
    // perimeter walls with crenellations
    const wallH = 9;
    this.addBox(0, 0, -S, S * 2, wallH, 2, stoneMat);
    this.addBox(0, 0, S, S * 2, wallH, 2, stoneMat);
    this.addBox(-S, 0, 0, 2, wallH, S * 2, stoneMat);
    this.addBox(S, 0, 0, 2, wallH, S * 2, stoneMat);
    for (let i = -S + 2; i < S; i += 4) {
      this.addBox(i, wallH, -S, 2, 1.2, 2.2, accentMat, false);
      this.addBox(i, wallH, S, 2, 1.2, 2.2, accentMat, false);
      this.addBox(-S, wallH, i, 2.2, 1.2, 2, accentMat, false);
      this.addBox(S, wallH, i, 2.2, 1.2, 2, accentMat, false);
    }
    // corner bastions
    for (const [cx, cz] of [
      [-S, -S],
      [S, -S],
      [-S, S],
      [S, S],
    ] as const) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 13, 20), stoneMat);
      tower.position.set(cx, 6.5, cz);
      tower.castShadow = tower.receiveShadow = true;
      this.scene.add(tower);
      this.worldMeshes.push(tower);
      this.colliders.push({
        box: new THREE.Box3(new THREE.Vector3(cx - 4.6, 0, cz - 4.6), new THREE.Vector3(cx + 4.6, 13, cz + 4.6)),
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
      dome.position.set(cx, 13, cz);
      dome.castShadow = true;
      this.scene.add(dome);
      this.worldMeshes.push(dome);
    }

    // central pillared pavilion
    const podium = this.addBox(0, 0, 0, 22, 1.2, 22, stoneMat);
    podium.receiveShadow = true;
    for (let x = -9; x <= 9; x += 6) {
      for (let z = -9; z <= 9; z += 6) {
        if (Math.abs(x) !== 9 && Math.abs(z) !== 9) continue;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5.4, 12), stoneMat);
        p.position.set(x, 1.2 + 2.7, z);
        p.castShadow = p.receiveShadow = true;
        this.scene.add(p);
        this.worldMeshes.push(p);
        this.colliders.push({
          box: new THREE.Box3(new THREE.Vector3(x - 0.6, 0, z - 0.6), new THREE.Vector3(x + 0.6, 6.6, z + 0.6)),
        });
      }
    }
    this.addBox(0, 6.6, 0, 21, 0.7, 21, accentMat, false);

    // scattered cover: crates, sandbags, jharokha screens
    const layout: [number, number, number, number, number][] = [
      [-20, -14, 4, 2.2, 4],
      [18, -20, 5, 3, 3],
      [26, 8, 3, 2.4, 8],
      [-28, 16, 8, 2.6, 3],
      [-14, 26, 4, 1.6, 4],
      [12, 24, 6, 2.8, 3],
      [30, -30, 6, 3.4, 6],
      [-32, -28, 5, 2.2, 5],
      [4, -32, 10, 1.4, 3],
      [-6, 34, 3, 2.6, 9],
      [34, 30, 4, 2, 4],
      [-38, 2, 3, 3.2, 10],
      [38, -6, 3, 1.8, 12],
      [16, 12, 3, 1.3, 3],
      [-16, -30, 3, 1.3, 3],
    ];
    for (const [x, z, w, h, d] of layout) {
      this.addBox(x, 0, z, w, h, d, (x + z) % 3 === 0 ? darkMat : stoneMat);
    }
    // ramps up to the walls
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 16), stoneMat);
    ramp.position.set(-S + 8, 3.2, -20);
    ramp.rotation.x = -0.42;
    ramp.castShadow = ramp.receiveShadow = true;
    this.scene.add(ramp);
    this.worldMeshes.push(ramp);

    // banners for flavour
    const banner = new THREE.MeshStandardMaterial({ color: m.accent, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), banner);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.cos(a) * 40, 5, Math.sin(a) * 40);
      b.lookAt(0, 5, 0);
      this.scene.add(b);
    }

    this.spawnPoints = [
      new THREE.Vector3(-36, 0, -36),
      new THREE.Vector3(36, 0, -36),
      new THREE.Vector3(-36, 0, 36),
      new THREE.Vector3(36, 0, 36),
      new THREE.Vector3(0, 0, -40),
      new THREE.Vector3(0, 0, 40),
      new THREE.Vector3(-40, 0, 0),
      new THREE.Vector3(40, 0, 0),
    ];
  }

  /* ----------------------------- view model ----------------------------- */

  private buildViewModel() {
    this.viewModel.clear();
    this.viewModel.add(this.muzzleFlash);
    const w = WEAPONS[this.wIndex]!;
    const metal = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.38, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: w.woodColor, roughness: 0.72, metalness: 0.05 });
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, w.length * 0.62), metal);
    body.position.set(0, 0, -w.length * 0.18);
    g.add(body);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, w.length * 0.42), wood);
    stock.position.set(0, -0.02, w.length * 0.26);
    g.add(stock);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, w.length * 0.7, 12), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -w.length * 0.55);
    g.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.09), metal);
    grip.position.set(0, -0.14, 0.06);
    grip.rotation.x = -0.24;
    g.add(grip);

    if (w.magSize > 5) {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.1), metal);
      mag.position.set(0, -0.17, -0.16);
      mag.rotation.x = 0.16;
      g.add(mag);
    }
    if (w.scoped) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), metal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.11, -0.1);
      g.add(scope);
    } else {
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), metal);
      sight.position.set(0, 0.09, -w.length * 0.42);
      g.add(sight);
      const rear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.02), metal);
      rear.position.set(0, 0.085, -0.02);
      g.add(rear);
    }
    if (w.id === "toradar") {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), wood);
      brace.position.set(0, -0.02, -0.4);
      g.add(brace);
    }

    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = false;
    });
    g.renderOrder = 10;
    g.scale.setScalar(0.66);
    this.viewModel.add(g);
    this.muzzle.position.set(0, 0.03, -w.length * 0.9);
    g.add(this.muzzle);
    this.muzzleFlash.position.copy(this.hipPos()).add(new THREE.Vector3(0, 0.03, -w.length * 0.9));
  }

  private hipPos() {
    return new THREE.Vector3(0.2, -0.17, -0.48);
  }

  /* ------------------------------- input -------------------------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "KeyR") this.startReload();
    if (e.code.startsWith("Digit")) {
      const n = Number(e.code.slice(5)) - 1;
      if (n >= 0 && n < WEAPONS.length) this.switchWeapon(n);
    }
    if (["Space", "Tab", "KeyR"].includes(e.code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onMouseDown = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.ads = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDown = false;
      this.semiLatch = false;
    }
    if (e.button === 2) this.ads = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement || this.dead) return;
    const w = WEAPONS[this.wIndex]!;
    const sens = 0.0021 / (this.ads ? w.zoom * 0.6 + 0.4 : 1);
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.pitch));
  };
  private onWheel = (e: WheelEvent) => {
    if (document.pointerLockElement !== this.renderer.domElement) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.switchWeapon((this.wIndex + dir + WEAPONS.length) % WEAPONS.length);
  };
  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
  private onContext = (e: Event) => e.preventDefault();

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("contextmenu", this.onContext);
  }

  lock() {
    this.renderer.domElement.requestPointerLock();
  }

  /* ------------------------------- audio -------------------------------- */

  private ac() {
    if (!this.audio) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audio = new Ctor();
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  private sfx(type: "shot" | "hit" | "kill" | "reload" | "hurt" | "empty", intensity = 1) {
    try {
      const ac = this.ac();
      const t = ac.currentTime;
      const gain = ac.createGain();
      gain.connect(ac.destination);
      if (type === "shot") {
        const buf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filt = ac.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.setValueAtTime(2600 - intensity * 900, t);
        src.connect(filt).connect(gain);
        gain.gain.setValueAtTime(0.32 * intensity, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        src.start(t);
        const osc = ac.createOscillator();
        const g2 = ac.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(150 * intensity, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g2.gain.setValueAtTime(0.22, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g2).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      } else {
        const osc = ac.createOscillator();
        osc.connect(gain);
        const map = { hit: 1400, kill: 700, reload: 320, hurt: 180, empty: 900 } as Record<string, number>;
        osc.type = type === "hit" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(map[type] ?? 500, t);
        if (type === "kill") osc.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.start(t);
        osc.stop(t + 0.18);
      }
    } catch {
      /* audio optional */
    }
  }

  /* ------------------------------ combat -------------------------------- */

  private switchWeapon(i: number) {
    if (i === this.wIndex || this.dead) return;
    this.wIndex = i;
    this.reloading = false;
    this.buildViewModel();
    this.sfx("reload");
  }

  private startReload() {
    const w = WEAPONS[this.wIndex]!;
    if (this.reloading || this.dead) return;
    if (this.mags[this.wIndex]! >= w.magSize) return;
    if (this.reserves[this.wIndex]! <= 0) return;
    this.reloading = true;
    this.reloadEnd = performance.now() / 1000 + w.reloadTime;
    this.sfx("reload");
  }

  private finishReload() {
    const w = WEAPONS[this.wIndex]!;
    const need = w.magSize - this.mags[this.wIndex]!;
    const take = Math.min(need, this.reserves[this.wIndex]!);
    this.mags[this.wIndex]! += take;
    this.reserves[this.wIndex]! -= take;
    this.reloading = false;
  }

  private shoot(now: number) {
    const w = WEAPONS[this.wIndex]!;
    if (this.reloading || this.dead) return;
    const interval = 60 / w.rpm;
    if (now - this.lastShot < interval) return;
    if (this.mags[this.wIndex]! <= 0) {
      if (!this.semiLatch) {
        this.sfx("empty");
        this.semiLatch = true;
      }
      this.startReload();
      return;
    }
    if (w.mode !== "auto") {
      if (this.semiLatch) return;
      this.semiLatch = true;
    }
    this.lastShot = now;
    this.mags[this.wIndex]!--;
    this.shotsFired++;
    this.sfx("shot", w.damage > 80 ? 1.4 : 1);

    const spread = (this.ads ? w.adsSpread : w.spread) * (this.onGround ? 1 : 2.4) * (this.crouch ? 0.7 : 1);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const baseDir = this.camera.getWorldDirection(new THREE.Vector3());
    const pellets = w.pellets ?? 1;
    let hitAny = false;

    for (let p = 0; p < pellets; p++) {
      const dir = baseDir
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
          ),
        )
        .normalize();
      this.raycaster.set(origin, dir);
      this.raycaster.far = w.range;
      const targets: THREE.Object3D[] = [...this.worldMeshes];
      for (const e of this.enemies) if (!e.dead) targets.push(e.head, e.body);
      const hits = this.raycaster.intersectObjects(targets, false);
      const hit = hits[0];
      const end = hit ? hit.point.clone() : origin.clone().add(dir.clone().multiplyScalar(w.range));
      this.tracer(origin.clone().add(dir.clone().multiplyScalar(0.6)), end);

      if (hit) {
        const owner = hit.object.userData["enemy"] as Enemy | undefined;
        if (owner && !owner.dead) {
          const head = hit.object.userData["head"] === true;
          const falloff = Math.max(0.55, 1 - hit.distance / w.range);
          const dmg = w.damage * falloff * (head ? w.headMult : 1);
          owner.hp -= dmg;
          hitAny = true;
          this.shotsHit++;
          this.hitAt = now;
          this.burst(hit.point, 0x9b1b1b, 12);
          this.sfx("hit");
          if (owner.hp <= 0) this.killEnemy(owner, head, now);
        } else {
          this.burst(hit.point, 0xd9c9a0, 8);
          this.decal(hit.point, hit.face?.normal ?? new THREE.Vector3(0, 1, 0));
        }
      }
    }
    if (!hitAny && pellets > 1) this.shotsFired += 0;

    // recoil + flash
    this.recoilPitch += w.recoil * (this.ads ? 0.62 : 1);
    this.recoilYaw += (Math.random() - 0.5) * w.recoil * 1.1;
    this.punch = w.kick;
    this.flashUntil = now + 0.05;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.scale.setScalar(0.7 + Math.random() * 0.9);
    this.muzzleLight.intensity = 22;
  }

  private killEnemy(e: Enemy, head: boolean, now: number) {
    e.dead = true;
    e.deadAt = now;
    this.kills++;
    if (head) this.headshots++;
    this.score += head ? 150 : 100;
    this.killAt = now;
    this.sfx("kill");
    this.feed.unshift({ id: this.feedId++, text: `${e.name} eliminated`, head });
    this.feed = this.feed.slice(0, 5);
    e.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        o.material = o.material.clone();
        o.material.transparent = true;
      }
    });
  }

  private tracer(a: THREE.Vector3, b: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, until: performance.now() / 1000 + 0.06 });
  }

  private burst(at: THREE.Vector3, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 5, 4),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.copy(at);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
        until: performance.now() / 1000 + 0.55,
        g: 9,
      });
    }
  }

  private decal(at: THREE.Vector3, normal: THREE.Vector3) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.06 + Math.random() * 0.04, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1512, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    m.position.copy(at).add(normal.clone().multiplyScalar(0.012));
    m.lookAt(at.clone().add(normal));
    this.scene.add(m);
    this.decals.push(m);
    if (this.decals.length > 70) {
      const old = this.decals.shift();
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
      }
    }
  }

  /* ------------------------------ enemies ------------------------------- */

  private enemyKinds(wave: number) {
    const kinds = [
      { name: "Sepoy Musketeer", hp: 100, speed: 3.0, dmg: 9, delay: 1.5, acc: 0.5, cloth: 0x8c3b2a, skin: 0x8a5a3b },
      { name: "Fort Guard", hp: 130, speed: 3.6, dmg: 7, delay: 1.0, acc: 0.55, cloth: 0x39527a, skin: 0x7a4e33 },
      { name: "Rampart Marksman", hp: 90, speed: 2.4, dmg: 18, delay: 2.1, acc: 0.7, cloth: 0x3d4a35, skin: 0x6f4a30 },
      { name: "Heavy Jezail", hp: 220, speed: 2.2, dmg: 22, delay: 2.4, acc: 0.6, cloth: 0x4a3050, skin: 0x6b452c },
    ];
    const pool = [kinds[0]!, kinds[1]!];
    if (wave >= 3) pool.push(kinds[2]!);
    if (wave >= 5) pool.push(kinds[3]!);
    return pool;
  }

  private spawnEnemy(wave: number) {
    const pool = this.enemyKinds(wave);
    const k = pool[Math.floor(Math.random() * pool.length)]!;
    const scale = 1 + (wave - 1) * 0.09;
    const g = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: k.cloth, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: k.skin, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.8, 6, 12), cloth);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
    head.position.y = 1.72;
    head.castShadow = true;
    g.add(head);
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), cloth);
    turban.position.y = 1.86;
    turban.scale.y = 0.7;
    g.add(turban);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.45, 4, 8), dark);
      leg.position.set(s * 0.15, 0.36, 0);
      leg.castShadow = true;
      g.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), cloth);
      arm.position.set(s * 0.44, 1.14, -0.05);
      g.add(arm);
    }
    const musket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), dark);
    musket.position.set(0.3, 1.15, -0.55);
    g.add(musket);

    const sp = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)]!;
    g.position.copy(sp).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
    this.scene.add(g);

    const e: Enemy = {
      root: g,
      head,
      body,
      hp: k.hp * scale,
      maxHp: k.hp * scale,
      speed: k.speed + Math.min(1.6, wave * 0.1),
      dmg: k.dmg,
      fireDelay: Math.max(0.5, k.delay - wave * 0.04),
      cd: 1 + Math.random() * 2,
      accuracy: Math.min(0.9, k.acc + wave * 0.02),
      name: k.name,
      dead: false,
      deadAt: 0,
      vel: new THREE.Vector3(),
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: 0,
    };
    head.userData["enemy"] = e;
    head.userData["head"] = true;
    body.userData["enemy"] = e;
    this.enemies.push(e);
  }

  private nextWave() {
    this.wave++;
    const count = Math.min(22, 4 + this.wave * 2);
    for (let i = 0; i < count; i++) this.spawnEnemy(this.wave);
    this.waveBanner = `WAVE ${this.wave}`;
    this.bannerUntil = performance.now() / 1000 + 2.6;
    // resupply
    for (let i = 0; i < WEAPONS.length; i++) {
      this.reserves[i] = Math.min(WEAPONS[i]!.reserve, this.reserves[i]! + Math.ceil(WEAPONS[i]!.reserve * 0.35));
    }
    this.health = Math.min(100, this.health + 25);
    this.armor = Math.min(100, this.armor + 20);
  }

  private damagePlayer(amount: number, now: number) {
    if (this.dead) return;
    let dmg = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.5);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.health -= dmg;
    this.hurtAt = now;
    this.sfx("hurt");
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      document.exitPointerLock?.();
    }
  }

  /* ------------------------------ movement ------------------------------ */

  private collide(pos: THREE.Vector3, radius: number, height: number) {
    const min = new THREE.Vector3(pos.x - radius, pos.y - height, pos.z - radius);
    const max = new THREE.Vector3(pos.x + radius, pos.y, pos.z + radius);
    const box = new THREE.Box3(min, max);
    for (const c of this.colliders) if (c.box.intersectsBox(box)) return c;
    return null;
  }

  private moveWithCollision(pos: THREE.Vector3, delta: THREE.Vector3, radius: number, height: number) {
    const step = pos.clone();
    step.x += delta.x;
    if (this.collide(step, radius, height)) step.x = pos.x;
    step.z += delta.z;
    if (this.collide(step, radius, height)) step.z = pos.z;
    pos.x = step.x;
    pos.z = step.z;
  }

  private groundHeight(x: number, z: number, fromY: number) {
    this.raycaster.set(new THREE.Vector3(x, fromY + 2, z), new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 60;
    const hit = this.raycaster.intersectObjects(this.worldMeshes, false)[0];
    return hit ? hit.point.y : 0;
  }

  private updatePlayer(dt: number, now: number) {
    if (this.dead) return;
    const wantCrouch = this.keys.has("ControlLeft") || this.keys.has("KeyC");
    this.crouch = wantCrouch;
    const targetEye = wantCrouch ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);

    const sprint = this.keys.has("ShiftLeft") && !wantCrouch && !this.ads;
    const speed = (wantCrouch ? 3.0 : this.ads ? 3.6 : sprint ? 8.2 : 6.0) * (this.onGround ? 1 : 0.85);

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.add(fwd);
    if (this.keys.has("KeyS")) wish.sub(fwd);
    if (this.keys.has("KeyD")) wish.add(right);
    if (this.keys.has("KeyA")) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const accel = this.onGround ? 14 : 4;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * accel);

    if (this.keys.has("Space") && this.onGround) {
      this.vel.y = 5.6;
      this.onGround = false;
    }
    this.vel.y -= 18 * dt;

    const feet = new THREE.Vector3(this.pos.x, this.pos.y - this.eye, this.pos.z);
    this.moveWithCollision(
      feet,
      new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt),
      PLAYER_RADIUS,
      -1.6,
    );
    feet.y += this.vel.y * dt;
    const gy = this.groundHeight(feet.x, feet.z, feet.y);
    if (feet.y <= gy + 0.02) {
      feet.y = gy;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.pos.set(feet.x, feet.y + this.eye, feet.z);

    // head bob
    const speedXZ = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * speedXZ * 1.5;
    const bobAmt = this.ads ? 0.008 : 0.03;
    const bobY = Math.sin(this.bob * 2) * bobAmt * Math.min(1, speedXZ / 6);
    const bobX = Math.cos(this.bob) * bobAmt * 0.7 * Math.min(1, speedXZ / 6);

    // recoil recovery
    this.recoilPitch *= Math.pow(0.0009, dt);
    this.recoilYaw *= Math.pow(0.0015, dt);
    this.punch += (0 - this.punch) * Math.min(1, dt * 9);

    this.camera.position.set(this.pos.x + bobX, this.pos.y + bobY, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw + this.recoilYaw);
    this.camera.rotateX(this.pitch + this.recoilPitch);
    this.camera.rotateZ(Math.sin(this.bob) * 0.004);

    const w = WEAPONS[this.wIndex]!;
    const targetFov = this.ads ? 90 / w.zoom : 90;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // view model placement
    const adsPos = new THREE.Vector3(0, w.scoped ? -0.05 : -0.055, -0.36);
    const hip = this.hipPos();
    const target = this.ads ? adsPos : hip;
    const bobModel = new THREE.Vector3(bobX * 0.6, bobY * 0.6, this.punch * 0.9);
    this.viewModel.position.lerp(target.clone().add(bobModel), Math.min(1, dt * 16));
    this.viewModel.rotation.x += ((this.ads ? 0 : -0.03) - this.punch * 0.7 - this.viewModel.rotation.x) * Math.min(1, dt * 14);
    this.viewModel.rotation.y += ((this.ads ? 0 : 0.06) - this.viewModel.rotation.y) * Math.min(1, dt * 14);
    this.viewModel.visible = !(this.ads && w.scoped);

    if (this.reloading && now >= this.reloadEnd) this.finishReload();
    if (this.mouseDown) this.shoot(now);

    if (now > this.flashUntil) {
      this.muzzleFlash.visible = false;
      this.muzzleLight.intensity *= Math.pow(0.0001, dt);
    }
    this.muzzleLight.position.copy(this.camera.localToWorld(this.viewModel.position.clone().add(new THREE.Vector3(0, 0, -0.6))));
  }

  private updateEnemies(dt: number, now: number) {
    const playerFeet = new THREE.Vector3(this.pos.x, this.pos.y - this.eye, this.pos.z);
    for (const e of this.enemies) {
      if (e.dead) {
        const t = now - e.deadAt;
        e.root.rotation.x = Math.min(Math.PI / 2, t * 4);
        e.root.position.y = Math.max(-1.2, -t * 0.4);
        continue;
      }
      const to = playerFeet.clone().sub(e.root.position);
      to.y = 0;
      const dist = to.length();
      to.normalize();
      e.root.lookAt(playerFeet.x, e.root.position.y, playerFeet.z);

      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = 0.8 + Math.random() * 1.4;
        e.strafe = Math.random() < 0.5 ? -1 : 1;
      }
      const side = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(e.strafe);
      const desired = dist > 12 ? to.clone() : to.clone().multiplyScalar(dist < 6 ? -0.4 : 0.15).add(side.multiplyScalar(0.9));
      desired.normalize().multiplyScalar(e.speed * dt);
      const before = e.root.position.clone();
      this.moveWithCollision(e.root.position, desired, 0.42, -1.7);
      if (e.root.position.distanceToSquared(before) < 1e-6) {
        const alt = new THREE.Vector3(-to.z, 0, to.x).multiplyScalar(e.speed * dt);
        this.moveWithCollision(e.root.position, alt, 0.42, -1.7);
      }
      e.root.position.y = this.groundHeight(e.root.position.x, e.root.position.z, e.root.position.y + 1);

      // shooting
      e.cd -= dt;
      if (e.cd <= 0 && dist < 65) {
        const eyePos = e.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const dir = this.camera.position.clone().sub(eyePos).normalize();
        this.raycaster.set(eyePos, dir);
        this.raycaster.far = dist;
        const blocked = this.raycaster.intersectObjects(this.worldMeshes, false)[0];
        if (!blocked || blocked.distance > dist - 1.2) {
          e.cd = e.fireDelay * (0.75 + Math.random() * 0.6);
          this.tracer(eyePos, this.camera.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2)));
          this.sfx("shot", 0.7);
          const chance = e.accuracy * Math.max(0.25, 1 - dist / 80);
          if (Math.random() < chance) this.damagePlayer(e.dmg, now);
        }
      }
    }

    // cleanup + waves
    const alive = this.enemies.filter((e) => !e.dead).length;
    for (const e of this.enemies) {
      if (e.dead && now - e.deadAt > 6) {
        this.scene.remove(e.root);
        e.root.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead || now - e.deadAt <= 6);

    if (alive === 0 && !this.dead) {
      if (this.betweenWaves === 0) this.betweenWaves = now + 3;
      else if (now >= this.betweenWaves) {
        this.betweenWaves = 0;
        this.nextWave();
      }
    }
  }

  private updateFx(now: number, dt: number) {
    this.tracers = this.tracers.filter((t) => {
      if (now > t.until) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        return false;
      }
      (t.mesh.material as THREE.LineBasicMaterial).opacity *= 0.82;
      return true;
    });
    this.particles = this.particles.filter((p) => {
      if (now > p.until) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        return false;
      }
      p.vel.y -= p.g * dt;
      p.mesh.position.add(this.tmp.copy(p.vel).multiplyScalar(dt));
      return true;
    });
  }

  private emit(now: number) {
    const w = WEAPONS[this.wIndex]!;
    if (this.waveBanner && now > this.bannerUntil) this.waveBanner = null;
    this.onHud({
      health: Math.round(this.health),
      armor: Math.round(this.armor),
      mag: this.mags[this.wIndex]!,
      reserve: this.reserves[this.wIndex]!,
      weapon: w.name,
      weaponIndex: this.wIndex,
      caliber: w.caliber,
      reloading: this.reloading,
      wave: this.wave,
      enemiesLeft: this.enemies.filter((e) => !e.dead).length,
      score: this.score,
      kills: this.kills,
      headshots: this.headshots,
      accuracy: this.shotsFired ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0,
      ads: this.ads,
      dead: this.dead,
      waveBanner: this.waveBanner,
      feed: this.feed,
      hitAt: this.hitAt,
      killAt: this.killAt,
      hurtAt: this.hurtAt,
    });
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now() / 1000;
    this.updatePlayer(dt, now);
    this.updateEnemies(dt, now);
    this.updateFx(now, dt);
    this.renderer.render(this.scene, this.camera);
    this.emit(now);
  };

  restart() {
    for (const e of this.enemies) this.scene.remove(e.root);
    this.enemies = [];
    this.health = 100;
    this.armor = 50;
    this.dead = false;
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.feed = [];
    this.pos.set(0, PLAYER_HEIGHT, 34);
    this.yaw = 0;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.mags = WEAPONS.map((w) => w.magSize);
    this.reserves = WEAPONS.map((w) => w.reserve);
    this.betweenWaves = 0;
    this.nextWave();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContext);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container)
      this.container.removeChild(this.renderer.domElement);
    void this.audio?.close();
  }
}

export { WEAPONS, MAPS };
export type { WeaponDef, MapDef };