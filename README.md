# Pokémon Champions Companion

A Pokémon Champions team-building and analysis companion app.

## Current version

v1.0.0


## Recent update

v1.0.0 is the first source-only release milestone. It restores the engine and validator regression suite so `npm test` passes end to end, keeps Pokémon Champions data honesty visible through low-emphasis data-confidence disclosures, gates the Data Quality page behind developer mode, and packages releases without generated folders or repository internals.

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
