// HorrorLabV3World (Engine v4 Style B — Semi-Realistic Indie 3D × Modular Dark & Body Horror):
// Drives 3 radically different gritty environments, sculpted non-plastic humans, visceral Body Horror entities
// (3D hollowed skull sockets, asymmetric bloodshot weeping sanpaku eyeballs, articulated 3D dislocated jaw + crooked teeth,
// elongated tendon neck, protruding ribs/spine, spider claw hands, 2 extra shadowy arms), and POV rig from MANIFEST.

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
  applyPsxTextureFilter,
  beatAt,
  clamp01,
  createCharacterFromBlueprint,
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
  torchMalfunction,
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
import { ANCHORS, CAMS, HOSP_BLACKOUTS, KICKS, MANIFEST, SHOTS, evalShotMotion } from "./story";

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
    this.sky.userData.noSSAO = true;
    this.root.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#2c222a", "#120d13", 0.30);
    this.sun = new THREE.DirectionalLight("#ffb878", 1.35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.root.add(this.hemi, this.sun, this.sun.target);

    // 3 radically different gritty environments (strictly isolated groups)
    this.funeralSet = buildRuralFuneralRoom();
    this.hospitalSet = buildHospitalCorridor();
    this.alleySet = buildFoggyVillageAlley();
    this.root.add(this.funeralSet.group, this.hospitalSet.group, this.alleySet.group);

    // Build ALL 4 cast characters strictly from story-driven MANIFEST.castBlueprints (zero cookie-cutter hardcoding!)
    const bpOf = (id: string) => {
      const found = (MANIFEST.castBlueprints ?? []).find((b) => b.id === id);
      if (!found) throw new Error(`HorrorLabV3World: missing CharacterBlueprint '${id}' in manifest.json`);
      return found;
    };

    this.chuBay = createCharacterFromBlueprint(bpOf("chuBay"));
    this.chuBay.group.position.set(...ANCHORS.NPC_SEAT);

    this.doorEntity = createCharacterFromBlueprint(bpOf("doorEntity"));
    this.doorEntity.group.position.set(...ANCHORS.ENTITY_DOOR);

    this.wardEntity = createCharacterFromBlueprint(bpOf("wardEntity"));
    this.wardEntity.group.position.set(...ANCHORS.HOSP_ENTITY);

    this.alleyFigure = createCharacterFromBlueprint(bpOf("alleyFigure"));
    this.alleyFigure.group.position.set(...ANCHORS.ALLEY_FIGURE);

    this.root.add(this.chuBay.group, this.doorEntity.group, this.wardEntity.group, this.alleyFigure.group);

    // 1st-Person POV Rig + Diegetic 3D Props (Phone3D + Flashlight3D — Style B zero outlines + weathered skin/metal)
    this.pov = createPovRig3D({ skinCol: "#967e6a", sleeveCol: "#353b44", pantsCol: "#1a1b24", outlineMode: "off" });
    this.phone = createPhone3D({ clock: "01:06" }, "off");
    this.phone.group.position.set(0.0, 0.055, -0.02);
    this.phone.group.rotation.set(-0.08, -0.06, 0.03);
    this.flashlight = createFlashlight3D("off");
    this.flashlight.group.position.set(0.0, 0.01, -0.05);
    this.pov.rightHand.add(this.phone.group, this.flashlight.group);
    this.root.add(this.pov.group);

    // Horror Engine v4.5: Crisp unfiltered PS1 NearestFilter across all world/character textures (preserving Phone3D lockscreen legibility)
    applyPsxTextureFilter(this.root, true);
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
        pts.push({ pos: [tx - 0.18, 0.84, tz + 0.05], color: [2.55 * flk, 1.46 * flk, 0.54 * flk], radius: 6.0 });
      }
      if (altarOn) {
        const [ax, , az] = ANCHORS.ALTAR;
        pts.push({ pos: [ax - 0.46, 1.32, az + 0.08], color: [1.85 * flk, 1.05 * flk, 0.42 * flk], radius: 4.5 });
      }
      // Subtle cold blue moonlight leaking from broken right shutter window (rich warm-vs-cold Chiaroscuro!)
      pts.push({ pos: [2.85, 1.62, -0.90], color: [0.42, 0.62, 0.98], radius: 4.2 });

      if (phoneOn) {
        pts.push(this.phone.getLight(1.45));
      }
      if (beat.lightState.doorMoonlight) {
        const [dx, , dz] = ANCHORS.DOUBLE_DOOR;
        pts.push({ pos: [dx, 0.38, dz + 0.45], color: [0.74, 0.94, 1.34], radius: 3.9 });
        // Side-raking cold moonlight grazing the Body-Horror doorway entity's skull hollows, eyeballs & crooked teeth!
        if (beat.castStates.doorEntity?.visible) {
          pts.push({ pos: [dx + 0.85, 1.88, dz + 1.45], color: [0.96, 1.18, 1.60], radius: 3.8 });
        }
      }
    } else if (beat.locationId === "hospitalCorridor") {
      // Stark Silent Hill abyssal chiaroscuro + P.T./Lights Out malfunctioning tight 20-deg flashlight beam!
      const malf = torchMalfunction(frame, HOSP_BLACKOUTS, 19);
      const flkA = flickerAt(frame, 13, 0.30, 0.22) * (malf.isDark ? 0.08 : 1.0);
      const flkB = flickerAt(frame, 41, 0.20, 0.45) * (malf.isDark ? 0.08 : 1.0);
      pts.push({ pos: [0, 2.72, -0.4], color: [0.46 * flkA, 0.62 * flkA, 0.44 * flkA], radius: 4.8 });
      pts.push({ pos: [0, 2.72, -6.4], color: [0.44 * flkB, 0.66 * flkB, 0.46 * flkB], radius: 5.2 });
      this.hospitalSet.tubeA.setIntensity(flkA * 0.72);
      this.hospitalSet.tubeB.setIntensity(flkB * 0.68);
      const torchSpot = this.flashlight.getSpotLight();
      if (torchSpot && !malf.isDark) {
        const ep = this.wardEntity.group.position;
        const aimY = malf.stage >= 2 ? 1.62 : 1.46;
        const beamK = malf.stage >= 2 ? 0.94 : 1.06;
        setSpotLight({
          ...torchSpot,
          target: [ep.x - 0.04, aimY, ep.z],
          color: [beamK * malf.power, 0.98 * beamK * malf.power, 0.86 * beamK * malf.power],
          distance: 9.2,
          angleDeg: malf.stage === 0 ? 22 : 20,
          penumbra: 0.44,
        });
      }
    } else if (beat.locationId === "foggyVillageAlley") {
      const bp = this.alleySet.streetLamp.bulbWorldPos;
      pts.push({ pos: [bp[0], bp[1] - 0.12, bp[2]], color: [2.55, 1.62, 0.70], radius: 9.8 });
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

    const fogOv = beat.lightState.fogOverride;
    untone(fogOv?.color ?? L.fog, this.fog.color);
    this.fog.near = fogOv?.near ?? L.fogNear;
    this.fog.far = fogOv?.far ?? L.fogFar;
    scene.fog = this.fog;
    scene.background = null;

    // 4. Location props, Haunted Portrait, Corner Lurkers & Swarming Flies driven directly by MANIFEST
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
      this.funeralSet.flies.update(frame);
      // Ancestral portrait gradually shifts gaze sideways & weeps dark blood as lights die!
      const hauntK = frame < 50 ? 0.25 + (frame / 50) * 0.25 : frame < 95 ? 0.65 : 0.96;
      this.funeralSet.hauntedPortrait.setHaunt(hauntK, frame < 50 ? -0.45 : 0.55);
      // Subliminal Corner Lurker peeking through broken shutter window right behind Phone3D in B2!
      const winPeek = beat.beatId === "B2_WHIP_PHONE" ? clamp01((frame - 62) / 10) : 0;
      this.funeralSet.windowLurker.setPeek(winPeek, frame);
    } else if (beat.locationId === "hospitalCorridor") {
      this.hospitalSet.dust.update(frame);
      this.hospitalSet.flies.update(frame);
    } else if (beat.locationId === "foggyVillageAlley") {
      this.alleySet.flies.update(frame);
      const alleyPeek = clamp01((frame - 246) / 14);
      this.alleySet.alleyLurker.setPeek(alleyPeek, frame);
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
      // Folk-horror shroud ghost with matted long hair & Jacob's Ladder head-twitch
      this.doorEntity.group.rotation.y = 0.22;
      this.doorEntity.setPose(deState.pose, frame, { jawOpen: 0.92, twitch: frame > 138, headTwitch: frame > 134 ? 0.78 : 0.22 });
    }

    const weState = beat.castStates.wardEntity;
    this.wardEntity.group.visible = !!weState?.visible;
    if (weState?.visible) {
      // Iconic P.T. / Lights Out 3-stage Blink-Advance synced to HOSP_BLACKOUTS!
      const malf = torchMalfunction(frame, HOSP_BLACKOUTS, 19);
      if (malf.stage === 0) {
        // Stage 0 (f160..185): Torso hidden behind right doorway wall, neck craning LEFTWARD into open doorway & spider hand clutching jamb!
        this.wardEntity.group.position.set(0.72, 0, -2.56);
        this.wardEntity.group.rotation.y = -0.28;
        this.wardEntity.setPose("doorwayPeek", frame, { jawOpen: 0.78, headTwitch: 0.35 });
      } else if (malf.stage === 1) {
        // Stage 1 (f191..206, peakFrame 198): Suddenly snapped 0.5m forward into doorway center with 4 arms splayed!
        this.wardEntity.group.position.set(0.05, 0, -2.28);
        this.wardEntity.group.rotation.y = -0.06;
        this.wardEntity.setPose("stalkLoom", frame, { jawOpen: 0.94, twitch: true, headTwitch: 0.82 });
      } else {
        // Stage 2 (f212..229): Snapped terrifyingly close right into the narrow flashlight beam!
        this.wardEntity.group.position.set(0.02, 0, -0.74);
        this.wardEntity.group.rotation.y = -0.04;
        this.wardEntity.setPose("lungeCloseUp", frame, { jawOpen: 0.98, twitch: true, headTwitch: 0.95 });
      }
    }

    const afState = beat.castStates.alleyFigure;
    this.alleyFigure.group.visible = !!afState?.visible;
    if (afState?.visible) {
      this.alleyFigure.group.rotation.y = -0.78;
      this.alleyFigure.setPose(afState.pose, frame, { expr: afState.expr ?? "dread", gazeX: 0.45, sweat: true, autoBlink: false });
    }

    // 6. POV Rig + Diegetic 3D Props synced to beat.propStates
    const phoneState = propStateOf(beat, "phone");
    const flashState = propStateOf(beat, "flashlight");
    const showPhone = !!phoneState?.visible;
    const showFlash = !!flashState?.visible;
    this.phone.group.visible = showPhone;
    this.flashlight.group.visible = showFlash;
    const flashPower = beat.locationId === "hospitalCorridor" ? torchMalfunction(frame, HOSP_BLACKOUTS, 19).power : 1.05;
    this.flashlight.setOn(showFlash && flashPower > 0.05, flashPower * 1.05);

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
    this.funeralSet.hauntedPortrait.dispose();
    this.phone.dispose();
  }
}
