// MaXoWorld implementing ShortWorld with strict EraGroup isolation ("kitchen" vs "hallway"),
// calibrated real dynamic local PointLights (handheld lamp, hearth ember bed, altar/table storm lantern, moonlight window),
// animated 3D chipped ceramic bowl, animated 3D cold white rice bowl, and crimson ember flare illumination.

import * as THREE from "three";
import {
  CastStage,
  LIGHTS,
  LOOK,
  LightKey,
  LightPreset,
  NOINK,
  ShortWorld,
  V,
  applyLightUniforms,
  evalCam,
  flickerAt,
  horrorCloudHD,
  lerp,
  lightningAt,
  setLocalLights,
  untone,
} from "../engine";
import { HallwayEra, KitchenEra, buildHallwayEra, buildKitchenEra } from "./build";
import { stageMaXo } from "./cast";
import { ANCHORS, CAMS, KICKS, OVERLAYS, MaXoShot, SHOTS, evalMaXoState } from "./story";

export class MaXoWorld implements ShortWorld {
  root = new THREE.Group();
  private kitchen: KitchenEra;
  private hallway: HallwayEra;
  private cast: CastStage;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#182a48", 6.5, 62);
  private cloudMaps: Partial<Record<LightKey, THREE.Texture[]>> = {};
  private clouds: THREE.Mesh[] = [];
  private sunCache = new Map<number, THREE.Vector3>();
  private rightVec = new THREE.Vector3();

  constructor() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() },
        c1: { value: new THREE.Color() },
        c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() },
        e: { value: new THREE.Vector4() },
      },
      vertexShader:
        "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.layers.set(NOINK);
    this.root.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#223456", "#0c1220", 0.30);
    this.sun = new THREE.DirectionalLight("#9bc0ff", 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.root.add(this.hemi, this.sun, this.sun.target);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const d = 380;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }),
      );
      m.position.set(Math.cos(a) * d, 95, Math.sin(a) * d);
      m.scale.set(200, 76, 1);
      m.layers.set(NOINK);
      this.clouds.push(m);
      this.root.add(m);
    }

    this.kitchen = buildKitchenEra();
    this.hallway = buildHallwayEra();
    this.root.add(this.kitchen.group, this.hallway.group);
    this.cast = new CastStage(this.root);
  }

  private shotSun(id: number, s: MaXoShot, L: LightPreset) {
    let dir = this.sunCache.get(id);
    if (!dir) {
      const c0 = evalCam(CAMS, id, s.a);
      let fx = c0.look[0] - c0.pos[0];
      let fz = c0.look[2] - c0.pos[2];
      const fn = Math.hypot(fx, fz) || 1;
      fx /= fn;
      fz /= fn;
      const az = THREE.MathUtils.degToRad(L.az);
      const el = THREE.MathUtils.degToRad(L.el);
      const hx = fx * Math.cos(az) - fz * Math.sin(az);
      const hz = fz * Math.cos(az) + fx * Math.sin(az);
      dir = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
      this.sunCache.set(id, dir);
    }
    return dir;
  }

  private syncDynamicLights(shotId: number, frame: number) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    const st = evalMaXoState(shotId, frame);
    const flk = flickerAt(frame, 31, 0.30, 0.48);
    const k = 0.84 + 0.24 * flk;

    if (s.era === "kitchen") {
      const [lx, ly, lz] = st.lanPos;
      const tbl = ANCHORS.KITCHEN_TABLE;
      const win = ANCHORS.KITCHEN_WINDOW;
      const h = ANCHORS.HEARTH;
      const lampOn = shotId <= 5 && frame < 1152;

      const lampPos: [number, number, number] =
        shotId === 5
          ? [0.68, 1.02, -2.92]
          : shotId === 3
          ? [0.12, 0.78, -2.35]
          : shotId === 2
          ? [lx + 0.14, ly + 0.96, lz - 0.50]
          : [lx + 0.18, ly + 0.92, lz - 0.35];

      const lampCol: [number, number, number] = !lampOn
        ? [0.0, 0.0, 0.0]
        : shotId === 3
        ? [4.2 * k, 2.85 * k, 1.48 * k]
        : shotId === 2
        ? [5.4 * k, 3.55 * k, 1.85 * k]
        : shotId === 4
        ? [4.6 * k, 3.85 * k, 2.35 * k]
        : shotId === 5
        ? [3.8 * k, 3.45 * k, 2.20 * k]
        : s.light === "eerie"
        ? [2.6 * k, 2.2 * k, 1.25]
        : [2.85 * k, 1.75 * k, 0.72];

      const lampRadius = shotId === 3 ? 7.6 : shotId === 2 ? 7.8 : shotId === 4 ? 7.2 : shotId === 5 ? 6.4 : 6.2;

      // Light 2: Hearth ember glow OR Shot 10 balanced warm oil-lamp fill grazing white cold rice bowl (no highlight blowout!)
      const l2 =
        shotId === 10
          ? { pos: [-0.28, 1.18, -1.88] as [number, number, number], color: [3.4 * k, 2.05 * k, 1.18 * k] as [number, number, number], radius: 7.8 }
          : shotId === 8
          ? { pos: [-0.42, 1.15, -1.95] as [number, number, number], color: [4.8 * k, 2.95 * k, 1.48 * k] as [number, number, number], radius: 7.8 }
          : st.emberGlow > 0.05
          ? {
              pos: [h[0], 0.42, h[2] + 0.58] as [number, number, number],
              color: [
                (shotId === 6 ? 5.6 : 3.2) * st.emberGlow * k,
                (shotId === 6 ? 1.55 : 1.12) * st.emberGlow * k,
                0.55 * st.emberGlow,
              ] as [number, number, number],
              radius: shotId === 6 ? 7.8 : 6.2,
            }
          : { pos: [tbl[0] - 0.16, 1.18, tbl[2] + 0.25] as [number, number, number], color: [2.8 * k, 1.72 * k, 0.78] as [number, number, number], radius: 7.2 };

      // Light 3: Right table lantern or moonlit window fill
      const l3 =
        shotId === 10
          ? { pos: [tbl[0] - 0.25, 1.25, tbl[2] + 0.35] as [number, number, number], color: [3.8 * k, 2.05 * k, 1.15 * k] as [number, number, number], radius: 8.2 }
          : shotId === 2
          ? { pos: [win[0] + 0.55, win[1], win[2] + 0.65] as [number, number, number], color: [1.65, 2.15, 2.85] as [number, number, number], radius: 6.8 }
          : { pos: [win[0] + 0.45, win[1], win[2] + 0.65] as [number, number, number], color: (s.light === "storm" ? [1.65, 1.95, 2.45] : [1.15, 1.55, 2.15]) as [number, number, number], radius: 6.6 };

      setLocalLights([
        lampOn
          ? { pos: lampPos, color: lampCol, radius: lampRadius }
          : { pos: [0.35, 1.45, -1.65], color: shotId === 10 ? [3.6 * k, 1.95 * k, 1.25 * k] : [1.65, 1.85, 2.25], radius: 7.4 },
        l2,
        l3,
      ]);
    } else {
      // Era 2: Main 3-bay timber hall (Shot 7 blood climax & Shot 9 night trapped)
      const alt = ANCHORS.HALL_ALTAR;
      const win = ANCHORS.HALL_WINDOW;
      setLocalLights([
        {
          pos: [alt[0] - 0.18, alt[1] + 1.22, alt[2] + 0.25],
          color: s.light === "blood" ? [3.8 * k, 1.25 * k, 0.85 * k] : [3.2 * k, 1.95 * k, 0.92 * k],
          radius: 7.8,
        },
        {
          pos: [win[0] + 0.45, win[1], win[2] + 0.65],
          color: s.light === "blood" ? [2.15, 0.68, 0.65] : [1.55, 1.98, 2.65],
          radius: 7.2,
        },
        {
          pos: [0.15, 1.48, -1.45],
          color: s.light === "blood" ? [2.65, 0.92, 0.78] : [1.35, 1.62, 2.15],
          radius: 6.8,
        },
      ]);
    }
  }

  syncLighting(shotId: number, frame: number) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    applyLightUniforms(LIGHTS[s.light], LOOK[s.light]);
    this.syncDynamicLights(shotId, frame);
  }

  update(shotId: number, frame: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    const L = LIGHTS[s.light];
    const K = LOOK[s.light];
    const isKitchen = s.era === "kitchen";

    this.kitchen.group.visible = isKitchen;
    this.hallway.group.visible = !isKitchen;
    this.kitchen.fgSilhouettes.visible = isKitchen && shotId === 1;
    this.hallway.fgSilhouettes.visible = !isKitchen && shotId === 9;

    const c = evalCam(CAMS, shotId, frame, KICKS);
    cam.position.set(...c.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.look);
    cam.rotateZ(c.roll);
    cam.fov = c.fov;
    cam.near = 0.2;
    cam.far = 1500;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.layers.enable(NOINK);

    const focus = V(...c.look);
    const sunDir = this.shotSun(shotId, s, L);
    this.hemi.color.set(L.sky);
    this.hemi.groundColor.set(L.ground);
    this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sunI;

    const Rr = 14;
    this.sun.position.copy(focus).addScaledVector(sunDir, 150);
    this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr;
    sc.right = Rr;
    sc.top = Rr;
    sc.bottom = -Rr;
    sc.near = 20;
    sc.far = 350;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias;
    this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    applyLightUniforms(L, K);
    this.syncDynamicLights(shotId, frame);

    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);

    untone(L.fog, this.fog.color);
    this.fog.near = L.fogNear;
    this.fog.far = L.fogFar;
    scene.fog = this.fog;
    scene.background = null;

    let cmaps = this.cloudMaps[s.light];
    if (!cmaps) {
      cmaps = [0, 1].map((k) => horrorCloudHD(k, LOOK[s.light].cloud));
      this.cloudMaps[s.light] = cmaps;
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.visible = true;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      const nextMap = cmaps[i % cmaps.length];
      if (mat.map !== nextMap) {
        mat.map = nextMap;
        mat.needsUpdate = true;
      }
    }

    const st = evalMaXoState(shotId, frame);
    const flk = flickerAt(frame, 31, 0.30, 0.48);
    const flash = lightningAt(OVERLAYS, frame);

    if (isKitchen) {
      // Animate 3D Chipped Ceramic Bowl (flips upside-down <-> upright & slides cleanly across ash!)
      const [nx, ny, nz] = ANCHORS.NOOK;
      const flipArc = Math.sin(st.bowlFlip * Math.PI) * 0.14;
      const s10NookOffsetX = shotId === 10 ? 0.30 : 0.0;
      const s10NookOffsetZ = shotId === 10 ? -0.18 : 0.0;
      this.kitchen.chippedBowl.position.set(
        lerp(nx + s10NookOffsetX, nx - 0.36, st.bowlFlip),
        ny + lerp(0.16, 0.015, st.bowlFlip) + flipArc,
        lerp(nz + 0.10 + s10NookOffsetZ, nz + 0.62, st.bowlFlip),
      );
      this.kitchen.chippedBowl.rotation.x = lerp(Math.PI, 0.0, st.bowlFlip);
      this.kitchen.chippedBowl.rotation.z = Math.sin(st.bowlFlip * Math.PI) * 0.25;
      // Keep chipped bowl tucked inside nook in Shot 10 while cold white rice bowl takes center stage!
      this.kitchen.chippedBowl.visible = shotId !== 5;

      // Animate 3D Cold White Rice Bowl in Shot 10 (dragged slowly into pitch-black nook beside tucked chipped bowl — zero mesh clipping!)
      this.kitchen.riceBowl.visible = shotId === 10;
      if (this.kitchen.riceBowl.visible) {
        this.kitchen.riceBowl.position.set(
          lerp(0.42, 0.72, st.ricePull),
          0.012,
          lerp(-2.58, -3.14, st.ricePull),
        );
        this.kitchen.riceBowl.rotation.y = lerp(0.12, -0.35, st.ricePull);
      }

      // Dynamic hearth ember material
      const em = st.emberGlow * (0.85 + 0.30 * flk);
      this.kitchen.emberMat.color.setRGB(3.1 * em, 0.88 * em, 0.24 * em);

      const tCol =
        s.light === "eerie"
          ? new THREE.Color(0.65, 1.90, 1.45)
          : s.light === "blood"
          ? new THREE.Color(2.8, 1.15, 0.72)
          : new THREE.Color(2.6, 1.62, 0.68);
      const wCol =
        s.light === "blood"
          ? new THREE.Color(2.1, 0.72, 0.68)
          : new THREE.Color(1.42 + flash * 1.4, 1.82 + flash * 1.5, 2.45 + flash * 1.5);
      this.kitchen.tableLampMat.color.copy(tCol).multiplyScalar(0.95 + 0.30 * flk);
      this.kitchen.windowMat.color.copy(wCol);
      this.kitchen.shaftMat.uniforms.uCol.value.set(s.light === "blood" ? "#d6585e" : s.light === "eerie" ? "#72dab8" : "#9ec6ff");
      this.kitchen.shaftMat.uniforms.uOpacity.value = s.light === "candle" ? 0.08 : 0.14 + flash * 0.20;
    } else {
      const aCol = s.light === "blood" ? new THREE.Color(2.9, 0.88, 0.64) : new THREE.Color(2.7, 1.68, 0.72);
      const wCol = s.light === "blood" ? new THREE.Color(2.1, 0.70, 0.68) : new THREE.Color(1.45, 1.85, 2.50);
      this.hallway.altarLampMat.color.copy(aCol).multiplyScalar(0.95 + 0.30 * flk);
      this.hallway.windowMat.color.copy(wCol);
      this.hallway.shaftMat.uniforms.uCol.value.set(s.light === "blood" ? "#d65258" : "#9ec6ff");
      this.hallway.shaftMat.uniforms.uOpacity.value = s.light === "blood" ? 0.13 : 0.15;
    }

    this.rightVec.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const stage = stageMaXo(shotId, frame, s.light, { pos: cam.position, right: this.rightVec, sun: sunDir }, sunDir);
    this.cast.apply(stage, cam, L.actorShadow);

    return focus;
  }

  dispose() {
    this.cast.dispose();
  }
}
