# Josh's personal factory

A local proof of concept for joshcazalas.com: a detached camera over an animated Factorio megafactory, with a concrete identity plaza and pixel lettering. No player character or building mechanics.

## Run locally in WSL

Requires Node.js 22.12+ (Node 24 was used here) and a local installation of Factorio with the base-game graphics.

```bash
npm ci
npm run assets:import
npm run dev
```

Open **http://localhost:5173** in your Windows browser. The Vite server binds to `127.0.0.1`. WSL's localhost forwarding normally makes it available from Windows.

The asset importer automatically finds this installation:

```text
/mnt/c/Program Files (x86)/Steam/steamapps/common/Factorio
```

For another installation:

```bash
npm run assets:import -- "/path/to/Factorio"
```

It imports 78 sprite definitions and three fonts into `public/factorio/`. The importer uses Sharp to crop the required animation frames and train orientations into three shared texture atlases. That directory, the local screenshots, and build output are gitignored. Game artwork belongs to Wube Software. This prototype is for local exploration; no deployment is configured.

After pulling changes to the sprite catalog or importer, rerun `npm run assets:import` before starting the site.

## Controls

| Action | Control |
| --- | --- |
| Pan | Drag, WASD, or arrow keys |
| Zoom | Wheel, pinch, + / −, or buttons |
| Home / identity plaza | H or Home |
| Entire factory | M or the overview button |
| Jump to a district | Quickbar or keys 1–4 |
| Move camera on the map | Click the minimap |
| Pause / resume animation | Space or Pause |
| Read projects and contact details | About & projects |

The lettering on the concrete has real email, GitHub, and LinkedIn links. They are also available in the accessible project panel. Reduced-motion preferences start factory animation paused.

## What the POC does

- Renders original terrain, belts, splitters, underground entrances, items, assemblers, furnaces, labs, refineries, tanks, pipes, roboports, robots, solar panels, accumulators, inserters, radar, rail, and trains.
- Composes approximately 1,400 machines and 19,500 visible belt tiles around the unchanged concrete identity plaza, with irregular production areas, folded supply lines, mixed-item science loops, chemical processing, and rail sidings.
- Moves both conveyor lanes continuously through turns and hides items at underground crossings. Seven persistent trains circulate on five complete rail circuits. Each carriage follows the same closed centerline, including across the lap join.
- Mainline trains cruise at 1,760–1,920 world pixels per second (55–60 game tiles per second). Depot trains accelerate, brake, and dwell at their loading tracks. Animation uses elapsed wall time, so lower rendering frame rates do not reduce train speed; hidden tabs and pause do not accumulate catch-up time.
- Uses packed textures, cached scenery chunks, camera culling, and particle batches for moving belt items.
- Provides a detached camera, pan/zoom, overview, quick navigation, and an accessible HTML project panel.
- Uses a tile alphabet for the identity plaza. Those letters live in world coordinates and move with the factory.

This is an authored visual scene, not a Factorio simulation. Items loop through connected visual routes; recipes, electrical networks, resource accounting, inserter transfers, train signals, and dispatch are not simulated. Rail bends are assembled from original track sprite sections. Conveyor beds are cached scenery while their items move. Project-specific construction and blueprint scenes remain a later step.

## Source map

- `src/factory.ts`: protected identity plaza and camera destinations.
- `src/layout.ts`: factory composition, production areas, and transport routes.
- `src/factory-core.ts`: rendering, sprite animation, underground crossings, train movement, and culling.
- `src/paths.ts`: conveyor geometry and railway sampling.
- `src/rail-network.ts`: closed rail circuits, cruising speeds, train sizes, and depot stops.
- `src/train-motion.ts`: repeating cruise, acceleration, braking, and dwell schedules.
- `src/asset-catalog.json`: original asset paths, frame dimensions, shifts, and scales.
- `src/camera.ts`: mouse, keyboard, touch, zoom, and destination framing.
- `src/pixel-font.ts`: world-space tile lettering.
- `src/main.ts` and `src/style.css`: interface, minimap, accessible content, and scene setup.
- `scripts/import-assets.mjs`: imports and packs selected frames from the installed game.

## Checkpoints

The `factory-hub-v1` tag preserves the initial megabase hub with the concrete identity plaza and looping trains. To explore that version without changing the current branch:

```bash
git switch -c revisit-factory-hub factory-hub-v1
```

Game artwork, generated atlases, local configuration, and planning notes are excluded from version control. A fresh checkout needs its own local Factorio installation and the asset import step above.

## Checks

```bash
npm run check
npm run test:geometry
npm run build
npx playwright install chromium
npm run test:browser
```

Run the dev server before the browser checks. Geometry checks cover belt turns, grid validation, closed rail seams, carriage continuity, station stops, speed, and train spacing. Browser checks follow persistent trains through a complete lap and check the animation clock, loading, pan/zoom, destinations, pause/resume, project-panel interaction, mobile layout, and reduced motion. Screenshots go to `.local/screenshots/`.

For a custom browser installation, set `BROWSER_EXECUTABLE_PATH`. For a different running server, set `TEST_URL`. The browser used during development was a temporary Chromium installation adapted to the libraries in this WSL/Nix environment; that temporary setup is not part of the app.
