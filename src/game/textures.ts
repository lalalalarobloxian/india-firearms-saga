import * as THREE from "three";

function canvas(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, dark: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d0 = img.data;
  for (let i = 0; i < d0.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    const d = Math.random() < dark ? -18 : 0;
    d0[i] = Math.max(0, Math.min(255, (d0[i] ?? 0) + n + d));
    d0[i + 1] = Math.max(0, Math.min(255, (d0[i + 1] ?? 0) + n + d));
    d0[i + 2] = Math.max(0, Math.min(255, (d0[i + 2] ?? 0) + n + d));
  }
  ctx.putImageData(img, 0, 0);
}

export function stoneTexture(color: number, repeat = 4) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  // brick courses
  const rows = 8;
  const h = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (size / 8);
    for (let x = -1; x < 5; x++) {
      const w = size / 4;
      const px = x * w + offset;
      const shade = 0.86 + Math.random() * 0.28;
      const col = base.clone().multiplyScalar(shade);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.fillRect(px + 1.5, r * h + 1.5, w - 3, h - 3);
    }
  }
  noise(ctx, size, 26, 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function groundTexture(color: number, repeat = 32) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const shade = 0.8 + Math.random() * 0.4;
    const col = base.clone().multiplyScalar(shade);
    ctx.fillStyle = `#${col.getHexString()}`;
    const r = 2 + Math.random() * 10;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, size, 20, 0.02);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function skyTexture(top: number, bottom: number) {
  const c = canvas(256);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `#${new THREE.Color(top).getHexString()}`);
  g.addColorStop(0.55, `#${new THREE.Color(top).lerp(new THREE.Color(bottom), 0.55).getHexString()}`);
  g.addColorStop(1, `#${new THREE.Color(bottom).getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}