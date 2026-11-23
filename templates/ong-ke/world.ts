// OngKeWorld implementing ShortWorld with strict EraGroup isolation ("hall" vs "bedroom"),
// real dynamic local PointLights (kid's oil lamp, altar lamp, bedside lamp, moonlight window),
// animated 3D hinged wardrobe doors, protruding muddy burlap sack, animated 3D bedroom crossbar,
// and real 3D storm lightning illumination.

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
  lightningAt,
  setLocalLights,
  untone,
} from "../engine";
import { BedroomEra, HallEra, buildBedroomEra, buildHallEra } from "./build";
import { stageOngKe } from "./cast";
import { ANCHORS, CAMS, KICKS, OVERLAYS, OngKeShot, SHOTS, evalOngKeState } from "./story";

export class OngKeWorld implements ShortWorld {
  root = new THREE.Group();
  private hall: HallEra;
  private bedroom: BedroomEra;
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

    this.hall = buildHallEra();
    this.bedroom = buildBedroomEra();
    this.root.add(this.hall.group, this.bedroom.group);
    this.cast = new CastStage(this.root);
  }

  private shotSun(id: number, s: OngKeShot, L: LightPreset) {
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
    const st = evalOngKeState(shotId, frame);
    const flk = flickerAt(frame, 23, 0.30, 0.48);
    const k = 0.84 + 0.24 * flk;

    if (s.era === "hall") {
      const [mx, my, mz] = st.minhPos;
      const alt = ANCHORS.ALTAR;
      const win = ANCHORS.HALL_WINDOW;
      const lampOn = shotId <= 5 && frame < 1132;
      const lampPos: [number, number, number] =
        shotId === 5
          ? [-0.28, 1.10, -2.30]
          : shotId === 3
          ? [-0.52, 0.78, -2.28]
          : shotId === 2
          ? [mx + 0.14, my + 0.84, mz - 0.50]
          : [mx + 0.16, my + 0.78, mz - 0.32];
      const lampRadius = shotId === 3 ? 8.2 : shotId === 2 ? 7.8 : shotId === 5 ? 7.4 : 5.8;
      const lampCol: [number, number, number] = !lampOn
        ? [0.0, 0.0, 0.0]
        : shotId === 3
        ? [5.3 * k, 3.55 * k, 1.88 * k]
        : shotId === 2
        ? [5.4 * k, 3.55 * k, 1.85 * k]
        : shotId === 5
        ? [3.5 * k, 2.85 * k, 1.70 * k]
        : s.light === "eerie"
        ? [2.15 * k, 1.65 * k, 0.85]
        : [2.65 * k, 1.55 * k, 0.62];
      const altCol: [number, number, number] =
        shotId === 3
          ? [2.7 * k, 1.65 * k, 0.78 * k]
          : s.light === "blood"
          ? [2.65 * k, 0.78 * k, 0.56]
          : [2.35 * k, 1.32 * k, 0.52];
      const winCol: [number, number, number] =
        shotId === 2
          ? [1.65, 2.15, 2.85]
          : s.light === "storm"
          ? [1.45, 1.75, 2.25]
          : s.light === "blood"
          ? [1.95, 0.55, 0.50]
          : [0.95, 1.35, 1.95];

      setLocalLights([
        // 1. Bé Minh's handheld oil lamp (or dim residual floor bounce after drop)
        lampOn
          ? { pos: lampPos, color: lampCol, radius: lampRadius }
          : { pos: [0.25, 1.35, -1.55], color: s.light === "blood" ? [2.25, 0.78, 0.62] : [1.35, 1.62, 2.05], radius: 6.4 },
        // 2. Rustic altar storm lantern illuminating right hall wall & wardrobe flank
        { pos: [alt[0] - 0.18, alt[1] + 1.18, alt[2] + 0.25], color: altCol, radius: shotId === 3 ? 7.6 : 6.5 },
        // 3. Moonlight / storm glow pouring through slatted window
        { pos: [win[0] + 0.45, win[1], win[2] + 0.65], color: winCol, radius: 6.4 },
      ]);
    } else {
      // Interior bedroom: generous warm bedside oil lamp + cool window fill so Shot 9 & Shot 10 stay richly readable!
      const lp = ANCHORS.BED_LAMP;
      const win = ANCHORS.BED_WINDOW;
      const bedCol: [number, number, number] =
        s.light === "blood" ? [6.4 * k, 3.85 * k, 2.20 * k] : [3.15 * k, 1.82 * k, 0.82];
      const winCol: [number, number, number] =
        s.light === "blood" ? [2.25, 1.15, 1.25] : [1.05, 1.38, 1.88];
      setLocalLights([
        { pos: [lp[0] - 0.08, lp[1] + 1.05, lp[2] - 0.10], color: bedCol, radius: s.light === "blood" ? 9.2 : 7.4 },
        { pos: [win[0] + 0.35, win[1], win[2] + 0.55], color: winCol, radius: s.light === "blood" ? 7.4 : 6.2 },
        // Warm oil-lamp ceiling bounce grazing Minh at door + muddy burlap sack & quilt while keeping recessed under-bed void dark!
        {
          pos: s.light === "blood" ? [0.24, 1.68, -0.58] : [ANCHORS.BED[0] - 0.15, 1.35, ANCHORS.BED[2] - 0.95],
          color: s.light === "blood" ? [4.4 * k, 2.55 * k, 1.55 * k] : [1.25, 0.92, 0.60],
          radius: s.light === "blood" ? 8.4 : 4.8,
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
    const isHall = s.era === "hall";

    this.hall.group.visible = isHall;
    this.bedroom.group.visible = !isHall;
    this.hall.fgSilhouettes.visible = isHall && (shotId === 1 || shotId === 8);

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
    if (isHall && !cmaps) {
      cmaps = [0, 1].map((k) => horrorCloudHD(k, LOOK[s.light].cloud));
      this.cloudMaps[s.light] = cmaps;
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.visible = isHall;
      if (isHall && cmaps) {
        m.lookAt(cam.position.x, m.position.y, cam.position.z);
        const mat = m.material as THREE.MeshBasicMaterial;
        const nextMap = cmaps[i % cmaps.length];
        if (mat.map !== nextMap) {
          mat.map = nextMap;
          mat.needsUpdate = true;
        }
      }
    }

    const st = evalOngKeState(shotId, frame);
    const flk = flickerAt(frame, 23, 0.30, 0.48);
    const flash = lightningAt(OVERLAYS, frame);

    if (isHall) {
      // Animate 3D hinged wardrobe doors & protruding muddy burlap sack corner
      this.hall.leftDoorPivot.rotation.y = st.leftDoorAngle;
      this.hall.rightDoorPivot.rotation.y = st.rightDoorAngle;
      this.hall.sackCorner.visible = shotId === 3 || shotId === 4 || shotId === 5;
      if (this.hall.sackCorner.visible) {
        // Starts tucked inside wardrobe behind closed door, glides cleanly out through the widened right door gap (zero door clip!)
        this.hall.sackCorner.position.set(
          ANCHORS.WARDROBE[0] - 0.04 + 0.14 * st.sackPoke,
          0.02,
          ANCHORS.WARDROBE[2] - 0.14 + 0.82 * st.sackPoke,
        );
      }

      const altCol =
        s.light === "eerie"
          ? new THREE.Color(0.55, 1.85, 1.35)
          : s.light === "blood"
          ? new THREE.Color(2.4, 0.58, 0.46)
          : new THREE.Color(2.5, 1.55, 0.65);
      const winCol =
        s.light === "blood"
          ? new THREE.Color(2.0, 0.65, 0.62)
          : new THREE.Color(1.4 + flash * 1.4, 1.8 + flash * 1.5, 2.45 + flash * 1.5);
      this.hall.altarLampMat.color.copy(altCol).multiplyScalar(0.95 + 0.35 * flk);
      this.hall.windowMat.color.copy(winCol);
      this.hall.shaftMat.uniforms.uCol.value.set(s.light === "blood" ? "#d65258" : s.light === "eerie" ? "#72dab8" : "#9ec6ff");
      this.hall.shaftMat.uniforms.uOpacity.value = s.light === "candle" ? 0.08 : 0.14 + flash * 0.20;
    } else {
      // Animate 3D wooden crossbar slamming down onto bedroom door in Shot 9
      const [dx, dy, dz] = ANCHORS.BED_DOOR;
      this.bedroom.doorCrossbar.position.set(dx, dy + 1.06 + (1 - st.doorBolt) * 0.28, dz + 0.12);
      this.bedroom.doorCrossbar.rotation.z = (1 - st.doorBolt) * 0.30;

      const lampCol = s.light === "blood" ? new THREE.Color(3.2, 1.75, 1.05) : new THREE.Color(3.0, 2.0, 0.98);
      const winCol = s.light === "blood" ? new THREE.Color(2.1, 0.85, 0.85) : new THREE.Color(1.45, 1.80, 2.45);
      this.bedroom.lampMat.color.copy(lampCol).multiplyScalar(1.0 + 0.32 * flk);
      this.bedroom.windowMat.color.copy(winCol).multiplyScalar(0.95 + 0.18 * flk);
      this.bedroom.shaftMat.uniforms.uCol.value.set(s.light === "blood" ? "#d0585e" : "#8cb8f0");
      this.bedroom.shaftMat.uniforms.uOpacity.value = s.light === "blood" ? 0.13 : 0.15;
    }

    this.rightVec.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const stage = stageOngKe(shotId, frame, s.light, { pos: cam.position, right: this.rightVec, sun: sunDir }, sunDir);
    this.cast.apply(stage, cam, L.actorShadow);

    return focus;
  }

  dispose() {
    this.cast.dispose();
  }
}
