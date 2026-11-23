// Horror Engine v3: Frame-deterministic 3D Atmospheric FX (rising incense smoke wisps, floating dust motes,
// feathered volumetric light cones, and perspective-locked flat ground decals). All meshes stay on NOINK.

import * as THREE from "three";
import { FPS, type V3 } from "./camera";
import { NOINK } from "./ink";
import { stylizedShade } from "./shade";

const hash = (i: number, s: number) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export type SmokeWisps3D = {
  group: THREE.Group;
  update: (frame: number, active?: boolean) => void;
};

export type DustMotes3D = {
  group: THREE.Group;
  update: (frame: number) => void;
};

/** Soft feathered rising smoke wisps for incense bowls, extinguished oil lamps, or candles (pure function of frame). */
export function addRisingSmokeWisps(
  parent: THREE.Object3D,
  origin: V3,
  opts: { count?: number; height?: number; color?: string; opacity?: number; radius?: number } = {},
): SmokeWisps3D {
  const count = opts.count ?? 8;
  const height = opts.height ?? 1.1;
  const baseRadius = opts.radius ?? 0.055;
  const maxOp = opts.opacity ?? 0.26;
  const col = new THREE.Color(opts.color ?? "#c4c6d4");

  const group = new THREE.Group();
  group.name = "SmokeWisps3D";
  group.position.set(...origin);
  group.layers.set(NOINK);

  const geo = new THREE.PlaneGeometry(1, 1);
  const mats: THREE.ShaderMaterial[] = [];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uCol: { value: col.clone() },
        uAlpha: { value: maxOp },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uAlpha; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float a = exp(-r * r * 3.4) * smoothstep(1.0, 0.35, r);
          gl_FragColor = vec4(uCol, a * uAlpha);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.layers.set(NOINK);
    m.userData.noOutline = true;
    mats.push(mat);
    group.add(m);
  }
  parent.add(group);

  const update = (frame: number, active = true) => {
    group.visible = active;
    if (!active) return;
    const t = frame / FPS;
    for (let i = 0; i < count; i++) {
      const m = group.children[i] as THREE.Mesh;
      const u = ((t * 0.24 + i / count) % 1 + 1) % 1;
      const swayX = Math.sin(u * Math.PI * 2.4 + i * 1.9 + t * 0.8) * (0.015 + 0.08 * u);
      const swayZ = Math.cos(u * Math.PI * 1.9 + i * 2.3 + t * 0.6) * (0.012 + 0.06 * u);
      m.position.set(swayX, u * height, swayZ);
      const sc = baseRadius * (0.8 + u * 3.6);
      m.scale.set(sc, sc * 1.35, 1);
      m.rotation.z = u * 1.4 + i;
      const fade = Math.sin(u * Math.PI) * (1 - u * 0.35);
      mats[i].uniforms.uAlpha.value = maxOp * fade;
    }
  };
  update(0, true);
  return { group, update };
}

/** Floating atmospheric dust motes drifting inside flashlight cones, moonbeams, or dark rooms. */
export function addDustMotes(
  parent: THREE.Object3D,
  center: V3,
  bounds: V3,
  count = 24,
  seed = 11,
  color = "#d6deec",
): DustMotes3D {
  const group = new THREE.Group();
  group.name = "DustMotes3D";
  group.position.set(...center);
  group.layers.set(NOINK);

  const geo = new THREE.SphereGeometry(0.0085, 5, 4);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const seeds: Array<[number, number, number, number]> = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.layers.set(NOINK);
    m.userData.noOutline = true;
    const bx = (hash(i, seed) - 0.5) * bounds[0];
    const by = (hash(i, seed + 7) - 0.5) * bounds[1];
    const bz = (hash(i, seed + 19) - 0.5) * bounds[2];
    const spd = 0.25 + hash(i, seed + 31) * 0.55;
    seeds.push([bx, by, bz, spd]);
    group.add(m);
  }
  parent.add(group);

  const update = (frame: number) => {
    const t = frame / FPS;
    for (let i = 0; i < count; i++) {
      const [bx, by, bz, spd] = seeds[i];
      const m = group.children[i];
      m.position.set(
        bx + Math.sin(t * spd + i * 1.7) * 0.12,
        by + Math.cos(t * spd * 0.7 + i * 2.3) * 0.10,
        bz + Math.sin(t * spd * 0.5 + i * 0.9) * 0.12,
      );
    }
  };
  update(0);
  return { group, update };
}

/** Soft feathered volumetric light cone (window moonbeam, corridor overhead cone, or streetlamp haze). */
export function addVolumetricCone(
  parent: THREE.Object3D,
  origin: V3,
  target: V3,
  rTop: number,
  rBot: number,
  color = "#b8d0f2",
  opacity = 0.11,
): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const a = new THREE.Vector3(...origin);
  const b = new THREE.Vector3(...target);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.1, dir.length());
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);

  const geo = new THREE.CylinderGeometry(rTop, rBot, len, 18, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.45);
        float vertical = smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
        gl_FragColor = vec4(uCol, edge * vertical * uOpacity);
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  mesh.layers.set(NOINK);
  mesh.userData.noOutline = true;
  parent.add(mesh);
  return { mesh, mat };
}

/** Create a perspective-locked horizontal flat decal (water puddles, footprints, blood/ash marks, moonlight floor pool). */
export function createFlatDecalMesh(
  tex: THREE.Texture,
  w: number,
  h: number,
  opacity = 0.85,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateX(-Math.PI * 0.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.layers.set(NOINK);
  mesh.userData.noOutline = true;
  return mesh;
}

/** Soft feathered ground Contact Ambient Occlusion shadow disc (grounds characters, tables, coffins, gurneys). */
export function addContactShadow(
  parent: THREE.Object3D,
  pos: V3,
  rx: number,
  rz: number = rx,
  opacity = 0.58,
  color = "#06040a",
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(rx * 2, rz * 2);
  geo.rotateX(-Math.PI * 0.5);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      uCol: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.12, r);
        a = a * a * uOpacity;
        gl_FragColor = vec4(uCol, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ContactShadowAO";
  mesh.position.set(pos[0], pos[1] + 0.004, pos[2]);
  mesh.layers.set(NOINK);
  mesh.userData.noOutline = true;
  parent.add(mesh);
  return mesh;
}

let cachedHaloTex: THREE.CanvasTexture | null = null;
function getHaloTex(): THREE.CanvasTexture {
  if (cachedHaloTex) return cachedHaloTex;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 256;
    const g = cv.getContext("2d")!;
    const gr = g.createRadialGradient(128, 128, 2, 128, 128, 126);
    gr.addColorStop(0, "rgba(255,255,255,1.0)");
    gr.addColorStop(0.24, "rgba(255,244,218,0.55)");
    gr.addColorStop(0.58, "rgba(255,220,175,0.16)");
    gr.addColorStop(1, "rgba(255,200,150,0.0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    cachedHaloTex = new THREE.CanvasTexture(cv);
  } else {
    cachedHaloTex = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  cachedHaloTex.colorSpace = THREE.SRGBColorSpace;
  return cachedHaloTex;
}

/** Soft additive atmospheric radial light halo around oil lamps, altar candles, or foggy streetlamps. */
export function addLampHalo3D(
  parent: THREE.Object3D,
  pos: V3,
  radius = 0.65,
  color = "#ffb964",
  opacity = 0.28,
): { sprite: THREE.Sprite; setIntensity: (k: number) => void } {
  const mat = new THREE.SpriteMaterial({
    map: getHaloTex(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.name = "LampHalo3D";
  sprite.position.set(...pos);
  sprite.scale.set(radius * 2, radius * 2, 1);
  sprite.layers.set(NOINK);
  sprite.userData.noOutline = true;
  parent.add(sprite);
  const setIntensity = (k: number) => {
    sprite.visible = k > 0.01;
    mat.opacity = opacity * k;
  };
  return { sprite, setIntensity };
}

/** Reflective wet floor/asphalt puddle catching real stylized specular sheen from PointLights & SpotLights. */
export function addWetPuddleDecal(
  parent: THREE.Object3D,
  pos: V3,
  rx = 0.9,
  rz = 1.4,
  tint = "#1a2230",
  opacity = 0.72,
): THREE.Mesh {
  const shape = new THREE.Shape();
  const segs = 20;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const wob = 1 + 0.14 * Math.sin(a * 3 + pos[0] * 2.1) + 0.09 * Math.cos(a * 5 + pos[2] * 1.7);
    const x = Math.cos(a) * rx * wob;
    const y = Math.sin(a) * rz * wob;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ShapeGeometry(shape, 16);
  geo.rotateX(-Math.PI * 0.5);
  const mat = stylizedShade(
    new THREE.MeshPhongMaterial({
      color: tint,
      specular: "#c8dcf4",
      shininess: 96,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "WetPuddleDecal";
  mesh.position.set(pos[0], pos[1] + 0.005, pos[2]);
  mesh.layers.set(NOINK);
  mesh.userData.noOutline = true;
  parent.add(mesh);
  return mesh;
}
