"use client";

import { PerformanceMonitor, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Repo } from "@/content/repos";
import { Distort } from "../scene/Effects";
import { Trail } from "../scene/Trail";
import { generatedCover, infoSheet } from "./covers";

/**
 * The work carousel: projects stand on the rim of a slowly turning drum,
 * the front of which faces the camera. A glowing rail runs along their feet,
 * a mirror floor reflects them and a grid ceiling recedes into the dark.
 *
 * Motion is one number, `rot`. It drifts on its own, wheel and drag throw it
 * with inertia, and once the visitor lets go it settles on the nearest card.
 * The card facing the camera is the focus: bright, clean, with its details
 * sheet. Cards toward the edges dim, pick up scanlines and break into pixels.
 */
export const SLOTS = 32;
export const STEP = (Math.PI * 2) / SLOTS;
// card pitch 2.7 units around the rim
const R = 2.7 / (2 * Math.sin(STEP / 2));
const CARD_W = 2.35;
const CARD_H = 3.05;

export type RingControl = {
  rot: number;
  vel: number;
  target: number | null;
  lastInput: number;
  hovered: number;
  /** Hue (degrees) the room is easing toward; changes on every card hover. */
  hue: number;
};

/** The drum never stops: one card every ~3.4 s, on top of any input. */
const FLOW = -STEP / 3.4;

const vertex = /* glsl */ `
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.y * 3.14159) * uHover * 0.06;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform sampler2D uInfo;
  uniform vec3 uHue;
  uniform float uFocus;
  uniform float uEdge;
  uniform float uHover;
  uniform float uTime;
  uniform float uSeed;
  uniform float uMirror;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 size = vec2(0.77, 1.0);
    vec2 px = vUv * size;
    float rad = 0.055;
    vec2 q = abs(px - size * 0.5) - (size * 0.5 - rad);
    float sd = length(max(q, 0.0)) - rad;
    if (sd > 0.003) discard;

    // Edge cards break into blocks that flicker in steps.
    float g = uEdge * (1.0 - uHover);
    vec2 uv = vUv;
    if (g > 0.05) {
      float bs = mix(0.004, 0.06, g);
      vec2 cell = floor(uv / bs);
      float tick = floor(uTime * 6.0 + uSeed * 10.0);
      float h = hash(cell + tick);
      if (h < g * 0.85) uv = (cell + 0.5) * bs;
      uv.x += (hash(vec2(cell.y, tick)) - 0.5) * 0.04 * g * step(0.7, h);
    }

    // Hover: a slow liquid ripple and a soft channel split.
    uv += vec2(sin(vUv.y * 18.0 + uTime * 2.0), cos(vUv.x * 14.0 - uTime * 1.6)) * 0.006 * uHover;
    float sp = 0.004 * uHover + 0.006 * g;
    vec3 col = vec3(texture2D(uTex, uv + vec2(sp, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(sp, 0.0)).b);

    // Unfocused cards: dimmed, cooled toward the hue, with vertical scanlines.
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    vec3 tinted = mix(vec3(lum), uHue, 0.35) * (0.45 + lum * 0.6);
    float lines = 0.82 + 0.18 * step(0.5, fract(vUv.x * 90.0));
    float focus = max(uFocus, uHover * 0.85);
    col = mix(tinted * lines, col, focus);
    col *= mix(0.55, 1.0, focus);

    // The details sheet on the focused card, over a darkened image.
    float info = texture2D(uInfo, vUv).a * uFocus;
    col = mix(col, col * 0.32, uFocus * 0.62);
    col = mix(col, vec3(1.0), info);

    // Glowing hue rim.
    float rim = smoothstep(-0.03, 0.0, sd);
    float inner = smoothstep(-0.05, 0.0, sd);
    col = mix(col, uHue * 1.6, rim * 0.95);
    col += uHue * inner * (0.25 + 0.5 * focus);

    // Mirrored twin under the floor: darker, fading out with depth.
    float alpha = 1.0;
    if (uMirror > 0.5) {
      col *= 0.38;
      alpha = (1.0 - smoothstep(0.0, 0.55, vUv.y)) * 0.5;
    }
    gl_FragColor = vec4(col, alpha);
  }
`;

function Card({ repo, index, num, angle, ctl, hue, onPick, onHover }: { repo: Repo; index: number; num: number; angle: number; ctl: React.MutableRefObject<RingControl>; hue: THREE.Color; onPick: (i: number) => void; onHover: () => void }) {
  const mesh = useRef<THREE.Group>(null); // the card and its mirrored twin
  const { cover, info } = useMemo(() => {
    const info = infoSheet(repo, num);
    if (!repo.image) return { cover: generatedCover(repo), info };
    const t = new THREE.TextureLoader().load(repo.image);
    t.colorSpace = THREE.SRGBColorSpace;
    return { cover: t, info };
  }, [repo, num]);
  useEffect(() => () => {
    cover.dispose();
    info.dispose();
  }, [cover, info]);

  const { material, mirror } = useMemo(() => {
    const u = {
      uTex: { value: cover },
      uInfo: { value: info },
      uHue: { value: hue },
      uFocus: { value: 0 },
      uEdge: { value: 0 },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: Math.random() },
    };
    const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { ...u, uMirror: { value: 0 } }, side: THREE.FrontSide });
    // shares every uniform object, so the twin animates for free
    const mirror = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { ...u, uMirror: { value: 1 } }, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    return { material, mirror };
  }, [cover, info, hue]);
  const focus = useRef(0);
  const hover = useRef(0);

  useFrame((s, dt) => {
    const m = mesh.current;
    if (!m) return;
    const a = angle + ctl.current.rot;
    // wrap to −π…π so the front is 0
    const w = Math.atan2(Math.sin(a), Math.cos(a));
    const isHover = ctl.current.hovered === index;
    const push = THREE.MathUtils.damp(m.userData.push ?? 0, isHover ? 0.35 : 0, 4, dt);
    m.userData.push = push;
    const r = R + push;
    // Entrance: the carousel is the last thing to arrive — cards rise up
    // from below the floor, the centre first, then outward.
    const delay = 0.15 + Math.abs(w) * 0.35;
    const k = THREE.MathUtils.clamp((s.clock.elapsedTime - delay) / 1.4, 0, 1);
    const rise = 1 - Math.pow(1 - k, 3);
    m.position.set(Math.sin(w) * r, (1 - rise) * -4.2, Math.cos(w) * r);
    m.visible = k > 0;
    m.rotation.y = w;
    focus.current = THREE.MathUtils.damp(focus.current, Math.abs(w) < STEP * 0.5 ? 1 : 0, 3, dt);
    hover.current = THREE.MathUtils.damp(hover.current, isHover ? 1 : 0, isHover ? 2.6 : 1.8, dt);
    const u = material.uniforms;
    u.uFocus.value = focus.current;
    u.uHover.value = hover.current;
    u.uEdge.value = THREE.MathUtils.smoothstep(Math.abs(w), STEP * 2.5, STEP * 6.5);
    u.uTime.value = s.clock.elapsedTime;
  });

  return (
    <group ref={mesh}>
      <mesh
        material={material}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (ctl.current.hovered !== index) onHover();
          ctl.current.hovered = index;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (ctl.current.hovered === index) ctl.current.hovered = -1;
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPick(index);
        }}
      >
        <planeGeometry args={[CARD_W, CARD_H, 1, 12]} />
      </mesh>
      <mesh material={mirror} position={[0, -CARD_H - 0.2, 0]} scale={[1, -1, 1]} raycast={() => null}>
        <planeGeometry args={[CARD_W, CARD_H, 1, 12]} />
      </mesh>
    </group>
  );
}


function Ceiling({ hue }: { hue: THREE.Color }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uHue: { value: hue } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: /* glsl */ `
          uniform vec3 uHue; varying vec2 vUv;
          void main(){
            vec2 g = abs(fract(vUv * vec2(26.0, 26.0)) - 0.5);
            float line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
            float spine = 1.0 - smoothstep(0.0, 0.004, abs(vUv.x - 0.5));
            float fade = smoothstep(0.5, 0.1, distance(vUv, vec2(0.5, 0.62)));
            vec3 c = vec3(0.16) * line + uHue * spine * 1.2;
            gl_FragColor = vec4(c, (line * 0.6 + spine) * fade);
          }`,
      }),
    [hue],
  );
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.5, R - 6]} material={mat}>
      <planeGeometry args={[70, 70]} />
    </mesh>
  );
}

function Scene({ repos, ctl, onPick, onHover }: { repos: Repo[]; ctl: React.MutableRefObject<RingControl>; onPick: (i: number) => void; onHover: () => void }) {
  const { camera, scene } = useThree();
  // One shared colour: every card rim, the rail and the ceiling read it, so
  // a hover recolours the whole room in a single smooth blend.
  const hue = useMemo(() => new THREE.Color().setHSL(ctl.current.hue / 360, 0.9, 0.56, THREE.SRGBColorSpace), [ctl]);
  const bg = useMemo(() => new THREE.Color("#030407"), []);
  const cur = useRef(ctl.current.hue);
  const rail = useRef<THREE.MeshBasicMaterial>(null);
  const flow = useRef(1);
  // Fill every slot, repeating the (filtered) set, so the drum never has gaps.
  const slots = useMemo(() => Array.from({ length: SLOTS }, (_, i) => repos[i % repos.length]), [repos]);

  useEffect(() => {
    scene.background = bg;
  }, [scene, bg]);

  useFrame((s, dtRaw) => {
    // real time, so a slow frame rate never slows the flow (capped for tab switches)
    const dt = Math.min(dtRaw, 0.25);
    const c = ctl.current;

    // colour: ease around the hue wheel the short way
    let d = c.hue - cur.current;
    d = ((d + 540) % 360) - 180;
    cur.current += d * (1 - Math.exp(-dt * 2.2));
    const h = (((cur.current % 360) + 360) % 360) / 360;
    // HSL is authored in sRGB; without the flag three reads it as linear
    hue.setHSL(h, 0.9, 0.56, THREE.SRGBColorSpace);
    bg.setHSL(h, 0.6, 0.045, THREE.SRGBColorSpace);
    rail.current?.color.copy(hue);

    // motion: constant flow, slowed under the cursor; input rides on top
    flow.current = THREE.MathUtils.damp(flow.current, c.hovered >= 0 ? 0.12 : 1, 3, dt);
    if (c.target !== null) {
      c.vel = 0;
      c.rot += (c.target - c.rot) * (1 - Math.exp(-dt * 3.2));
      if (Math.abs(c.target - c.rot) < 1e-3) c.target = null;
    } else {
      c.rot += (FLOW * flow.current + c.vel) * dt;
      c.vel *= Math.exp(-dt * 1.6);
    }

    const t = s.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.15) * 0.3;
    camera.position.y = 0.9 + Math.sin(t * 0.21) * 0.08;
    camera.lookAt(0, -0.25, R - 6);
  });

  return (
    <>
      <fog attach="fog" args={["#030407", 24, 52]} />
      <Ceiling hue={hue} />
      <Stars radius={60} depth={30} count={900} factor={2.2} fade speed={0.4} />
      {slots.map((r, i) => (
        <Card key={`${r.slug}-${i}`} repo={r} index={i} num={i % repos.length} angle={i * STEP} ctl={ctl} hue={hue} onPick={onPick} onHover={onHover} />
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -CARD_H / 2 - 0.08, 0]}>
        <torusGeometry args={[R + 0.15, 0.035, 8, 320]} />
        <meshBasicMaterial ref={rail} color={hue} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CARD_H / 2 - 0.1, R - 2]} renderOrder={2}>
        <circleGeometry args={[30, 64]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </>
  );
}

export function Ring({ repos, ctl, onPick, onHover }: { repos: Repo[]; ctl: React.MutableRefObject<RingControl>; onPick: (i: number) => void; onHover: () => void }) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas dpr={dpr} camera={{ position: [0, 0.9, R + 14], fov: 32 }} gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      <Trail />
      <Scene repos={repos} ctl={ctl} onPick={onPick} onHover={onHover} />
      {/* the same liquid cursor wake as the home page */}
      <EffectComposer multisampling={2} enableNormalPass={false}>
        <Distort />
      </EffectComposer>
    </Canvas>
  );
}
