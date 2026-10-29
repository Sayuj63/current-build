# Reference teardown — emotion-agency.com

Captured 2026-10-29 via Playwright, 1440×900, scrolled with the wheel. Frames in the
session scratchpad. We clone the **structure and interaction patterns**, not their
copy, images, 3D assets or paid fonts.

## Stack (detected)
- Nuxt 3 (Vue) + Three.js (`__THREE__`) + GSAP + Lenis smooth scroll
- One full-screen WebGL2 canvas fixed behind the DOM; small 2D canvases for button
  gradients and a sound visualiser
- Fonts: PP Neue Montreal (UI sans, paid), IBM Plex Mono (labels), custom
  "Emotion Serif" (condensed display serif, italics for accent words)
- Palette: lavender bg `#F5EFFF`, violet/magenta accents, deep purple 3D scene

## Homepage, top to bottom
0. **Gate / preloader** — logo on blank lavender, "Enter with audio" pill + "Enter
   without audio" text link. A soft glowing orb follows the cursor.
1. **Hero (3D world, ~4 screens pinned)** — a stylised low-poly landscape: purple
   grass, rocks, a reflective lake, fog, floating dust. Centre object = their "e"
   logo built from thousands of glittery instanced particles. Scroll drives the
   camera through the scene and **morphs the particle logo** (e → blob → heart/tree
   → ring → blown-out white portal).
   Each pinned beat has one big headline:
   - "*Where* AMBITIOUS IDEAS BECOME INTERFACES PEOPLE REMEMBER"
   - "TECHNOLOGY AS EMOTION" (chrome/liquid distortion on the type)
   - "BEAUTY *With* A REASON" + small DESIGN chip + mono caption
   - "*We* ↪ BUILD WITH PEOPLE WHO CARE HOW THINGS FEEL" + OUR PEOPLE chip
   The ring flares white and the page **wipes to flat lavender**: the 3D-to-DOM handoff.
2. **What we do** — big serif paragraph that fades in word by word, "More about us"
   pill, and on the right a numbered services list `(005) Web Applications …` where
   the active row is highlighted as you scroll.
3. **Projects** — scattered/staggered masonry of rounded cards at different sizes and
   offsets. Each card has a mono tag line `UI/UX / FRONTEND / WEBGL` and a serif name.
   Hovering gives pixel/glitch dissolve shaders on the images. "View all projects" pill.
4. **Awards** — a ledger table (platform · award · count `10X`) with a 3D trophy
   that pixel-dissolves in. "AWARDS & RECOGNITION" giant serif.
5. **CTA / footer** — giant "LET'S BUILD ↪ SOMETHING MEANINGFUL", Start project pill,
   location + click-to-copy email, socials list `[01] AWWWARDS`.
6. **Scroll-to-next-page** — below the footer the 3D world peeks back in with
   "(JUST CONTINUE TO REVEAL)" and a circular progress ring; keep scrolling and
   it **routes to /about**, then the about footer routes to /projects.

## Persistent chrome
- Nav: logo · ABOUT WORK CONTACT · ⚙ SETTINGS · sound toggle · "Let's talk" pill
- A floating iridescent orb bottom-right = AI assistant ("HI! I'M YOUR PERSONAL AI
  ASSISTANT…" bubble)
- Pill buttons with an animated gradient canvas inside

## Inner pages
- **/about** — the same 3D world, then "HOW IT ↪ BEGAN" story, founders with portraits,
  approach, FAQ accordion (incl. "What is your tech stack?"), CTA
- **/projects** — dark scene, project cards on a **curved 3D carousel/cylinder** with
  reflections; "SHOWING X — PROJECT n OF 16", filter pill, tick scrubber `01 |||| 16`

## What makes it work (and what our current site lacks)
1. **Readable first.** Every 3D beat carries one huge plain-English headline, so you
   always know what you're looking at. Ours has 8px mono labels.
2. **3D only in the hero, then a hard handoff to clean DOM.** Work, services and
   contact are normal, scannable layouts. Ours is 38 screens of canvas.
3. **Work is the centrepiece**: real thumbnails, names, tags, a dedicated page.
4. **One accent colour + light background** reads premium, not "terminal".
5. Micro-delight everywhere: cursor orb, pill gradients, word-reveal type, glitch hovers,
   scroll-to-next-page.
