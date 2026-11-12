# BREACHLINE

Co-op tactical entry game for Quest (WebXR), phones, tablets and desktop, up to 4 officers. Everyone arrives at a training facility (shooting range with static, pop-up and moving targets, a timed shoot / no-shoot kill house, and practice doors and a dummy bomb that reset themselves); the mission board there picks one of three maps (mansion, container terminal, Grand Prix pit building with the race still running: stay off the track), the weather and, for the Grand Prix, day or night, and START sends the whole room in together. After a mission, TRAINING on the debrief returns to the range; suspects, hostages and bombs are reshuffled every mission. Dusk, with a breaker that cuts the lights, and night vision.
- **Mansion** (Operation GILDED CAGE): a three-storey modern house, walk-out basement and pool terrace above the ocean. 9 suspects, 5 hostages, 2 bombs, 12:00.
- **Terminal** (Operation IRON TIDE): a container port about 120 x 110 m. Container yard, ship-to-shore and yard cranes, trucks, an operations building (breaker), and a moored container ship: board by a gangway, cross the stacked deck, clear the bridge tower. 14 suspects, 8 hostages, 3 bombs in padlocked containers (cut the lock with the cutters, open the doors, defuse inside), 15:00. A high-value target with two bodyguards holds the bridge: arrest him for full marks.

## Deploy (GitHub + one Cloudflare Worker)
1. Cloudflare dashboard > Workers & Pages > Create > Import a repository > pick this repo.
2. Deploy command: `npx wrangler deploy` (the default). No build command, no variables.
3. Open the `*.workers.dev` URL in the Quest browser, enter a room code, press ENTER VR. Friends use the same code.

`wrangler.toml` serves `/public` as static assets and routes `/ws/<ROOM>` to a Durable Object (`Room`) that runs the mission.

## Layout
- `public/js/core/` pure game logic shared by server and client: `level.js` (walls, collision, bullets, pathfinding for any map), `maps/` (one file per map: layout, floors, spawn points), `sim.js` (suspects, hostages, bombs, rules of engagement, scoring), `weapon.js` (manual gun handling), `host.js` (message protocol).
- `public/js/` client: `game.js` (VR rig, hands, weapons, HUD, networking), `gfx.js` (shared world rendering), `maps/<id>-gfx.js` (each map's scenery and sky), `actors.js` (people, guns, bombs), `audio.js`.
- `src/worker.js` Worker + Durable Object.
- `test/` `node test/core.test.mjs`, `node test/worker.test.mjs`; `vr.py` + `xrmock.js` drive the VR path in headless Chromium with a fake headset.

## Art and sound
People, weapons, furniture and the house are built in code; the race car is ported from the Kerbside app (`js/racecar.js`). Downloaded models: suspects and the squad (`public/models/chars`, see its LICENSE.md; two are derived from Valve's Counter-Strike characters, keep the project private or swap them before publishing), the officers' rifle and pistol (`public/models/m4`: "Assault rifle M4A1" by bobeer, CC BY 4.0; "FN509 Pistol" by Lokeig, CC BY-NC 4.0, non-commercial), civilians and off-duty police hostages (`public/models/civ`, by Michael Constantine, CC BY 4.0), plants (`public/models/nature`, CC0) and the parked car (`public/models/car`, CC-BY 4.0, Car Concept by Eric Chadwick / Darmstadt Graphics Group, simplified); see the LICENSE.md in each folder. Materials come from `public/js/mats.js` (Phong shine plus a tiny reflection map, same approach as Kerbside).
Sound effects are recorded CC0 libraries from GitHub (Free Firearm Sound Library and Kenney packs), built by `tools/build_sfx.py`; credits in `public/sfx/CREDITS.md`.

## Not in yet
Voice chat, climbing (container tops, crane ladders), downloaded furniture and character models, AI teammates.
