# Copilot Instructions — swissgeol-viewer-app

A 3D geological data viewer for Switzerland (viewer.swissgeol.ch).
Four services: **UI** (Lit/Vite, port 8000), **API** (Rust/Axum, port 3000), **titiler** (GeoTIFF tiles, port 8481), **abbreviator** (URL shortener, port 8001).

## Build, Test, and Lint Commands

### UI (`ui/`)

```sh
npm start              # Dev server (port 8000)
npm run build          # Full production build (clean + static + vite)
npm run lint           # ESLint + Prettier check
npm run lint:fix       # ESLint + Prettier auto-fix
npm run check          # TypeScript type-check (tsc --noEmit)

# E2E tests (Cypress + Cucumber BDD) — requires running dev server
npm run e2e            # Start server + run all Cypress tests headless
npm run cypress:open   # Open Cypress interactive runner
npm run cypress:run    # Run Cypress headless (server must be running)

# Run a single Cypress feature file
npx cypress run --spec cypress/e2e/someFeature.feature
```

### API (`api/`)

```sh
cargo build            # Build
cargo test             # Run tests (requires Postgres via docker compose)
cargo fmt              # Format
cargo clippy           # Lint

# Run a single test
cargo test test_name
```

API tests require a running PostgreSQL instance. Use `docker compose -f docker-compose-tests.yaml up` or the dev composition.

### Full Stack (Docker)

```sh
docker compose up      # Start all 4 services with hot-reload
```

## Architecture

### UI — Lit Web Components + CesiumJS

The UI is a **Lit 3** web components app bundled with **Vite**. It renders a 3D globe via **CesiumJS** and uses **RxJS** for reactive state.

**Feature modules** (`ui/src/features/`): The primary organizational unit. Each feature contains elements, services, models, and controllers scoped to a domain (e.g., `layer/`, `catalog/`, `session/`).

**Service injection**: Services are provided via `@lit/context`. A custom `BaseService` class wraps this with RxJS support (`inject$()` returns an Observable, `inject()` returns a Promise). Services are registered in `ui/src/context/register-context.ts`.

**Legacy stores** (`ui/src/store/`): Older code uses static classes with RxJS `BehaviorSubject` fields (e.g., `MainStore`, `DashboardStore`). New code should prefer `@lit/context`-based services.

**Element base class**: New elements extend `CoreElement` (from `features/core/`), which provides i18n reactivity, RxJS subscription management via `register()`, and lifecycle hooks (`willFirstUpdate`, `willChangeLanguage`).

### API — Rust/Axum

A REST API using **Axum 0.7** with **sqlx** (Postgres) and **AWS S3**. Flat module layout with a domain-specific `layers/` submodule.

**Auth**: JWT validation against AWS Cognito JWKS, implemented as an Axum `FromRequestParts` extractor (`Claims`). Handlers opt in by adding `claims: Claims` (or `Option<Claims>`) as a parameter.

**Layer config**: Layers are defined in JSON5 files under `layers/`. The API parses these at startup into a typed tree, filters by user access (Cognito groups + environment), and serves them to the UI.

### Layer Configuration (`layers/`)

Layers are defined in **JSON5** files with a hierarchical include system. `layertree.json5` is the root config.

Layer types: `Wmts`, `Tiles3d`, `Voxel`, `Tiff`, `Earthquakes`, `GeoJson`, `Kml`.

The info box config uses a `source` discriminator:
- `{ source: 'api3.geo.admin.ch' }` — legend fetched from geo.admin.ch
- `{ source: 'custom', legend_url?, information? }` — custom content with optional `{ key, url }` link objects

See `docs/layer-config/` for full documentation of all layer properties.

## Key Conventions

### File Naming

- `*.element.ts` — Lit custom elements (registered via `@customElement`)
- `*.service.ts` — injectable services (extend `BaseService`, provided via `@lit/context`)
- `*.model.ts` — TypeScript data models and interfaces
- `*.module.ts` — side-effect-only files that import elements to register them
- `*.controller.ts` — Lit reactive controllers

### Module Registration

Features self-register their custom elements via side-effect imports in `*.module.ts` files. These modules are imported from the root `ngm-app.ts`. When adding a new element, add its import to the feature's module file.

### Barrel Exports

Each feature re-exports its public API through `index.ts` barrel files:
```
features/layer/index.ts → features/layer/models/index.ts → features/layer/models/layer.model.ts
```
Import from the feature root (e.g., `import { LayerService } from 'src/features/layer'`), not from internal paths.

### Path Aliases

TypeScript and Vite both resolve `src/*` to `ui/src/*`. Use `import { ... } from 'src/features/...'` style imports.

### CSS / Styling

New components use Lit's `static readonly styles = css\`...\`` with Shadow DOM scoping. Shared design tokens are in `ui/src/styles/theme.ts` (provides `applyTypography()`, `applyEffect()`, `applyTransition()`, `hostStyles`). Global CSS and Fomantic UI are in `ui/src/styles/`.

### ESLint: Class Member Ordering

The ESLint config enforces a specific order for Lit element class members:
1. Decorated properties/accessors (`@property`, `@state`, `@consume`, `@query`)
2. Constructor
3. Lifecycle methods and other methods
4. `render()` method
5. `static styles`

### ESLint: Boolean Naming

Boolean variables/properties must use one of these prefixes: `is`, `has`, `show`, `hide`, `should`, `does`, `can`, `use`, `needs`, `was`.

### i18n

Uses **i18next** with 4 languages (`de`, `en`, `fr`, `it`; fallback: `en`) and 6 namespaces (`app`, `assets`, `catalog`, `layers`, `layout`, `toolbox`). Translation files are in `ui/locales/{namespace}/{namespace}.{lang}.json`. Run `npm run extract-i18n` after adding new translation keys.

### Rust Serde Conventions

Layer configs use **snake_case in JSON5** (deserialization) and **camelCase in API responses** (serialization). This is controlled via `#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]`.

### Git Branching & Versioning

- Branches: `feature/viewer-{issue}-{title}`, `bugfix/...`, `hotfix/...`, `chore/...`
- Flow: `feature/*` → `develop` → `main` → production
- Semantic versioning with pre-release labels: `-devX`, `-rcX`, `-hotfixX`
