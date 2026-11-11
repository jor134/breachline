# BREACHLINE

Co-op tactical entry game for Quest (WebXR), up to 4 officers. One level: a three-storey modern house (walk-out basement, pool terrace above the ocean) with armed suspects, five hostages and two bombs, reshuffled every mission. Dusk or night (power cut) with night vision.

## Deploy (GitHub + one Cloudflare Worker)
1. Cloudflare dashboard > Workers & Pages > Create > Import a repository > pick this repo.
2. Deploy command: `npx wrangler deploy` (the default). No build command, no variables.
3. Open the `*.workers.dev` URL in the Quest browser, enter a room code, press ENTER VR. Friends use the same code.

`wrangler.toml` serves `/public` as static assets and routes `/ws/<ROOM>` to a Durable Object (`Room`) that runs the mission.

## Layout
- `public/js/core/` pure game logic shared by server and client: `level.js` (mansion, collision, bullets, pathfinding), `sim.js` (suspects, hostages, bombs, rules of engagement, scoring), `weapon.js` (manual gun handling), `host.js` (message protocol).
- `public/js/` client: `game.js` (VR rig, hands, weapons, HUD, networking), `gfx.js` (world), `actors.js` (people, guns, bombs), `audio.js`.
- `src/worker.js` Worker + Durable Object.
- `test/` `node test/core.test.mjs`, `node test/worker.test.mjs`; `vr.py` + `xrmock.js` drive the VR path in headless Chromium with a fake headset.

## Art and sound
All models are built in code (no downloaded assets yet). Materials come from `public/js/mats.js` (Phong shine plus a tiny reflection map, same approach as Kerbside).
Recorded sound effects can be dropped into `public/sfx/` and listed in `manifest.json`; see the README there.

## Not in yet
Voice chat, flashbangs / less-lethal, downloaded furniture/character models and recorded sounds, AI teammates.
