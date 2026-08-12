import * as THREE from "three";
import type { WeaponDef } from "./config";

/**
 * Higher-fidelity procedural character + weapon models.
 * Everything is built from primitives so there are no asset downloads,
 * but limbs are separated so they can be animated (walk cycle, aim, melee).
 */

export interface Humanoid {
  root: THREE.Group;
  head: THREE.Mesh;
  body: THREE.Mesh;
  hips: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  gun: THREE.Group;
  phase: number;
}

export interface HumanoidStyle {
  cloth: number;
  skin: number;
  accent: number;
  /** headgear style */
  head: "turban" | "helmet" | "cap" | "bare" | "pagri";
  /** carried silhouette */
  weapon: "musket" | "rifle" | "sword" | "lmg" | "none";
  scale?: number;
}

function mat(color: number, rough = 0.8, metal = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function limb(len: number, radius: number, material: THREE.Material) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 6, 10), material);
  mesh.position.y = -len / 2 - radius * 0.5;
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

export function buildHumanoid(style: HumanoidStyle): Humanoid {
  const scale = style.scale ?? 1;
  const cloth = mat(style.cloth, 0.86);
  const skin = mat(style.skin, 0.62);
  const accent = mat(style.accent, 0.55, 0.2);
  const dark = mat(0x24242a, 0.7, 0.15);
  const steel = mat(0x9aa2ab, 0.35, 0.8);

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  root.add(hips);

  // torso: chest + belly for a less "capsule blob" silhouette
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.42, 8, 16), cloth);
  body.position.y = 0.28;
  body.castShadow = true;
  hips.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.3, 0.32), cloth);
  chest.position.y = 0.44;
  chest.castShadow = true;
  hips.add(chest);

  // sash / bandolier
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.36), accent);
  sash.position.y = 0.4;
  sash.rotation.z = 0.4;
  hips.add(sash);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.3), dark);
  belt.position.y = 0.06;
  hips.add(belt);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 8), skin);
  neck.position.y = 0.62;
  hips.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 14), skin);
  head.position.y = 0.77;
  head.scale.set(0.92, 1.08, 0.98);
  head.castShadow = true;
  hips.add(head);

  // face: simple brow + moustache so heads read at distance
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), dark);
  brow.position.set(0, 0.81, -0.16);
  hips.add(brow);
  const tache = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.03), dark);
  tache.position.set(0, 0.72, -0.17);
  hips.add(tache);

  if (style.head === "turban" || style.head === "pagri") {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 12), style.head === "pagri" ? accent : cloth);
    t.position.y = 0.9;
    t.scale.y = 0.66;
    t.castShadow = true;
    hips.add(t);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), accent);
    knot.position.set(0.16, 0.95, 0.04);
    hips.add(knot);
    if (style.head === "pagri") {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 8), accent);
      plume.position.set(0, 1.06, 0.02);
      hips.add(plume);
    }
  } else if (style.head === "helmet") {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), dark);
    h.position.y = 0.83;
    h.castShadow = true;
    hips.add(h);
  } else if (style.head === "cap") {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.11, 14), cloth);
    c.position.y = 0.9;
    hips.add(c);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.14), dark);
    peak.position.set(0, 0.86, -0.18);
    hips.add(peak);
  }

  const legL = limb(0.44, 0.12, dark);
  const legR = limb(0.44, 0.12, dark);
  legL.position.set(-0.14, 0, 0);
  legR.position.set(0.14, 0, 0);
  hips.add(legL, legR);
  for (const leg of [legL, legR]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.26), dark);
    boot.position.set(0, -0.66, -0.03);
    leg.add(boot);
  }

  const armL = limb(0.42, 0.095, cloth);
  const armR = limb(0.42, 0.095, cloth);
  armL.position.set(-0.31, 0.48, 0);
  armR.position.set(0.31, 0.48, 0);
  hips.add(armL, armR);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin);
    hand.position.y = -0.5;
    arm.add(hand);
  }

  // carried weapon silhouette
  const gun = new THREE.Group();
  gun.position.set(0.22, 0.42, -0.12);
  hips.add(gun);
  if (style.weapon === "musket" || style.weapon === "rifle" || style.weapon === "lmg") {
    const len = style.weapon === "musket" ? 1.35 : style.weapon === "lmg" ? 1.15 : 1.0;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, len * 0.42), mat(0x6b4423, 0.75));
    stock.position.z = len * 0.24;
    gun.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, len * 0.8, 10), steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -len * 0.28;
    gun.add(barrel);
    if (style.weapon === "lmg") {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.18), dark);
      box.position.set(0, -0.1, 0);
      gun.add(box);
    }
    gun.rotation.set(0, 0, 0);
  } else if (style.weapon === "sword") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.012), steel);
    blade.position.set(0, -0.2, 0);
    gun.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.05), accent);
    guard.position.set(0, 0.26, 0);
    gun.add(guard);
    gun.rotation.x = -0.5;
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.receiveShadow = true;
  });

  return { root, head, body, hips, legL, legR, armL, armR, gun, phase: Math.random() * Math.PI * 2 };
}

/** Animate a humanoid walk / idle / death lean. */
export function animateHumanoid(h: Humanoid, speed: number, time: number, aiming: boolean) {
  const stride = Math.min(1, speed / 4);
  const t = time * (4 + stride * 5) + h.phase;
  h.legL.rotation.x = Math.sin(t) * 0.7 * stride;
  h.legR.rotation.x = -Math.sin(t) * 0.7 * stride;
  h.armL.rotation.x = aiming ? -1.35 : -Math.sin(t) * 0.55 * stride;
  h.armR.rotation.x = aiming ? -1.45 : Math.sin(t) * 0.55 * stride;
  h.armR.rotation.z = aiming ? -0.22 : 0;
  h.armL.rotation.z = aiming ? 0.3 : 0;
  h.hips.position.y = 0.92 + Math.abs(Math.sin(t)) * 0.045 * stride;
  h.hips.rotation.y = Math.sin(t * 0.5) * 0.05 * stride;
  h.gun.rotation.x = aiming ? -0.05 : 0.35;
}

/* ------------------------------------------------------------------ */
/*  First-person weapon view models                                    */
/* ------------------------------------------------------------------ */

export interface ViewModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  /** moving parts for animation */
  slide?: THREE.Object3D;
  bolt?: THREE.Object3D;
  magazine?: THREE.Object3D;
}

export function buildViewModel(w: WeaponDef): ViewModel {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.34, metalness: 0.72 });
  const wood = new THREE.MeshStandardMaterial({ color: w.woodColor, roughness: 0.7, metalness: 0.04 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 });
  const muzzle = new THREE.Object3D();
  const vm: ViewModel = { group: g, muzzle };

  const hands = new THREE.Group();
  g.add(hands);
  const addHand = (x: number, y: number, z: number, rot: number) => {
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.13, 6, 10), skin);
    hand.position.set(x, y, z);
    hand.rotation.set(rot, 0, 0.35);
    hands.add(hand);
  };

  if (w.category === "grenade") {
    const bodyGeo =
      w.id === "smoke"
        ? new THREE.CylinderGeometry(0.055, 0.055, 0.17, 14)
        : new THREE.SphereGeometry(0.075, 16, 12);
    const body = new THREE.Mesh(bodyGeo, metal);
    body.position.set(0, -0.02, -0.06);
    g.add(body);
    const ridges = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 6, 16), metal);
    ridges.position.copy(body.position);
    ridges.rotation.x = Math.PI / 2;
    g.add(ridges);
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), brass);
    pin.position.set(0.05, 0.05, -0.06);
    g.add(pin);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.09, 0.02), brass);
    lever.position.set(0.02, 0.05, -0.06);
    g.add(lever);
    addHand(-0.03, -0.12, 0.0, -0.5);
    muzzle.position.set(0, 0, -0.12);
    g.add(muzzle);
    return vm;
  }

  if (w.id === "khanda") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.95), new THREE.MeshStandardMaterial({ color: 0xd6dae2, roughness: 0.16, metalness: 0.95 }));
    blade.position.set(0, 0.01, -0.55);
    g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xd6dae2, roughness: 0.16, metalness: 0.95 }));
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0.01, -1.06);
    g.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), brass);
    guard.position.set(0, 0, -0.08);
    g.add(guard);
    const basket = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14, Math.PI), brass);
    basket.position.set(0, 0.02, 0.02);
    basket.rotation.set(Math.PI / 2, 0, 0);
    g.add(basket);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.2, 10), wood);
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0, 0.08);
    g.add(grip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), brass);
    pommel.position.set(0, 0, 0.19);
    g.add(pommel);
    addHand(0, -0.06, 0.09, -0.2);
    muzzle.position.set(0, 0, -0.9);
    g.add(muzzle);
    return vm;
  }

  if (w.id === "katta") {
    // crude single-shot pistol: pipe barrel, taped grip, hammer
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.34, 10), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.2);
    g.add(barrel);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), metal);
    receiver.position.set(0, 0, -0.03);
    g.add(receiver);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.08), wood);
    grip.position.set(0, -0.13, 0.03);
    grip.rotation.x = -0.28;
    g.add(grip);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.05, 0.09), rubber);
    tape.position.set(0, -0.1, 0.02);
    tape.rotation.x = -0.28;
    g.add(tape);
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), brass);
    hammer.position.set(0, 0.07, 0.03);
    g.add(hammer);
    vm.slide = receiver;
    addHand(0.0, -0.17, 0.05, -0.35);
    muzzle.position.set(0, 0.02, -0.38);
    g.add(muzzle);
    return vm;
  }

  // ---- firearms -------------------------------------------------------
  const L = w.length;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.115, L * 0.6), metal);
  receiver.position.set(0, 0, -L * 0.16);
  g.add(receiver);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, L * 0.55), metal);
  upper.position.set(0, 0.08, -L * 0.2);
  g.add(upper);
  vm.bolt = upper;

  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.08, L * 0.34),
    w.woodColor === w.color ? metal : wood,
  );
  handguard.position.set(0, 0.0, -L * 0.52);
  g.add(handguard);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, L * 0.85, 12), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -L * 0.62);
  g.add(barrel);

  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.08, 12), metal);
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.03, -L * 0.98);
  g.add(brake);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, L * 0.32), wood);
  stock.position.set(0, -0.02, L * 0.22);
  stock.rotation.x = 0.04;
  g.add(stock);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.03), rubber);
  pad.position.set(0, -0.03, L * 0.38);
  g.add(pad);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.2, 0.09), rubber);
  grip.position.set(0, -0.15, 0.05);
  grip.rotation.x = -0.26;
  g.add(grip);

  const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), metal);
  trigger.position.set(0, -0.08, -0.01);
  trigger.rotation.y = Math.PI / 2;
  g.add(trigger);

  if (w.magSize > 5 && w.category !== "sniper") {
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, w.magSize > 50 ? 0.3 : 0.24, 0.11),
      metal,
    );
    magazine.position.set(0, -0.19, -0.16);
    magazine.rotation.x = w.id === "ak203" ? 0.22 : 0.12;
    g.add(magazine);
    vm.magazine = magazine;
  }
  if (w.magSize > 50) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 16), metal);
    drum.position.set(0, -0.3, -0.16);
    drum.rotation.z = Math.PI / 2;
    g.add(drum);
  }

  if (w.scoped) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.34, 16), metal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.135, -0.12);
    g.add(tube);
    for (const z of [-0.28, 0.03]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 12), rubber);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.135, z);
      g.add(ring);
    }
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.032, 16),
      new THREE.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.05, metalness: 1 }),
    );
    lens.position.set(0, 0.135, -0.29);
    g.add(lens);
  } else {
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), metal);
    front.position.set(0, 0.1, -L * 0.46);
    g.add(front);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.018), metal);
    rear.position.set(0, 0.095, -0.02);
    g.add(rear);
  }

  if (w.id === "toradar") {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), wood);
    brace.position.set(0, -0.03, -0.45);
    g.add(brace);
    const serpentine = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 10, Math.PI), brass);
    serpentine.position.set(0.05, 0.05, 0.02);
    g.add(serpentine);
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.012, 0.5), brass);
    inlay.position.set(0, 0.06, 0.1);
    g.add(inlay);
  }
  if (w.category === "rifle" && w.magSize > 20) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, L * 0.4), metal);
    rail.position.set(0, 0.112, -L * 0.24);
    g.add(rail);
  }
  if (w.id === "bhalu") {
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), metal);
    bipodL.position.set(-0.07, -0.14, -L * 0.6);
    bipodL.rotation.z = 0.35;
    g.add(bipodL);
    const bipodR = bipodL.clone();
    bipodR.position.x = 0.07;
    bipodR.rotation.z = -0.35;
    g.add(bipodR);
  }

  addHand(0.0, -0.19, 0.03, -0.4);
  addHand(0.0, -0.11, -L * 0.5, -0.5);

  muzzle.position.set(0, 0.03, -L * 1.02);
  g.add(muzzle);
  return vm;
}
