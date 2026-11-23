// HorrorLabV3World: Drives 3 radically different environments, 3D dark-horror characters,
// 1st-person POV rig + Phone3D/Flashlight3D, smooth warmLamp->coldMoon light-loss shift,
// and deterministic Whip-Pan velocity directly from the single-source-of-truth MANIFEST.

import * as THREE from "three";
import {
  type Character3D,
  type Flashlight3D,
  type LightKey,
  LIGHTS,
  LOOK,
  type LocalLight,
  NOINK,
  type Phone3D,
  type PovRig3D,
  type ShortWorld,
  V,
  applyLightUniforms,
  beatAt,
  clamp01,
  createCharacter3D,
  createFlashlight3D,
  createPhone3D,
  createPovRig3D,
  flickerAt,
  isLampLit,
  lerpLights,
  lerpLook,
  propStateOf,
  setLocalLights,
  setSpotLight,
  untone,
} from "../engine";
import {
  type FuneralRoomSet,
  type HospitalCorridorSet,
  type VillageAlleySet,
  buildFoggyVillageAlley,
  buildHospitalCorridor,
  buildRuralFuneralRoom,
} from "./build";
import { ANCHORS, CAMS, KICKS, MANIFEST, SHOTS, evalShotMotion } from "./story";

export class HorrorLabV3World implements ShortWorld {
  root = new THREE.Group();
  private funeralSet: FuneralRoomSet;
  private hospitalSet: HospitalCorridorSet;
  private alleySet: VillageAlleySet;

  private chuBay: Character3D;
  private doorEntity: Character3D;
  private wardEntity: Character3D;
  private alleyFigure: Character3D;
  private pov: PovRig3D;
  private phone: Phone3D;
  private flashlight: Flashlight3D;

  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#1d151d", 7, 44);

  constructor() {
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() },
        c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() },
        c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 18), this.skyMat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.layers.set(NOINK);
    this.root.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#2c222a", "#120d13", 0.30);
    this.sun = new THREE.DirectionalLight("#ffb878", 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.root.add(this.hemi, this.sun, this.sun.target);

    // 3 radically different environments (strictly isolated groups)
    this.funeralSet = buildRuralFuneralRoom();
    this.hospitalSet = buildHospitalCorridor();
    this.alleySet = buildFoggyVillageAlley();
    this.root.add(this.funeralSet.group, this.hospitalSet.group, this.alleySet.group);

    // 3D Dark-Horror Non-Chibi Characters & Uncanny Entities
    this.chuBay = createCharacter3D({
      id: "chuBay",
      height: 1.74,
      skinCol: "#cbb298",
      hairCol: "#141218",
      hairStyle: "shortParted",
      topCol: "#3a424e",
      bottomCol: "#191a22",
      garment: "shirt",
      headbandCol: "#ede6d8",
      outlinePx: 5.8,
    });
    this.chuBay.group.position.set(...ANCHORS.NPC_SEAT);

    this.doorEntity = createCharacter3D({
      id: "doorEntity",
      height: 1.74,
      hairStyle: "longDraped",
      garment: "shroud",
      outlinePx: 6.2,
      entity: {
        heightScale: 1.18,
        gauntness: 0.74,
        armScale: 1.26,
        fingerScale: 1.38,
        neckTiltDeg: 28,
        shoulderSkew: 0.11,
        hairCurtain: true,
        silhouetteMode: true,
        eyeGlow: true,
        eyeGlowColor: [2.2, 2.35, 2.8],
        breathing: false,
      },
    });
    this.doorEntity.group.position.set(...ANCHORS.ENTITY_DOOR);

    this.wardEntity = createCharacter3D({
      id: "wardEntity",
      height: 1.72,
      skinCol: "#6d7470",
      hairCol: "#111316",
      hairStyle: "longDraped",
      topCol: "#4a5552",
      bottomCol: "#232a2c",
      garment: "hospitalGown",
      outlinePx: 6.0,
      entity: {
        heightScale: 1.14,
        gauntness: 0.76,
        armScale: 1.24,
        fingerScale: 1.32,
        neckTiltDeg: -24,
        hairCurtain: true,
        breathing: false,
      },
    });
    this.wardEntity.group.position.set(...ANCHORS.HOSP_ENTITY);

    this.alleyFigure = createCharacter3D({
      id: "alleyFigure",
      height: 1.75,
      skinCol: "#c8b29b",
      hairCol: "#14131a",
      hairStyle: "messyFringe",
      topCol: "#2d3340",
      bottomCol: "#171820",
      garment: "casualJacket",
      outlinePx: 5.8,
    });
    this.alleyFigure.group.position.set(...ANCHORS.ALLEY_FIGURE);

    this.root.add(this.chuBay.group, this.doorEntity.group, this.wardEntity.group, this.alleyFigure.group);

    // 1st-Person POV Rig + Diegetic 3D Props (Phone3D + Flashlight3D)
    this.pov = createPovRig3D({ skinCol: "#ccb6a0", sleeveCol: "#3d4450", pantsCol: "#1a1b24" });
    this.phone = createPhone3D({ clock: "01:06" });
    this.phone.group.position.set(0.0, 0.055, -0.02);
    this.phone.group.rotation.set(-0.08, -0.06, 0.03);
    this.flashlight = createFlashlight3D();
    this.flashlight.group.position.set(0.0, 0.01, -0.05);
    this.pov.rightHand.add(this.phone.group, this.flashlight.group);
    this.root.add(this.pov.group);
  }

  getLightBlend(_shotId: number, frame: number): { from?: LightKey; to: LightKey; t: number } | null {
    const beat = beatAt(MANIFEST, frame);
    const ls = beat.lightState;
    if (!ls.blendTo || !ls.blendRange) return null;
    const [f0, f1] = ls.blendRange;
    const t = clamp01((frame - f0) / Math.max(1, f1 - f0));
    return { from: ls.preset, to: ls.blendTo, t };
  }

  getMotionVelocity(shotId: number, frame: number, aspect: number, heightPx: number) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    return evalShotMotion(CAMS, s, frame, aspect, heightPx, KICKS).vel;
  }

  private resolveLight(frame: number) {
    const beat = beatAt(MANIFEST, frame);
    const ls = beat.lightState;
    const baseL = LIGHTS[ls.preset];
    const baseK = LOOK[ls.preset];
    if (ls.blendTo && ls.blendRange) {
      const [f0, f1] = ls.blendRange;
      const t = clamp01((frame - f0) / Math.max(1, f1 - f0));
      return { L: lerpLights(baseL, LIGHTS[ls.blendTo], t), K: lerpLook(baseK, LOOK[ls.blendTo], t), beat };
    }
    return { L: baseL, K: baseK, beat };
  }

  syncLighting(_shotId: number, frame: number) {
    const { L, K, beat } = this.resolveLight(frame);
    applyLightUniforms(L, K);

    const pts: LocalLight[] = [];
    setSpotLight(null);

    if (beat.locationId === "ruralFuneralRoom") {
      const oilOn = isLampLit(beat, "oilLamp");
      const altarOn = isLampLit(beat, "altarCandle");
      const phoneOn = isLampLit(beat, "phoneScreen") && !!propStateOf(beat, "phone")?.visible;
      const flk = flickerAt(frame, 29, 0.22, 0.80);

      if (oilOn) {
        const [tx, , tz] = ANCHORS.OIL_LAMP_TABLE;
        pts.push({ pos: [tx - 0.18, 0.84, tz + 0.05], color: [2.45 * flk, 1.42 * flk, 0.56 * flk], radius: 5.8 });
      }
      if (altarOn) {
        const [ax, , az] = ANCHORS.ALTAR;
        pts.push({ pos: [ax - 0.46, 1.32, az + 0.08], color: [1.85 * flk, 1.05 * flk, 0.42 * flk], radius: 4.5 });
      }
      if (phoneOn) {
        pts.push(this.phone.getLight(1.45));
      }
      if (beat.lightState.doorMoonlight) {
        const [dx, , dz] = ANCHORS.DOUBLE_DOOR;
        pts.push({ pos: [dx, 0.35, dz + 0.45], color: [0.58, 0.76, 1.12], radius: 3.4 });
      }
    } else if (beat.locationId === "hospitalCorridor") {
      const flkA = flickerAt(frame, 13, 0.34, 0.22);
      const flkB = flickerAt(frame, 41, 0.20, 0.58);
      pts.push({ pos: [0, 2.72, -1.6], color: [1.15 * flkA, 1.42 * flkA, 1.32 * flkA], radius: 6.2 });
      pts.push({ pos: [0, 2.72, -6.8], color: [0.85 * flkB, 1.12 * flkB, 1.04 * flkB], radius: 6.0 });
      this.hospitalSet.tubeA.setIntensity(flkA);
      this.hospitalSet.tubeB.setIntensity(flkB);
      setSpotLight(this.flashlight.getSpotLight());
    } else if (beat.locationId === "foggyVillageAlley") {
      const bp = this.alleySet.streetLamp.bulbWorldPos;
      pts.push({ pos: [bp[0], bp[1] - 0.12, bp[2]], color: [2.4, 1.52, 0.68], radius: 9.2 });
    }

    setLocalLights(pts);
  }

  update(shotId: number, frame: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    const { L, K, beat } = this.resolveLight(frame);

    // 1. Strict location isolation driven by MANIFEST.locationId
    this.funeralSet.group.visible = beat.locationId === "ruralFuneralRoom";
    this.hospitalSet.group.visible = beat.locationId === "hospitalCorridor";
    this.alleySet.group.visible = beat.locationId === "foggyVillageAlley";

    // 2. Camera evaluation
    const heightPx = cam.aspect < 1 ? 1920 : 1080;
    const { cam: c } = evalShotMotion(CAMS, s, frame, cam.aspect, heightPx, KICKS);
    cam.position.set(...c.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.look);
    cam.rotateZ(c.roll);
    cam.fov = c.fov;
    cam.near = 0.08;
    cam.far = 1500;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.layers.enable(NOINK);

    // 3. Global sky, fog, hemisphere & directional shadow light
    const focus = V(...c.look);
    const az = THREE.MathUtils.degToRad(L.az);
    const el = THREE.MathUtils.degToRad(L.el);
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();

    this.hemi.color.set(L.sky);
    this.hemi.groundColor.set(L.ground);
    this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 28);
    this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8;
    sc.near = 1; sc.far = 65;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias;
    this.sun.shadow.normalBias = L.normalBias;

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

    // 4. Location props & atmospheric FX driven directly by MANIFEST
    if (beat.locationId === "ruralFuneralRoom") {
      const oilOn = isLampLit(beat, "oilLamp");
      const altarOn = isLampLit(beat, "altarCandle");
      const flk = flickerAt(frame, 29, 0.22, 0.80);
      this.funeralSet.oilLamp.setLit(oilOn, frame);
      this.funeralSet.oilLampHalo.setIntensity(oilOn ? flk : 0);
      this.funeralSet.altarCandleMat.color.setRGB(altarOn ? 3.4 : 0.05, altarOn ? 2.1 : 0.05, altarOn ? 0.72 : 0.06);
      this.funeralSet.altarHalo.setIntensity(altarOn ? flk : 0);
      this.funeralSet.doorCtrl.setMoonlight(!!beat.lightState.doorMoonlight, !!beat.lightState.feetShadow);
      this.funeralSet.incenseSmoke.update(frame, true);
      this.funeralSet.altarSmoke.update(frame, true);
    } else if (beat.locationId === "hospitalCorridor") {
      this.hospitalSet.dust.update(frame);
    }

    // 5. Characters driven directly by beat.castStates
    const cbState = beat.castStates.chuBay;
    this.chuBay.group.visible = !!cbState?.visible;
    if (cbState?.visible) {
      this.chuBay.setPose(cbState.pose, frame, {
        expr: cbState.expr ?? "uneasy",
        mouth: beat.beatId === "B1_FUNERAL_TALK" && frame % 12 < 6 ? "talkE" : "tense",
        ageLines: true,
        autoBlink: true,
      });
      this.chuBay.lookAtWorld(ANCHORS.POV_EYE, 0.85);
    }

    const deState = beat.castStates.doorEntity;
    this.doorEntity.group.visible = !!deState?.visible;
    if (deState?.visible) {
      this.doorEntity.setPose(deState.pose, frame, { twitch: frame > 142 });
    }

    const weState = beat.castStates.wardEntity;
    this.wardEntity.group.visible = !!weState?.visible;
    if (weState?.visible) {
      this.wardEntity.setPose(weState.pose, frame, { expr: weState.expr ?? "deadStare" });
    }

    const afState = beat.castStates.alleyFigure;
    this.alleyFigure.group.visible = !!afState?.visible;
    if (afState?.visible) {
      // 3/4 tense over-the-shoulder turn toward camera under the warm sodium streetlamp pool
      this.alleyFigure.group.rotation.y = -0.78;
      this.alleyFigure.setPose(afState.pose, frame, { expr: afState.expr ?? "dread", gazeX: 0.45, sweat: true, autoBlink: true });
    }

    // 6. POV Rig + Diegetic 3D Props synced to beat.propStates
    const phoneState = propStateOf(beat, "phone");
    const flashState = propStateOf(beat, "flashlight");
    const showPhone = !!phoneState?.visible;
    const showFlash = !!flashState?.visible;
    this.phone.group.visible = showPhone;
    this.flashlight.group.visible = showFlash;
    this.flashlight.setOn(showFlash, 0.92);

    if (showPhone && phoneState?.detail) {
      const det = phoneState.detail;
      this.phone.setScreen({
        clock: String(det.clock ?? "01:06"),
        date: "Chủ Nhật, 22 tháng 11",
        carrier: "Viettel",
        battery: 23,
        notifications: det.notifBody
          ? [{ sender: String(det.notifSender ?? "Tin nhắn"), time: String(det.notifTime ?? det.notifFooter ?? ""), body: String(det.notifBody) }]
          : [],
      });
    }

    const showPov = beat.locationId !== "foggyVillageAlley";
    this.pov.group.visible = showPov;
    if (showPov) {
      const isHosp = beat.locationId === "hospitalCorridor";
      const isDoorLook = beat.beatId === "B3_DOOR_SHADOW";
      const raisePhone = showPhone ? clamp01((frame - 58) / 10) : 0;
      this.pov.update(cam, {
        stance: isHosp ? "standing" : "seated",
        anchor: isHosp ? ANCHORS.HOSP_POV_FEET : isDoorLook ? [-0.68, 0.0, 0.34] : ANCHORS.POV_SEAT,
        bodyYaw: isDoorLook ? 0.16 : 0,
        kneeYOffset: isDoorLook ? 0.16 : 0,
        kneeZOffset: isDoorLook ? -0.22 : 0,
        propMode: showPhone ? "phone" : showFlash ? "flashlight" : "none",
        rightArmRaise: showPhone ? raisePhone : showFlash ? 1 : 0,
        leftArmRaise: 0,
        frame,
      });
    }

    this.syncLighting(shotId, frame);
    return focus;
  }

  dispose() {
    this.chuBay.dispose();
    this.doorEntity.dispose();
    this.wardEntity.dispose();
    this.alleyFigure.dispose();
    this.phone.dispose();
  }
}
