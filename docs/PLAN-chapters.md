# Plan — chapters after the hero

## How the reference actually behaves (measured with Playwright, wheel by wheel)
- **Stepped, not scrubbed.** Small wheel notches do nothing. One deliberate scroll
  triggers one full chapter change that plays to the end by itself (~1.6–2 s), even
  if you stop scrolling. There is never an in-between frame to get stuck in.
- **Exit:** the headline liquefies in the cursor-wake shader (strong ripple and RGB
  split), slides up and dissolves. Meanwhile the particle mark balloons, scatters and
  re-forms into the next shape.
- **Camera:** each chapter flies to a different spot in the world with a slight roll
  (by the dark building, beside a tree, across the pond). The world reads as a place.
- **Entry:** a small pill label appears, then lines rise in staggered. The second line
  starts flush left and slides right while a ↪ arrow fades in behind it.
- **Shapes:** e → cube → big blob → heart → ring. The ring grows until it fills the
  frame, flares white, and the page wipes to a cream DOM layout with normal smooth
  scrolling (What we do → Projects → Awards → CTA → "keep scrolling" to /about).
- Scrolling up from the top of the DOM section re-enters the last chapter in reverse.

## Our chapters (each tells the visitor something about *me*)
| # | Pill | Headline | Sub-line | Mark | Camera |
|---|---|---|---|---|---|
| 0 | — | *I build* SYSTEMS THAT TURN AMBIGUITY INTO THINGS THAT WORK | (current) | **S** | current |
| 1 | APPROACH | *I* BUILD ↪ MORE THAN WEBSITES — I BUILD SYSTEMS | From brief to production: design, engineering, launch and the support after it — one person, the whole pipeline | **cube** (a system / building block) | trucks left, mark moves right |
| 2 | CRAFT | CODE *as* ↪ CRAFT | Pixel-tight interfaces, motion and 3D. The details people feel before they notice them | **gem** (faceted) | low angle beside the rocks |
| 3 | RANGE | ONE MIND ↪ MANY *domains* | Commerce, data, automation, AI. Different material, same habit: find the structure, make it run | **constellation** (nodes and links) | crosses the lake, text right |
| 4 | OUTCOMES | *It* SHIPS ↪ AND STAYS SHIPPED | Live stores, real users, real traffic. I measure work by what is still running | **ring**, which grows and flares white | pulls back to centre |

## After the flare: the cream DOM (smooth Lenis scroll)
1. **What I do.** A big serif statement revealed word by word, a "More about me" pill,
   and a numbered services list that lights up as it passes: Websites & Storefronts ·
   Shopify Theme Architecture · Web Apps & Dashboards · Data & Automation ·
   AI Integrations · 3D & Motion · Performance & SEO.
2. **Selected work.** Staggered cards with real screenshots of the live stores, mono
   tags (UI · FRONTEND · SHOPIFY), a hover dissolve, and "View all work".
3. **How I work.** 01 Discover → 02 Design → 03 Build → 04 Launch → 05 Support, as a
   horizontal pinned strip.
4. **Proof.** An animated ledger of stores shipped, products imported, years building
   and live sites, in place of awards.
5. **CTA + footer.** *Let's build* ↪ SOMETHING THAT WORKS, click-to-copy email,
   socials, local time, and "keep scrolling" leading into /about.

## Engine
- `ChapterDirector`: wheel, touch and keyboard intent accumulates past a threshold,
  then `goTo(i ± 1)`. Input is locked until the transition timeline finishes, so a
  trackpad flick never skips two chapters. Arrow keys and nav links jump directly.
- A single GSAP master timeline per transition, all on the GPU:
  camera keyframe tween (position + look + roll) · mark morph `from → to` with a mid
  "balloon & scatter" · text-exit uniform (wake strength + RGB split + slide/blur) ·
  next text-enter (pill, lines staggered, arrow slide).
- Mark shapes are point sets sampled from three.js geometries (box, icosahedron,
  generated graph, torus) plus the existing S glyph. Two attribute buffers are
  swapped and a `uMorph` uniform moves between them.
- A soft swell at each chapter change, with a brighter one on the white flare.
- Reduced-motion and mobile: chapters become stacked fades, with fewer particles.
