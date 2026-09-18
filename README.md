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

It imports 87 sprite definitions, three fonts, the in-world Factorio logo, and nine programmable-speaker instrument samples into `public/factorio/`. The importer uses Sharp to crop the required animation frames and train orientations into three shared texture atlases. That directory, the local screenshots, and build output are gitignored. Game artwork and instrument samples belong to Wube Software. This prototype is for local exploration; no deployment is configured.

After pulling changes to the sprite catalog or importer, rerun `npm run assets:import` before starting the site.

## Main menu

Opening the site shows a modern Factorio-style main menu with a single **Play** button. Three close-up factory scenes rotate behind it: a train yard with persistent looping trains, a research campus with moving science belts, and an active oil refinery. These are authored sprite scenes inspired by [Factorio's menu simulations](https://www.factorio.com/blog/post/fff-362), rendered with the local game assets. The menu uses the same WebGL canvas and atlases as the portfolio; the belt beds animate in these close views. The main factory's existing scenery caching is unchanged.

Play opens a brief map-loading panel, then the identity plaza—or the requested outpost if the URL has a project hash. The transition waits for asset loading and scene construction. The portfolio clock starts only after entering; menu scenes use their own clock and stop updating once hidden. Reduced motion uses a still factory backdrop and a shorter transition. No audio autoplays. Keyboard Enter activates Play; the map controls become available after entry.

For an existing checkout that already has its packed sprites, import just the menu logo with:

```bash
npm run assets:import -- --menu-only
```

The normal full import includes it too. The logo and other game artwork stay under the ignored `public/factorio/` directory.

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
| Read projects and contact details | About or Projects |
| Visit the AWS Foundation construction site | Projects → AWS Foundation |
| Visit the Auxide music outpost | Projects → Auxide |
| Visit the caz.nix homelab | Projects → caz.nix |

The lettering on the concrete has real email, GitHub, and LinkedIn links. They are also available in the accessible project panel. Reduced-motion preferences start factory animation paused.

## AWS Foundation outpost

Open **http://localhost:5173/#aws-foundation** directly, or select it from Projects. The outpost sits east of the main factory on the same surface. Home returns to the original identity plaza; browser back and forward also navigate between the two.

A running reference foundation sits beside an empty site. **Deploy foundation** places the same blueprint at the new site, sends construction robots from the depot, builds governance/state, deployment/identity, and workload boundaries, then activates the connections and production. The sequence takes about 21 seconds. Replay rebuilds the target without changing the reference, and **Show completed** skips the animation. Pause freezes construction, robot flights, and production together. When paused—including the default for reduced motion—the build button completes construction instantly.

The panel describes the real repository's multi-account boundaries, OpenTofu configuration, OIDC identity chain, state separation, and reviewed manual applies. The construction sequence is a visual analogy; it makes no AWS calls. On smaller screens the camera frames the new construction site, with the running reference to its west. Pan and zoom remain available, and **Frame build site** restores the project view.

The concrete nameplate includes a tile interpretation of the AWS wordmark and smile. The AWS logo belongs to Amazon Web Services.

## Auxide outpost

Open **http://localhost:5173/#auxide** or choose Projects → Auxide. South of the foundation site, three separate production lines represent independent Discord guild actors. Each has a queue, a playback controller, a voice worker, and a sixteen-step lamp display connected to original programmable speakers and combinators.

Select a demonstration server, then **Pause this server** or **Skip**. Its belts, inserters, musical position, and lamp sequence use the same independent clock; the other two lines keep playing. The main factory Pause control freezes all three. The project panel explains the actual Rust/Tokio actor model, source separation, bounded media processes, supervised playback, and operational tooling.

Ferris appears as a tile mosaic on the Auxide nameplate. The code-drawn interpretation is based on [Karen Rustad Tölva's CC0 Ferris artwork](https://rustacean.net/).

Sound starts off. **Enable sound** plays only the selected server, using original short phrases composed for this site with six Factorio piano notes and three drum samples. Samples load only after that click. Audio uses a short scheduling lookahead so a slow rendering frame doesn't determine note timing. Skipping, pausing, and changing servers cancel pending notes. Leaving the outpost or hiding the tab turns sound off. No Discord, YouTube, or external audio connections are made. The reduced-motion setting starts everything paused as elsewhere on the site.

## caz.nix outpost

Open **http://localhost:5173/#caz-nix** or choose Projects → caz.nix. South of Auxide, interwoven conveyor corridors form an architecture diagram around the NixOS core. Six service islands represent network/access, storage, Home Assistant, observability, Jellyfin media, and community services (Minecraft, BlueMap, and Auxide). A pinned flake also feeds a separate Home Manager output for WSL. Local application archives sit apart from the system generations.

**Deploy next generation** runs a condensed 17-second release: verify provenance, reproduce the build, archive app state, activate, then check service health. Select **Fail the new media service's health check** to run a 23-second recovery sequence. The media island stops, the failure is confirmed, the previous generation is reactivated and checked, and the failed release is quarantined. Generation numbers are fictional; no server connections are made. Successful and rejected releases retain the appropriate active generation across subsequent runs and navigation.

**Show outcome** skips to the same final state. Global Pause freezes the transaction; starting a release while paused or with reduced motion completes it instantly. The panel explains the real project's review gates, separate machine outputs, verified releases, health checks, and the distinction between configuration rollback and explicitly restoring application data.

The nameplate and central system carry tile adaptations of the [NixOS contributors' logomark](https://nixos.org/branding/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The adaptation samples its geometry onto square tiles and uses two brighter blues instead of gradients.

## What the POC does

- Renders original terrain, belts, splitters, underground entrances, items, assemblers, furnaces, labs, refineries, tanks, pipes, roboports, robots, solar panels, accumulators, inserters, radar, rail, and trains.
- Composes approximately 1,400 machines and 19,500 visible belt tiles around the unchanged concrete identity plaza, with irregular production areas, folded supply lines, mixed-item science loops, chemical processing, and rail sidings.
- Moves both conveyor lanes continuously through turns and hides items at underground crossings. Seven persistent trains circulate on five complete rail circuits. Each carriage follows the same closed centerline, including across the lap join.
- Mainline trains cruise at 1,760–1,920 world pixels per second (55–60 game tiles per second). Depot trains accelerate, brake, and dwell at their loading tracks. Animation uses elapsed wall time, so lower rendering frame rates do not reduce train speed; hidden tabs and pause do not accumulate catch-up time.
- Uses packed textures, cached scenery chunks, camera culling, and particle batches for moving belt items.
- Provides a detached camera, pan/zoom, overview, quick navigation, and an accessible HTML project panel.
- Uses a tile alphabet for the identity plaza. Those letters live in world coordinates and move with the factory.

This is an authored visual scene, not a Factorio simulation. Items loop through connected visual routes; recipes, electrical networks, resource accounting, inserter transfers, train signals, and dispatch are not simulated. Rail bends are assembled from original track sprite sections. Conveyor beds are cached scenery while their items move. The AWS Foundation outpost illustrates repeatable infrastructure through a scripted construction sequence built from the same imported sprites and shared atlas textures.

## Source map

- `src/factory.ts`: protected identity plaza and camera destinations.
- `src/layout.ts`: factory composition, production areas, and transport routes.
- `src/factory-core.ts`: rendering, sprite animation, underground crossings, train movement, and culling.
- `src/paths.ts`: conveyor geometry and railway sampling.
- `src/rail-network.ts`: closed rail circuits, cruising speeds, train sizes, and depot stops.
- `src/train-motion.ts`: repeating cruise, acceleration, braking, and dwell schedules.
- `src/foundation-outpost.ts`: shared foundation layout, blueprint ghosts, construction bots, and completed production.
- `src/foundation-deployment.ts`: deterministic construction stages and robot flight timing.
- `src/outpost-location.ts`: outpost position and expanded camera bounds.
- `src/project-panel.ts`: project directory, readable engineering details, and deployment controls.
- `src/auxide-outpost.ts`: three independently animated music lines, speakers, and lamp sequencers.
- `src/auxide-playback.ts`: per-server playback clocks, queues, and original musical phrases.
- `src/auxide-audio.ts` and `src/auxide-samples.json`: opt-in sample loading, scheduling, and cancellation.
- `src/auxide-panel.ts`: server selection, transport, sound controls, and project details.
- `src/caz-outpost.ts`: interwoven homelab diagram, service islands, system generations, and health feedback.
- `src/caz-release.ts`: deterministic release, confirmation, rollback, and recovery state.
- `src/caz-panel.ts`: release controls and readable homelab architecture.
- `src/pixel-nix.ts`: the tile adaptation of the NixOS snowflake.
- `src/asset-catalog.json`: original asset paths, frame dimensions, shifts, and scales.
- `src/camera.ts`: mouse, keyboard, touch, zoom, and destination framing.
- `src/pixel-font.ts`: world-space tile lettering.
- `src/pixel-ferris.ts`: the world-space Ferris tile mosaic on Auxide's nameplate.
- `src/pixel-aws.ts`: the world-space AWS wordmark and smile on the foundation nameplate.
- `src/main-menu.ts` and `src/main-menu.css`: title menu, guarded loading transition, and startup errors.
- `src/menu-backdrop.ts`: three independently timed, rotating title-screen factory scenes.
- `src/main.ts` and `src/style.css`: interface, minimap, accessible content, and scene setup.
- `scripts/import-assets.mjs`: imports and packs selected frames from the installed game.

## Checkpoints

The [`factory-main-menu-v1`](https://github.com/joshcazalas/website/tree/factory-main-menu-v1) tag preserves the animated title menu, Play/loading transition, main hub, and all three project outposts. Continue development on `feature/factorio-main-menu`.

The [`factory-outposts-v1`](https://github.com/joshcazalas/website/tree/factory-outposts-v1) tag preserves the hub and all three project outposts before the main-menu work (commit `86d78e7`, pushed on `feature/aws-foundation-outpost`).

The `factory-hub-v1` tag preserves the initial megabase hub with the concrete identity plaza and looping trains. To explore that version without changing the current branch:

```bash
git switch -c revisit-factory-hub factory-hub-v1
```

Game artwork, generated atlases, local configuration, and planning notes are excluded from version control. A fresh checkout needs its own local Factorio installation and the asset import step above.

## Checks

```bash
npm run check
npm run test:geometry
npm run test:deployment
npm run test:playback
npm run test:release
npm run build
npx playwright install chromium
npm run test:browser
npm run test:outpost
npm run test:auxide
npm run test:caz
npm run test:menu
```

Run the dev server before the browser checks. Geometry checks cover belt turns, grid validation, closed rail seams, carriage continuity, station stops, speed, and train spacing. Browser checks follow persistent trains through a complete lap and check the animation clock, loading, pan/zoom, destinations, pause/resume, project-panel interaction, mobile layout, and reduced motion. Screenshots go to `.local/screenshots/`.

Deployment checks cover stage ordering, construction before power, and round-trip robot flights. The outpost browser check observes a full natural build, pause/resume, replay, immediate completion, project navigation and history, direct URLs, mobile controls, and reduced motion.

Playback checks cover server isolation, pause/resume, repeated skips, fractional-tempo boundaries, and available samples. The Auxide browser check covers server controls, opt-in audio and cancellation, cross-outpost navigation, direct links, mobile layout, and reduced motion.

Release checks cover archival before activation, failure confirmation, recovery, quarantine, repeated generations and physical slots, overlapping-run protection, and equivalent skipped/reduced-motion outcomes. The caz.nix browser check covers complete healthy and failed runs, pause, project navigation, history, mobile controls, and reduced motion.

Menu checks cover scene animation and rotation, separation from the portfolio clock, keyboard Play, the loading transition, deep links, mobile and reduced motion, delayed assets, startup failure, and retry. Existing browser checks enter through Play before exercising the factory.

For a custom browser installation, set `BROWSER_EXECUTABLE_PATH`. For a different running server, set `TEST_URL`. The browser used during development was a temporary Chromium installation adapted to the libraries in this WSL/Nix environment; that temporary setup is not part of the app.
