// Horror Engine v3: Soft stylized cel/Lambert lighting for 3D worlds & 3D dark-horror characters.
// Supports up to 6 real dynamic local PointLights (oil lamps, candles, phone screen, streetlamps),
// 1 real directional SpotLight cone (flashlight / doorway beam), real Three.js soft shadow maps,
// subtle 3D rim light, and real 3D lightning flash illumination.

import * as THREE from "three";
import type { LightPreset, LocalLight, SpotLightCfg, WorldLook } from "./lights";

export const MAX_LOCAL_LIGHTS = 6;

export const TONE = {
  uLitCol: { value: new THREE.Vector3(0.68, 0.50, 0.36) },
  uShadeCol: { value: new THREE.Vector3(0.068, 0.052, 0.072) },
  uShadeLift: { value: new THREE.Vector3(0.018, 0.014, 0.022) },
  uLambert: { value: 0.65 },
  uSideK: { value: 0.78 },
  uWrapLo: { value: -0.18 },
  uWrapHi: { value: 0.72 },
  uRimCol: { value: new THREE.Vector3(0.95, 0.64, 0.34) },
  uRimStrength: { value: 0.34 },
  uBounce: { value: new THREE.Vector3(0.038, 0.022, 0.014) },
  uSat: { value: 0.88 },
};

/** Shared dynamic lights (6 local PointLights + 1 SpotLight cone + 3D lightning flash). */
export const DYNAMIC_LIGHTS = {
  uPtPos: { value: Array.from({ length: MAX_LOCAL_LIGHTS }, () => new THREE.Vector3(0, -999, 0)) },
  uPtCol: { value: Array.from({ length: MAX_LOCAL_LIGHTS }, () => new THREE.Vector3(0, 0, 0)) },
  uPtRad: { value: new Float32Array(MAX_LOCAL_LIGHTS) },
  uSpPos: { value: new THREE.Vector3(0, -999, 0) },
  uSpDir: { value: new THREE.Vector3(0, 0, -1) },
  uSpCol: { value: new THREE.Vector3(0, 0, 0) },
  uSpDist: { value: 0.0 },
  uSpCosIn: { value: 0.96 },
  uSpCosOut: { value: 0.88 },
  uFlashAmt: { value: 0.0 },
  uFlashCol: { value: new THREE.Vector3(0.84, 0.94, 1.18) },
};

/** Sync global TONE uniforms from a LightPreset (and optional WorldLook). */
export function applyLightUniforms(L: LightPreset, K?: WorldLook): void {
  TONE.uLitCol.value.set(...L.lit);
  TONE.uShadeCol.value.set(...L.shade);
  TONE.uShadeLift.value.set(...L.lift);
  TONE.uLambert.value = L.lambert;
  TONE.uSideK.value = L.sideK;
  TONE.uWrapLo.value = L.wrapLo;
  TONE.uWrapHi.value = L.wrapHi;
  TONE.uRimCol.value.set(...L.rimCol);
  TONE.uRimStrength.value = L.rimStrength;
  if (K) {
    TONE.uBounce.value.set(...K.bounce);
    TONE.uSat.value = K.sat;
  } else {
    TONE.uBounce.value.set(0, 0, 0);
    TONE.uSat.value = 1;
  }
}

/** Update up to 6 real local PointLights for the current frame. Pass [] to clear. */
export function setLocalLights(lights: LocalLight[]): void {
  const pos = DYNAMIC_LIGHTS.uPtPos.value;
  const col = DYNAMIC_LIGHTS.uPtCol.value;
  const rad = DYNAMIC_LIGHTS.uPtRad.value;
  for (let i = 0; i < MAX_LOCAL_LIGHTS; i++) {
    const lt = lights[i];
    if (lt && lt.radius > 0.01) {
      pos[i].set(...lt.pos);
      col[i].set(...lt.color);
      rad[i] = lt.radius;
    } else {
      pos[i].set(0, -999, 0);
      col[i].set(0, 0, 0);
      rad[i] = 0;
    }
  }
}

/** Update the active 3D SpotLight cone (e.g. handheld flashlight or moonlight doorway beam). Pass null to disable. */
export function setSpotLight(spot: SpotLightCfg | null): void {
  if (!spot || spot.distance <= 0.01) {
    DYNAMIC_LIGHTS.uSpDist.value = 0;
    DYNAMIC_LIGHTS.uSpCol.value.set(0, 0, 0);
    return;
  }
  DYNAMIC_LIGHTS.uSpPos.value.set(...spot.pos);
  DYNAMIC_LIGHTS.uSpDir.value
    .set(spot.target[0] - spot.pos[0], spot.target[1] - spot.pos[1], spot.target[2] - spot.pos[2])
    .normalize();
  DYNAMIC_LIGHTS.uSpCol.value.set(...spot.color);
  DYNAMIC_LIGHTS.uSpDist.value = spot.distance;
  const outRad = (Math.max(1, Math.min(85, spot.angleDeg)) * Math.PI) / 180;
  const pen = Math.max(0.02, Math.min(0.95, spot.penumbra));
  const inRad = outRad * (1 - pen);
  DYNAMIC_LIGHTS.uSpCosIn.value = Math.cos(inRad);
  DYNAMIC_LIGHTS.uSpCosOut.value = Math.cos(outRad);
}

/** Update real 3D lightning flash illumination (0..1). */
export function setLightningFlash(amount: number, color: [number, number, number] = [0.84, 0.94, 1.18]): void {
  DYNAMIC_LIGHTS.uFlashAmt.value = Math.max(0, amount);
  DYNAMIC_LIGHTS.uFlashCol.value.set(...color);
}

// Capture Three.js directional light 0 shadow visibility inside Three's own unrolled light loop.
export const LFB = THREE.ShaderChunk.lights_fragment_begin
  .replace(
    "directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]",
    "sunVis = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]",
  )
  .replace(
    "vDirectionalShadowCoord[ i ] ) : 1.0;",
    "vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= sunVis;",
  );
if (!LFB.includes("directLight.color *= sunVis")) throw new Error("shade.ts: three lights_fragment_begin changed");

const VERT_WORLD_POS = /* glsl */ `
  vec4 tWp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    tWp = instanceMatrix * tWp;
  #endif
  vToneWorldPos = ( modelMatrix * tWp ).xyz;
`;

const STYLIZED_SHADE = /* glsl */ `
{
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float facing = max( dot( geometryNormal, geometryViewDir ), 0.0 );
  vec3 alb = max( mix( vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), diffuseColor.rgb, uSat ), 0.0 );
  float skyK = mix( uSideK, 1.0, 0.5 + 0.5 * dot( geometryNormal, upV ) );

  float sunTerm = 0.0;
  vec3 lit = uLitCol;
  #if NUM_DIR_LIGHTS > 0
    vec3 sunV = directionalLights[ 0 ].direction;
    float ndl = dot( geometryNormal, sunV );
    sunTerm = sunVis * smoothstep( uWrapLo, uWrapHi, ndl );
    lit = uLitCol * mix( 1.0, max( ndl, 0.0 ), uLambert );
  #endif

  vec3 baseDiff = alb * ( mix( uShadeCol, lit, sunTerm ) * skyK + uBounce * facing * clamp( 1.0 - dot( geometryNormal, upV ), 0.0, 1.0 ) * ( 1.0 - sunTerm ) )
    + uShadeLift * LIFT_K * ( 1.0 - sunTerm );

  // Subtle 3D stylized rim highlight separating dark silhouettes from shadowed backgrounds
  float fres = pow( clamp( 1.0 - facing, 0.0, 1.0 ), 2.6 );
  vec3 rimDiff = alb * uRimCol * uRimStrength * fres * ( 0.30 + 0.70 * sunTerm );

  // 6 real local dynamic PointLights (oil lamps, candles, phone screen glow, streetlamps)
  vec3 fragV = -vViewPosition;
  vec3 ptSum = vec3( 0.0 );
  for ( int i = 0; i < 6; i++ ) {
    float r = uPtRad[ i ];
    if ( r > 0.01 ) {
      float d = length( uPtPos[ i ] - vToneWorldPos );
      float att = pow( clamp( 1.0 - d / r, 0.0, 1.0 ), 1.85 ) * 1.32;
      vec3 lDir = normalize( ( viewMatrix * vec4( uPtPos[ i ], 1.0 ) ).xyz - fragV );
      float pndl = 0.24 + 0.76 * smoothstep( -0.22, 0.68, dot( geometryNormal, lDir ) );
      ptSum += uPtCol[ i ] * att * pndl;
    }
  }

  // 1 real dynamic SpotLight cone (handheld flashlight / narrow doorway light shaft)
  if ( uSpDist > 0.01 ) {
    vec3 toFragW = vToneWorldPos - uSpPos;
    float sd = length( toFragW );
    if ( sd < uSpDist && sd > 0.001 ) {
      float satt = pow( clamp( 1.0 - sd / uSpDist, 0.0, 1.0 ), 1.55 ) * 1.65;
      float cone = smoothstep( uSpCosOut, uSpCosIn, dot( toFragW / sd, uSpDir ) );
      vec3 lDir = normalize( ( viewMatrix * vec4( uSpPos, 1.0 ) ).xyz - fragV );
      float sndl = 0.18 + 0.82 * smoothstep( -0.15, 0.58, dot( geometryNormal, lDir ) );
      ptSum += uSpCol * satt * cone * sndl;
    }
  }

  // Real 3D lightning flash
  vec3 flashDiff = vec3( 0.0 );
  if ( uFlashAmt > 0.001 ) {
    float fndl = 0.32 + 0.68 * smoothstep( -0.15, 0.65, dot( geometryNormal, normalize( vec3( 0.22, 0.88, 0.42 ) ) ) );
    flashDiff = alb * uFlashCol * uFlashAmt * 1.45 * fndl;
  }

  reflectedLight.directDiffuse = baseDiff + rimDiff + alb * ptSum + flashDiff;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
}
`;

const DECL =
  "#include <common>\n" +
  "varying vec3 vToneWorldPos;\n" +
  "uniform vec3 uLitCol; uniform vec3 uShadeCol; uniform vec3 uShadeLift; uniform float uLambert; uniform float uSideK;\n" +
  "uniform float uWrapLo; uniform float uWrapHi; uniform vec3 uRimCol; uniform float uRimStrength; uniform vec3 uBounce; uniform float uSat;\n" +
  "uniform vec3 uPtPos[6]; uniform vec3 uPtCol[6]; uniform float uPtRad[6];\n" +
  "uniform vec3 uSpPos; uniform vec3 uSpDir; uniform vec3 uSpCol; uniform float uSpDist; uniform float uSpCosIn; uniform float uSpCosOut;\n" +
  "uniform float uFlashAmt; uniform vec3 uFlashCol;";

/** Upgrade Lambert / Phong material to Horror Engine v3 soft stylized shading with 6 PointLights + 1 SpotLight. */
export function stylizedShade<T extends THREE.MeshLambertMaterial | THREE.MeshPhongMaterial>(m: T, liftK = 1): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TONE, DYNAMIC_LIGHTS);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vToneWorldPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_WORLD_POS);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL + `\n#define LIFT_K ${liftK.toFixed(3)}`)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + STYLIZED_SHADE);
  };
  m.customProgramCacheKey = () => "stylizedShadeV3_" + liftK.toFixed(3);
  return m;
}

/** Alias kept strictly for internal convenience. */
export const twoTone = stylizedShade;

// ---------------- tone-map inversion ----------------
const neutral = (c: number[]) => {
  const x = Math.min(c[0], c[1], c[2]), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const v = c.map((k) => k - off), peak = Math.max(v[0], v[1], v[2]), S = 0.76;
  if (peak < S) return v;
  const d = 1 - S, np = 1 - (d * d) / (peak + d - S), g = 1 - 1 / (0.15 * (peak - np) + 1);
  return v.map((k) => (k * np) / peak * (1 - g) + np * g);
};

/** Linear input that PBR-Neutral tone mapping turns into the given on-screen sRGB colour. */
export const untone = (target: THREE.ColorRepresentation, out = new THREE.Color()): THREE.Color => {
  const t = new THREE.Color(target);
  const tt = [t.r, t.g, t.b].map((k) => Math.min(k, 0.985));
  let c = tt.slice();
  for (let i = 0; i < 60; i++) {
    const y = neutral(c);
    c = c.map((k, j) => Math.max(0, k + (tt[j] - y[j])));
  }
  return out.setRGB(c[0], c[1], c[2]);
};
