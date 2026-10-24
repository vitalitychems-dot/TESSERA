# God's Eye View → Tessera: review and handoff

## What was actually done

- Read the imported MIT source and its separate `DATA_SOURCES.md` carve-outs.
- Used the official `morluto/rea` npm package `rea-agents@6.7.0` (MIT) for
  static source analysis, not a substitute reimplementation or model training.
- Found Cesium 1.138.0 resolving engine 22.3.0 directly and widgets 14.5.0
  resolving engine 24.0.0. The viewer initializes a different `ContextLimits`
  singleton from that used by application primitives. Its zero limits match
  the user's `maximumTextureSize (0)` and `maximumCubeMapSize (0)` screenshots.
- Pinned Cesium's widget dependency to 14.3.0. Both now use engine 22.3.0.
  Added a regression test comparing resolved engines and singleton identity.
- Built the app; 43 focused startup, Apple-atmosphere, dependency and framing
  tests passed. The new direct collector's seven offline tests passed.
- Queried all four real direct feeds successfully: USGS, EONET, NWS,
  CelesTrak. Record counts are observations of a run, not ongoing guarantees.
- Workspace and production dependency audits returned zero advisories.
- Private preview returns HTTP 200. The capture browser still cannot initialize
  WebGL; a successful real-phone globe render is **not yet verified**. Its
  initial-context error is distinct from the user's post-startup zero limits.
- Grok/xAI rejected the request before returning a model list. No Grok answer
  was received, and none is represented as evidence.

## Architecture recovered from readable source

| Responsibility | Existing code |
|---|---|
| Browser entry and error handling | `src/main.js` |
| Lifecycle/teardown | `src/app/application.js`, `src/standalone/application.js` |
| Viewer, GPU context | `src/app/viewer.js`, `src/app/atmosphereCompat.js` |
| Sky and cube-map textures | `src/sky/starrySky.js` |
| Basemap choice and credential routing | `src/mapStackController.js`, `src/mapStartup.js` |
| Shared layer interfaces | `src/layers/`, `src/app/layers/` |
| Standalone catalog, scene and controls | `src/standalone/` |
| Local proxy/provider endpoints | `server/providers/`, `server/standalone/` |
| Source licensing and UI attribution | `DATA_SOURCES.md`, `src/data/dataCredits.js` |
| Third-party model licenses | `public/models/README.md` |

This is already open, readable source. Lawful source review and an attributed
fork are preferable to decompilation. REA inventories relationships and evidence;
it does not automatically produce a feature-complete, independently authored
replacement. Static relationships do not prove runtime execution.

## Independent program

`lib/world-sources` is original code with no dependency on this app, Cesium,
copied map assets or third-party imagery. It is designed for Tessera's existing
Node/pnpm workspace, makes no changes to ports, and returns structured evidence.
Its README documents the direct endpoints, observation meanings, limits,
integration contract and remaining work.

Implemented: earthquake observations, NASA's event catalogue, US weather
alerts, and space-station orbital elements. Not implemented: globe/layer UI
parity, aircraft/vessel coverage, satellite propagation, provider credentials,
or live Tessera retrieval-route integration. The current Tessera memory README
explicitly says its retrieval hook is not mounted and does not train weights.
The separate usage-memory importer matches that store's append/list interface,
skips existing seed tags on sequential re-runs, and has an offline contract test.
It is staged for the TESSERA checkout, not executed against a live instance.

## What can and cannot be reused

The app's MIT license permits an attributed fork. Keep Bilawal Sidhu's
copyright notice. It does not license all data and assets. In particular,
TeleGeography's non-commercial data cannot simply be relabeled as ours;
Google/Cesium map services, imagery, external models and other datasets retain
their terms and required attribution. A direct fetch does not remove those terms.
The independent collector includes none of those restricted assets.

## Storage and adoption gates

- Archive only source and reviewed documentation, not `.env` files, credentials,
  browser profiles, runtime caches, build output, personal screenshots or logs.
- Preserve the original app in a clearly labeled upstream directory; keep
  independent collector code separate.
- Keep the working private preview; source archival does not authorize deletion.
- Use additive branches/PRs for code changes. Do not merge, launch a mesh,
  publish, train a model, or overwrite a running Tessera installation implicitly.
- Save an indexed recall card in the memory repository. Call that repository
  documentation, not verified ingestion into a running assistant.
- Choose the primary mission before a UI replacement: global events,
  aircraft/vessel/satellite tracking, or a research/evidence workspace require
  different licensed feeds, retention policies and interaction design.

## Reproduce locally

```sh
pnpm install --frozen-lockfile
pnpm --filter gods-eye-view exec node --test \
  src/app/application.test.mjs src/app/atmosphereCompat.test.mjs \
  src/tooling/cesiumDependencies.test.mjs src/tooling/viteBuild.test.mjs
pnpm --filter gods-eye-view run build
node --test lib/world-sources/test.mjs
node lib/world-sources/cli.mjs --source usgs
pnpm audit
```

REA commands used:

```sh
pnpm exec rea analyze-javascript-application artifacts/gods-eye-view \
  --source-path src/app/viewer.js --source-path src/sky/starrySky.js \
  --source-path src/mapStackController.js --source-path src/standalone/scene.js \
  --format json
pnpm exec rea analyze-javascript-application /tmp/gev-source-review \
  --max-heap-mb 1024 --format json
```

The first run parsed four files, with zero parse failures, and explicitly left
2,159 inventoried files outside semantic analysis. The second run used a clean
source-only copy of the archived files (without dependencies or compiled output).
It read 37,716,647 text bytes, parsed 1,912 JavaScript files with zero parse
failures, and retained 63,640 semantic nodes. It reported 3,698 resource-constraint
limitations and incomplete relationship coverage; complete semantic recovery is
**not** claimed. See `rea-receipt.json`. The first all-directory attempt was
stopped because it was parsing the generated Cesium vendor bundle rather than
only the reviewed source.

Large raw REA output is generated evidence, not application source, and is
excluded from workspace Git. The receipt preserves its digest and limitations.
