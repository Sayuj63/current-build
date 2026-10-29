import * as THREE from "three";

/**
 * One WebGL layer that draws every project image, glued to its DOM card.
 *
 * Effects are pure functions of where a card sits on screen, so they scrub
 * with the scroll and can rest at any point:
 *   exit    as a card climbs past the top, its top edge stretches upward and
 *           the image breaks into blocks — pixelated, row-shifted, RGB-split —
 *           that dissolve away
 *   enter   while a card is still rising in from the bottom, its lower part
 *           is glitched the same way and settles as it comes into view
 *   flow    the plane bends with scroll velocity
 *   hover   a liquid ripple + RGB split around the cursor and a slow darken,
 *           eased in and out over ~1.2 s
 */
const vertex = /* glsl */ `
  uniform float uVel;
  uniform float uExit;
  uniform float uHover;
  uniform float uTime;
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // flow: bow with scroll velocity (px → local units)
    p.y += sin(uv.x * 3.14159) * clamp(uVel, -70.0, 70.0) * 0.55 / uSize.y;
    // exit: the top edge is pulled up
    p.y += uv.y * uv.y * min(uExit * 2.0, 1.0) * 0.12;
    // hover: the edges breathe a little
    p.x += sin(uv.y * 7.0 + uTime * 1.6) * 0.006 * uHover;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uImg;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uExit;
  uniform float uEnter;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec2 cover(vec2 uv) {
    float ra = uSize.x / uSize.y;
    float ia = uImg.x / uImg.y;
    vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
    // anchor to the top of the screenshot: that's where the brand lives
    return vec2((uv.x - 0.5) * s.x + 0.5, 1.0 - (1.0 - uv.y) * s.y);
  }

  void main() {
    vec2 px = vUv * uSize;
    // rounded corners
    vec2 q = abs(px - uSize * 0.5) - (uSize * 0.5 - uRadius);
    float sd = length(max(q, 0.0)) - uRadius;
    float mask = 1.0 - smoothstep(-1.0, 1.0, sd);
    if (mask <= 0.0) discard;

    // Glitch lives only in a band at the screen edge the card is crossing:
    // the strip just below the top of the viewport on exit, just above the
    // bottom on entry. uExit / uEnter = fraction of the card past that edge.
    float topEdge = 1.0 - uExit;   // uv.y of the viewport top on this card
    float ax = smoothstep(topEdge - 0.2, topEdge, vUv.y) * clamp(uExit * 5.0, 0.0, 1.0);
    float botEdge = uEnter;        // uv.y of the viewport bottom on this card
    float ae = (1.0 - smoothstep(botEdge, botEdge + 0.16, vUv.y)) * clamp(uEnter * 5.0, 0.0, 1.0);
    float amt = max(ax, ae);

    vec2 uv = vUv;
    float split = 0.0;
    if (amt > 0.02) {
      float bs = floor(mix(2.0, 18.0, amt) / 2.0) * 2.0;
      vec2 cell = floor(px / bs);
      vec2 qv = (cell + 0.5) * bs / uSize;
      float rowH = hash(vec2(cell.y, 3.0));
      uv = mix(uv, qv, smoothstep(0.1, 0.5, amt));
      uv.x += (rowH - 0.5) * 0.06 * amt * step(0.6, rowH);
      split = 0.012 * amt;
      if (hash(cell + 7.1) < (amt - 0.75) * 2.5) discard;
    }

    // hover: a liquid ripple around the cursor
    vec2 asp = vec2(uSize.x / uSize.y, 1.0);
    float d = distance(vUv * asp, uMouse * asp);
    float w = smoothstep(0.55, 0.0, d) * uHover;
    uv += vec2(sin(vUv.y * 22.0 + uTime * 2.2), cos(vUv.x * 18.0 - uTime * 1.8)) * 0.011 * w;
    split += 0.009 * w;

    vec2 c = cover(uv);
    float r = texture2D(uTex, cover(uv + vec2(split, 0.0))).r;
    vec4 g = texture2D(uTex, c);
    float b = texture2D(uTex, cover(uv - vec2(split, 0.0))).b;
    vec3 col = vec3(r, g.g, b);
    col *= 1.0 - 0.38 * uHover;
    gl_FragColor = vec4(col, mask);
  }
`;

type Card = {
  el: HTMLElement;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  hover: number;
  hoverTarget: number;
  mouse: THREE.Vector2;
};

export class CardsGL {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private cards: Card[] = [];
  private geo = new THREE.PlaneGeometry(1, 1, 24, 24);
  private loader = new THREE.TextureLoader();
  private w = 0;
  private h = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.resize();
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.left = -this.w / 2;
    this.camera.right = this.w / 2;
    this.camera.top = this.h / 2;
    this.camera.bottom = -this.h / 2;
    this.camera.updateProjectionMatrix();
  }

  add(el: HTMLElement, src: string, onReady: () => void) {
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      uniforms: {
        uTex: { value: null },
        uImg: { value: new THREE.Vector2(1, 1) },
        uSize: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 26 },
        uExit: { value: 0 },
        uEnter: { value: 0 },
        uHover: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uVel: { value: 0 },
      },
    });
    const mesh = new THREE.Mesh(this.geo, material);
    mesh.visible = false;
    this.scene.add(mesh);
    const card: Card = { el, mesh, hover: 0, hoverTarget: 0, mouse: new THREE.Vector2(0.5, 0.5) };
    this.cards.push(card);
    this.loader.load(src, (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      material.uniforms.uTex.value = tex;
      material.uniforms.uImg.value.set(tex.image.width, tex.image.height);
      onReady();
    });
    return {
      hover: (on: boolean) => (card.hoverTarget = on ? 1 : 0),
      pointer: (u: number, v: number) => card.mouse.set(u, v),
    };
  }

  frame(time: number, dt: number, velocity: number) {
    const vh = this.h;
    let any = false;
    for (const c of this.cards) {
      const u = c.mesh.material.uniforms;
      if (!u.uTex.value) continue;
      const r = c.el.getBoundingClientRect();
      const on = r.bottom > -r.height * 0.6 && r.top < vh + 40;
      c.mesh.visible = on;
      if (!on) continue;
      any = true;
      // Slow, settling hover — never snaps.
      c.hover = THREE.MathUtils.damp(c.hover, c.hoverTarget, c.hoverTarget > c.hover ? 3.2 : 2.4, dt);
      c.mesh.position.set(r.left + r.width / 2 - this.w / 2, vh / 2 - r.top - r.height / 2, 0);
      c.mesh.scale.set(r.width, r.height, 1);
      u.uSize.value.set(r.width, r.height);
      u.uRadius.value = Math.min(r.width, r.height) * 0.07;
      u.uExit.value = THREE.MathUtils.clamp(-r.top / r.height, 0, 1);
      u.uEnter.value = THREE.MathUtils.clamp((r.bottom - vh) / r.height, 0, 1);
      u.uHover.value = c.hover;
      u.uMouse.value.lerp(c.mouse, 1 - Math.exp(-dt * 10));
      u.uTime.value = time;
      u.uVel.value = velocity;
    }
    if (any || this.drewLast) this.renderer.render(this.scene, this.camera);
    this.drewLast = any;
  }

  private drewLast = true;

  dispose() {
    for (const c of this.cards) {
      c.mesh.material.uniforms.uTex.value?.dispose();
      c.mesh.material.dispose();
    }
    this.geo.dispose();
    this.renderer.dispose();
  }
}
