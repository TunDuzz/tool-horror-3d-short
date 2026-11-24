// Horror Engine v4: Modular Visceral Dark & Body Horror 3D Anatomy Kit (100% Neutral).
// Builds continuous, organic, vertex-sculpted primal-fear anatomy (ZERO floating tubes/blocks):
//   - Deeply hollowed 3D skull eye sockets, sunken starved cheeks, protruding brow/zygomatic bones, skeletal nasal pit
//   - Recessed wet glossy 3D eyeballs seated deep inside shadowed orbital hollows (sanpaku, weepingIchor, voidSockets, stitched, multiEye)
//   - Articulated 3D dislocated lower jaw (sockets.jaw) + recessed black throat + 18 crooked aged-bone 3D teeth + fine ichor threads
//   - Continuous vertex-sculpted fluted tendon neck + continuous vertex-sculpted emaciated ribcage/clavicles/spine
//   - Continuous shredded V-neck hospital gown / burial shroud (zero waist seam!) + 3-joint skeletal spider claws + 2 extra shadowy arms

import * as THREE from "three";
import { NOINK } from "./ink";
import { rng } from "./paint";
import { stylizedShade } from "./shade";

export type EyeHorrorMode = "sanpaku" | "voidSockets" | "weepingIchor" | "stitched" | "multiEye";

export type BodyHorrorConfig = {
  skullHollows?: boolean;      // Deep concave 3D skull eye pits, hollow cheeks, brow ridge & skeletal nasal cavity
  jawDrop3D?: number;          // 0..1: articulated 3D dislocated lower jaw hinged downward exposing black throat
  crookedTeeth?: boolean;      // 18 jagged aged-bone 3D teeth (upper + lower arc) + dark gums + fine wet ichor threads
  neckStretch?: number;        // 1.0..2.3: unnaturally elongated vertex-sculpted fluted tendon neck
  exposedRibs?: boolean;       // Continuous vertex-sculpted emaciated ribcage & sharp clavicles visible through torn V-neck
  protrudingSpine?: boolean;   // Sculpted dorsal vertebrae ridges along hunched spine
  clawHands?: boolean;         // Elongated skeletal 3-joint spider fingers with knobby joints & curved black claws
  twistedJoints?: boolean;     // Unnatural asymmetric elbow/wrist joint twists
  extraArms?: number;          // 0 | 2: two gaunt dark extra arms emerging from behind shoulders/ribs
  cadaverSkin?: boolean;       // 1024px veined decaying corpse skin + BumpMap + clammy specular Phong material
  bloodStainLevel?: number;    // 0..1: dried/seeping dark crimson-brown blood on mouth, gown, chest, claws
  eyeHorror?: EyeHorrorMode;   // Primal 3D eye horror inside skull sockets
  cheekSplitGrin?: boolean;    // Torn stretched cheek tissue connecting upper maxilla to dislocated jaw
  tatteredCloth?: boolean;     // Continuous hanging tattered robe/gown with jagged shredded hem & V-neck tear
};

type Disposable = { dispose(): void };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * High-resolution sculpted 3D cadaver skull head (40x30) with deep concave 3D orbital sockets,
 * protruding brow & zygomatic ridges, starved sunken cheeks, skeletal nasal cavity,
 * and open upper-palate cavity when an articulated 3D lower jaw is attached.
 */
export function buildHorrorSkullHeadGeo(
  rx: number,
  ry: number,
  rz: number,
  hasJawDrop = true,
  lowPoly = false,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, lowPoly ? 22 : 40, lowPoly ? 16 : 30);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Tall bony cranium with slightly pinched temples
    if (y > 0.18) {
      const topT = clamp((y - 0.18) / 0.82, 0, 1);
      x *= 0.94 + 0.08 * Math.sin(topT * Math.PI);
      z *= 1.03;
    }

    // Taper lower face tightly into gaunt maxilla bone
    if (y < 0.06) {
      const jt = clamp((0.06 - y) / 1.06, 0, 1);
      x *= 1 - 0.44 * jt * jt;
      z *= 1 - 0.24 * jt;
    }

    if (z > 0.12) {
      const frontMask = clamp((z - 0.12) / 0.55, 0, 1);

      // 1. Wide, deep concave 3D orbital skull sockets (recessed strongly so eyeballs nestle INSIDE dark bony cavities!)
      for (const s of [-1, 1]) {
        const dx = (x - s * 0.36) / 0.27;
        const dy = (y - 0.14) / 0.24;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2.4) {
          const pit = Math.exp(-d2 * 1.75) * frontMask;
          z -= 0.52 * pit;
        }
      }

      // 2. Heavy overhanging supraorbital brow ridge casting real shadow over eye pits
      const browY = (y - 0.38) / 0.13;
      const browX = x / 0.72;
      const browBump = Math.exp(-(browY * browY) * 1.6) * clamp(1 - browX * browX, 0, 1) * frontMask;
      z += 0.17 * browBump;

      // 3. Sharp protruding zygomatic cheekbones directly beneath eye pits
      for (const s of [-1, 1]) {
        const zx = (x - s * 0.54) / 0.23;
        const zy = (y + 0.07) / 0.14;
        const zBump = Math.exp(-(zx * zx + zy * zy) * 1.6) * frontMask;
        x += s * 0.13 * zBump;
        z += 0.14 * zBump;
      }

      // 4. Deeply hollowed starved cheeks & pinched temples
      for (const s of [-1, 1]) {
        const cx = (x - s * 0.45) / 0.24;
        const cy = (y + 0.34) / 0.26;
        const cPit = Math.exp(-(cx * cx + cy * cy) * 1.55) * frontMask;
        x -= s * 0.24 * cPit;
        z -= 0.20 * cPit;

        const tx = (x - s * 0.72) / 0.22;
        const ty = (y - 0.28) / 0.24;
        const tPit = Math.exp(-(tx * tx + ty * ty) * 1.8);
        x -= s * 0.13 * tPit;
      }

      // 5. Recessed triangular skeletal nasal cavity at face center
      const nx = x / 0.13;
      const ny = (y + 0.05) / 0.16;
      const nPit = Math.exp(-(nx * nx + ny * ny) * 2.0) * frontMask;
      z -= 0.32 * nPit;

      // 6. Smoothly arched open upper-mouth cavern when articulated lower jaw drops open
      if (hasJawDrop && y < -0.18) {
        const mx = x / 0.38;
        const my = (y + 0.54) / 0.36;
        const mCav = Math.exp(-(mx * mx * 1.35 + my * my * 1.35)) * frontMask;
        z -= 0.54 * mCav;
        if (y < -0.56 && Math.abs(x) < 0.48) {
          y = -0.56 + (y + 0.56) * 0.22;
        }
      }
    }

    pos.setXYZ(i, x * rx, y * ry, z * rz);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Generate glossy bloodshot sanpaku eyeball CanvasTexture (tiny pinpoint black pupil + deep shadowed sclera rim). */
let sanpakuTexCache: THREE.CanvasTexture | null = null;
function getSanpakuEyeTex(): THREE.CanvasTexture {
  if (sanpakuTexCache) return sanpakuTexCache;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 256;
    const g = cv.getContext("2d")!;
    const r = rng(907);

    // Muted bloodshot yellowed sclera with deep dark socket falloff around edges (prevents ping-pong ball look!)
    const bg = g.createRadialGradient(128, 128, 14, 128, 128, 128);
    bg.addColorStop(0, "#d8d0c4");
    bg.addColorStop(0.45, "#bab0a2");
    bg.addColorStop(0.72, "#764644");
    bg.addColorStop(1, "#1e0a0d");
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);

    // Jagged crimson bloodshot capillaries radiating inward toward iris
    g.lineCap = "round";
    for (let i = 0; i < 38; i++) {
      const ang = (i / 38) * Math.PI * 2 + (r() - 0.5) * 0.14;
      let rad = 126;
      let a = ang;
      g.strokeStyle = `rgba(124, 14, 18, ${(0.48 + r() * 0.42).toFixed(2)})`;
      g.lineWidth = 1.2 + r() * 1.8;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad);
      for (let s = 0; s < 4; s++) {
        rad -= 18 + r() * 14;
        a += (r() - 0.5) * 0.16;
        if (rad < 34) break;
        g.lineTo(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad);
      }
      g.stroke();
    }

    // Pale sickly grey-ochre iris rim + tiny unblinking pinpoint black pupil
    g.fillStyle = "#2d221f";
    g.beginPath();
    g.arc(128, 128, 22, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#6c5d4c";
    g.beginPath();
    g.arc(128, 128, 16, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#030105";
    g.beginPath();
    g.arc(128, 128, 9.5, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "rgba(250, 246, 238, 0.85)";
    g.beginPath();
    g.arc(124, 124, 2.6, 0, Math.PI * 2);
    g.fill();

    sanpakuTexCache = new THREE.CanvasTexture(cv);
  } else {
    sanpakuTexCache = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  sanpakuTexCache.colorSpace = THREE.SRGBColorSpace;
  return sanpakuTexCache;
}

/**
 * Populate concave 3D skull sockets & nasal cavity with deeply recessed wet 3D eyeballs,
 * bruised orbital shadow rings, weeping ichor streaks, stitched sutures, void pits, or multi-eye clusters.
 */
export function buildHorrorEyes3D(
  head: THREE.Group,
  cfg: BodyHorrorConfig,
  rx: number,
  ry: number,
  rz: number,
  hScale: number,
  disposables: Disposable[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = "bodyHorrorEyes";
  const mode: EyeHorrorMode = cfg.eyeHorror ?? "sanpaku";

  const voidMat = new THREE.MeshBasicMaterial({ color: "#050207" });
  const bruisedMat = stylizedShade(
    new THREE.MeshLambertMaterial({ color: "#190c14" }),
    0.35,
    0.3,
  );
  const ichorMat = stylizedShade(
    new THREE.MeshPhongMaterial({ color: "#0b0306", specular: "#82545a", shininess: 88 }),
    0.35,
    0.05,
  );
  disposables.push(voidMat, bruisedMat, ichorMat);

  // Dark recessed skeletal nasal pit (inverted tear-drop split by thin bony nasal septum)
  const nosePitGeo = new THREE.ConeGeometry(0.013 * hScale, 0.034 * hScale, 3);
  nosePitGeo.scale(0.86, 1.0, 0.36);
  disposables.push(nosePitGeo);
  const nosePit = new THREE.Mesh(nosePitGeo, voidMat);
  nosePit.name = "skullNasalPit";
  nosePit.position.set(0, -ry * 0.05, rz * 0.72);
  nosePit.userData.noOutline = true;
  g.add(nosePit);

  const eyeY = ry * 0.14;
  const eyeZ = rz * 0.56;

  // Deep bruised dark orbital socket liners framing both deeply recessed eyes
  for (const s of [-1, 1] as const) {
    const sx = s * rx * 0.36;
    const rimGeo = new THREE.SphereGeometry(0.028 * hScale, 14, 10);
    rimGeo.scale(1.18, 1.06, 0.38);
    disposables.push(rimGeo);
    const rim = new THREE.Mesh(rimGeo, voidMat);
    rim.name = s < 0 ? "eyeSocketVoidL" : "eyeSocketVoidR";
    rim.position.set(sx, eyeY, eyeZ - 0.004 * hScale);
    rim.userData.noOutline = true;
    g.add(rim);

    // Subtle dark bruised orbital skin ring hugging the outer edge of the pit
    const ringGeo = new THREE.TorusGeometry(0.024 * hScale, 0.0055 * hScale, 6, 14);
    ringGeo.scale(1.12, 1.0, 0.55);
    disposables.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, bruisedMat);
    ring.name = s < 0 ? "orbitalBruiseL" : "orbitalBruiseR";
    ring.position.set(sx, eyeY, eyeZ + 0.008 * hScale);
    ring.userData.noOutline = true;
    g.add(ring);
  }

  if (mode === "sanpaku" || mode === "weepingIchor") {
    const eyeMat = stylizedShade(
      new THREE.MeshPhongMaterial({
        map: getSanpakuEyeTex(),
        color: "#d6cec4",
        emissive: new THREE.Color("#140d0e"),
        specular: "#e8e0d8",
        shininess: 92,
      }),
      0.85,
      0.0,
    );
    disposables.push(eyeMat);

    // Deeply recessed, subtly asymmetric staring bloodshot 3D eyeballs peering from the dark sockets!
    for (const s of [-1, 1] as const) {
      const asym = s < 0 ? 1.08 : 0.92;
      const eGeo = new THREE.SphereGeometry(0.0185 * hScale * asym, 16, 12);
      eGeo.rotateY(-Math.PI * 0.5);
      disposables.push(eGeo);
      const em = new THREE.Mesh(eGeo, eyeMat);
      em.name = s < 0 ? "horrorEyeballL" : "horrorEyeballR";
      em.position.set(s * rx * 0.36, eyeY + (s < 0 ? 0.002 : -0.002) * hScale, eyeZ + 0.005 * hScale);
      em.rotation.set(s < 0 ? -0.03 : 0.04, s * 0.05, 0);
      em.userData.noOutline = true;
      g.add(em);

      // Fine glossy weeping ichor tear trails hugging the hollow cheekbone downward
      if (mode === "weepingIchor" || (cfg.bloodStainLevel ?? 0) > 0.3) {
        const streaks = mode === "weepingIchor" ? 3 : 2;
        for (let k = 0; k < streaks; k++) {
          const len = (0.044 + k * 0.020) * hScale;
          const tGeo = new THREE.CylinderGeometry(0.0020 * hScale, 0.0008 * hScale, len, 6);
          disposables.push(tGeo);
          const tm = new THREE.Mesh(tGeo, ichorMat);
          tm.name = `ichorTear_${s < 0 ? "L" : "R"}_${k}`;
          tm.position.set(
            s * rx * (0.31 + k * 0.06),
            eyeY - 0.018 * hScale - len * 0.44,
            rz * (0.71 - k * 0.04),
          );
          tm.rotation.set(-0.14, 0, s * (-0.06 + k * 0.05));
          tm.userData.noOutline = true;
          g.add(tm);
        }
      }
    }
  } else if (mode === "voidSockets") {
    const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.85, 2.1), toneMapped: false });
    disposables.push(glintMat);
    for (const s of [-1, 1] as const) {
      const pGeo = new THREE.SphereGeometry(0.0042 * hScale, 8, 6);
      disposables.push(pGeo);
      const pm = new THREE.Mesh(pGeo, glintMat);
      pm.name = s < 0 ? "voidGlintL" : "voidGlintR";
      pm.position.set(s * rx * 0.36, eyeY, eyeZ + 0.004 * hScale);
      pm.userData.noOutline = true;
      pm.userData.isEyeGlow = true;
      g.add(pm);
    }
  } else if (mode === "stitched") {
    const wireMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#151216", specular: "#6e7682", shininess: 60 }), 0.6, 0.2);
    disposables.push(wireMat);
    for (const s of [-1, 1] as const) {
      const sx = s * rx * 0.36;
      for (let k = -2; k <= 2; k++) {
        const stGeo = new THREE.CylinderGeometry(0.0017 * hScale, 0.0017 * hScale, 0.036 * hScale, 5);
        disposables.push(stGeo);
        const st = new THREE.Mesh(stGeo, wireMat);
        st.name = `eyeStitch_${s < 0 ? "L" : "R"}_${k}`;
        st.position.set(sx + k * 0.009 * hScale, eyeY, eyeZ + 0.014 * hScale);
        st.rotation.z = (k % 2 === 0 ? 0.38 : -0.38) * s;
        st.userData.noOutline = true;
        g.add(st);
      }
    }
  } else if (mode === "multiEye") {
    const eyeMat = stylizedShade(
      new THREE.MeshPhongMaterial({ map: getSanpakuEyeTex(), color: "#d4ccc2", specular: "#e8e0d8", shininess: 92 }),
      0.85,
      0.0,
    );
    disposables.push(eyeMat);
    const offsets: Array<[number, number, number]> = [
      [-0.010, 0.008, 0.0096],
      [0.011, 0.006, 0.0082],
      [-0.002, -0.006, 0.0088],
      [0.012, -0.010, 0.0068],
      [-0.012, -0.008, 0.0064],
    ];
    for (const s of [-1, 1] as const) {
      const sx = s * rx * 0.36;
      offsets.forEach(([ox, oy, rad], idx) => {
        const eGeo = new THREE.SphereGeometry(rad * hScale, 10, 8);
        eGeo.rotateY(-Math.PI * 0.5);
        disposables.push(eGeo);
        const em = new THREE.Mesh(eGeo, eyeMat);
        em.name = `multiEye_${s < 0 ? "L" : "R"}_${idx}`;
        em.position.set(sx + ox * hScale, eyeY + oy * hScale, eyeZ + 0.008 * hScale);
        em.userData.noOutline = true;
        g.add(em);
      });
    }
  }

  head.add(g);
  return g;
}

/**
 * Build an articulated 3D dislocated lower jaw (`sockets.jaw`) with smoothly framed inner mouth void,
 * 18 crooked yellowed-bone 3D teeth (upper + lower arc), dark bruised gum rims, organic stretched cheek tendons,
 * and thin wet ichor threads tucked inside the tooth arc (ZERO blocky rectangles!).
 */
export function buildHorrorJaw3D(
  head: THREE.Group,
  cfg: BodyHorrorConfig,
  rx: number,
  ry: number,
  rz: number,
  hScale: number,
  skinMat: THREE.Material,
  disposables: Disposable[],
): THREE.Group {
  const jaw = new THREE.Group();
  jaw.name = "jaw";
  jaw.position.set(0, -ry * 0.24, rz * 0.14);
  head.add(jaw);

  const r = rng(409);
  const voidMat = new THREE.MeshBasicMaterial({ color: "#040105" });
  const gumMat = stylizedShade(
    new THREE.MeshPhongMaterial({ color: "#2c0d11", specular: "#663238", shininess: 40 }),
    0.45,
    0.2,
  );
  const toothMat = stylizedShade(
    new THREE.MeshPhongMaterial({ color: "#a89b78", specular: "#e4d8b8", shininess: 68 }),
    0.85,
    0.2,
  );
  const ichorMat = stylizedShade(
    new THREE.MeshPhongMaterial({ color: "#140407", specular: "#8c545a", shininess: 92 }),
    0.35,
    0.05,
  );
  disposables.push(voidMat, gumMat, toothMat, ichorMat);

  // Recessed dark inner throat cavity (tucked strictly inside the maxillary/mandibular arch!)
  const throatGeo = new THREE.CylinderGeometry(rx * 0.34, rx * 0.28, ry * 0.72, 14);
  disposables.push(throatGeo);
  const throat = new THREE.Mesh(throatGeo, voidMat);
  throat.name = "mouthVoidCavern";
  throat.position.set(0, -ry * 0.44, rz * 0.36);
  throat.userData.noOutline = true;
  head.add(throat);

  // Sculpted gaunt lower mandible & bony chin on articulated `jaw` socket
  const chinGeo = new THREE.SphereGeometry(rx * 0.46, 16, 12);
  chinGeo.scale(1.02, 0.52, 1.32);
  disposables.push(chinGeo);
  const chin = new THREE.Mesh(chinGeo, skinMat);
  chin.name = "mandibleChin";
  chin.position.set(0, -ry * 0.56, rz * 0.48);
  chin.castShadow = true;
  chin.receiveShadow = true;
  jaw.add(chin);

  // Organic curved lower jaw rami + taut stretched dark cheek-tendon webs bridging upper cheek to dropped jaw!
  for (const s of [-1, 1] as const) {
    const ramusGeo = new THREE.CapsuleGeometry(0.013 * hScale, ry * 0.56, 5, 8);
    disposables.push(ramusGeo);
    const ramus = new THREE.Mesh(ramusGeo, skinMat);
    ramus.name = s < 0 ? "jawRamusL" : "jawRamusR";
    ramus.position.set(s * rx * 0.44, -ry * 0.28, rz * 0.30);
    ramus.rotation.set(0.54, 0, s * -0.14);
    jaw.add(ramus);

    // Stretched dark-crimson fleshy tendon web inside mouth corner (organic curve, NOT a square box!)
    if (cfg.cheekSplitGrin) {
      const webGeo = new THREE.CapsuleGeometry(0.0065 * hScale, ry * 0.46, 4, 8);
      disposables.push(webGeo);
      const web = new THREE.Mesh(webGeo, gumMat);
      web.name = s < 0 ? "cheekSplitL" : "cheekSplitR";
      web.position.set(s * rx * 0.39, -ry * 0.42, rz * 0.52);
      web.rotation.set(0.22, s * 0.28, s * 0.14);
      web.userData.noOutline = true;
      head.add(web);
    }
  }

  // Dark recessed upper & lower gum horseshoe rims + 18 individually crooked yellowed-bone 3D teeth!
  if (cfg.crookedTeeth !== false) {
    const upperGumGeo = new THREE.TorusGeometry(rx * 0.35, 0.010 * hScale, 6, 16, Math.PI);
    upperGumGeo.rotateX(Math.PI * 0.5);
    disposables.push(upperGumGeo);
    const upperGum = new THREE.Mesh(upperGumGeo, gumMat);
    upperGum.name = "upperGumArc";
    upperGum.position.set(0, -ry * 0.32, rz * 0.40);
    upperGum.userData.noOutline = true;
    head.add(upperGum);

    const lowerGumGeo = new THREE.TorusGeometry(rx * 0.33, 0.009 * hScale, 6, 16, Math.PI);
    lowerGumGeo.rotateX(Math.PI * 0.5);
    disposables.push(lowerGumGeo);
    const lowerGum = new THREE.Mesh(lowerGumGeo, gumMat);
    lowerGum.name = "lowerGumArc";
    lowerGum.position.set(0, -ry * 0.44, rz * 0.34);
    lowerGum.userData.noOutline = true;
    jaw.add(lowerGum);

    const toothCount = 9;
    for (let i = 0; i < toothCount; i++) {
      const u = (i / (toothCount - 1)) * 2 - 1;
      const ang = u * 1.15;
      const ux = Math.sin(ang) * rx * 0.36;
      const uz = Math.cos(ang) * rz * 0.38;
      const tLenU = (0.016 + (i % 3 === 0 ? 0.005 : 0) + r() * 0.005) * hScale;
      const tRadU = (0.0040 + r() * 0.0016) * hScale;

      const utGeo = new THREE.ConeGeometry(tRadU, tLenU, 5);
      utGeo.rotateX(Math.PI);
      disposables.push(utGeo);
      const ut = new THREE.Mesh(utGeo, toothMat);
      ut.name = `upperTooth_${i}`;
      ut.position.set(ux, -ry * 0.33 - tLenU * 0.42, rz * 0.40 + uz);
      ut.rotation.set((r() - 0.5) * 0.22, 0, (r() - 0.5) * 0.24);
      ut.userData.noOutline = true;
      head.add(ut);

      const tLenL = (0.014 + ((i + 1) % 3 === 0 ? 0.004 : 0) + r() * 0.005) * hScale;
      const ltGeo = new THREE.ConeGeometry(tRadU * 0.90, tLenL, 5);
      disposables.push(ltGeo);
      const lt = new THREE.Mesh(ltGeo, toothMat);
      lt.name = `lowerTooth_${i}`;
      lt.position.set(ux * 0.94, -ry * 0.43 + tLenL * 0.42, rz * 0.34 + uz * 0.90);
      lt.rotation.set((r() - 0.5) * 0.22, 0, (r() - 0.5) * 0.24);
      lt.userData.noOutline = true;
      jaw.add(lt);
    }

    // 3 ultra-fine wet dark saliva/ichor threads tucked cleanly inside the tooth arc
    for (let k = 0; k < 3; k++) {
      const sx = (k - 1) * rx * 0.20 + (r() - 0.5) * 0.006;
      const sLen = (0.052 + r() * 0.028) * hScale;
      const sGeo = new THREE.CylinderGeometry(0.0009 * hScale, 0.0006 * hScale, sLen, 5);
      disposables.push(sGeo);
      const st = new THREE.Mesh(sGeo, ichorMat);
      st.name = `jawIchorStrand_${k}`;
      st.position.set(sx, -ry * 0.50, rz * 0.68);
      st.rotation.z = (r() - 0.5) * 0.12;
      st.userData.noOutline = true;
      head.add(st);
    }
  }

  const drop = clamp(cfg.jawDrop3D ?? 0, 0, 1);
  jaw.rotation.x = drop * 0.78;
  jaw.position.y = -ry * 0.24 - drop * 0.022 * hScale;

  return jaw;
}

/**
 * Continuous vertex-sculpted fluted sinewy tendon neck (ZERO detached pipes!).
 * Flared organically into the trapezius shoulders below and skull base above with taut sternocleidomastoid ridges,
 * recessed suprasternal hollow, and subtle trachea ridges.
 */
export function buildTendonNeck3D(
  neck: THREE.Group,
  neckLen: number,
  hScale: number,
  gaunt: number,
  skinMat: THREE.Material,
  disposables: Disposable[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = "tendonNeck";

  const geo = new THREE.CylinderGeometry(0.036 * hScale * gaunt, 0.058 * hScale * gaunt, neckLen * 1.24, 28, 18, false);
  const pos = geo.attributes.position;
  const halfH = neckLen * 0.62;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const v = clamp((y + halfH) / Math.max(1e-4, halfH * 2), 0, 1); // 0 bottom, 1 top
    const ang = Math.atan2(x, z); // 0 is front (+Z)
    const r = Math.hypot(x, z);
    if (r > 1e-4) {
      // Pinch middle neck taut & flare bottom smoothly into collarbones/trapezius
      let mul = 0.88 + 0.38 * Math.pow(1 - v, 2.2) + 0.12 * Math.pow(v, 2.0);
      // 2 prominent anterior sternocleidomastoid tendon cords angling from ears toward sternum!
      const scmAngle = 0.42 + v * 0.34;
      const scmL = Math.exp(-Math.pow((ang + scmAngle) / 0.22, 2));
      const scmR = Math.exp(-Math.pow((ang - scmAngle) / 0.22, 2));
      // Deep concave suprasternal throat hollow right between the 2 front tendons!
      const pit = Math.exp(-Math.pow(ang / 0.28, 2)) * Math.sin(v * Math.PI);
      // Subtle trachea rings + lateral sinew flutes
      const rings = Math.exp(-Math.pow(ang / 0.22, 2)) * Math.sin(v * Math.PI * 7.0) * 0.05;
      const lat = (Math.exp(-Math.pow((Math.abs(ang) - 1.45) / 0.26, 2))) * 0.14;

      mul += (scmL + scmR) * 0.26 * Math.sin(v * Math.PI * 0.9 + 0.1) - pit * 0.22 + rings + lat;
      const nr = r * mul;
      x = Math.sin(ang) * nr;
      z = Math.cos(ang) * nr;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  disposables.push(geo);

  const mesh = new THREE.Mesh(geo, skinMat);
  mesh.name = "sculptedTendonNeck";
  mesh.position.set(0, neckLen * 0.46, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);

  neck.add(g);
  return g;
}

/**
 * Continuous vertex-sculpted emaciated ribcage + sunken sternum + sharp clavicles + hunched dorsal spine,
 * paired with a continuous shredded V-neck tattered gown/shroud (ZERO floating white plastic rib tubes, ZERO waist seam!).
 */
export function buildEmaciatedTorso3D(
  spine: THREE.Group,
  pelvis: THREE.Group,
  hScale: number,
  gaunt: number,
  skinMat: THREE.Material,
  clothMat: THREE.Material,
  cfg: BodyHorrorConfig,
  disposables: Disposable[],
): THREE.Group {
  const g = new THREE.Group();
  g.name = "emaciatedAnatomy";

  // 1. Continuous vertex-sculpted emaciated ribcage & clavicle mesh tucked naturally inside the V-cut gown neckline!
  // Rotated by PI first so the CylinderGeometry UV seam sits invisibly at the BACK (-Z), NEVER down the center of the chest!
  if (cfg.exposedRibs) {
    const chestH = 0.42 * hScale;
    const chestGeo = new THREE.CylinderGeometry(0.145 * hScale * gaunt, 0.104 * hScale * gaunt, chestH, 36, 28, false);
    chestGeo.rotateY(Math.PI);
    const pos = chestGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const v = clamp((y + chestH * 0.5) / chestH, 0, 1); // 0 lower waist, 1 neck base
      const ang = Math.atan2(x, z); // 0 = front (+Z)

      // Smooth rounded shoulder slope into neck at top (v > 0.78) so there is ZERO flat tin-can shelf!
      const topSlope = v > 0.78 ? Math.cos(((v - 0.78) / 0.22) * Math.PI * 0.46) : 1.0;
      const shoulderTaper = 0.34 + 0.66 * topSlope;
      z *= 0.68 * shoulderTaper;
      x *= 1.12 * (0.42 + 0.58 * topSlope);

      const frontMask = Math.max(0, Math.cos(ang));
      if (frontMask > 0.08 && v < 0.94) {
        // Deep sunken central sternum valley between left & right rib arches
        const sternumHollow = Math.exp(-Math.pow(ang / 0.25, 2)) * Math.sin(clamp(v / 0.88, 0, 1) * Math.PI);
        z -= Math.max(0, sternumHollow) * 0.026 * hScale;

        // 5 pairs of prominent organic sculpted rib ridges & intercostal hollows curving around the ribcage
        if (v > 0.14 && v < 0.74) {
          const ribPhase = (v - 0.14) * 5.0 * Math.PI * 2 - Math.abs(ang) * 1.15;
          const ribWave = Math.sin(ribPhase);
          const ribSide = Math.sin(clamp(Math.abs(ang) / 1.28, 0, 1) * Math.PI);
          z += ribWave * 0.0115 * hScale * ribSide * frontMask;
        }

        // Sharp sculpted clavicle collarbones arching outward below the neck pit (v ~ 0.74..0.88)
        if (v > 0.70 && v < 0.90) {
          const clV = Math.exp(-Math.pow((v - 0.79) / 0.048, 2));
          const clX = Math.sin(clamp(Math.abs(ang) / 1.18, 0, 1) * Math.PI);
          z += clV * clX * 0.018 * hScale;
        }
      }

      if (cfg.protrudingSpine && Math.cos(ang) < -0.72) {
        const backMask = Math.pow((-Math.cos(ang) - 0.72) / 0.28, 1.5);
        const vertWave = Math.max(0, Math.sin(v * 7.0 * Math.PI * 2));
        z -= backMask * vertWave * 0.016 * hScale;
      }

      pos.setXYZ(i, x, y, z);
    }
    chestGeo.computeVertexNormals();
    disposables.push(chestGeo);
    const chestMesh = new THREE.Mesh(chestGeo, skinMat);
    chestMesh.name = "exposedRib_0";
    chestMesh.position.set(0, 0.30 * hScale, 0.008 * hScale);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    g.add(chestMesh);
  }

  // Keep discrete subtle spine vertebrae nubs when protrudingSpine is enabled so back silhouette stays jagged
  if (cfg.protrudingSpine) {
    for (let vi = 0; vi < 7; vi++) {
      const vGeo = new THREE.ConeGeometry(0.011 * hScale, 0.022 * hScale, 5);
      vGeo.rotateX(-Math.PI * 0.5);
      disposables.push(vGeo);
      const vm = new THREE.Mesh(vGeo, skinMat);
      vm.name = `spineVertebra_${vi}`;
      vm.position.set(0, (0.08 + vi * 0.062) * hScale, -0.092 * hScale * gaunt);
      g.add(vm);
    }
  }

  // 2. Continuous draped ragged gown/shroud shell from rounded shoulders down past knees!
  // Uses `clothMat` directly (already DoubleSide + stylizedShade — NEVER .clone() which strips onBeforeCompile!)
  // Rotated by PI so UV seam sits invisibly at back (-Z)!
  if (cfg.tatteredCloth) {
    const r = rng(719);
    const robeH = 1.04 * hScale;
    const segU = 32, segV = 22;
    const robeGeo = new THREE.CylinderGeometry(0.168 * hScale * gaunt, 0.238 * hScale * gaunt, robeH, segU, segV, true);
    robeGeo.rotateY(Math.PI);
    const pos = robeGeo.attributes.position;
    const halfH = robeH * 0.5;
    const hemDrop = Array.from({ length: segU + 1 }, (_, i) => (i === segU ? 0 : (r() - 0.38) * 0.14 * hScale));
    hemDrop[segU] = hemDrop[0];

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const v = clamp((y + halfH) / robeH, 0, 1); // 0 bottom hem, 1 top of shoulders
      const ang = Math.atan2(x, z); // 0 = front (+Z)
      const colIdx = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segU) % segU;

      // Natural curved shoulder yoke at top (v > 0.84 slopes softly inward toward neck instead of flat cylinder rim!)
      let silhouette: number;
      if (v > 0.84) {
        const st = (v - 0.84) / 0.16;
        silhouette = 1.06 * (1 - 0.50 * st * st);
      } else if (v > 0.72) {
        silhouette = 1.06;
      } else if (v > 0.44) {
        silhouette = 0.80 + ((v - 0.44) / 0.28) * 0.26;
      } else {
        silhouette = 0.80 + (1 - v / 0.44) * 0.28;
      }
      const pleat = 1.0 + Math.sin(ang * 7.0 + v * 1.4) * 0.06 * (1 - v * 0.65);
      x *= silhouette * 1.12 * pleat;
      z *= silhouette * 0.74 * pleat;

      // Real torn V-neck cutout on upper front exposing the sculpted emaciated ribcage & collarbones cleanly!
      if (cfg.exposedRibs && v > 0.56 && Math.abs(ang) < 0.76) {
        const vFactor = (v - 0.56) / 0.44;
        const halfOpen = 0.06 + vFactor * 0.60;
        if (Math.abs(ang) < halfOpen) {
          const depthIn = 1 - Math.abs(ang) / Math.max(0.04, halfOpen);
          y -= depthIn * 0.28 * hScale * vFactor;
          // Tuck neckline lip gently behind rib peaks so the exposed ribcage emerges cleanly from the torn collar!
          z -= depthIn * 0.022 * hScale;
        }
      }

      if (v < 0.18) {
        const bottomWeight = 1 - v / 0.18;
        y += hemDrop[colIdx] * bottomWeight;
      }

      pos.setXYZ(i, x, y, z);
    }
    robeGeo.computeVertexNormals();
    disposables.push(robeGeo);

    const robeMesh = new THREE.Mesh(robeGeo, clothMat);
    robeMesh.name = "clothTatter_0";
    robeMesh.position.set(0, -0.02 * hScale, 0);
    robeMesh.castShadow = true;
    robeMesh.receiveShadow = true;
    spine.add(robeMesh);
  }

  spine.add(g);
  return g;
}

/** Build elongated skeletal 3-joint spider claw hand with knobby knuckles & curved jet-black claws. */
export function buildSpiderClawHand3D(
  hand: THREE.Group,
  side: -1 | 1,
  hScale: number,
  gaunt: number,
  fingerS: number,
  skinMat: THREE.Material,
  bloodLevel: number,
  disposables: Disposable[],
  prefix = "",
): void {
  const clawMat = stylizedShade(
    new THREE.MeshPhongMaterial({
      color: bloodLevel > 0.35 ? "#22070a" : "#0e0a0f",
      specular: "#7c5c60",
      shininess: 76,
    }),
    0.45,
    0.1,
  );
  disposables.push(clawMat);

  // Gaunt bony metacarpal palm
  const palmGeo = new THREE.BoxGeometry(0.036 * hScale * gaunt, 0.074 * hScale * fingerS, 0.016 * hScale);
  disposables.push(palmGeo);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.name = `${prefix}clawPalm`;
  palm.position.set(0, -0.036 * hScale * fingerS, 0);
  palm.castShadow = true;
  hand.add(palm);

  const seg1Len = 0.042 * hScale * fingerS;
  const seg2Len = 0.036 * hScale * fingerS;
  const clawLen = 0.028 * hScale * fingerS;
  for (let fi = 0; fi < 4; fi++) {
    const spread = (fi - 1.5) * 0.25;
    const lenMul = fi === 1 || fi === 2 ? 1.15 : 0.94;
    const fx = (fi - 1.5) * 0.011 * hScale * gaunt;
    const fy = -0.072 * hScale * fingerS;

    const fRoot = new THREE.Group();
    fRoot.position.set(fx, fy, 0.002 * hScale);
    fRoot.rotation.set(0.18 + fi * 0.03, 0, spread);

    const knGeo = new THREE.SphereGeometry(0.0064 * hScale * gaunt, 6, 5);
    const s1Geo = new THREE.CapsuleGeometry(0.0046 * hScale * gaunt, seg1Len * lenMul, 4, 6);
    disposables.push(knGeo, s1Geo);
    fRoot.add(new THREE.Mesh(knGeo, skinMat));
    const s1 = new THREE.Mesh(s1Geo, skinMat);
    s1.name = `${prefix}spiderFinger_${fi}_s1`;
    s1.position.set(0, -seg1Len * lenMul * 0.5, 0);
    fRoot.add(s1);

    const midJ = new THREE.Group();
    midJ.position.set(0, -seg1Len * lenMul, 0);
    midJ.rotation.x = 0.36;
    const s2Geo = new THREE.CapsuleGeometry(0.0036 * hScale * gaunt, seg2Len * lenMul, 4, 6);
    disposables.push(s2Geo);
    midJ.add(new THREE.Mesh(knGeo, skinMat));
    const s2 = new THREE.Mesh(s2Geo, skinMat);
    s2.name = `${prefix}spiderFinger_${fi}_s2`;
    s2.position.set(0, -seg2Len * lenMul * 0.5, 0);
    midJ.add(s2);

    const cGeo = new THREE.ConeGeometry(0.0036 * hScale * gaunt, clawLen, 5);
    cGeo.rotateX(Math.PI);
    disposables.push(cGeo);
    const claw = new THREE.Mesh(cGeo, clawMat);
    claw.name = `${prefix}spiderClaw_${fi}`;
    claw.position.set(0, -seg2Len * lenMul - clawLen * 0.42, 0.004 * hScale);
    claw.rotation.x = 0.34;
    midJ.add(claw);

    fRoot.add(midJ);
    hand.add(fRoot);
  }

  const thRoot = new THREE.Group();
  thRoot.position.set(-side * 0.024 * hScale * gaunt, -0.042 * hScale * fingerS, 0.012 * hScale);
  thRoot.rotation.set(0.28, 0, -side * 0.62);
  const thGeo = new THREE.CapsuleGeometry(0.0050 * hScale * gaunt, 0.046 * hScale * fingerS, 4, 6);
  const thClawGeo = new THREE.ConeGeometry(0.0040 * hScale * gaunt, 0.022 * hScale * fingerS, 5);
  thClawGeo.rotateX(Math.PI);
  disposables.push(thGeo, thClawGeo);
  const th = new THREE.Mesh(thGeo, skinMat);
  th.position.set(0, -0.023 * hScale * fingerS, 0);
  const thC = new THREE.Mesh(thClawGeo, clawMat);
  thC.position.set(0, -0.054 * hScale * fingerS, 0.004 * hScale);
  thC.rotation.x = 0.32;
  thRoot.add(th, thC);
  hand.add(thRoot);
}

/** Build 2 extra gaunt shadowy arms emerging eerily from behind the shoulders/ribs (uses stylizedShade cleanly — NEVER .clone()!). */
export function buildExtraArms3D(
  chest: THREE.Group,
  hScale: number,
  gaunt: number,
  armS: number,
  skinMat: THREE.Material,
  clawHands: boolean,
  bloodLevel: number,
  disposables: Disposable[],
): { leftExtraArm: THREE.Group; rightExtraArm: THREE.Group } {
  const srcPhong = skinMat as THREE.MeshPhongMaterial;
  const shadowArmMat = stylizedShade(
    new THREE.MeshPhongMaterial({
      color: "#7c7d88",
      ...(srcPhong.map ? { map: srcPhong.map } : {}),
      ...(srcPhong.bumpMap ? { bumpMap: srcPhong.bumpMap, bumpScale: 0.012 } : {}),
      flatShading: !!srcPhong.flatShading,
      specular: "#46404a",
      shininess: 18,
    }),
    0.65,
    0.45,
  );
  disposables.push(shadowArmMat);

  const buildOne = (side: -1 | 1) => {
    const pfx = side < 0 ? "leftExtra" : "rightExtra";
    const root = new THREE.Group();
    root.name = `${pfx}Arm`;
    // Positioned visibly wide from behind upper ribs/shoulders so both eerie extra spider-clawed limbs jut into silhouette!
    root.position.set(side * 0.17 * hScale * gaunt, 0.06 * hScale, -0.055 * hScale);
    root.rotation.set(0.18, side * -0.10, side * 0.98);
    chest.add(root);

    const uLen = 0.28 * hScale * armS;
    const fLen = 0.27 * hScale * armS;
    const uGeo = new THREE.CapsuleGeometry(0.019 * hScale * gaunt, uLen, 4, 6);
    disposables.push(uGeo);
    const uMesh = new THREE.Mesh(uGeo, shadowArmMat);
    uMesh.name = `${pfx}Upper`;
    uMesh.position.set(0, -uLen * 0.5, 0);
    uMesh.castShadow = true;
    root.add(uMesh);

    const elbow = new THREE.Group();
    elbow.name = `${pfx}Elbow`;
    elbow.position.set(0, -uLen, 0);
    elbow.rotation.set(-0.32, 0, side * -0.34);
    root.add(elbow);

    const fGeo = new THREE.CapsuleGeometry(0.015 * hScale * gaunt, fLen, 4, 6);
    disposables.push(fGeo);
    const fMesh = new THREE.Mesh(fGeo, shadowArmMat);
    fMesh.name = `${pfx}Forearm`;
    fMesh.position.set(0, -fLen * 0.5, 0);
    fMesh.castShadow = true;
    elbow.add(fMesh);

    const hand = new THREE.Group();
    hand.name = `${pfx}Hand`;
    hand.position.set(0, -fLen, 0);
    elbow.add(hand);

    if (clawHands) {
      buildSpiderClawHand3D(hand, side, hScale * 0.90, gaunt * 0.86, 1.12, shadowArmMat, bloodLevel, disposables, pfx);
    } else {
      const pGeo = new THREE.BoxGeometry(0.030 * hScale * gaunt, 0.064 * hScale, 0.014 * hScale);
      disposables.push(pGeo);
      const pm = new THREE.Mesh(pGeo, shadowArmMat);
      pm.position.set(0, -0.032 * hScale, 0);
      hand.add(pm);
    }

    return root;
  };

  return {
    leftExtraArm: buildOne(-1),
    rightExtraArm: buildOne(1),
  };
}

/** Mark all body-horror meshes cleanly onto NOINK so architectural InkPass never interferes. */
export function tagBodyHorrorNoInk(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.layers.set(NOINK);
  });
}
