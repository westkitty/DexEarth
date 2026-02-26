# Local Development

## Prerequisites

| Tool    | Version | Install                                      |
| ------- | ------- | -------------------------------------------- |
| Node.js | 18+     | <https://nodejs.org> or `brew install node`  |
| npm     | 9+      | bundled with Node                            |
| Git     | any     | bundled with Xcode CLT or `brew install git` |

A modern browser is required — Chrome or Firefox recommended. CesiumJS uses WebGL 2.

## First-time Setup

```bash
git clone https://github.com/westkitty/DexEarth.git
cd DexEarth
npm install
cp .env.example .env
```

Edit `.env` if you have a NASA FIRMS key (optional — only THERMAL_FIRES layer needs it):

```
VITE_FIRMS_MAP_KEY=your_key_here
```

## Running the Dev Server

```bash
npm run dev
```

- Local: `http://localhost:3000`
- Network (LAN / Tailscale): `http://<your-machine-ip>:3000`

The Vite dev server handles all proxy routes. Do not use `npm run preview` for development — it serves the production build which lacks the proxy middleware.

## Common Commands

```bash
npm run dev           # start dev server with HMR
npm run build         # production build → dist/
npm run lint          # ESLint
npm run format        # Prettier (auto-fix)
npm run format:check  # Prettier (check only, used in CI)
npm run test          # Vitest watch mode
npm run test:run      # Vitest single pass (used in CI)
npm run ci            # lint + format:check + test:run + build
```

## Hot Reload Notes

CesiumJS does not survive React Fast Refresh (HMR) cleanly. If the globe goes black after a save:

- Hard-refresh the browser: `Cmd+Shift+R`
- The `viewerRef.current` guard in `App.jsx` prevents double-init, but the WebGL context can still be lost on aggressive HMR cycles

## Adding a New Layer

1. Add an entry to `LAYER_DEFS` in `src/config.js`
2. Add the layer's initial data shape to `buildInitialLayerData()` in `src/App.jsx`
3. Add a `case 'YOUR_LAYER':` block in `activateLayer()`
4. Add the matching `case 'YOUR_LAYER':` block in `deactivateLayer()`
5. If the layer needs a CORS proxy, add it to `vite.config.js`

## Environment Variables

See `.env.example` for all supported variables. All Vite env vars must be prefixed `VITE_` to be accessible in the browser bundle.

## Verify Environment

```bash
bash scripts/verify_env.sh
```

This checks that required variables are set before you start.
