# Pokémon Champions Companion

A Pokémon Champions team-building and analysis companion app.

## Current version

v0.3.31

## Local setup

```bash
npm install
npm run build
npm start
```

## Netlify deployment

Use these settings when connecting this repository to Netlify:

```text
Build command: npm run build
Publish directory: dist
```

The app is a static build. Source files live in `src/`, runtime assets and data live in `public/`, and build output is generated into `dist/`.

## Repository contents

Keep these folders/files in GitHub:

- `src/` — app source code
- `public/` — runtime assets and data used by the app
- `scripts/` — build, QA, and validation scripts
- `tests/` — regression and engine tests
- `index.html`
- `package.json`
- `package-lock.json`
- `netlify.toml`
- `CHANGELOG.md`
- `README.md`
- `.gitignore`

Do not commit generated folders like `dist/`, `node_modules/`, `.netlify/`, or `reports/`.
