// Stylised Gothic two-tone lighting for world materials + up to 3 real dynamic local PointLights (lanterns,
// oil lamps, candles, flashlights) + real 3D lightning flash illumination.
// Shared uniforms (TONE, CHAR, DYNAMIC_LIGHTS) are synced every frame via applyLightUniforms / setLocalLights / setLightningFlash.

import * as THREE from "three";
import type { LightPreset, LocalLight, WorldLook } from "./lights";

export const TONE = {
  uLitCol: { value: new THREE.Vector3(0.62, 0.84, 1.24) },
  uShadeCol: { value: new THREE.Vector3(0.08, 0.11, 0.20) },
  uShadeLift: { value: new THREE.Vector3(0.02, 0.03, 0.06) },
  uLambert: { value: 0.42 },
  uSideK: { value: 0.78 },
  uTerm: { value: 0.24 },
  uBounce: { value: new THREE.Vector3() },
  uSat: { value: 0.74 },
};

/** Character-card uniforms synced from LIGHTS every frame for cardshade.ts. */
export const CHAR = {
  uCharTint: { value: new THREE.Vector3(0.76, 0.87, 1.0) },
  uCharShade: { value: 0.74 },
  uGrad: { value: 0.14 },
  uBodyGrad: { value: 0.30 },
  uSideTint: { value: new THREE.Vector3(0.46, 0.58, 0.88) },
  uLightGain: { value: 0.68 },
  uRimCol: { value: new THREE.Vector3(0.46, 0.68, 1.0) },
  uRimK: { value: 0.52 },
};

/** Shared dynamic local point lights (max 3) + real 3D lightning flash uniform (used by BOTH world & character shaders). */
export const DYNAMIC_LIGHTS = {
  uPtPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uPtCol: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  uPtRad: { value: new THREE.Vector3(0, 0, 0) },
  uFlashAmt: { value: 0.0 },
  uFlashCol: { value: new THREE.Vector3(0.82, 0.94, 1.18) },
};

/** Sync all global TONE and CHAR uniforms from a LightPreset (and optional WorldLook). */
export function applyLightUniforms(L: LightPreset, K?: WorldLook) {
  TONE.uLitCol.value.set(...L.lit);
  TONE.uShadeCol.value.set(...L.shade);
  TONE.uShadeLift.value.set(...L.lift);
  TONE.uLambert.value = L.lambert;
  TONE.uSideK.value = L.sideK;
  TONE.uTerm.value = L.term;
  if (K) {
    TONE.uBounce.value.set(...K.bounce);
    TONE.uSat.value = K.sat;
  } else {
    TONE.uBounce.value.set(0, 0, 0);
    TONE.uSat.value = 1;
  }
  CHAR.uCharTint.value.set(...L.charTint);
  CHAR.uCharShade.value = L.charShade;
  CHAR.uGrad.value = L.charGrad;
  CHAR.uBodyGrad.value = L.bodyGrad;
  CHAR.uSideTint.value.set(...L.sideTint);
  CHAR.uLightGain.value = L.charGain;
  CHAR.uRimCol.value.set(...L.rimCol);
  CHAR.uRimK.value = L.rimStrength;
}

/** Update up to 3 real local point lights (lanterns, candles, flashlights) for the current frame. Pass [] to clear. */
export function setLocalLights(lights: LocalLight[]) {
  const pos = DYNAMIC_LIGHTS.uPtPos.value;
  const col = DYNAMIC_LIGHTS.uPtCol.value;
  const rad = DYNAMIC_LIGHTS.uPtRad.value;
  const rArr = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lt = lights[i];
    if (lt && lt.radius > 0.01) {
      pos[i].set(...lt.pos);
      col[i].set(...lt.color);
      rArr[i] = lt.radius;
    } else {
      pos[i].set(0, -999, 0);
      col[i].set(0, 0, 0);
      rArr[i] = 0;
    }
  }
  rad.set(rArr[0], rArr[1], rArr[2]);
}

/** Update real 3D lightning flash illumination (0..1) across both world geometry and character cards. */
export function setLightningFlash(amount: number, color: [number, number, number] = [0.82, 0.94, 1.18]) {
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

const TWO_TONE = /* glsl */ `
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float ndl = max( dot( geometryNormal, sunV ), 0.0 );
  float sunTerm = sunVis * smoothstep( 0.0, uTerm, ndl );
  float skyK = mix( uSideK, 1.0, 0.5 + 0.5 * dot( geometryNormal, upV ) );
  vec3 lit = uLitCol * mix( 1.0, ndl, uLambert );
  float facing = max( dot( geometryNormal, geometryViewDir ), 0.0 );
  vec3 alb = max( mix( vec3( dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), diffuseColor.rgb, uSat ), 0.0 );
  vec3 baseDiff = alb * ( mix( uShadeCol, lit, sunTerm ) * skyK + uBounce * facing * clamp( 1.0 - dot( geometryNormal, upV ), 0.0, 1.0 ) * ( 1.0 - sunTerm ) )
    + uShadeLift * LIFT_K * ( 1.0 - sunTerm );

  // Real local dynamic PointLights (lanterns, candles, oil lamps) with tight Chiaroscuro island-of-light falloff
  vec3 fragV = -vViewPosition;
  vec3 ptSum = vec3( 0.0 );
  float r0 = uPtRad.x;
  if ( r0 > 0.01 ) {
    float d = length( uPtPos[0] - vToneWorldPos );
    float att = pow( clamp( 1.0 - d / r0, 0.0, 1.0 ), 2.25 ) * 1.28;
    vec3 lDir = normalize( ( viewMatrix * vec4( uPtPos[0], 1.0 ) ).xyz - fragV );
    float pndl = 0.22 + 0.78 * smoothstep( -0.15, 0.62, dot( geometryNormal, lDir ) );
    ptSum += uPtCol[0] * att * pndl;
  }
  float r1 = uPtRad.y;
  if ( r1 > 0.01 ) {
    float d = length( uPtPos[1] - vToneWorldPos );
    float att = pow( clamp( 1.0 - d / r1, 0.0, 1.0 ), 2.25 ) * 1.28;
    vec3 lDir = normalize( ( viewMatrix * vec4( uPtPos[1], 1.0 ) ).xyz - fragV );
    float pndl = 0.22 + 0.78 * smoothstep( -0.15, 0.62, dot( geometryNormal, lDir ) );
    ptSum += uPtCol[1] * att * pndl;
  }
  float r2 = uPtRad.z;
  if ( r2 > 0.01 ) {
    float d = length( uPtPos[2] - vToneWorldPos );
    float att = pow( clamp( 1.0 - d / r2, 0.0, 1.0 ), 2.25 ) * 1.28;
    vec3 lDir = normalize( ( viewMatrix * vec4( uPtPos[2], 1.0 ) ).xyz - fragV );
    float pndl = 0.22 + 0.78 * smoothstep( -0.15, 0.62, dot( geometryNormal, lDir ) );
    ptSum += uPtCol[2] * att * pndl;
  }

  // Real 3D lightning flash illuminating scene geometry
  vec3 flashDiff = vec3( 0.0 );
  if ( uFlashAmt > 0.001 ) {
    float fndl = 0.32 + 0.68 * smoothstep( -0.15, 0.65, dot( geometryNormal, normalize( vec3( 0.22, 0.88, 0.42 ) ) ) );
    flashDiff = alb * uFlashCol * uFlashAmt * 1.45 * fndl;
  }

  reflectedLight.directDiffuse = baseDiff + alb * ptSum + flashDiff;
  reflectedLight.indirectDiffuse = vec3( 0.0 );
}
#endif
`;

const DECL =
  "#include <common>\n" +
  "varying vec3 vToneWorldPos;\n" +
  "uniform vec3 uLitCol; uniform vec3 uShadeCol; uniform vec3 uShadeLift; uniform float uLambert; uniform float uSideK; uniform float uTerm; uniform vec3 uBounce; uniform float uSat;\n" +
  "uniform vec3 uPtPos[3]; uniform vec3 uPtCol[3]; uniform vec3 uPtRad; uniform float uFlashAmt; uniform vec3 uFlashCol;";

/** Lambert (or Phong: specular preserved) -> Gothic two-tone with real local PointLights & lightning flash. */
export function twoTone<T extends THREE.MeshLambertMaterial | THREE.MeshPhongMaterial>(m: T, liftK = 1): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, TONE, DYNAMIC_LIGHTS);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vToneWorldPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_WORLD_POS);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL + `\n#define LIFT_K ${liftK.toFixed(3)}`)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + TWO_TONE);
  };
  m.customProgramCacheKey = () => "twoToneV2_" + liftK.toFixed(3);
  return m;
}

// ---------------- tone-map inversion ----------------
const neutral = (c: number[]) => {
  const x = Math.min(c[0], c[1], c[2]), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  const v = c.map((k) => k - off), peak = Math.max(v[0], v[1], v[2]), S = 0.76;
  if (peak < S) return v;
  const d = 1 - S, np = 1 - (d * d) / (peak + d - S), g = 1 - 1 / (0.15 * (peak - np) + 1);
  return v.map((k) => (k * np) / peak * (1 - g) + np * g);
};

/** Linear input that the PBR-Neutral tone map turns into the given on-screen sRGB colour. */
export const untone = (target: THREE.ColorRepresentation, out = new THREE.Color()) => {
  const t = new THREE.Color(target);
  const tt = [t.r, t.g, t.b].map((k) => Math.min(k, 0.985));
  let c = tt.slice();
  for (let i = 0; i < 60; i++) {
    const y = neutral(c);
    c = c.map((k, j) => Math.max(0, k + (tt[j] - y[j])));
  }
  return out.setRGB(c[0], c[1], c[2]);
};
