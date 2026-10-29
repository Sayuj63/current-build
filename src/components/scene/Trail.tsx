"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { motion } from "@/lib/motion";

/**
 * Cursor wake. A small, cheap velocity field (ping-pong render targets): the
 * pointer injects its velocity as a soft splat, the field carries itself
 * forward, diffuses and slowly fades. The post pass reads it to bend the
 * whole frame — a smooth liquid wake rather than a glitch.
 */
export const trail = { texture: null as THREE.Texture | null };

const frag = /* glsl */ `
  uniform sampler2D uPrev;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform vec2 uVel;
  uniform float uAspect;
  uniform float uDt;
  uniform float uSplat;
  varying vec2 vUv;
  void main() {
    vec2 px = 1.0 / uRes;
    vec4 c = texture2D(uPrev, vUv);
    vec2 back = vUv - c.xy * uDt * 0.18;
    vec4 a = texture2D(uPrev, back);
    vec4 n = (texture2D(uPrev, back + vec2(px.x, 0.0)) + texture2D(uPrev, back - vec2(px.x, 0.0))
            + texture2D(uPrev, back + vec2(0.0, px.y)) + texture2D(uPrev, back - vec2(0.0, px.y))) * 0.25;
    vec4 v = mix(a, n, 0.45);
    v *= pow(0.955, uDt * 60.0);

    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float s = exp(-dot(d, d) / 0.004) * uSplat;
    v.xy += uVel * s * 0.35;
    float l = length(v.xy);
    if (l > 2.2) v.xy *= 2.2 / l;
    gl_FragColor = vec4(v.xy, 0.0, 1.0);
  }
`;

export function Trail() {
  const { gl, size } = useThree();
  const res = useMemo(() => ({ w: 256, h: Math.max(64, Math.round((256 * size.height) / size.width)) }), [size.width, size.height]);

  const targets = useMemo(() => {
    const make = () =>
      new THREE.WebGLRenderTarget(res.w, res.h, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    return [make(), make()];
  }, [res]);
  useEffect(() => () => targets.forEach((t) => t.dispose()), [targets]);

  const { scene, camera, material } = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: frag,
      uniforms: {
        uPrev: { value: null },
        uRes: { value: new THREE.Vector2() },
        uMouse: { value: new THREE.Vector2(-1, -1) },
        uVel: { value: new THREE.Vector2() },
        uAspect: { value: 1 },
        uDt: { value: 0.016 },
        uSplat: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
  }, []);

  const last = useRef(new THREE.Vector2(-9, -9));
  const idx = useRef(0);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const u = material.uniforms;
    const mx = (motion.pointer.x + 1) / 2;
    const my = (motion.pointer.y + 1) / 2;
    if (last.current.x < -5) last.current.set(mx, my);
    const vx = (mx - last.current.x) / Math.max(dt, 1e-3);
    const vy = (my - last.current.y) / Math.max(dt, 1e-3);
    last.current.set(mx, my);

    const read = targets[idx.current];
    const write = targets[1 - idx.current];
    u.uPrev.value = read.texture;
    u.uRes.value.set(res.w, res.h);
    u.uMouse.value.set(mx, my);
    u.uVel.value.set(vx, vy).clampLength(0, 6);
    u.uAspect.value = size.width / size.height;
    u.uDt.value = dt;
    u.uSplat.value = motion.pointerSeen && motion.reveal > 0.98 ? 1 : 0;

    const prev = gl.getRenderTarget();
    gl.setRenderTarget(write);
    gl.render(scene, camera);
    gl.setRenderTarget(prev);
    idx.current = 1 - idx.current;
    trail.texture = write.texture;
  }, -1);

  return null;
}
