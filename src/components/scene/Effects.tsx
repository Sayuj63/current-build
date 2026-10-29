"use client";

import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { JOURNEY_END, motion } from "@/lib/motion";
import { trail } from "./Trail";

/**
 * The portal. Until the visitor enters, this pass paints the whole frame in
 * paper colour, so the scene renders (and warms the GPU) invisibly behind the
 * loader. On enter, a cloud-edged hole opens from the centre: the edge is
 * displaced by fbm noise and carries a white vapour rim, and the scene inside
 * is washed toward white at first, then clears — the same beat as the
 * reference's opening.
 */
const fragment = /* glsl */ `
  uniform float uProgress;
  uniform float uOut;
  uniform vec3 uPaper;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    if (uProgress >= 0.999 && uOut <= 0.0) { outputColor = inputColor; return; }
    vec2 p = uv - 0.5;
    p.x *= aspect;
    float d = length(p);
    float ang = atan(p.y, p.x);
    float n = fbm(vec2(cos(ang), sin(ang)) * 2.2 + d * 3.0 + time * 0.25);
    float maxR = 0.5 * length(vec2(aspect, 1.0)) + 0.35;
    float r = mix(-0.12, maxR, uProgress);
    float edge = d + (n - 0.5) * 0.22;

    float inside = 1.0 - smoothstep(r - 0.05, r + 0.01, edge);
    float rim = exp(-pow((edge - r + 0.02) / 0.045, 2.0)) * (1.0 - smoothstep(0.75, 1.0, uProgress));
    float wash = 1.0 - smoothstep(0.15, 0.75, uProgress);

    vec3 scene = mix(inputColor.rgb, vec3(1.0), wash * 0.75);
    vec3 col = mix(uPaper, scene, inside);
    col = mix(col, vec3(1.0), clamp(rim * 0.95, 0.0, 1.0));

    // Closing portal: the same cloud-edged rim, run the other way — paper
    // opens from the centre (inside the ring) with a white glowing edge and a
    // soft bloom that bleaches the world around it.
    if (uOut > 0.0) {
      float n2 = fbm(vec2(cos(ang), sin(ang)) * 1.5 + d * 1.8 - time * 0.22 + 7.0);
      float r2 = mix(-0.15, maxR + 0.15, uOut);
      float e2 = d + (n2 - 0.5) * 0.17;
      float inside2 = 1.0 - smoothstep(r2 - 0.05, r2 + 0.01, e2);
      float fade = 1.0 - smoothstep(0.82, 1.0, uOut);
      float rim2 = exp(-pow((e2 - r2 - 0.03) / 0.065, 2.0)) * fade;
      float glow = exp(-pow(max(e2 - r2, 0.0) / 0.22, 2.0)) * fade * smoothstep(0.0, 0.15, uOut);
      col = mix(col, vec3(1.0), glow * 0.55 + smoothstep(0.45, 1.0, uOut) * 0.25);
      col = mix(col, uPaper, inside2);
      col = mix(col, vec3(1.0), clamp(rim2 * 1.1, 0.0, 1.0) * (1.0 - inside2 * 0.6));
    }
    outputColor = vec4(col, 1.0);
  }
`;

/**
 * Liquid cursor wake over the whole frame — world and type alike. Pixels are
 * pushed along the trail's velocity, and the red and blue channels are pulled
 * slightly apart in the direction of travel, so fast strokes leave a soft
 * prismatic smear that settles back like disturbed water.
 */
const distortFragment = /* glsl */ `
  uniform sampler2D uTrail;
  uniform float uStrength;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 v = texture2D(uTrail, uv).xy;
    float amt = length(v);
    if (amt < 0.002) { outputColor = inputColor; return; }
    vec2 off = v * 0.011 * uStrength;
    vec2 ca = (v / max(amt, 1e-4)) * min(amt, 1.0) * 0.0035 * uStrength;
    float r = texture2D(inputBuffer, uv - off + ca).r;
    vec4 g = texture2D(inputBuffer, uv - off);
    float b = texture2D(inputBuffer, uv - off - ca).b;
    outputColor = vec4(r, g.g, b, g.a);
  }
`;

class DistortEffectImpl extends Effect {
  constructor() {
    super("DistortEffect", distortFragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ["uTrail", new THREE.Uniform(null)],
        ["uStrength", new THREE.Uniform(1)],
      ]),
    });
  }
}

function Distort() {
  const effect = useMemo(() => new DistortEffectImpl(), []);
  useFrame(() => {
    effect.uniforms.get("uTrail")!.value = trail.texture;
  });
  return <primitive object={effect} dispose={null} />;
}

class RevealEffectImpl extends Effect {
  constructor() {
    super("RevealEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uProgress", new THREE.Uniform(0)],
        ["uOut", new THREE.Uniform(0)],
        ["uPaper", new THREE.Uniform(new THREE.Color("#fff3ea"))],
      ]),
    });
  }
}

const Reveal = forwardRef<RevealEffectImpl>(function Reveal(_, ref) {
  const effect = useMemo(() => new RevealEffectImpl(), []);
  useFrame(() => {
    effect.uniforms.get("uProgress")!.value = motion.reveal;
    // Paper opens across the last step of the journey.
    const o = Math.min(1, Math.max(0, motion.p - (JOURNEY_END - 1)));
    effect.uniforms.get("uOut")!.value = o * o * (3 - 2 * o);
  });
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export function Effects({ lite = false }: { lite?: boolean }) {
  return (
    <EffectComposer multisampling={lite ? 0 : 4} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={0.4} luminanceThreshold={0.92} luminanceSmoothing={0.2} radius={0.7} />
      <Distort />
      <Vignette offset={0.32} darkness={0.42} eskil={false} />
      <Noise opacity={0.035} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
      <Reveal />
    </EffectComposer>
  );
}
