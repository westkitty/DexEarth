# Visuals + Overlays — Architecture Guide

## Overview

Phase III adds two systems on top of DexEarth's existing Phase I/II layers:

1. **Country Overlay** — Toggleable country borders, inside labels, and border-following labels.
2. **Render Style Presets** — Five global rendering modes applied via Cesium PostProcessStages and globe settings.

All data is bundled. No API keys. No paid services. Fully offline-capable.

---

## Country Data

| File | Detail | Size | Use |
|------|--------|------|-----|
| `public/data/borders/ne_110m_admin_0_countries.geojson` | 110m (coarse) | ~839 KB | Zoom > 3 000 km |
| `public/data/borders/ne_50m_admin_0_countries.geojson` | 50m (medium) | ~3.1 MB | Zoom < 3 000 km |
| `public/data/borders/country_index.json` | Pre-computed | ~40 KB | Search + fly-to |

Source: [Natural Earth](https://www.naturalearthdata.com/) — public domain.

### Regenerating the index

```bash
node scripts/generate_country_index.js
```

This is a one-time offline build step. The generated `country_index.json` is committed to the repo so end users never need to run it.

---

## Overlay Module Architecture

```
src/overlays/countries/
  loadGeojson.js        # GeoJSON loader (in-memory cache, altitude-based LOD)
  repPoint.js           # Centroid + fallback interior point computation
  buildBorders.js       # PolylineCollection builder + highlightBorder()
  buildLabels.js        # LabelCollection with screen-space collision avoidance
  followBorderLabels.js # BillboardCollection — canvas text rotated to border tangent
  index.js              # Public API: activate/deactivate/tick/select/flyTo
```

### Level-of-detail switching

`loadGeojson.js > detailByAltitude(altMeters)`:
- `> 3 000 000 m` → 110m dataset (coarse)
- `≤ 3 000 000 m` → 50m dataset (medium)

The GeoJSON is swapped on `camera.moveEnd` with a 300ms debounce.

### Representative Point Computation (`repPoint.js`)

For each country:
1. Centroid of the largest exterior ring (shoelace formula)
2. If centroid is outside the ring → bbox center
3. If bbox center is also outside → 5×5 grid search inside the bbox
4. Final fallback: bbox center regardless

This handles concave countries (e.g., France with overseas territories, USA, Russia, etc.).

### Screen-Space Collision Avoidance (`buildLabels.js`)

Labels are projected to window coordinates via `Cesium.SceneTransforms.wgs84ToWindowCoordinates`.
Each label gets an estimated bounding rect based on character count × font size.
A simple axis-aligned overlap test (`rectsOverlap`) skips any label whose rect overlaps an already-placed label.

Runs on `camera.moveEnd`, not every frame. A 300ms debounce prevents rebuild spam.

### Border-Following Labels (`followBorderLabels.js`, Mode 1)

For each country:
1. Find the longest straight segment in the largest exterior ring
2. Compute bearing of that segment (returns `[0, 2π)`)
3. If the bearing would render text upside-down (pointing into left half-circle), rotate by `π`
4. Draw text onto an off-screen `<canvas>` (white fill + black stroke)
5. Use the canvas data URL as a Cesium `Billboard.image`
6. Set `Billboard.rotation = -bearing` (Cesium rotates CCW, so negate)

Canvas textures are cached by `(text|fontSize|color|outline)` key to avoid redundant redraws.

> **Mode 2** (glyph sprites along the full line) scaffolding is in the codebase but disabled — only enabled under a future "High Detail" toggle at close zoom.

---

## Style Preset Architecture

```
src/visuals/
  styleManager.js         # State, FPS monitor, apply/remove cycle
  presets/
    realistic.js          # Lighting + atmosphere + FXAA
    celShaded.js          # GLSL: edge-detect + posterize PostProcessStage
    hologram.js           # GLSL: scanlines + cyan grade + animated jitter + lat/lon grid
    wireframe.js          # Dark base + lat/lon PolylineCollection (cheap — no PostFX)
    nightOps.js           # GLSL: vignette + green desaturate, low atmosphere
```

### Preset lifecycle

```
applyPreset(id)
  → deactivate previous preset (remove stages, restore globe defaults)
  → remove any active PostProcessStages and grid primitives
  → if safe mode AND preset is not isCheap → call preset.activateLite()
  → else → call preset.activate(), collect returned stages + gridPrimitive
  → apply overlay style (border/label colors) for this preset
  → notify UI subscribers
```

### Safe Mode

A `requestAnimationFrame` loop averages FPS over 60 frames. If the rolling average drops below 25 FPS:
- All registered `PostProcessStage` objects are removed
- `activateLite()` is called on the current preset (minimal visual fallback)
- Label density is reduced (halved internally by LOD thresholds)
- Border-follow label mode drops to a lower cap automatically
- A HUD indicator flashes "⚠ SAFE MODE"

Manual override: user can press the "Safe Mode" button in the Styles panel to force-exit.

---

## UI Location

`VisualsRoot` is mounted at the bottom of `PhaseIIRoot` as a separate section labeled **"PHASE III // VISUALS + OVERLAYS"**. It has two collapsible sub-sections:
- 🌐 **Overlays** → `OverlaysPanel` (borders/labels/follow toggles, density sliders, search)
- 🎨 **Render Style** → `StylesPanel` (preset buttons, per-preset sliders, FPS readout)

---

## Known Limitations

- **Antimeridian wrap**: Bboxes for countries crossing ±180° (Russia, Fiji, etc.) will be oversized. Labels still display at the polygon centroid which is computed correctly; only the fly-to bbox flyTo will be inaccurate.
- **Mode 2 border-following text** (glyph sprites per letter) is not yet enabled. The canvas-rotation approach (Mode 1) is the default and works well at all zoom levels.
- **Terrain**: Country borders are offset 80–200m above the ellipsoid. On terrain-enabled viewers, borders may not visually track terrain contours.
- **PostProcessStage GLSL**: Targeting GLSL 300 ES (WebGL 2). The cel-shade and hologram stages will silently fail on WebGL 1 contexts (some older devices) and fall back to the `activateLite` behavior.
- **GeoJSON memory**: The 50m dataset (~3.1MB raw) is parsed once and held in memory. On devices with < 4GB RAM this may cause mild GC pressure when first loaded.

---

## Performance Notes

- Borders (`PolylineCollection`): ~177 polylines. Negligible GPU cost.
- Labels (`LabelCollection`): capped at 200 by default; screen-space collision removes ~40% at high zoom. Rebuilt on camera move end only.
- Follow labels (`BillboardCollection`): capped at 80 by default. Canvas textures cached in memory.
- PostProcessStages (cel-shade, hologram, nightOps): single full-screen pass each. On low-end hardware, safe mode removes these automatically.
- Wireframe preset: no PostProcessStage — fastest of all presets.
