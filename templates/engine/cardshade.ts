// Gothic Ink-Noir character card shading: scene tint, deep side chiaroscuro, rim lighting,
// AND real dynamic PointLight (lantern / oil lamp) + 3D lightning flash interaction!

import * as THREE from "three";
import { LFB, CHAR, DYNAMIC_LIGHTS } from "./shade";

export const GRAD_K = 5.4;
export const GRAD_KB = 1.95;
export const TINT_K = 0.60;

const VERT_CARD_WP = /* glsl */ `
  vec4 cWp = vec4( transformed, 1.0 );
  vCardWorldPos = ( modelMatrix * cWp ).xyz;
`;

// Gothic proportions in 600 x 1000 card UV (v = 1 top, v = 0 bottom):
// Head sits around v = 0.74..0.93 (center ~0.82), torso around v = 0.42..0.74.
const CARD = /* glsl */ `
vec3 tintK = mix( vec3( 1.0 ), uCharTint, uTintK );
tintK /= pow( max( dot( tintK, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.2 ), uNorm );
vec3 outgoingLight = diffuseColor.rgb * tintK;
#if NUM_DIR_LIGHTS > 0
{
  vec3 sunV = directionalLights[ 0 ].direction;
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  float side = sign( sunV.x ) * smoothstep( 0.0, 0.35, abs( sunV.x ) );
  float head = smoothstep( 0.70, 0.75, vMapUv.y );
  float hw = mix( 0.14, 0.13, head );
  float uu = clamp( ( vMapUv.x - 0.5 ) / hw, -1.0, 1.0 ) * sign( dFdx( vMapUv.x ) + 1e-7 );
  float t = uu * side;
  float g = mix( uBodyGrad * uGradKB, min( uGrad * uGradK, 0.44 ), head );
  float dark = smoothstep( -0.15, 0.9, -t );
  vec3 sideK = mix( vec3( 1.0 ), uSideTint, dark * clamp( g / max( min( uGrad * uGradK, 0.44 ), 1e-3 ), 0.0, 1.5 ) * 0.55 );
  float top = 1.0 + 0.06 * clamp( ( vMapUv.y - 0.82 ) / 0.10, -1.0, 1.0 ) * clamp( dot( sunV, upV ) * 2.0, 0.0, 1.0 ) * head;
  float lift = 1.0 + 0.05 * smoothstep( 0.0, 0.9, t );
  outgoingLight *= mix( uCharShade, 1.0, sunVis ) * ( 1.0 - g * dark ) * sideK * top * lift * uGain * uLightGain;

  // Real local PointLights illuminating the facing side of the character card!
  vec3 fragV = -vViewPosition;
  vec3 ptGlow = vec3( 0.0 );
  float pr0 = uPtRad.x;
  if ( pr0 > 0.01 ) {
    float d = length( uPtPos[0] - vCardWorldPos );
    float att = pow( clamp( 1.0 - d / pr0, 0.0, 1.0 ), 1.55 );
    vec3 toPt = normalize( ( viewMatrix * vec4( uPtPos[0], 1.0 ) ).xyz - fragV );
    float pSide = clamp( 0.56 + 0.48 * uu * sign( toPt.x ) * smoothstep( 0.0, 0.35, abs( toPt.x ) ), 0.16, 1.15 );
    ptGlow += uPtCol[0] * att * pSide;
  }
  float pr1 = uPtRad.y;
  if ( pr1 > 0.01 ) {
    float d = length( uPtPos[1] - vCardWorldPos );
    float att = pow( clamp( 1.0 - d / pr1, 0.0, 1.0 ), 1.55 );
    vec3 toPt = normalize( ( viewMatrix * vec4( uPtPos[1], 1.0 ) ).xyz - fragV );
    float pSide = clamp( 0.56 + 0.48 * uu * sign( toPt.x ) * smoothstep( 0.0, 0.35, abs( toPt.x ) ), 0.16, 1.15 );
    ptGlow += uPtCol[1] * att * pSide;
  }
  float pr2 = uPtRad.z;
  if ( pr2 > 0.01 ) {
    float d = length( uPtPos[2] - vCardWorldPos );
    float att = pow( clamp( 1.0 - d / pr2, 0.0, 1.0 ), 1.55 );
    vec3 toPt = normalize( ( viewMatrix * vec4( uPtPos[2], 1.0 ) ).xyz - fragV );
    float pSide = clamp( 0.56 + 0.48 * uu * sign( toPt.x ) * smoothstep( 0.0, 0.35, abs( toPt.x ) ), 0.16, 1.15 );
    ptGlow += uPtCol[2] * att * pSide;
  }
  outgoingLight += diffuseColor.rgb * ptGlow * 0.72;

  // Real 3D lightning flash
  if ( uFlashAmt > 0.001 ) {
    outgoingLight += diffuseColor.rgb * uFlashCol * uFlashAmt * 0.92;
  }

  #ifdef USE_MAP
  {
    // Crisp Gothic backlit / side rim light along the outer silhouette of head, shoulders, and coat
    float rimAmt = uRimK >= 0.0 ? uRimK : smoothstep( 0.2, 0.4, 1.0 - uCharTint.b );
    float sl = length( sunV.xy );
    vec2 d2 = sunV.xy / max( sl, 1e-4 );
    vec2 duv = 2.2 * uPx * ( d2.x * dFdx( vMapUv ) + d2.y * dFdy( vMapUv ) );
    float edge = step( texture2D( map, vMapUv + duv ).a, 0.5 );
    vec2 dirU = normalize( duv + vec2( 1e-9 ) );
    vec4 c1 = texture2D( map, vMapUv - dirU * vec2( 0.020, 0.014 ) );
    vec4 c2 = texture2D( map, vMapUv - dirU * vec2( 0.045, 0.030 ) );
    float thickBody = step( 0.5, c1.a ) * step( 0.5, c2.a ) * step( 0.16, vMapUv.y );
    float rim = rimAmt * smoothstep( 0.08, 0.38, sl ) * edge * thickBody * mix( 0.65, 1.0, sunVis );
    outgoingLight += uRimCol * rim;
  }
  #endif
}
#endif
`;

const DECL =
  "#include <common>\n" +
  "varying vec3 vCardWorldPos;\n" +
  "uniform vec3 uCharTint; uniform float uCharShade; uniform float uGrad; uniform float uBodyGrad; uniform vec3 uSideTint;" +
  " uniform float uGradK; uniform float uGradKB; uniform float uTintK; uniform float uNorm; uniform float uGain; uniform float uPx;" +
  " uniform float uLightGain; uniform vec3 uRimCol; uniform float uRimK;" +
  " uniform vec3 uPtPos[3]; uniform vec3 uPtCol[3]; uniform vec3 uPtRad; uniform float uFlashAmt; uniform vec3 uFlashCol;";

export const CARD_K = {
  uGradK: { value: GRAD_K },
  uGradKB: { value: GRAD_KB },
  uTintK: { value: TINT_K },
  uNorm: { value: 0.7 },
  uGain: { value: 1.04 },
  uPx: { value: 0.5 },
};

/** MeshLambertMaterial -> Gothic lit character card with scene tint, local PointLights, rim light, and lightning. */
export function cardShade(m: THREE.MeshLambertMaterial) {
  m.emissive.set(0x000000);
  m.emissiveIntensity = 0;
  m.emissiveMap = null;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CHAR, CARD_K, DYNAMIC_LIGHTS);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCardWorldPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n" + VERT_CARD_WP);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", DECL)
      .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
      .replace("vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;", CARD);
  };
  m.customProgramCacheKey = () => "cardV2";
  return m;
}

/** Ground contact blob: multiplies what is already drawn on the ground plane. */
export const blobMaterial = (map: THREE.Texture) =>
  new THREE.MeshBasicMaterial({
    map,
    transparent: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
