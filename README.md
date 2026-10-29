# Sayuj Pillai — portfolio

Next.js 15 + React Three Fiber. Structure modelled on emotion-agency.com, in a
light orange palette. See `docs/` for the reference teardown and plan, and
`CREDITS.md` for every asset (all open-source).

```bash
npm install
npm run dev        # http://localhost:3000
# add ?enter to the URL to skip the gate while developing
```

## How the opening works
1. **Gate** (`components/loader`) — every model, texture, the HDRI, fonts and
   decoded audio download here. The 3D scene is already mounted behind the
   paper, so its shaders compile and textures upload while the visitor waits;
   the counter only reaches 100 after real frames have rendered.
2. **Portal** (`components/scene/Effects.tsx`) — a post-processing pass paints
   paper until "Enter", then opens a cloud-edged hole onto the scene.
3. **Hero** (`components/hero`) — DOM type animates in, then hands over to a
   WebGL copy that ripples and RGB-splits under the cursor.

The old vanilla build is kept in `legacy/` for reference.
