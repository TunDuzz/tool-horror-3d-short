// Horror Engine v2: 2D Gothic Billboard Cast & Flat Decal Pool in the 3D world.
// Supports 3 views (front / side / back with over-the-shoulder glance), translucent ghosts, unlit eye glints,
// perspective-locked flat ground/water decals (`pushFlatDecal`), and real dynamic PointLight card shading.

import * as THREE from "three";
import { Pen, bodyFront, bodySide, bodyBack, fxContact, Outfit, PoseOpts } from "./toon";
import { FPS, LightKey, clamp01 } from "./camera";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };

const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
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
      if (l) l.push(r);
      else want.set(r.key, [r]);
    }
    for (const [key, e] of this.live) {
      if (!want.has(key)) {
        this.live.delete(key);
        this.free.push(e);
      }
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
export const SU = 0.00215; // metres per design unit (~1.84 m tall Gothic adult)
export const BODY = (() => {
  const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU);
  g.translate(0, (970 - 500) * SU, 0);
  return g;
})();
export const CARD = new THREE.PlaneGeometry(1, 1);

/** Lit flat Gothic character card: cardShade() with real PointLight & lightning sync, NOINK layer. */
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

/** Effect card: hard cut-out, soft atmospheric sprite, perspective-locked flat decal, or multiply ground blob. */
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

  use(soft: boolean) {
    this.mesh.material = soft ? this.soft : this.mat;
  }

  bind(renderOrder = 0) {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) {
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
        t.needsUpdate = true;
      }
      this.blob.map = t;
      this.mesh.material = this.blob;
      this.mesh.renderOrder = 0.5;
    } else {
      this.mat.map = t;
      this.soft.map = t;
      this.mesh.renderOrder = renderOrder;
    }
  }
}

// ---------------- placements & view helpers ----------------
export type ViewKind = "front" | "side" | "back";
export type ViewResult = { view: ViewKind; side: boolean; back: boolean; mirror: boolean; facing: -1 | 0 | 1; fs: number };

export type Place = {
  key: string;
  draw: (p: Pen) => void;
  x: number;
  y: number;
  z: number;
  scale?: number;
  mirror?: boolean;
  yaw?: number;
  roll?: number;
  opacity?: number;
  unlit?: boolean;
  size?: [number, number, number];
  geo?: THREE.BufferGeometry;
  castShadow?: boolean;
  cull?: boolean;
};

export type FxPlace = {
  key: string;
  cw: number;
  ch: number;
  draw: (p: Pen) => void;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  flat?: boolean;
  rot?: number;
  soft?: boolean;
  renderOrder?: number;
};

export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const q = (v: number, n = 60) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tmp = new THREE.Vector3();

/** Drawing resolution tier by distance from camera. */
export const tierForDistance = (d: number): [number, number, number] =>
  d < 3.4 ? [1500, 2500, 2.5] : d < 7.0 ? [960, 1600, 1.6] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

/** Canvas angle the key light comes FROM on an upright billboard facing the camera, quantised to 45-deg steps. */
export const light2D = (cam: CamInfo, sunDir: THREE.Vector3, mirror: boolean): number => {
  const sx = sunDir.dot(cam.right) * (mirror ? -1 : 1), sy = -sunDir.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** Compute true 3-way view (front / side / back), horizontal mirroring, and 3/4 facing bias from character heading (dx, dz). */
export const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number): ViewResult => {
  const fl = Math.hypot(dx, dz) || 1;
  const fdx = dx / fl, fdz = dz / fl;
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * fdx + tz * fdz) / tl; // +1 = facing camera, 0 = side, -1 = back to camera
  const rightDot = fdx * cam.right.x + fdz * cam.right.z;
  const mirror = rightDot < 0;
  const view: ViewKind = c < -0.45 ? "back" : c < 0.48 ? "side" : "front";
  const facing: -1 | 0 | 1 = view === "front" ? (rightDot > 0.22 ? 1 : rightDot < -0.22 ? -1 : 0) : 0;
  return {
    view,
    side: view === "side",
    back: view === "back",
    mirror,
    facing,
    fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20,
  };
};

const LID = [0.5, 1, 1, 0.5];
/** Eyelid openness (0 open .. 1 shut): deterministic blinks + shock blink cues. */
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
    s += Math.round(24 + 66 * hh(i * 31 + n, 13));
  }
  return 0;
};

export const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

/** Place a Gothic Ink-Noir character supporting front, side, and back views with continuous pose animation. */
export const placePerson = (
  cam: CamInfo,
  sunDir: THREE.Vector3,
  who: { i: number; o: Outfit; okey: string },
  x: number,
  y: number,
  z: number,
  view: Partial<ViewResult> & { view?: ViewKind; side?: boolean; back?: boolean; mirror?: boolean },
  opts: PoseOpts,
  scale = 1,
): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.15 * scale, z)) / scale;
  const [w, h, k] = tierForDistance(d);
  const vKind: ViewKind = view.view ?? (view.back ? "back" : view.side ? "side" : "front");
  const mirror = vKind === "side" && !!view.mirror;
  const light = light2D(cam, sunDir, mirror);
  const seed = seedOf(who.i);
  const pOpts: PoseOpts = {
    facing: view.facing ?? 0,
    ...opts,
    light,
    seed,
  };
  const prefix = vKind === "back" ? "B" : vKind === "side" ? "S" : "F";
  const key = `${prefix}|${who.okey}|${fkey(pOpts)}`;
  return {
    key,
    x,
    y,
    z,
    scale,
    mirror,
    draw: (p) =>
      vKind === "back" ? bodyBack(p, who.o, pOpts) : vKind === "side" ? bodySide(p, who.o, pOpts) : bodyFront(p, who.o, pOpts),
    size: [w, h, k],
  };
};

/** Push 1–2 offset translucent double-exposure afterimages beside an entity for hallucinatory horror smear / twitch trails. */
export const pushAfterimage = (
  out: Stage,
  base: Place,
  offsets: [number, number, number, number][], // [dx, dy, dz, opacity]
  extraRoll = 0.04,
): void => {
  offsets.forEach(([dx, dy, dz, op], idx) => {
    out.places.push({
      ...base,
      x: base.x + dx,
      y: base.y + dy,
      z: base.z + dz,
      opacity: op,
      roll: (base.roll ?? 0) + (idx % 2 === 0 ? extraRoll : -extraRoll),
      castShadow: false,
    });
  });
};

/** Push a perspective-locked HORIZONTAL decal (water ripples, wet mud footprints, puddles, ground markings). */
export const pushFlatDecal = (
  out: Stage,
  key: string,
  cw: number,
  ch: number,
  draw: (p: Pen) => void,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  rot = 0,
  renderOrder = 0.6,
): void => {
  out.fx.push({
    key,
    cw,
    ch,
    draw,
    x,
    y,
    z,
    w,
    h,
    flat: true,
    rot,
    soft: true,
    renderOrder,
  });
};

const CONTACT: Record<LightKey, [number, number, number]> = {
  night: [0.14, 0.16, 0.26],
  candle: [0.16, 0.12, 0.18],
  storm: [0.16, 0.19, 0.24],
  eerie: [0.14, 0.18, 0.22],
  blood: [0.18, 0.10, 0.16],
};
const toSrgb = (v: number) => {
  const c = clamp01(v);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
};
const hexOf = (c: [number, number, number], k: number) =>
  "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");

/** Push a tight ground contact shadow under a character's boots. */
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
  const cc = hexOf(CONTACT[light], k);
  out.fx.push({
    key: `blob|contact|${cc}`,
    cw: 128,
    ch: 128,
    draw: (p) => fxContact(p, cc),
    x: x + ox * 0.03 * sc,
    y: y + 0.014,
    z: z + oz * 0.03 * sc,
    w: 0.62 * sc,
    h: 0.44 * sc,
    flat: true,
    rot,
  });
};

/** Manages Actor/Fx billboard pools, frustum-culls, flushes canvases, and hides unused sprites every frame. */
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
      if (p.cull !== false && !this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.0 * sc2, p.z), 3.6 * Math.max(1, sc2)))) continue;
      const a = this.actor(ai++);
      const targetGeo = p.geo ?? BODY;
      if (a.mesh.geometry !== targetGeo) a.mesh.geometry = targetGeo;
      const [w, h, k] = p.size ?? [480, 800, 0.8];
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
    const fused: { e: Fx; order: number }[] = [];
    for (const p of stage.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h) * 1.4))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) {
        e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      } else {
        e.mesh.quaternion.copy(cam.quaternion);
        e.mesh.rotateZ(p.rot ?? 0);
      }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push({ e, order: p.renderOrder ?? 0 });
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;

    this.pool.flush();
    for (const u of used) u.a.bind(u.opacity, u.unlit);
    for (const f of fused) f.e.bind(f.order);
  }

  dispose() {
    this.pool.dispose();
  }
}
