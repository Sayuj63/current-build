# Rebuild plan — Sayuj Pillai portfolio (v1: homepage)

Structure modelled on emotion-agency.com (see `REFERENCE-emotion-agency.md`), in my own
branding. Every asset, font and library is free/open-source.

## Decisions
- **Palette:** dark + orange. Background `#06070a`, ink `#ece8e1`, accent `#ff4d0a`,
  plus one warm secondary `#ffb38a` for glow.
- **Hero world:** desert monoliths at dusk. The "SP" mark is made of glowing particles.
- **Repo:** the old vanilla site moves to `legacy/`; Next.js lives at the root of `current-build`.
- **Scope:** homepage only for v1.

## Stack (all free / MIT)
| Concern | Pick |
|---|---|
| Framework | Next.js 15 App Router + TypeScript, deployed to Vercel |
| 3D | three + @react-three/fiber + @react-three/drei |
| Post FX | @react-three/postprocessing (bloom, noise, vignette, chromatic aberration) |
| Scroll/motion | Lenis + GSAP ScrollTrigger (GSAP is free incl. plugins since 2025) |
| Styling | Tailwind CSS 4 |
| Fonts | Display: **Instrument Serif** (italic accents) · UI: **Inter Tight** · Mono: **JetBrains Mono** (all Google Fonts / OFL) |

## Free 3D assets
- **Terrain:** procedural. A displaced plane with simplex noise for the dunes, plus a custom
  shader with a height-based colour ramp. No download needed.
- **Monolith rocks:** Quaternius "Ultimate Nature" / Kenney "Nature Kit" (CC0), or
  procedural via a displaced icosahedron. Poly Haven rock textures (CC0).
- **Sky/lighting:** a Poly Haven HDRI (CC0, dusk), e.g. a "kloppenheim"/"belfast sunset"
  style at 1k, plus fog.
- **Water:** drei `MeshReflectorMaterial` strip in front of the camera.
- **Dust/particles:** instanced points, procedural.
- **Particle mark:** sample points from "SP" text geometry (drei `Text3D` + a free font
  JSON) with `MeshSurfaceSampler`, then morph between target shapes in a vertex shader.
  This is the spiritual successor to the old 256-node register.
- All assets go in `public/models` and `public/hdri`, Draco/KTX2-compressed, with
  credits in `CREDITS.md`.

## Homepage sections
0. **Gate**: SP mark + one-liner, "Enter with sound" / "Enter silently". A cursor glow
   orb shows while the scene loads in the background, with a real progress %.
1. **Hero (pinned ~400vh, 4 beats).** Camera glides over the desert while the particle
   mark morphs. One giant headline per beat:
   - *I build* SYSTEMS THAT TURN AMBIGUITY INTO SOMETHING THAT WORKS (mark = SP)
   - COMMERCE *at* PRODUCTION SCALE (mark → grid / storefront lattice)
   - SIGNALS *that* RUN WHILE I SLEEP (mark → flowing network / candlestick wave)
   - *I* SHIP, THEN TEACH OTHERS TO (mark → ring, which flares to white → **wipe to DOM**)
2. **What I do**: a big serif statement revealed word by word, plus a numbered services
   list that highlights while it scrolls past: Shopify Theme Architecture · Headless/
   Storefront · Quant Research Pipelines · Data & Automation · WebGL / Motion ·
   DevOps / Cloud · AI Tooling.
3. **Selected work**: staggered masonry of rounded cards (ISOA, Almost Always, Radiant
   & Keen, TCC, Adore, Calvium, AEQEA, Seba Digital, Apurvi, plus WorldQuant pipeline
   and Fliq). Real screenshots captured with Playwright, mono tags, a pixel-dissolve
   hover shader, and links to the live stores.
4. **Numbers** (instead of awards): an animated ledger with stores shipped, products
   imported, alphas simulated, hackathon club members (500+), years building.
5. **CTA + footer**: giant "LET'S BUILD ↪ SOMETHING THAT WORKS", click-to-copy email,
   GitHub/LinkedIn, local time in Mumbai, and a "keep scrolling" hook for the future /work page.

Persistent chrome: nav (logo · WORK · ABOUT · CONTACT · sound · "Let's talk" pill),
a custom cursor, and a sound toggle (subtle wind + chime, a CC0 Freesound clip).

## Performance and accessibility
- Lazy-load the canvas after first paint. DPR is capped at 1.5. Phones get fewer
  particles (~8k vs 40k) and no reflector.
- `prefers-reduced-motion` → static hero render (pre-baked image) + normal scrolling.
- All content is real HTML underneath (SEO + screen readers). Target LCP < 2.5s.

## Build phases
1. **Scaffold**: move the old site to `legacy/`, set up Next + Tailwind + fonts + Lenis,
   the layout shell, nav and footer.
2. **Hero world**: terrain, rocks, HDRI, fog, water, dust, camera path on scroll.
3. **Particle mark**: SP sampling, 4 morph targets, colour/bloom, flare + wipe.
4. **DOM sections**: what I do, work grid (with Playwright screenshots of the
   stores), numbers, CTA.
5. **Polish**: gate/preloader, cursor, hover shaders, sound, mobile cut,
   reduced-motion.
6. **Verify + ship**: Playwright screenshots at 1440/768/390, Lighthouse, Vercel deploy.

## Needed from Sayuj
- LinkedIn URL + email for the contact links
- Confirm the headline copy above (or rewrite it)
- Any stores that must **not** be linked publicly
