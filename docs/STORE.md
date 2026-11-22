# You Can't Hide on the Meta Horizon Store (`quest-store` branch)

Store title: **You Can't Hide** (straight apostrophe, everywhere: store title, cover art, manifest, in-game). BREACHLINE stays
as the development name: repo, main branch, code comments, storage keys and cache names keep it, since players never see them.

The store build is a WebXR PWA packaged with Meta's Bubblewrap (a Trusted Web Activity). The headset app is a thin
wrapper that opens the store Worker's URL, so the game files still come from a web server: that server is public,
but outside the store app it only offers the demo, and the full game unlocks through Meta in-app purchase.

## Decisions (17 Nov 2026)
- VR only, Quest 2 and Quest 3 (listing says "Quest 3 recommended"). No phone / desktop / 2D editor in the store build.
- Online lobbies are Quest-only: this branch deploys its own Worker (`you-cant-hide`) with its own Durable Objects.
- Monetisation: free download + one durable add-on "Full game" through Meta's Digital Goods API (Stage 3). Reason: PWAs
  have no documented paid-app entitlement check, and the Digital Goods service only exists in store installs, so a copied
  APK or the bare URL cannot unlock it. The gate is a flag in `js/store/config.js`, so a paid listing is still possible.
- The two Sketchfab Standard models (pistol, BAe 146) ship obfuscated as `.blx` (`tools/obf_glb.py`, loader
  `js/store/obf.js`); originals are in `assets-src/`, outside `public/`, so they are never served.
- Weapon names in game text stay generic (RIFLE, PISTOL). The rifle's licence title "Assault rifle M4A1" appears only in
  the credits, as the CC BY attribution requires.
- Age: aim for ESRB Teen / PEGI 16 like Onward and Breachers (keep: no blood or gore, no strong language). Self-certify
  the age group as teens and adults (13+), which avoids the Mixed Ages Get Age Category API.

## Name check
Two small free itch.io games already use the title "You Can't Hide" (a Ren'Py escape game, 2023; a Godot runner, 2023).
No store-level conflict found, but a CIPO / USPTO trademark search before launch is worth the ten minutes.

## Versions
- Store web builds: `q1`, `q2`, ... in three places: `public/sw.js` (`breachline-qN`), `public/version.txt`, `BUILD` in
  `public/js/game.js`. Bump all three on every push to `quest-store`.
- APK: `appVersionName` 1.0.N / `appVersionCode` N in `store/twa-manifest.json`, bumped only when a new APK is needed
  (icon, permissions, manifest or start URL changes). Ordinary game updates need no new APK.
- Merging main: main bumps `vNN` in the same three files; on conflict keep the `qN` side and bump N.

## Hosting
1. Cloudflare > Workers & Pages > Create > Import a repository > `jor134/breachline`, production branch `quest-store`.
   `wrangler.toml` on this branch already names it `you-cant-hide`. Add the secrets `TURN_KEY_ID`,
   `TURN_KEY_API_TOKEN` and a new `CREATOR_CODE`.
2. On the existing `breachline` Worker (main): Settings > Build > turn off builds for non-production branches, so it does
   not try to deploy `quest-store`.
3. Development build (main) private: Settings > Domains & Routes > workers.dev > enable Cloudflare Access, allow only your
   email. You log in once in the Quest Browser and keep developing there.
4. Custom domain for the store Worker (Stage 5), e.g. `play.<yourdomain>`. The packaged app is tied to this origin for good.

## Stages
- [x] 0. Branch, version scheme, separate Worker.
- [x] 1. Compliance basics: generic weapon text, in-game CREDITS (menu) + `credits.html`, obfuscated pistol / jet,
      `privacy.html`, PLAYERS menu: mute anyone, room owner can remove a player (Worker).
- [x] 2. VR-only launch (q3): `js/store/boot.js` asks for VR the moment the page opens and draws a "LOADING" card fixed in the
      room with raw WebGL (session in ~0.3 s in the headless test); game.js takes the same session over (`js/store/launch.js`)
      and shows the start menu in VR: CALLSIGN (preset word + number), VOICE CHAT, TUTORIAL, PLAY ONLINE (quick match as a terrorist, friends, 6-character room-code keyboard,
      NEW makes a code), CREDITS, PLAY SOLO. The Worker accepts preset callsigns only. The 2D page is just a fallback
      ENTER VR button; `?classic=1` brings back the full development screen (the headless tests use it).
      Still to check on the headset (stage 5 sideload): the microphone prompt inside the packaged app, and that the
      automatic VR request is allowed when the app is opened from its icon.
- [x] q4 fixes from the first headset test: PLAY ONLINE kept (leaving VR for the microphone prompt no longer reloads the page;
      ENTER VR goes back to the same room), character models double-sided (holes), each finger joint curls about its own axis,
      walk cycle with eased stride and planted feet, casino floor / suites drawn only when they can be seen (gfx `zone`), shaders
      compiled at map load (`prewarm` in game.js), night-vision goggles flip down and up (`js/store/nvgflip.js`).
      These touch shared files (actors.js, chars.js, gfx.js, game.js, casino-gfx.js): worth bringing to main too.
- [x] 3. Full-game unlock (q7, `js/store/config.js`, `unlock.js`, purchase panel in `ui.js`). App ID 1766163904906396, add-on
      SKU `full_game` (durable). Demo: training facility + mansion, solo. Full game: the other four missions, PLAY ONLINE, the
      map editor and custom maps. Locked missions show [FULL GAME] on the board; START, PLAY ONLINE or MAP EDITOR on a locked
      item opens the purchase panel (Meta's own dialog in the store app; a "get it on the Store" note anywhere else).
      Ownership is checked every launch with listPurchases (works across headsets; last result kept for offline play).
      Development devices: open the game once with `?dev=<CREATOR_CODE>`; the Worker checks the code (`/api/unlock`).
      `gate: 'none'` in config.js unlocks everything (if the game is ever a paid listing instead).
- [x] 4. Performance (q6, `js/store/perf.js`): 72 Hz on every headset; dynamic resolution (WebXR viewport scaling, Quest
      Browser 35+): a second with several dropped frames lowers the render resolution a step (100 / 90 / 80 / 72 %), eight clean
      seconds raise it again; a Quest 2 on a browser without viewport scaling starts at 85 %. Foveation was already at maximum.
      The radio MENU shows the current resolution. Plus (q4) shaders compiled at load and the casino zones.
- [ ] 5. Packaging + submission kit: twa-manifest, `/.well-known/assetlinks.json`, GitHub Action APK build, listing text,
      IARC answers, assets list.
- [ ] 6. Steam feasibility spike.

## Your dashboard checklist (things only you can do)
- Payout account: individual is fine (no business name needed); bank account name must match the developer account.
  Tax form W-8BEN as a Canadian individual.
- Create the app in the Developer Dashboard (gives the App ID for Stage 3 / 5).
- Platform Services > User Reporting > Add Service > activate (Meta-button reporting, VRC.Content.3). Mark the app as
  having multiplayer / co-op modes, or the Report button will not appear.
- Data Use Checkup: request "In-app purchases and/or downloadable content"; give the privacy policy URL.
- Add-ons: create a **durable** add-on with SKU `full_game` and set its price (it shows in the game's purchase panel).
- Reset the App secret (it was pasted into a chat on 17 Nov 2026). The game never uses it.
- IARC questionnaire and age-group self-certification at submission.

## Domain and app package (Stage 5)
- Store domain: https://youcanthidegame.com (Workers custom domain in wrangler.toml; www too). The workers.dev address still works.
- Package name: com.jordanbreccia.youcanthide (permanent). Meta App ID 1766163904906396. Immersive, Horizon billing on, microphone permission on.
- Signing key: RSA 2048, alias youcanthide, kept by Jordan (never in the repo). GitHub secrets ANDROID_KEYSTORE_BASE64 + ANDROID_KEYSTORE_PASSWORD.
- /.well-known/assetlinks.json is served by src/worker.js with the key's SHA-256 fingerprint. Without it the immersive app will not launch.
- APK: GitHub Actions "Quest APK" (.github/workflows/quest-apk.yml), run by hand or when android/twa-manifest.json changes. Bump appVersionCode and appVersion there for each new APK. Download from the run's artifacts, upload to the ALPHA channel.

## Test mode (unreleased maps on the live site)

- Mark a map `test: true` in its definition (`public/js/core/maps/<map>.js`). It is left out of the mission and map lists for
  everyone except testers, and rooms refuse it from anyone who is not a tester. A room on a test map is never offered to
  QUICK MATCH. Boards show it as `NAME (TEST)`.
- Become a tester on a headset: CREDITS > DEBUG: ON > TEST MODE: ENTER CODE, type the `TEST_CODE` (Worker secret, digits,
  10-12 recommended; 20 tries a day per network address). The token lasts 90 days. TEST MODE: ON/OFF switches between your view
  and a buyer's.
- To release a map: remove `test: true` and push.
- Limits: the map's code and models still ship with the site (anyone who digs through the files can find them); a bug in shared
  code still reaches everyone; the shared code changes the moment it is pushed. For bigger changes use a staging Worker.
