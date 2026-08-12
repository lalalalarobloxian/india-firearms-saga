import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { GameSettings } from "./economy";

/**
 * Post-processing pipeline: bloom + vignette + chromatic aberration
 * + tone grading. Uses a render-target chain with custom shader passes.
 * Controlled by GameSettings (postProcessing, bloom, graphics quality).
 */

const BLOOM_FRAGMENT = `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float bloomStrength;
  uniform float vignette;
  uniform float aberration;
  varying vec2 vUv;

  vec3 brightPass(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float k = smoothstep(0.45, 0.9, l);
    return c * k;
  }

  void main() {
    vec2 uv = vUv;

    // chromatic aberration
    vec2 dir = uv - 0.5;
    float aberr = aberration * 0.004;
    vec3 col;
    col.r = texture2D(tDiffuse, uv - dir * aberr).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv + dir * aberr).b;

    // bloom: sample blurred bright areas at multiple offsets
    vec2 px = 1.0 / resolution;
    vec3 bloom = vec3(0.0);
    float offsets[8];
    offsets[0] = 1.0; offsets[1] = 2.0; offsets[2] = 3.0; offsets[3] = 4.0;
    offsets[4] = 5.0; offsets[5] = 6.0; offsets[6] = 7.0; offsets[7] = 8.0;
    float weights[8];
    weights[0] = 0.32; weights[1] = 0.24; weights[2] = 0.16; weights[3] = 0.10;
    weights[4] = 0.07; weights[5] = 0.05; weights[6] = 0.03; weights[7] = 0.02;

    for (int i = 0; i < 8; i++) {
      float o = offsets[i];
      float w = weights[i];
      vec3 s;
      s  = brightPass(texture2D(tDiffuse, uv + vec2(px.x * o, 0.0)).rgb);
      s += brightPass(texture2D(tDiffuse, uv - vec2(px.x * o, 0.0)).rgb);
      s += brightPass(texture2D(tDiffuse, uv + vec2(0.0, px.y * o)).rgb);
      s += brightPass(texture2D(tDiffuse, uv - vec2(0.0, px.y * o)).rgb);
      s += brightPass(texture2D(tDiffuse, uv + vec2(px.x * o, px.y * o)).rgb);
      s += brightPass(texture2D(tDiffuse, uv - vec2(px.x * o, px.y * o)).rgb);
      s += brightPass(texture2D(tDiffuse, uv + vec2(px.x * o, -px.y * o)).rgb);
      s += brightPass(texture2D(tDiffuse, uv - vec2(px.x * o, -px.y * o)).rgb);
      bloom += s * w;
    }
    bloom *= bloomStrength;

    col += bloom;

    // tone grading (warm shadows, cool highlights)
    col = col * 1.08;
    col.r = col.r * 1.03 + 0.01;
    col.b = col.b * 0.97;

    // vignette
    float d = length(dir);
    float vig = 1.0 - d * d * vignette;
    col *= vig;

    // gamma
    col = pow(clamp(col, 0.0, 1.0), vec3(0.88));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class PostProcessing {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: ShaderPass;
  private enabled = true;
  private bloomEnabled = true;
  private renderer: THREE.WebGLRenderer;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        bloomStrength: { value: 0.6 },
        vignette: { value: 0.85 },
        aberration: { value: 1.0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: BLOOM_FRAGMENT,
    });
    this.bloomPass.renderToScreen = true;
    this.composer.addPass(this.bloomPass);
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    (this.bloomPass.uniforms["resolution"]!.value as THREE.Vector2).set(width, height);
  }

  setScene(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
  }

  applySettings(settings: GameSettings) {
    this.enabled = settings.postProcessing;
    this.bloomEnabled = settings.bloom;
    const quality = settings.graphics;
    const pixelRatio = quality === "ultra" ? 2 : quality === "high" ? 1.5 : quality === "medium" ? 1 : 0.75;
    this.composer.setPixelRatio(Math.min(pixelRatio, window.devicePixelRatio * 1.5));
    (this.bloomPass.uniforms["bloomStrength"]!.value as number) = settings.bloom ? 0.65 : 0;
    (this.bloomPass.uniforms["vignette"]!.value as number) = 0.85;
    (this.bloomPass.uniforms["aberration"]!.value as number) = quality === "low" ? 0 : 1.0;
  }

  render() {
    if (this.enabled || this.bloomEnabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.renderPass.scene, this.renderPass.camera);
    }
  }

  dispose() {
    this.composer.dispose();
  }
}

/**
 * Animated water surface shader for coastal/jungle maps.
 */
export function createWaterMesh(size: number, color: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      waterColor: { value: new THREE.Color(color) },
      deepColor: { value: new THREE.Color(color).multiplyScalar(0.4) },
    },
    vertexShader: `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 pos = position;
        float w1 = sin(pos.x * 0.3 + time * 1.5) * 0.15;
        float w2 = cos(pos.y * 0.25 + time * 1.2) * 0.12;
        float w3 = sin((pos.x + pos.y) * 0.15 + time * 0.8) * 0.08;
        pos.z += w1 + w2 + w3;
        vNormal = normalize(vec3(
          -cos(pos.x * 0.3 + time * 1.5) * 0.045,
          -sin(pos.y * 0.25 + time * 1.2) * 0.03,
          1.0
        ));
        vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 waterColor;
      uniform vec3 deepColor;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
        vec3 col = mix(deepColor, waterColor, fresnel);
        // specular highlight
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
        float spec = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 32.0);
        col += vec3(spec) * 0.3;
        // shimmer
        float shimmer = sin(vWorld.x * 2.0 + time * 3.0) * sin(vWorld.z * 2.0 + time * 2.0) * 0.03;
        col += shimmer;
        gl_FragColor = vec4(col, 0.85);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.userData["water"] = mat;
  return mesh;
}

/**
 * Volumetric-like fog/god-ray effect using a large translucent cone mesh.
 * Lightweight approach that doesn't need render-to-texture.
 */
export function createGodRays(color: number, position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 6; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2 + i * 3, 30 + i * 5, 8, 1, true), mat);
    cone.position.copy(position);
    cone.position.y += 15 + i * 2;
    cone.rotation.z = (Math.random() - 0.5) * 0.15;
    cone.rotation.x = (Math.random() - 0.5) * 0.1;
    group.add(cone);
  }
  group.userData["godRays"] = true;
  return group;
}

/**
 * Animated fire/heat haze shader for torches and explosions.
 */
export function createFireSprite(color: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(0.5, 1.0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      flameColor: { value: new THREE.Color(color) },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.x += sin(time * 8.0 + uv.y * 10.0) * 0.03;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 flameColor;
      varying vec2 vUv;
      void main() {
        float y = vUv.y;
        float flicker = sin(time * 15.0 + vUv.x * 20.0) * 0.1 + 0.9;
        float intensity = (1.0 - y) * flicker;
        intensity *= smoothstep(0.0, 0.3, 1.0 - abs(vUv.x - 0.5) * 2.0);
        vec3 col = flameColor * intensity;
        col = mix(col, vec3(1.0, 0.9, 0.4), intensity * 0.5);
        float alpha = intensity * 0.7;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData["fire"] = mat;
  return mesh;
}

/**
 * Animated grass/vegetation shader for jungle maps.
 */
export function createGrassField(size: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const count = 200;
  const geo = new THREE.PlaneGeometry(0.15, 0.6);
  for (let i = 0; i < count; i++) {
    const blade = new THREE.Mesh(geo, mat);
    blade.position.set(
      (Math.random() - 0.5) * size,
      0.3,
      (Math.random() - 0.5) * size,
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.userData["grassBase"] = blade.rotation.z;
    blade.userData["grassPhase"] = Math.random() * Math.PI * 2;
    group.add(blade);
  }
  group.userData["grassField"] = true;
  return group;
}

/**
 * Atmospheric particle system (dust motes / snow / sand).
 */
export function createAtmosphereParticles(
  count: number,
  color: number,
  bounds: number,
  size: number,
  speed: number,
): THREE.Points {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * bounds;
    positions[i * 3 + 1] = Math.random() * bounds * 0.7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * bounds;
    velocities[i * 3] = (Math.random() - 0.5) * speed;
    velocities[i * 3 + 1] = -Math.random() * speed * 0.5;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData["atmosphere"] = { bounds, speed };
  points.frustumCulled = false;
  return points;
}

/**
 * Update animated shader meshes (water, fire, grass, atmosphere) each frame.
 */
export function updateShaderMeshes(scene: THREE.Scene, time: number, dt: number) {
  scene.traverse((obj) => {
    const mat = (obj as THREE.Mesh).material as THREE.Material | undefined;
    if (mat && (mat as THREE.ShaderMaterial).uniforms) {
      const uniforms = (mat as THREE.ShaderMaterial).uniforms as Record<string, { value: unknown }>;
      if (uniforms["time"]) uniforms["time"].value = time;
    }
    if (obj.userData["grassField"]) {
      obj.children.forEach((blade) => {
        const phase = blade.userData["grassPhase"] as number;
        blade.rotation.z = (blade.userData["grassBase"] as number) + Math.sin(time * 2 + phase) * 0.15;
      });
    }
  });
  // atmosphere particles
  scene.children.forEach((child) => {
    if (child.userData["atmosphere"]) {
      const attr = (child as THREE.Points).geometry.getAttribute("position") as THREE.BufferAttribute;
      const velAttr = (child as THREE.Points).geometry.getAttribute("velocity") as THREE.BufferAttribute;
      const { bounds } = child.userData["atmosphere"] as { bounds: number; speed: number };
      const pos = attr.array as Float32Array;
      const vel = velAttr.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] = (pos[i] ?? 0) + (vel[i] ?? 0) * dt;
        pos[i + 1] = (pos[i + 1] ?? 0) + (vel[i + 1] ?? 0) * dt;
        pos[i + 2] = (pos[i + 2] ?? 0) + (vel[i + 2] ?? 0) * dt;
        if ((pos[i + 1] ?? 0) < 0) {
          pos[i] = (Math.random() - 0.5) * bounds;
          pos[i + 1] = bounds * 0.7;
          pos[i + 2] = (Math.random() - 0.5) * bounds;
        }
      }
      attr.needsUpdate = true;
    }
  });
}
