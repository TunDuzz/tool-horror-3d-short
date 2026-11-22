// MadaWorld implementing ShortWorld with strict EraGroup isolation ("wharf" vs "shack"),
// animated dark river water shader, dynamic moored sampan + rope physics, and horror preset lighting.

import * as THREE from "three";
import {
  CastStage,
  FPS,
  LIGHTS,
  LOOK,
  LightKey,
  LightPreset,
  NOINK,
  ShortWorld,
  V,
  applyLightUniforms,
  cloudHD,
  ctex,
  evalCam,
  flickerAt,
  untone,
} from "../engine";
import { ShackEra, WharfEra, buildShackEra, buildWharfEra } from "./build";
import { stageMada } from "./cast";
import { ANCHORS, CAMS, KICKS, MadaShot, SHOTS, evalMadaState } from "./story";

const discTex = () =>
  ctex("sunDiscMada", 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 56, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });

const haloTex = () =>
  ctex("sunHaloMada", 256, 256, (g) => {
    const im = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = Math.hypot(x - 127.5, y - 127.5) / 128;
        const a =
          (0.5 * Math.exp(-((u / 0.28) ** 2)) + 0.3 * Math.exp(-((u / 0.62) ** 2))) *
          (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
        const i = (y * 256 + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
        im.data[i + 3] = Math.round(255 * Math.min(1, a));
      }
    }
    g.putImageData(im, 0, 0);
  });

export class MadaWorld implements ShortWorld {
  root = new THREE.Group();
  private wharf: WharfEra;
  private shack: ShackEra;
  private cast: CastStage;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#1a2b48", 12, 125);
  private moonDisc: THREE.Sprite;
  private moonHalo: THREE.Sprite;
  private cloudMaps: Partial<Record<LightKey, THREE.Texture[]>> = {};
  private clouds: THREE.Mesh[] = [];
  private sunCache = new Map<number, THREE.Vector3>();
  private rightVec = new THREE.Vector3();
  private ropePts = Array.from({ length: 10 }, () => new THREE.Vector3());

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

    this.moonDisc = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: discTex(),
        color: new THREE.Color(2.2, 2.5, 3.2),
        fog: false,
        depthWrite: false,
      }),
    );
    this.moonHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTex(),
        color: new THREE.Color(1, 1, 1),
        fog: false,
        depthWrite: false,
        depthTest: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.moonDisc.renderOrder = -0.5;
    this.moonHalo.renderOrder = 5;
    for (const sp of [this.moonDisc, this.moonHalo]) {
      sp.frustumCulled = false;
      sp.layers.set(NOINK);
      this.root.add(sp);
    }

    this.hemi = new THREE.HemisphereLight("#223456", "#0c1220", 0.32);
    this.sun = new THREE.DirectionalLight("#9bc0ff", 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.root.add(this.hemi, this.sun, this.sun.target);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.35;
      const d = 420 + (i % 3) * 50;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          fog: false,
        }),
      );
      const w = 130 + (i % 3) * 35;
      m.position.set(Math.cos(a) * d, 92 + (i % 3) * 26, Math.sin(a) * d);
      m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m);
      this.root.add(m);
    }

    this.wharf = buildWharfEra();
    this.shack = buildShackEra();
    this.root.add(this.wharf.group, this.shack.group);
    this.cast = new CastStage(this.root);
  }

  private shotSun(id: number, s: MadaShot, L: LightPreset) {
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

  syncLighting(shotId: number) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    applyLightUniforms(LIGHTS[s.light], LOOK[s.light]);
  }

  update(shotId: number, frame: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s = SHOTS.find((x) => x.id === shotId) ?? SHOTS[0];
    const L = LIGHTS[s.light];
    const K = LOOK[s.light];
    const isWharf = s.era === "wharf";

    // Strict EraGroup isolation
    this.wharf.group.visible = isWharf;
    this.shack.group.visible = !isWharf;

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

    const Rr = 16;
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

    const showDisc = isWharf && L.sunDisc !== "#000000" && s.light !== "candle";
    this.moonDisc.visible = this.moonHalo.visible = showDisc;
    if (showDisc) {
      this.moonDisc.position.copy(cam.position).addScaledVector(sunDir, 850);
      this.moonDisc.scale.setScalar(2 * 850 * Math.tan(THREE.MathUtils.degToRad(2.0)));
      this.moonHalo.position.copy(this.moonDisc.position);
      this.moonHalo.scale.setScalar(2 * 850 * Math.tan(THREE.MathUtils.degToRad(14)));
      (this.moonDisc.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.8);
      (this.moonHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(0.55);
    }

    let cmaps = this.cloudMaps[s.light];
    if (isWharf && !cmaps) {
      cmaps = [0, 1].map((k) => cloudHD(k, LOOK[s.light].cloud));
      this.cloudMaps[s.light] = cmaps;
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.visible = isWharf;
      if (isWharf && cmaps) {
        m.lookAt(cam.position.x, m.position.y, cam.position.z);
        const mat = m.material as THREE.MeshBasicMaterial;
        const nextMap = cmaps[i % cmaps.length];
        if (mat.map !== nextMap) {
          mat.map = nextMap;
          mat.needsUpdate = true;
        }
      }
    }

    const st = evalMadaState(shotId, frame);
    const flk = flickerAt(frame, 17, 0.32, 0.42);

    if (isWharf) {
      // Update river water shader uniforms
      const wu = this.wharf.waterMat.uniforms;
      wu.uTime.value = frame / FPS;
      untone(K.water.near, wu.cNear.value);
      untone(K.water.mid, wu.cMid.value);
      untone(K.water.far, wu.cFar.value);
      untone(K.water.crest, wu.cCrest.value);
      untone(K.water.trough, wu.cTrough.value);
      untone(K.water.glint, wu.cGlint.value);
      untone(K.water.near, wu.cShade.value);
      wu.cShade.value.r *= K.water.shade[0];
      wu.cShade.value.g *= K.water.shade[1];
      wu.cShade.value.b *= K.water.shade[2];
      untone(L.fog, wu.cFog.value);
      wu.fogRange.value.set(L.fogNear, L.fogFar);

      // Update moored wooden sampan (skiff) heave, pitch, and roll
      this.wharf.skiff.position.set(ANCHORS.SKIFF[0], ANCHORS.SKIFF[1] + st.skiffY, ANCHORS.SKIFF[2]);
      this.wharf.skiff.rotation.set(st.skiffPitch, -0.18, st.skiffRoll);
      this.wharf.skiff.updateMatrixWorld(true);

      // Update mooring rope connecting pier bollard to sampan bow cleat
      const p0x = ANCHORS.BOLLARD_R[0];
      const p0y = 1.00;
      const p0z = ANCHORS.BOLLARD_R[2];
      const bowWorld = V(0, 0.38, 0.93).applyMatrix4(this.wharf.skiff.matrixWorld);
      const sag = shotId === 5 ? 0.08 * (1 - st.handGrab) : 0.08;
      for (let i = 0; i < this.ropePts.length; i++) {
        const u = i / (this.ropePts.length - 1);
        const drop = 4 * u * (1 - u) * sag;
        this.ropePts[i].set(
          p0x + (bowWorld.x - p0x) * u,
          p0y + (bowWorld.y - p0y) * u - drop,
          p0z + (bowWorld.z - p0z) * u,
        );
      }
      this.wharf.rope.set(this.ropePts);

      // Modulate HDR emissive lantern & distant shack window
      const glowCol =
        s.light === "eerie"
          ? new THREE.Color(0.55, 1.85, 1.35)
          : s.light === "blood"
          ? new THREE.Color(2.2, 0.45, 0.4)
          : new THREE.Color(2.0, 1.25, 0.52);
      this.wharf.lanternMat.color.copy(glowCol).multiplyScalar(1.0 + 0.42 * flk);
      this.wharf.shackWinMat.color.copy(glowCol).multiplyScalar(0.82 + 0.25 * flk);
    } else {
      // Modulate HDR emissive oil lamp & slatted window inside watchman's shack
      const lampCol =
        s.light === "blood"
          ? new THREE.Color(3.2, 1.65, 1.15)
          : new THREE.Color(3.0, 2.0, 0.95);
      const winCol =
        s.light === "blood"
          ? new THREE.Color(2.4, 0.95, 0.95)
          : new THREE.Color(1.4, 1.75, 2.4);
      this.shack.lampMat.color.copy(lampCol).multiplyScalar(1.0 + 0.35 * flk);
      this.shack.windowMat.color.copy(winCol).multiplyScalar(0.95 + 0.20 * flk);
    }

    this.rightVec.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const stage = stageMada(
      shotId,
      frame,
      s.light,
      { pos: cam.position, right: this.rightVec, sun: sunDir },
      sunDir,
    );
    this.cast.apply(stage, cam, L.actorShadow);

    return focus;
  }

  dispose() {
    this.cast.dispose();
  }
}
