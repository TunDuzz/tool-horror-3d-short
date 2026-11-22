// Neutral 2D billboard cast & effect pool in the 3D world.
// Characters are yaw-only billboards shaded by cardShade() (scene tint, bright shadow floor, side gradient
// toward the sun) and live on layer NOINK so the world ink pass never draws boxes around their quads.

import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxShadow, fxContact, Outfit, FrontOpts, SideOpts } from "./toon";
import { FPS, LightKey, clamp01 } from "./camera";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };

const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { cv, tex, w, h };
};

export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];

  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }

  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) {
      const l = want.get(r.key);
      if (l) l.push(r); else want.set(r.key, [r]);
    }
    for (const [key, e] of this.live) {
      if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, e.w, e.h);
        g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }

  dispose() {
    for (const e of this.live.values()) e.tex.dispose();
    for (const e of this.free) e.tex.dispose();
    this.live.clear();
    this.free = [];
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  return new THREE.CanvasTexture(c);
})();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const BODY = (() => {
  const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU);
  g.translate(0, (975 - 500) * SU, 0);
  return g;
})();
export const CARD = new THREE.PlaneGeometry(1, 1);

/** Lit flat character card: cardShade() material, receives shadows, NOINK layer, renderOrder 1 (2 when translucent). */
export class Actor {
  mesh: THREE.Mesh;
  mat: THREE.MeshLambertMaterial;
  ghostMat: THREE.MeshLambertMaterial;
  unlitMat: THREE.MeshBasicMaterial;
  dmat: THREE.MeshDepthMaterial;
  r: Req | null = null;

  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.ghostMat = cardShade(new THREE.MeshLambertMaterial({ map: blank, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
    this.ghostMat.alphaToCoverage = false;
    this.unlitMat = new THREE.MeshBasicMaterial({ map: blank, transparent: true, opacity: 1, depthWrite: false, fog: true, side: THREE.DoubleSide });
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => {
      const rt = r.getRenderTarget();
      const rw = rt ? rt.width : r.domElement.width, rh = rt ? rt.height : r.domElement.height;
      CARD_K.uPx.value = Math.min(rw, rh) / 1080;
    };
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ";
    this.mesh.renderOrder = 1;
    this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }

  bind(opacity = 1, unlit = false) {
    const t = this.r?.tex;
    if (!t) return;
    this.dmat.map = t;
    const translucent = opacity < 0.99;
    if (unlit) {
      this.unlitMat.map = t;
      this.unlitMat.opacity = opacity;
      this.unlitMat.transparent = translucent;
      this.unlitMat.alphaTest = translucent ? 0 : 0.5;
      this.unlitMat.depthWrite = !translucent;
      this.mesh.material = this.unlitMat;
      this.mesh.renderOrder = translucent ? 2 : 1;
    } else if (translucent) {
      this.ghostMat.map = t;
      this.ghostMat.opacity = opacity;
      this.mesh.material = this.ghostMat;
      this.mesh.renderOrder = 2;
    } else {
      this.mat.map = t;
      this.mesh.material = this.mat;
      this.mesh.renderOrder = 1;
    }
  }
}

/** Unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist), or multiply ground blob. */
export class Fx {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  soft: THREE.MeshBasicMaterial;
  blob: THREE.MeshBasicMaterial;
  r: Req | null = null;

  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false;
    this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }

  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }

  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t;
      this.mesh.material = this.blob;
      this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t;
      this.soft.map = t;
      this.mesh.renderOrder = 0;
    }
  }
}

// ---------------- placements & pure helpers ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number;
  opacity?: number; unlit?: boolean;
  size?: [number, number, number]; geo?: THREE.BufferGeometry; castShadow?: boolean; cull?: boolean;
};
export type FxPlace = {
  key: string; cw: number; ch: number; draw: (p: Pen) => void;
  x: number; y: number; z: number; w: number; h: number;
  flat?: boolean; rot?: number; soft?: boolean;
};
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tmp = new THREE.Vector3();

/** Drawing resolution tier by distance from camera (sized for 1440 x 2560 final). */
export const tierForDistance = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

/** Canvas angle the sun comes FROM on an upright billboard facing the camera, quantised to 45-degree steps. */
export const light2D = (cam: CamInfo, sunDir: THREE.Vector3, mirror: boolean): number => {
  const sx = sunDir.dot(cam.right) * (mirror ? -1 : 1), sy = -sunDir.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** Front / side view and mirroring for someone at (x, z) facing/walking along (dx, dz). */
export const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return {
    side: c < 0.57,
    mirror: dx * cam.right.x + dz * cam.right.z < 0,
    fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20,
  };
};

const LID = [0.5, 1, 1, 0.5];
/** Eyelid openness (0 open .. 1 shut): 4-frame blinks every 0.5-2.3 s plus blink across expression swaps. */
export const lidAt = (t: number, i: number, swaps: number[] = [], fps = FPS): number => {
  const lead = 2 / fps, f = Math.round(t * fps);
  for (const ts of swaps) {
    const k = f - Math.round((ts - lead) * fps) + 1;
    if (k >= 0 && k < 4) return LID[k];
  }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};

/** Deterministic cache key for character option objects (quantising floats). */
export const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

/** Build a Place record for a 600 x 1000 character drawing scaled by camera distance and lit from `sunDir`. */
export const placePerson = (
  cam: CamInfo,
  sunDir: THREE.Vector3,
  who: { i: number; o: Outfit; okey: string },
  x: number,
  y: number,
  z: number,
  view: { side: boolean; mirror: boolean },
  fo: FrontOpts,
  so: SideOpts,
  scale = 1,
): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tierForDistance(d);
  const mirror = view.side && view.mirror;
  const light = light2D(cam, sunDir, mirror);
  const seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed };
  const s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key,
    x,
    y,
    z,
    scale,
    mirror,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

const CONTACT: Record<LightKey, [number, number, number]> = {
  day: [0.2, 0.21, 0.33],
  golden: [0.24, 0.2, 0.33],
  night: [0.16, 0.18, 0.28],
  candle: [0.18, 0.14, 0.20],
  storm: [0.18, 0.21, 0.26],
  eerie: [0.16, 0.20, 0.24],
  blood: [0.20, 0.12, 0.18],
};
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => {
  const c = clamp01(v);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};
const hexOf = (c: [number, number, number], k: number) =>
  "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

/** Push a tight ground contact shadow (plus a soft directional tail by day) into `out.fx`. */
export const pushContactShadow = (
  out: Stage,
  sunDir: THREE.Vector3,
  light: LightKey,
  x: number,
  y: number,
  z: number,
  sc = 1,
  k = 1,
): void => {
  const hl = Math.hypot(sunDir.x, sunDir.z) || 1, ox = -sunDir.x / hl, oz = -sunDir.z / hl, rot = Math.atan2(-ox, -oz);
  if (light === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, sunDir.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({
      key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc),
      x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot,
    });
  }
  const cc = hexOf(CONTACT[light], k);
  out.fx.push({
    key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc),
    x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot,
  });
};

/** Manages Actor/Fx billboard pools for a World, frustum-culls, flushes canvases, and hides unused sprites every frame. */
export class CastStage {
  readonly pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private sph = new THREE.Sphere();

  constructor(private parent: THREE.Object3D) {}

  private actor(i: number) {
    while (this.actors.length <= i) this.actors.push(new Actor(this.parent));
    return this.actors[i];
  }

  private fx(i: number) {
    while (this.fxs.length <= i) this.fxs.push(new Fx(this.parent));
    return this.fxs[i];
  }

  apply(stage: Stage, cam: THREE.PerspectiveCamera, castShadow = false) {
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: { a: Actor; opacity: number; unlit: boolean }[] = [];
    for (const p of stage.places) {
      const sc2 = p.scale ?? 1;
      if (p.cull !== false && !this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * Math.max(1, sc2)))) continue;
      const a = this.actor(ai++);
      const targetGeo = p.geo ?? BODY;
      if (a.mesh.geometry !== targetGeo) a.mesh.geometry = targetGeo;
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      const opacity = p.opacity ?? 1;
      const unlit = !!p.unlit;
      a.mesh.visible = opacity > 0.005;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = opacity >= 0.99 && !unlit ? (p.castShadow ?? castShadow) : false;
      used.push({ a, opacity, unlit });
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;

    let fi = 0;
    const fused: Fx[] = [];
    for (const p of stage.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;

    this.pool.flush();
    for (const u of used) u.a.bind(u.opacity, u.unlit);
    for (const e of fused) e.bind();
  }

  dispose() {
    this.pool.dispose();
  }
}
