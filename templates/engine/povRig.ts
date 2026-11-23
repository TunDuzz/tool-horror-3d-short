// Horror Engine v3: 1st-Person POV 3D Rig (visible lower body + dual articulated arms/hands)
// and Diegetic 3D Props (Phone3D with live Canvas2D lockscreen, Flashlight3D with SpotLight cone,
// HandheldOilLamp3D with translucent glass chimney, PaperProp3D).

import * as THREE from "three";
import { FPS, clamp01, flickerAt, type V3 } from "./camera";
import { NOINK } from "./ink";
import type { LocalLight, SpotLightCfg } from "./lights";
import { attachOutlineRig } from "./outline3d";
import { stylizedShade } from "./shade";

export type PhoneScreenState = {
  clock: string;
  date?: string;
  carrier?: string;
  battery?: number;
  notifications?: Array<{ sender: string; time?: string; body: string }>;
};

export type Phone3D = {
  group: THREE.Group;
  setScreen: (state: PhoneScreenState) => void;
  getLight: (intensity?: number) => LocalLight;
  dispose: () => void;
};

export type Flashlight3D = {
  group: THREE.Group;
  setOn: (on: boolean, intensity?: number) => void;
  getSpotLight: () => SpotLightCfg | null;
};

export type HandheldOilLamp3D = {
  group: THREE.Group;
  setLit: (lit: boolean, frame: number) => void;
  getLight: (frame: number) => LocalLight | null;
};

export type PaperProp3D = {
  group: THREE.Group;
  setText: (title: string, lines: string[]) => void;
  dispose: () => void;
};

export type PovPose = {
  stance: "seated" | "standing";
  anchor: V3;
  bodyYaw: number;
  leftArmRaise?: number; // 0..1
  rightArmRaise?: number; // 0..1
  propMode?: "none" | "phone" | "flashlight" | "lamp" | "paper";
  kneeYOffset?: number; // optional subtle seat-height adjustment for POV_DOWN framing
  kneeZOffset?: number; // optional forward knee placement for POV_DOWN framing
  frame: number;
};

export type PovRig3D = {
  group: THREE.Group;
  lowerBody: THREE.Group;
  armsRoot: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  update: (cam: THREE.PerspectiveCamera, pose: PovPose) => void;
};

function drawPhoneCanvas(cv: HTMLCanvasElement, state: PhoneScreenState) {
  const g = cv.getContext("2d");
  if (!g) return;
  const W = cv.width, H = cv.height;

  // Dark lockscreen backdrop
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#10131e");
  bg.addColorStop(0.55, "#191c2a");
  bg.addColorStop(1, "#0d0f18");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Status bar
  g.fillStyle = "#d8dce8";
  g.font = "bold 20px sans-serif";
  g.textAlign = "left";
  g.fillText(state.carrier ?? "Viettel", 26, 38);
  g.textAlign = "right";
  g.fillText(`${state.battery ?? 23}%`, W - 26, 38);

  // Date + large bold lockscreen digital clock
  g.textAlign = "center";
  g.fillStyle = "#c8cedd";
  g.font = "600 24px sans-serif";
  g.fillText(state.date ?? "Chủ Nhật, 22 tháng 11", W * 0.5, 108);

  g.fillStyle = "#ffffff";
  g.font = "900 106px sans-serif";
  g.fillText(state.clock, W * 0.5, 210);

  // Rounded lockscreen notification cards
  const notifs = state.notifications ?? [];
  let y = 250;
  for (const n of notifs.slice(0, 2)) {
    const cardH = 148;
    const x = 22, w = W - 44, r = 24;
    g.fillStyle = "rgba(246, 245, 242, 0.96)";
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + cardH - r);
    g.quadraticCurveTo(x + w, y + cardH, x + w - r, y + cardH);
    g.lineTo(x + r, y + cardH);
    g.quadraticCurveTo(x, y + cardH, x, y + cardH - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
    g.fill();

    // Small green message icon
    g.fillStyle = "#2db958";
    g.fillRect(x + 20, y + 20, 28, 28);

    g.textAlign = "left";
    g.fillStyle = "#181a22";
    g.font = "bold 24px sans-serif";
    g.fillText(n.sender, x + 60, y + 43);

    if (n.time) {
      g.textAlign = "right";
      g.fillStyle = "#6c707e";
      g.font = "600 19px sans-serif";
      g.fillText(n.time, x + w - 20, y + 41);
    }

    // Wrap message body up to 3 lines
    g.textAlign = "left";
    g.fillStyle = "#14161e";
    g.font = "600 24px sans-serif";
    const words = n.body.split(" ");
    let line = "";
    let ly = y + 84;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > w - 42 && line) {
        g.fillText(line, x + 20, ly);
        line = word;
        ly += 30;
        if (ly > y + cardH - 14) break;
      } else {
        line = test;
      }
    }
    if (line && ly <= y + cardH - 10) g.fillText(line, x + 20, ly);
    y += cardH + 16;
  }

  // Bottom home bar
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillRect(W * 0.32, H - 24, W * 0.36, 7);
}

/** Create a 3D diegetic smartphone with live HDR-emissive Canvas2D lockscreen & synced PointLight emitter. */
export function createPhone3D(initial: PhoneScreenState = { clock: "00:58" }): Phone3D {
  const group = new THREE.Group();
  group.name = "Phone3D";

  const bodyMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#151720", specular: "#4a5268", shininess: 35 }));
  const bodyGeo = new THREE.BoxGeometry(0.088, 0.172, 0.011);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = "phoneBody";
  group.add(body);

  let cv: HTMLCanvasElement | null = null;
  let tex: THREE.CanvasTexture;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    cv = document.createElement("canvas");
    cv.width = 420;
    cv.height = 820;
    drawPhoneCanvas(cv, initial);
    tex = new THREE.CanvasTexture(cv);
  } else {
    tex = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // Subtle HDR emissive screen (1.12-1.22 triggers gentle edge bloom while keeping lockscreen text razor-crisp!)
  const screenMat = new THREE.MeshBasicMaterial({
    map: tex,
    color: new THREE.Color(1.12, 1.15, 1.22),
    toneMapped: false,
  });
  const screenGeo = new THREE.PlaneGeometry(0.080, 0.160);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.name = "phoneScreen";
  screen.position.set(0, 0, 0.0062);
  screen.userData.noOutline = true;
  group.add(screen);

  // Articulated 2-joint curled fingers wrapping organically around the left bezel edge (zero text overlap!)
  const skinMat = stylizedShade(new THREE.MeshLambertMaterial({ color: "#ccb6a0" }));
  const knuckleShadeMat = stylizedShade(new THREE.MeshLambertMaterial({ color: "#baa28b" }));
  // Curved palm cradle tucked cleanly behind the phone body (-Z) without peeking past the bottom bezel
  const backPalm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.072, 0.014), knuckleShadeMat);
  backPalm.name = "phoneBackPalm";
  backPalm.position.set(0.010, -0.006, -0.016);
  group.add(backPalm);

  const fLengths = [0.011, 0.013, 0.012, 0.0095];
  for (let i = 0; i < 4; i++) {
    const fy = 0.019 - i * 0.0185;
    // Proximal knuckle wrapping around the left side edge
    const prox = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, 0.014, 5, 8), knuckleShadeMat);
    prox.name = `phoneGripKnuckle_${i}`;
    prox.position.set(-0.047, fy, -0.007);
    prox.rotation.set(Math.PI * 0.48, 0, -0.18);
    // Distal fingertip curling onto the outer left bezel rim
    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0060, fLengths[i], 5, 8), skinMat);
    tip.name = `phoneGripFinger_${i}`;
    tip.position.set(-0.0465, fy - 0.001, 0.004);
    tip.rotation.set(0.08, 0.22, Math.PI * 0.5 - 0.14);
    group.add(prox, tip);
  }
  // Articulated 2-segment right thumb emerging from lower-right palm & resting cleanly on outer right bezel
  const thumbBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.0092, 0.028, 5, 8), knuckleShadeMat);
  thumbBase.name = "phoneGripThumbBase";
  thumbBase.position.set(0.047, -0.056, -0.004);
  thumbBase.rotation.set(-0.18, 0.16, 0.36);
  const thumbTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, 0.022, 5, 8), skinMat);
  thumbTip.name = "phoneGripThumb";
  thumbTip.position.set(0.044, -0.032, 0.006);
  thumbTip.rotation.set(0.08, -0.18, 0.62);
  group.add(thumbBase, thumbTip);

  attachOutlineRig(group, { pxWidth: 4.5, minWorld: 0.0009, maxWorld: 0.008, color: "#06060a" });

  let lastKey = JSON.stringify(initial);
  const setScreen = (state: PhoneScreenState) => {
    const k = JSON.stringify(state);
    if (k === lastKey) return;
    lastKey = k;
    if (cv) {
      drawPhoneCanvas(cv, state);
      tex.needsUpdate = true;
    }
  };

  const wp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const getLight = (intensity = 1.35): LocalLight => {
    group.updateMatrixWorld(true);
    screen.getWorldPosition(wp);
    screen.getWorldDirection(fwd);
    wp.addScaledVector(fwd, 0.055);
    return {
      pos: [wp.x, wp.y, wp.z],
      color: [0.95 * intensity, 1.05 * intensity, 1.28 * intensity],
      radius: 1.65,
    };
  };

  const dispose = () => {
    tex.dispose();
    bodyGeo.dispose();
    screenGeo.dispose();
    bodyMat.dispose();
    screenMat.dispose();
    skinMat.dispose();
  };

  return { group, setScreen, getLight, dispose };
}

/** Create a 3D handheld metal flashlight with HDR emissive lens, subtle volumetric beam, and SpotLightCfg emitter. */
export function createFlashlight3D(): Flashlight3D {
  const group = new THREE.Group();
  group.name = "Flashlight3D";

  const metalMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#22252e", specular: "#8ea0ba", shininess: 56 }));
  const gripSkinMat = stylizedShade(new THREE.MeshLambertMaterial({ color: "#c4ad97" }));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.019, 0.20, 12).rotateX(Math.PI * 0.5), metalMat);
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.022, 0.048, 12).rotateX(Math.PI * 0.5), metalMat);
  bezel.position.set(0, 0, -0.115);

  // Curled POV gripping fingers & thumb wrapping naturally around the flashlight barrel
  const gripGroup = new THREE.Group();
  gripGroup.name = "flashlightGrip";
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0068, 6, 12, Math.PI * 1.15), gripSkinMat);
    f.position.set(0, 0, -0.045 + i * 0.018);
    f.rotation.z = -Math.PI * 0.15;
    gripGroup.add(f);
  }
  const fThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.026, 5, 8), gripSkinMat);
  fThumb.position.set(-0.016, 0.024, -0.036);
  fThumb.rotation.set(Math.PI * 0.44, 0.18, 0.28);
  gripGroup.add(fThumb);
  group.add(gripGroup);

  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.0), toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 14), lensMat);
  lens.position.set(0, 0, -0.140);
  lens.rotation.y = Math.PI;
  lens.userData.noOutline = true;

  // Soft volumetric flashlight cone
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCol: { value: new THREE.Color("#dce8ff") },
      uOpacity: { value: 0.11 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv;
      void main(){
        float along = smoothstep(0.0, 0.12, vUv.y) * pow(1.0 - vUv.y, 1.85);
        gl_FragColor = vec4(uCol, along * uOpacity);
      }`,
  });
  const coneGeo = new THREE.CylinderGeometry(0.72, 0.035, 4.4, 16, 1, true);
  coneGeo.rotateX(-Math.PI * 0.5);
  coneGeo.translate(0, 0, -2.35);
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.userData.noOutline = true;

  group.add(barrel, bezel, lens, cone);
  attachOutlineRig(group, { pxWidth: 4.6, minWorld: 0.001, maxWorld: 0.01, color: "#06060a" });

  let isOn = true;
  let power = 1.0;

  const setOn = (on: boolean, intensity = 1.0) => {
    isOn = on;
    power = intensity;
    lens.visible = on;
    cone.visible = on;
    coneMat.uniforms.uOpacity.value = 0.10 * intensity;
    lensMat.color.setRGB(2.4 * intensity, 2.3 * intensity, 2.0 * intensity);
  };

  const wp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const getSpotLight = (): SpotLightCfg | null => {
    if (!isOn || power <= 0.01) return null;
    group.updateMatrixWorld(true);
    lens.getWorldPosition(wp);
    // Torch aims down local -Z
    dir.set(0, 0, -1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return {
      pos: [wp.x, wp.y, wp.z],
      target: [wp.x + dir.x * 8, wp.y + dir.y * 8, wp.z + dir.z * 8],
      color: [1.42 * power, 1.38 * power, 1.24 * power],
      distance: 13.5,
      angleDeg: 24,
      penumbra: 0.54,
    };
  };

  return { group, setOn, getSpotLight };
}

/** Create a portable 3D Vietnamese oil lamp with round oil reservoir, translucent glass chimney, and HDR flame. */
export function createHandheldOilLamp3D(): HandheldOilLamp3D {
  const group = new THREE.Group();
  group.name = "HandheldOilLamp3D";

  const baseMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#3d4652", specular: "#7c8ea0", shininess: 32 }));
  const brassMat = stylizedShade(new THREE.MeshPhongMaterial({ color: "#8c7246", specular: "#d8be80", shininess: 46 }));
  const glassMat = new THREE.MeshBasicMaterial({
    color: "#e6dfd4",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 0.025, 14), baseMat);
  foot.position.y = 0.012;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.064, 14, 10), baseMat);
  bulb.scale.set(1.0, 0.78, 1.0);
  bulb.position.y = 0.064;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.034, 12), brassMat);
  collar.position.y = 0.118;

  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.72), toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.046, 8), flameMat);
  flame.position.y = 0.158;
  flame.userData.noOutline = true;

  const chimneyPts = [
    new THREE.Vector2(0.026, 0.132),
    new THREE.Vector2(0.048, 0.175),
    new THREE.Vector2(0.042, 0.215),
    new THREE.Vector2(0.022, 0.265),
    new THREE.Vector2(0.024, 0.295),
  ];
  const chimney = new THREE.Mesh(new THREE.LatheGeometry(chimneyPts, 14), glassMat);
  chimney.userData.noOutline = true;

  group.add(foot, bulb, collar, flame, chimney);
  attachOutlineRig(group, { pxWidth: 4.8, minWorld: 0.001, maxWorld: 0.012, color: "#06060a" });

  let isLit = true;
  const setLit = (lit: boolean, frame: number) => {
    isLit = lit;
    flame.visible = lit;
    if (lit) {
      const flk = flickerAt(frame, 17, 0.28, 0.76);
      flame.scale.set(0.95 + 0.12 * flk, 0.85 + 0.30 * flk, 0.95 + 0.12 * flk);
      flameMat.color.setRGB(3.1 * flk, 1.95 * flk, 0.68 * flk);
    }
  };

  const wp = new THREE.Vector3();
  const getLight = (frame: number): LocalLight | null => {
    if (!isLit) return null;
    group.updateMatrixWorld(true);
    flame.getWorldPosition(wp);
    const flk = flickerAt(frame, 17, 0.28, 0.76);
    return {
      pos: [wp.x, wp.y + 0.03, wp.z],
      color: [2.25 * flk, 1.28 * flk, 0.50 * flk],
      radius: 4.8,
    };
  };

  return { group, setLit, getLight };
}

/** Create a held 3D paper note / old letter / talisman prop with custom Canvas2D text. */
export function createPaperProp3D(): PaperProp3D {
  const group = new THREE.Group();
  group.name = "PaperProp3D";

  let cv: HTMLCanvasElement | null = null;
  let tex: THREE.CanvasTexture;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 640;
    tex = new THREE.CanvasTexture(cv);
  } else {
    tex = new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = stylizedShade(new THREE.MeshLambertMaterial({ map: tex, color: "#ddd5c4", side: THREE.DoubleSide }));
  const geo = new THREE.BoxGeometry(0.16, 0.21, 0.004);
  const sheet = new THREE.Mesh(geo, mat);
  group.add(sheet);
  attachOutlineRig(group, { pxWidth: 4.0, minWorld: 0.0008, maxWorld: 0.008, color: "#06060a" });

  const setText = (title: string, lines: string[]) => {
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    g.fillStyle = "#dfd6c2";
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#18141c";
    g.font = "bold 40px serif";
    g.textAlign = "center";
    g.fillText(title, 256, 86);
    g.font = "30px serif";
    g.textAlign = "left";
    lines.forEach((ln, i) => g.fillText(ln, 44, 165 + i * 52));
    tex.needsUpdate = true;
  };
  setText("LƯU Ý", ["Không mở cửa sau 1 giờ."]);

  const dispose = () => {
    tex.dispose();
    geo.dispose();
    mat.dispose();
  };

  return { group, setText, dispose };
}

/**
 * Create a 1st-person POV 3D Rig: visible lower body (seated knees/trousers/shoes or standing legs)
 * plus camera-aligned articulated dual arms & slender hands for holding diegetic 3D props.
 */
export function createPovRig3D(
  opts: { skinCol?: string; sleeveCol?: string; pantsCol?: string; shoeCol?: string; outlinePx?: number } = {},
): PovRig3D {
  const skinMat = stylizedShade(new THREE.MeshLambertMaterial({ color: opts.skinCol ?? "#ccb6a0" }));
  const sleeveMat = stylizedShade(new THREE.MeshLambertMaterial({ color: opts.sleeveCol ?? "#d8d1c2" }));
  const pantsMat = stylizedShade(new THREE.MeshLambertMaterial({ color: opts.pantsCol ?? "#1c1d27" }));
  const shoeMat = stylizedShade(new THREE.MeshLambertMaterial({ color: opts.shoeCol ?? "#15141a" }));

  const group = new THREE.Group();
  group.name = "PovRig3D";

  // 1. Lower body (seated cross-legged knees/robes/feet OR standing legs visible when looking down)
  const lowerBody = new THREE.Group();
  lowerBody.name = "povLowerBody";
  group.add(lowerBody);

  const seatedMeshGroup = new THREE.Group();
  seatedMeshGroup.name = "povSeated";
  // 2 clean natural seated thighs/knees + tucked shins + draped shirt lap hem (zero extra double-humps!)
  const lapHem = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.24), sleeveMat);
  lapHem.position.set(0, 0.16, -0.22);
  seatedMeshGroup.add(lapHem);
  for (const side of [-1, 1] as const) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.36, 8, 12), pantsMat);
    thigh.position.set(side * 0.17, 0.17, -0.38);
    thigh.rotation.set(Math.PI * 0.45, side * -0.24, side * 0.06);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.060, 0.34, 6, 10), pantsMat);
    shin.position.set(side * 0.11, 0.10, -0.54);
    shin.rotation.set(Math.PI * 0.5, side * 1.18, 0);
    seatedMeshGroup.add(thigh, shin);
  }
  lowerBody.add(seatedMeshGroup);

  const standingMeshGroup = new THREE.Group();
  standingMeshGroup.name = "povStanding";
  for (const side of [-1, 1] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.68, 6, 10), pantsMat);
    leg.position.set(side * 0.11, 0.44, -0.05);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.13, 6, 8), shoeMat);
    foot.rotation.x = Math.PI * 0.5;
    foot.scale.set(0.92, 0.65, 1.0);
    foot.position.set(side * 0.11, 0.045, -0.14);
    standingMeshGroup.add(leg, foot);
  }
  const chestHem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.34, 12), sleeveMat);
  chestHem.position.set(0, 0.92, -0.02);
  standingMeshGroup.add(chestHem);
  standingMeshGroup.visible = false;
  lowerBody.add(standingMeshGroup);

  // 2. Camera-aligned POV dual forearms & hands
  const armsRoot = new THREE.Group();
  armsRoot.name = "povArmsRoot";
  group.add(armsRoot);

  const buildPovArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? "povLeftArm" : "povRightArm";
    // Forearm & wrist sit cleanly behind held props (-Z away from camera) sloping downward-outward toward shoulder
    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.34, 6, 10), sleeveMat);
    forearm.position.set(side * 0.076, -0.21, -0.044);
    forearm.rotation.set(-0.18, 0, side * 0.28);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.068, 10), skinMat);
    wrist.position.set(side * 0.020, -0.070, -0.048);
    wrist.rotation.set(-0.14, 0, side * 0.20);
    const hand = new THREE.Group();
    hand.name = side < 0 ? "povLeftHand" : "povRightHand";
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.038, 0.016), skinMat);
    palm.position.set(0, -0.012, -0.048);
    hand.add(palm);
    arm.add(forearm, wrist, hand);
    armsRoot.add(arm);
    return { arm, hand };
  };

  const left = buildPovArm(-1);
  const right = buildPovArm(1);

  attachOutlineRig(group, { pxWidth: opts.outlinePx ?? 5.2, minWorld: 0.001, maxWorld: 0.012, color: "#06060a" });

  const update = (cam: THREE.PerspectiveCamera, pose: PovPose) => {
    lowerBody.position.set(...pose.anchor);
    lowerBody.rotation.set(0, pose.bodyYaw, 0);
    seatedMeshGroup.position.set(0, pose.kneeYOffset ?? 0, pose.kneeZOffset ?? 0);
    seatedMeshGroup.visible = pose.stance === "seated";
    standingMeshGroup.visible = pose.stance === "standing";

    armsRoot.position.copy(cam.position);
    armsRoot.quaternion.copy(cam.quaternion);

    const t = pose.frame / FPS;
    const swayY = Math.sin(t * 2.2) * 0.004;
    const swayX = Math.cos(t * 1.4) * 0.003;
    const lRaise = clamp01(pose.leftArmRaise ?? 0);
    const rRaise = clamp01(pose.rightArmRaise ?? 0);

    // Default resting positions tucked cleanly just below camera edge unless raised
    left.arm.position.set(-0.24 + swayX, -0.44 + lRaise * 0.24 + swayY, -0.28 - lRaise * 0.08);
    left.arm.rotation.set(0.18 - lRaise * 0.22, 0.26, -0.12);
    left.arm.visible = lRaise > 0.02;

    if (pose.propMode === "phone") {
      // Raised centered-right smartphone framing clearly above lower-third subtitles with zero wrist/bezel clipping
      const k = Math.max(0.001, rRaise);
      right.arm.visible = k > 0.02;
      right.arm.position.set(0.032 + swayX, -0.34 + k * 0.33 + swayY, -0.35);
      right.arm.rotation.set(0.10 * (1 - k), -0.05, 0.03);
      left.arm.visible = false;
    } else if (pose.propMode === "flashlight") {
      // Positioned cleanly inside narrow 9:16 lower-right frustum so POV hand & metal torch barrel are clearly visible
      right.arm.visible = rRaise > 0.02;
      right.arm.position.set(0.082 + swayX, -0.22 + rRaise * 0.09 + swayY, -0.35);
      right.arm.rotation.set(0.06, 0.06, -0.04);
    } else if (pose.propMode === "lamp") {
      right.arm.visible = rRaise > 0.02;
      right.arm.position.set(0.095 + swayX, -0.26 + rRaise * 0.14 + swayY, -0.38);
      right.arm.rotation.set(0.05, -0.08, 0);
    } else if (pose.propMode === "paper") {
      right.arm.visible = rRaise > 0.02;
      right.arm.position.set(0.0 + swayX, -0.34 + rRaise * 0.32 + swayY, -0.33);
      right.arm.rotation.set(-0.08, 0, 0);
    } else {
      right.arm.visible = rRaise > 0.02;
      right.arm.position.set(0.24 + swayX, -0.44 + rRaise * 0.24 + swayY, -0.28 - rRaise * 0.08);
      right.arm.rotation.set(0.18 - rRaise * 0.22, -0.26, 0.12);
    }
  };

  return { group, lowerBody, armsRoot, leftHand: left.hand, rightHand: right.hand, update };
}
