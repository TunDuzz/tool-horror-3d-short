// ShortWorld v12.0 + v13.0 Controller for "Đêm Gió Bấc — Máy Nội Bộ 204".
// Drives:
//   - DormDutyRoomSet (vaulted Hanoi duty room, pendulum clock decelerating & stopping at 02:15,
//     corridor transom door + sliding brass bolt, jolting rotary phone + lifted handset,
//     dusty severed floor cord, and gently swaying Room 204 brass key tag)
//   - C01 Huy (`voiceOver` closed-mouth discipline) + C02 Bà Hạnh (`directSpeech` vowel lip-sync + corridor walk)
//   - Embodied 2-joint `PovRig3D` (`leanDesk`, `reachBolt` to real 3D bolt target, `holdHandset` with diegetic bakelite receiver).

import * as THREE from "three";
import {
  type Character3D,
  type LightKey,
  LIGHTS,
  LOOK,
  type LocalLight,
  NOINK,
  type PovRig3D,
  type RawWordTiming,
  type ShortWorld,
  V,
  applyLightUniforms,
  applyManifestActors,
  applyPsxTextureFilter,
  beatAt,
  clamp01,
  createCharacterFromBlueprint,
  createPovRig3D,
  evalShotMotion,
  flickerAt,
  getCharacterPartWorldPos,
  isLampLit,
  lerp,
  lerpLights,
  lerpLook,
  phong,
  propStateOf,
  setLocalLights,
  setSpotLight,
  shotSpecAt,
  smooth,
  untone,
} from "../engine";
import { type DormDutyRoomSet, MNB_ANCHORS, buildDormDutyRoom } from "./build";
import { CAMS, KICKS, MANIFEST, SHOTS } from "./story";
import wordsPayload from "./words.json";

const WORDS = (wordsPayload as { words: Array<{ w: string; s: number; e: number; speaker?: string }> }).words;

// Show Huy's full 3D body ONLY in Shot 1 (Master Establishing) and Shot 3 (Same-Side OTS);
// hide C01 body on all 1st-person POV shots so camera never clips inside Huy's head while showing 2-joint PovRig3D hands!
const HIDE_HUY_ON_SHOTS = [2, 4, 5, 6, 7, 8, 9, 10];

class MayNoiBo204World implements ShortWorld {
  root = new THREE.Group();
  private room: DormDutyRoomSet;
  private huy: Character3D;
  private baHanh: Character3D;
  private pov: PovRig3D;
  private povHandset: THREE.Group;

  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#0b1014", 4.6, 24);

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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(850, 28, 16), this.skyMat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.layers.set(NOINK);
    this.sky.userData.noSSAO = true;
    this.root.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#222c30", "#0c0e12", 0.32);
    this.sun = new THREE.DirectionalLight("#9eb8c4", 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.root.add(this.hemi, this.sun, this.sun.target);

    this.room = buildDormDutyRoom();
    this.root.add(this.room.group);

    const bpMap = Object.fromEntries((MANIFEST.castBlueprints ?? []).map((b) => [b.id, b]));
    this.huy = createCharacterFromBlueprint(bpMap.C01);
    this.baHanh = createCharacterFromBlueprint(bpMap.C02);
    this.root.add(this.huy.group, this.baHanh.group);

    // Embodied POV Rig matching Huy's dark winter coat sleeve + diegetic black bakelite handset on rightHand
    this.pov = createPovRig3D({ skinCol: "#b49882", sleeveCol: "#303640", pantsCol: "#1c2028", outlineMode: "off" });
    this.povHandset = new THREE.Group();
    const bakeliteMat = phong("mnb_pov_bakelite", () => ({ color: "#18191d", specular: "#68707c", shininess: 76 }));
    const rBar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.19, 0.032), bakeliteMat);
    const rEar = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.038, 10).rotateZ(Math.PI * 0.5), bakeliteMat);
    rEar.position.set(-0.02, 0.085, 0);
    const rMouth = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.038, 10).rotateZ(Math.PI * 0.5), bakeliteMat);
    rMouth.position.set(-0.02, -0.085, 0);
    rBar.layers.set(NOINK);
    rEar.layers.set(NOINK);
    rMouth.layers.set(NOINK);
    this.povHandset.add(rBar, rEar, rMouth);
    this.povHandset.position.set(-0.02, 0.02, -0.04);
    this.povHandset.visible = false;
    this.pov.rightHand.add(this.povHandset);
    this.root.add(this.pov.group);

    applyPsxTextureFilter(this.root, true);
  }

  getAuditTargets(): Record<string, THREE.Object3D | null | undefined> {
    return {
      deskLamp: this.room.deskLampGroup,
      switchboardPhone: this.room.switchboardPhone,
      severedPhoneCord: this.room.severedPhoneCord,
      wallPendulumClock: this.room.wallPendulumClock,
      keyTag204: this.room.keyTag204,
      corridorDoor: this.room.corridorDoor,
      corridorBolt: this.room.corridorBolt,
      C01: this.huy.group,
      "C01:head": this.huy.sockets.head,
      C02: this.baHanh.group,
      "C02:head": this.baHanh.sockets.head,
    };
  }

  getFocusTarget(shotId: number): THREE.Object3D | null {
    switch (shotId) {
      case 3:
      case 4:
        return this.baHanh.sockets.head;
      case 5:
        return this.room.corridorBolt;
      case 6:
        return this.room.wallPendulumClock;
      case 7:
      case 8:
        return this.room.switchboardPhone;
      case 9:
        return this.room.severedPhoneCord;
      case 10:
        return this.room.keyTag204;
      default:
        return this.room.switchboardPhone;
    }
  }

  getLightBlend(_shotId: number, frame: number): { from?: LightKey; to: LightKey; t: number } | null {
    const beat = beatAt(MANIFEST, frame);
    const ls = beat.lightState;
    if (!ls.blendTo || !ls.blendRange) return null;
    const [f0, f1] = ls.blendRange;
    return { from: ls.preset, to: ls.blendTo, t: clamp01((frame - f0) / Math.max(1, f1 - f0)) };
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

  syncLighting(shotId: number, frame: number) {
    const { L, K, beat } = this.resolveLight(frame);
    applyLightUniforms(L, K);
    setSpotLight(null);

    const pts: LocalLight[] = [];
    const deskOn = isLampLit(beat, "deskLamp");
    const tubeOn = isLampLit(beat, "fluorescent");
    const flk = flickerAt(frame, 29, 0.16, 0.86);
    const tubeFlk = tubeOn ? flickerAt(frame, 43, 0.22, 0.80) : 0.14;

    if (deskOn) {
      // Balanced warm chiaroscuro pool from green gooseneck desk lamp (crisp dials/pages with zero HDR blowout!)
      pts.push({ pos: [-0.30, 1.12, 0.04], color: [1.32 * flk, 1.00 * flk, 0.60 * flk], radius: 6.4 });
    }
    // Overhead duty-room tube + exterior cold corridor tube (`Zero Black Void` architectural readability!)
    pts.push({ pos: [0.15, 2.85, -0.25], color: [0.85 * tubeFlk, 1.16 * tubeFlk, 1.20 * tubeFlk], radius: 7.8 });
    pts.push({ pos: [3.25, 2.75, -1.65], color: [0.72, 1.05, 1.25], radius: 6.4 });

    // Dedicated readable key lights for characters & hero close-up reveals (without overexposing p95!)
    if (this.baHanh.group.visible) {
      const hp = getCharacterPartWorldPos(this.baHanh, "head");
      pts.push({ pos: [hp[0] - 0.58, hp[1] + 0.20, hp[2] + 0.68], color: [1.28 * flk, 1.06 * flk, 0.78 * flk], radius: 4.2 });
    }
    if (this.huy.group.visible) {
      const hp = getCharacterPartWorldPos(this.huy, "head");
      pts.push({ pos: [hp[0] - 0.35, hp[1] + 0.22, hp[2] - 0.55], color: [1.15 * flk, 0.96 * flk, 0.72 * flk], radius: 3.6 });
    }
    if (shotId === 6 || shotId === 7) {
      pts.push({ pos: [-1.55, 1.72, -0.22], color: [0.92, 0.86, 0.72], radius: 3.4 });
    } else if (shotId === 9) {
      // Crisp cool-warm floor bounce on `severedPhoneCord` so frayed copper strands & grey dust read crystal-clear!
      pts.push({ pos: [0.72, 0.68, 0.46], color: [1.12, 1.18, 1.32], radius: 3.2 });
    } else if (shotId === 10) {
      // Balanced spotlight spill on `keyBoardGroup` / `keyTag204`
      pts.push({ pos: [-1.18, 1.62, -1.78], color: [1.15, 1.10, 1.04], radius: 3.4 });
    }

    setLocalLights(pts);
  }

  update(shotId: number, frame: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    const { L, K, beat } = this.resolveLight(frame);

    const heightPx = cam.aspect < 1 ? 1920 : 1080;
    const { cam: c } = evalShotMotion(CAMS, s, frame, cam.aspect, heightPx, KICKS);

    cam.position.set(...c.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(...c.look);
    cam.rotateZ(c.roll);
    cam.fov = c.fov;
    cam.near = 0.08;
    cam.far = 1200;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.layers.enable(NOINK);

    const focus = V(...c.look);
    const az = THREE.MathUtils.degToRad(L.az);
    const el = THREE.MathUtils.degToRad(L.el);
    const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();

    this.hemi.color.set(L.sky);
    this.hemi.groundColor.set(L.ground);
    this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol);
    this.sun.intensity = L.sunI;
    this.sun.position.copy(focus).addScaledVector(sunDir, 26);
    this.sun.target.position.copy(focus);
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

    // 1. Update Practical Lights & Dust
    const flk = flickerAt(frame, 29, 0.16, 0.86);
    const tubeOn = isLampLit(beat, "fluorescent");
    this.room.deskLampHalo.setIntensity(isLampLit(beat, "deskLamp") ? flk : 0);
    this.room.roomTube.setIntensity(tubeOn ? flickerAt(frame, 43, 0.22, 0.80) : 0.08);
    this.room.corridorTube.setIntensity(0.75 * flickerAt(frame, 61, 0.18, 0.82));
    this.room.dust.update(frame);

    // 2. Prop State Machine P01_DOOR: ajar (0.48 rad) -> pulls shut & slides `corridorBolt` into jamb!
    const pDoor = propStateOf(beat, "P01_DOOR");
    if (pDoor?.state === "lockedInside") {
      const trigF = pDoor.triggerFrame ?? beat.a;
      if (pDoor.fromState === "ajar") {
        const closeK = smooth(clamp01((frame - (beat.a + 8)) / Math.max(14, trigF - beat.a - 10)));
        const boltK = smooth(clamp01((frame - (trigF - 4)) / 12));
        this.room.corridorDoor.rotation.y = lerp(0.52, 0.0, closeK);
        this.room.corridorBolt.position.z = lerp(0.62, 0.86, boltK);
      } else {
        this.room.corridorDoor.rotation.y = 0.0;
        this.room.corridorBolt.position.z = 0.86;
      }
    } else {
      this.room.corridorDoor.rotation.y = 0.52;
      this.room.corridorBolt.position.z = 0.62;
    }

    // 3. Prop State Machine P02_CLOCK: steady 1.05s swing -> decelerates & freezes dead at `stopped0215`!
    const pClock = propStateOf(beat, "P02_CLOCK");
    const stopTrig = pClock?.triggerFrame ?? 99999;
    if (pClock?.state === "stopped0215" && frame >= stopTrig) {
      const settle = Math.exp(-(frame - stopTrig) * 0.18) * Math.sin((frame - stopTrig) * 0.35) * 0.04;
      this.room.pendulumPivot.rotation.z = settle;
    } else {
      const slowDown = pClock?.state === "stopped0215" ? clamp01((stopTrig - frame) / 45) : 1.0;
      const amp = 0.24 * (0.35 + 0.65 * slowDown);
      this.room.pendulumPivot.rotation.z = Math.sin((frame / 30) * (Math.PI / 1.05)) * amp;
    }

    // 4. Prop State Machine P03_PHONE: idleCut -> halfRing (0.88s bell jolt) -> liftedWhisper (cradle empty!)
    const pPhone = propStateOf(beat, "P03_PHONE");
    if (pPhone?.state === "liftedWhisper") {
      this.room.handsetOnCradle.visible = false;
      this.room.phoneBellPivot.rotation.z = 0;
    } else if (pPhone?.state === "halfRing") {
      this.room.handsetOnCradle.visible = true;
      const rTrig = pPhone.triggerFrame ?? beat.a;
      const inRing = frame >= rTrig - 4 && frame <= rTrig + 24;
      this.room.phoneBellPivot.rotation.z = inRing ? Math.sin(frame * 2.8) * 0.12 : 0;
      this.room.handsetOnCradle.rotation.z = inRing ? Math.sin(frame * 2.4) * 0.035 : 0;
    } else {
      this.room.handsetOnCradle.visible = true;
      this.room.phoneBellPivot.rotation.z = 0;
      this.room.handsetOnCradle.rotation.z = 0;
    }

    // 5. Prop State Machine P04_KEY204: gentle uncanny pendulum sway on hook #4 during final reveal (`swaying`)
    const pKey = propStateOf(beat, "P04_KEY204");
    if (pKey?.state === "swaying" || shotId === 10) {
      this.room.keyTag204.rotation.z = Math.sin(frame * 0.095) * 0.16;
    } else {
      this.room.keyTag204.rotation.z = 0;
    }

    // 6. Drive Characters via `stage.ts` (`C01` Huy `voiceOver` closed mouth + `C02` Bà Hạnh `directSpeech` vowel lip-sync!)
    applyManifestActors(
      MANIFEST,
      frame,
      { C01: this.huy, C02: this.baHanh },
      undefined,
      {
        words: WORDS as RawWordTiming[],
        speakerMap: {
          C01: ["NARRATOR", "HUY"],
          C02: ["BÀ HẠNH", "BA HANH"],
        },
      },
    );
    if (HIDE_HUY_ON_SHOTS.includes(shotId)) {
      this.huy.group.visible = false;
    }

    // 7. Embodied 2-Joint `PovRig3D` Hands
    const spec = shotSpecAt(MANIFEST, frame);
    const sa = spec?.a ?? s.a;
    const trig = spec?.actionTriggerFrame ?? Math.round((s.a + s.b) * 0.55);

    if (shotId === 2 || shotId === 7) {
      this.pov.group.visible = true;
      this.povHandset.visible = false;
      this.pov.update(cam, {
        stance: "seated",
        anchor: MNB_ANCHORS.DUTY_DESK,
        bodyYaw: Math.PI,
        propMode: "leanDesk",
        frame,
      });
    } else if (shotId === 4 || shotId === 6) {
      this.pov.group.visible = true;
      this.povHandset.visible = false;
      this.pov.update(cam, {
        stance: "standing",
        anchor: MNB_ANCHORS.HUY_DESK_SIDE,
        bodyYaw: Math.PI,
        propMode: "idle",
        walkBob: shotId === 6 && frame < sa + 36 ? 0.55 : 0,
        frame,
      });
    } else if (shotId === 5) {
      this.pov.group.visible = true;
      this.povHandset.visible = false;
      this.pov.update(cam, {
        stance: "standing",
        anchor: MNB_ANCHORS.HUY_BOLT_STAND,
        bodyYaw: Math.PI * 0.5,
        propMode: "reachBolt",
        actionProgress: smooth(clamp01((frame - (sa + 20)) / Math.max(24, trig - sa))),
        worldTarget: [2.16, 1.06, -0.92],
        reachHand: "right",
        fingerCurl: 0.78,
        frame,
      });
    } else if (shotId === 8) {
      this.pov.group.visible = true;
      this.povHandset.visible = true;
      this.pov.update(cam, {
        stance: "seated",
        anchor: MNB_ANCHORS.DUTY_DESK,
        bodyYaw: Math.PI,
        propMode: "holdHandset",
        actionProgress: smooth(clamp01((frame - sa) / 28)),
        fingerCurl: 0.82,
        rightArmRaise: 1,
        frame,
      });
    } else {
      // Master (1), OTS (3), and Extreme Close-Ups on floor cord (9) & wall key-board (10): keep sightline 100% clear!
      this.pov.group.visible = false;
      this.povHandset.visible = false;
    }

    this.syncLighting(shotId, frame);
    return focus;
  }

  dispose() {
    this.huy.dispose();
    this.baHanh.dispose();
  }
}

export const createMayNoiBo204World = () => new MayNoiBo204World();
