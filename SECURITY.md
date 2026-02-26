# Security

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Report privately via [GitHub Security Advisories](https://github.com/westkitty/DexEarth/security/advisories/new) or email the repository owner directly.

## Scope

DexEarth is a client-side web app. The main attack surface is:

- **Vite dev-server proxy** — runs only on your local machine or Tailscale network; not intended to be publicly internet-exposed
- **Third-party data sources** — the app fetches from external APIs (USGS, CelesTrak, airplanes.live, etc.); malformed responses are parsed defensively but not cryptographically verified
- **FIRMS API key** — stored in `.env` which is gitignored; do not commit it

## Out of Scope

This is a personal dashboard tool with no authentication, no user accounts, and no server-side data storage. There is nothing to escalate privileges into.
