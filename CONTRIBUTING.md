# Contributing

Bug reports and pull requests are welcome.

## Dev Environment Setup

```bash
git clone https://github.com/westkitty/DexEarth.git
cd DexEarth
npm install
cp .env.example .env   # set VITE_FIRMS_MAP_KEY if you want the fires layer
npm run dev            # http://localhost:3000
```

Node.js 18+ required. No other system dependencies.

## Branch Naming

```
feat/short-description
fix/short-description
chore/short-description
docs/short-description
```

## Commit Messages

Plain English, present tense, one line for small changes:

```
feat: add ship traffic density heatmap
fix: prevent double Cesium init on HMR reload
chore: bump cesium to 1.139
```

## Running Checks Locally

```bash
npm run lint          # ESLint
npm run format:check  # Prettier dry-run
npm run test:run      # Vitest (single pass)
npm run build         # Vite production build
npm run ci            # all of the above in sequence
```

Fix formatting automatically:

```bash
npm run format
```

## PR Checklist

- [ ] `npm run ci` passes locally
- [ ] New layer or data source documented in README
- [ ] No API keys, `.env` files, or secrets committed
- [ ] Screenshot attached if the change is visual

## Notes

This project is provided as-is with no guarantee that PRs will be reviewed or merged quickly. Fork freely if you need your own direction. Be ungovernable but be kind.
