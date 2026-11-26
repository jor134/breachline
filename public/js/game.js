// BREACHLINE client: WebXR rig, manual weapon handling, interactions, networking, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld, label } from './gfx.js';
import { Human, Officer, Bomb, Body, RIG, GOG, SELF_BACK, GROUND, SUPP, setSuppressor, makeRifle, makePistol, makeMag, makeTool, makeNade } from './actors.js';
import { loadCar, loadParkedCars } from './car.js';
import { setEnvInside } from './mats.js';
import { gfxMode, gfxLabel, toggleGfx, applyGfx } from './store/gfxmode.js';
import { DBG } from './store/debug.js';
import { CHARS, charReady } from './chars.js';
import { voiceState, initAudio, setListener, setAmbience, setOccluder, sfx, setMusic } from './audio.js';
import { makeWeather } from './weather.js';
import { loadVegetation } from './veg.js';
import { resolveCircle, rayStatic, ledgeNear, MAP_IDS, MAPS, MISSION_IDS, registerMap } from './core/level.js';
import { compile as compileCustom } from './core/maps/custom.js';
import { createVoice } from './voice.js';
import { createRace } from './race.js';
import { createTutorial } from './tutorial.js';
import { createRopes } from './rope.js';
import { createVREditor } from './vredit.js';
import { createGun, pullTrigger, ejectMag, insertMag, release, rack, toggleMode, GUNS } from './core/weapon.js';
import { RoomHost, TICK } from './core/host.js';
import { makeStoreUI } from './store/ui.js';
import { isRoomCode, randomRoomCode } from './store/roomcode.js';
import { TEST } from './store/tester.js';
import { storeLaunch } from './store/launch.js';
import { makeNvgFlip } from './store/nvgflip.js';
import { makePerf } from './store/perf.js';   // quest-store: 72 Hz and dynamic resolution to hold the frame rate   // quest-store: straight into VR, start menu inside the headset   // quest-store: PLAYERS (mute / remove) and CREDITS in the VR menu

const $ = id => document.getElementById(id), Q = new URLSearchParams(location.search);
const V = () => new THREE.Vector3(), v1 = V(), v2 = V(), v3 = V(), v4 = V(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
// Soft sun shadows from 5 shadow-map reads per pixel instead of three.js's 17 (same blur width; every lit pixel pays for this)
{ const C = THREE.ShaderChunk, s = C.shadowmap_pars_fragment, a = s.indexOf('#if defined( SHADOWMAP_TYPE_PCF )'), e = s.indexOf('( 1.0 / 17.0 );', a);
  if (a >= 0 && e > a) C.shadowmap_pars_fragment = s.slice(0, a) + `#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 o = texelSize * shadowRadius * 0.75; vec2 p = vec2( o.x, - o.y );
			shadow = ( texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) * 2.0 +
				texture2DCompare( shadowMap, shadowCoord.xy + o, shadowCoord.z ) + texture2DCompare( shadowMap, shadowCoord.xy - o, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + p, shadowCoord.z ) + texture2DCompare( shadowMap, shadowCoord.xy - p, shadowCoord.z ) ) * ( 1.0 / 6.0 );` + s.slice(e + '( 1.0 / 17.0 );'.length); }
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// problems worth reporting (a model that failed to load, a shader the headset rejected, a lost GPU context) show on the HUD and the wrist display
const ERRS = []; const noteErr = m => { m = String(m).replace(/\s+/g, ' ').slice(0, 90); if (!ERRS.includes(m)) { ERRS.push(m); if (ERRS.length > 4) ERRS.shift(); const el = document.getElementById('errs'); if (el) { el.textContent = ERRS.join('\n'); el.style.display = 'block'; } } };
for (const k of ['error', 'warn']) { const f = console[k].bind(console); console[k] = (...a) => { f(...a); const t = a.map(x => x && x.message ? x.message : String(x)).join(' '); if (k === 'error' || /not loaded|failed/i.test(t)) noteErr(t); }; }
addEventListener('error', e => noteErr(e.message)); addEventListener('unhandledrejection', e => noteErr(e.reason && e.reason.message || e.reason));
renderer.domElement.addEventListener('webglcontextlost', () => noteErr('GPU context lost (out of graphics memory?)'));
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.08;   // rolls off hot spots (flashlight, glass glare) without washing out colour
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // static sun shadows, drawn once
try { renderer.xr.setFoveation(1); } catch { }
const perf = makePerf(renderer); perf.fov = gfxMode() === 'quality' ? 0.35 : 1;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 640), rig = new THREE.Group();
camera.rotation.order = 'YXZ'; rig.add(camera); scene.add(rig);
addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// The world is rebuilt when the squad picks another map in the lobby: geometry, doors, lights, the breaker, the exit, plants and cars.
let world = null, level = null, M = null, extras = [], mapGen = 0, ready = false;
GROUND.y = (x, z, y) => level ? level.groundY(x, z, y) : null;   // feet on stairs and slopes (actors.js)

// ---------- training targets: plywood cut-outs on a hinge; red = armed, blue = no-shoot ----------
let targets = [];
const tgTex = (() => { const mk = hostile => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#c9a26a'; g.fillRect(0, 0, 128, 256); g.fillStyle = hostile ? '#a8231e' : '#2858a8';
  g.beginPath(); g.arc(64, 46, 26, 0, 7); g.fill(); g.beginPath(); g.moveTo(18, 250); g.lineTo(22, 110); g.quadraticCurveTo(26, 80, 64, 78); g.quadraticCurveTo(102, 80, 106, 110); g.lineTo(110, 250); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; for (const r of [14, 30]) { g.beginPath(); g.ellipse(64, 150, r * 1.2, r * 1.6, 0, 0, 7); g.stroke(); }
  g.fillStyle = '#111'; if (hostile) { g.fillRect(84, 128, 40, 12); g.fillRect(104, 136, 10, 22); } else { g.fillRect(8, 40, 12, 60); g.fillRect(108, 40, 12, 60); g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('NO', 64, 210); g.fillText('SHOOT', 64, 234); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }); };
  return { h: mk(true), n: mk(false), post: new THREE.MeshLambertMaterial({ color: 0x3a3d42 }) }; })();
function buildTargets() {
  for (const t of targets) { scene.remove(t.g); t.board.geometry.dispose(); } targets = [];
  if (!M.training) return;
  for (const d of M.targets) {
    const g = new THREE.Group(), hinge = new THREE.Group(), board = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), tgTex.h); board.position.y = d.h / 2; board.castShadow = true;
    hinge.add(board); g.add(hinge); g.position.set(d.x, d.y, d.z); g.rotation.y = d.face || 0;
    if (d.y > 0.1) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, d.y, 0.05), tgTex.post); post.position.y = -d.y / 2; g.add(post); }
    scene.add(g); targets.push({ d, g, hinge, board, up: d.kind === 'static' || d.kind === 'move' ? 1 : 0, cur: 0, x: d.x, tx: d.x, hostile: 1 });
  }
}
function updateTargets(dt) {
  for (const t of targets) { const want = t.up ? 0 : -Math.PI / 2; t.cur += (want - t.cur) * Math.min(1, dt * 10); t.hinge.rotation.x = t.cur;
    if (t.d.kind === 'move') { t.x += (t.tx - t.x) * Math.min(1, dt * 8); t.g.position.x = t.x; } }
}
function trainLine() {
  const mine = (S.tstats || []).find(r => r[0] === S.me.id) || [0, 0, 0, 0], H = S.house || [0, 0, 0, 0, 0];
  return { hits: mine[1], shots: mine[2], ns: mine[3], acc: mine[2] ? Math.round(100 * mine[1] / mine[2]) : 0, run: H[0] ? H[1].toFixed(1) + 's' : H[3] ? 'last ' + H[3] + 's' : '-', best: H[2] ? H[2] + 's' : '-', on: !!H[0] };
}
let race = null;
// Compile every material's shader while the map loads instead of the first time each one comes into view: on the headset each
// first sight costs a hitch, which is what stuttered walking into new parts of a map (the casino's suites after the rappel).
// Character models that are loaded but not yet in the scene are compiled against the scene's lights too. Already-built shaders
// come straight from the cache, so calling this again is cheap.
function prewarm(gen) {
  if (gen !== mapGen) return;
  try { const p = renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera); if (p && p.catch) p.catch(() => { });
    for (const id of Object.keys(CHARS)) { const t = charReady(id); if (t) renderer.compile(t.scene, camera, scene); } } catch (e) { console.warn('prewarm', e); }
}
function loadMap(id, tod, force) {
  const T = MAPS[id] && MAPS[id].tods ? (MAPS[id].tods.includes(tod) ? tod : (world && world.level.id === id ? world.tod : MAPS[id].tods[0])) : 'dusk';
  if (!force && world && world.level.id === id && world.tod === T) return;
  if (world) world.dispose(); if (race) { race.dispose(); race = null; } for (const o of extras) { scene.remove(o); o.geometry && o.geometry.dispose(); } extras = []; const gen = ++mapGen;
  world = buildWorld(scene, id, T); level = world.level; M = level.map; if (M.race) race = createRace(scene);
  buildTargets();
  if (ready) { S.doorTrap = level.doors.map(() => 0); S.doorOpen = level.doors.map(() => false); S.doorLocked = level.doors.map(() => false); S.deskCam = null; S.deskPick = null; for (const h of hands) h.hold = null; placeMapProps(); applyLook(); }
  applyGfx(world, renderer); for (const t of [2000, 4000, 12000]) setTimeout(() => { if (gen === mapGen) applyGfx(world, renderer); }, t);   // glass that arrives with the map's models
  renderer.shadowMap.needsUpdate = true; prewarm(gen); setTimeout(() => prewarm(gen), 4000); setTimeout(() => prewarm(gen), 12000);   // again once the models have arrived
  if (!Q.get('lite')) {   // ?lite=1 skips the heavy models (used by the automated tests)
    const keep = m => { if (!m || gen !== mapGen) { if (m) scene.remove(m); return; } if (m.isMesh) m.castShadow = m.receiveShadow = true; extras.push(m); renderer.shadowMap.needsUpdate = true; };
    if (M.veg) loadVegetation(scene, M).then(v => keep(v && v.mesh)).catch(e => console.warn('vegetation not loaded', e));
    for (const c of M.cars || []) loadCar(scene, c.x, 0, c.z, Math.PI, c.length).then(keep).catch(e => console.warn('car not loaded', e));
    if (M.parked) loadParkedCars(scene, M.parked).then(keep).catch(e => console.warn('parked cars not loaded', e));
    if (world.gfx.load) world.gfx.load().then(m => { if (gen === mapGen) scene.add(m); keep(m); }).catch(e => console.warn('map model not loaded', e));   // e.g. the airport's jet
  }
}
loadMap(MAP_IDS.includes(Q.get('map')) ? Q.get('map') : 'training');
// ?draft=1: the level editor's TEST button. The draft from this device's editor plays solo, straight into the mission.
const DRAFT = (() => { if (!Q.get('draft')) return null; try { const d = JSON.parse(localStorage.getItem('bl_draft') || 'null'); if (!d) return null; registerMap(compileCustom(d, 'draft')); return d; } catch (e) { console.warn('draft not loaded', e); return null; } })();
// the tutorial: from the start screen (TUTORIAL button, the first-visit offer or ?tut=1) it runs solo; from the mission board, in place
let TUT = false; let tutSeen = false; try { tutSeen = !!localStorage.getItem('bl_tutseen'); } catch (e) { }
function armTutorial() { TUT = true; $('solo').checked = true; $('tutoffer').style.display = 'none'; try { localStorage.setItem('bl_tutseen', '1'); } catch (e) { } status('Tutorial: now pick ENTER VR, PLAY ON THIS PHONE / TABLET or Desktop. It runs solo in the training facility.'); $('tutbtn').classList.add('on'); }
$('tutbtn').onclick = armTutorial; $('tutgo').onclick = armTutorial; $('tutno').onclick = e => { e.preventDefault(); $('tutoffer').style.display = 'none'; try { localStorage.setItem('bl_tutseen', '1'); } catch (er) { } };
if (!tutSeen && !Q.get('draft')) $('tutoffer').style.display = 'block'; if (Q.get('tut')) setTimeout(armTutorial, 0);
if (DRAFT) { $('solo').checked = true; setTimeout(() => { status('Testing your draft "' + DRAFT.name + '": pick VR, phone or desktop. It plays solo.'); const a = $('editlink'); a.textContent = 'BACK TO THE EDITOR'; }, 0); }   // everyone arrives at the training facility; the mission board sends the squad out

const S = { hvtIds: [], rope: null, fly: null, fadeT: 0, ropeHint: '', mode: null, me: { id: 0, slot: 0, hp: 100, down: false, w: 0, med: false, fl: 2, sm: 1 }, doorTrap: level.doors.map(() => 0), deskCam: null, touch: false, tmove: { x: 0, y: 0 }, tmenu: false, figT: 0, lastPart: '', phase: 'lobby', timer: 600, doorOpen: level.doors.map(() => false), actors: new Map(), officers: new Map(), bombs: [], feetY: 0,
  net: 'offline', room: '', report: null, doorLocked: level.doors.map(() => false), bodyYaw: 0, panel: 'lobby', menu: false, deskPick: null, night: false, nvg: false, tool: 'hands', hintT: 0, wx: 'clear', wxPick: 'random', squad: [], secured: 0, civs: 5, defused: 0, light: true, now: 0, eye: 1.66, crouch: false, yaw: 0, pitch: 0, ads: false, reloading: false, tilt: +(localStorage.getItem('bl_tilt') || 0) };
S.nextMap = MISSION_IDS[0]; S.todPick = 'random'; S.raceT = 0;
const head = { pos: V(), quat: new THREE.Quaternion(), fwd: V(), yaw: 0 };
const status = t => { $('status').textContent = t; };
const lostHint = n => { if (n % 2 === 0) hint(head.pos.x + head.fwd.x * 1.2, head.pos.y - 0.1, head.pos.z + head.fwd.z * 1.2, 'CONNECTION LOST - REJOINING...'); };

// ---------- networking ----------
const net = {
  ws: null, host: null, timer: null,
  connect(room, name, solo) {
    return new Promise(res => {
      if (solo) { this.local(name); return res('solo'); }
      // quest-store: a dropped connection rejoins the same room by itself (a server update restarts every room; a headset can drop
      // off the network for a moment). Before, the world simply froze: nobody moved and shots went nowhere.
      let done = false; const fail = (e) => { if (done) { if (S.net === 'online' && this.ws === ws) { const code = e && e.code;
        if (code === 4001 || code === 4000 || code === 4002) { S.net = 'lost'; status(code === 4001 ? 'Removed from the room.' : code === 4002 ? 'That game is no longer open.' : 'Room full.'); return; }
        S.net = 'lost'; this.ws = null; status('Connection lost: rejoining room ' + room + '...'); this.rejoin(room, name, 0); } return; } done = true; this.ws = null; this.local(name); res('solo'); };
      let ws;
      try {
        ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + room + '?name=' + encodeURIComponent(name) + storeUI.wsExtra(room, false));
        ws.onopen = () => { done = true; res('online'); }; ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } }; ws.onerror = fail; ws.onclose = fail;
        setTimeout(() => { if (!done) { try { ws.close(); } catch { } fail(); } }, 5000);
      } catch { fail(); }
    });
  },
  rejoin(room, name, n) {
    if (S.net !== 'lost') return; lostHint(n);
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + room + '?name=' + encodeURIComponent(name) + storeUI.wsExtra(room, true)); let ok = false;
    ws.onopen = () => { ok = true; this.ws = ws; S.net = 'online'; status('Back in room ' + room + '.'); hint(head.pos.x + head.fwd.x * 1.2, head.pos.y - 0.1, head.pos.z + head.fwd.z * 1.2, 'RECONNECTED'); sfx.ok();
      ws.onclose = ws.onerror = (e) => { if (this.ws !== ws) return; const code = e && e.code; if (code === 4001 || code === 4000 || code === 4002) { S.net = 'lost'; return; } S.net = 'lost'; this.ws = null; this.rejoin(room, name, 0); }; };
    ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onerror = ws.onclose = () => { if (ok) return; setTimeout(() => this.rejoin(room, name, n + 1), Math.min(5000, 1000 + n * 500)); };
  },
  local(name) { this.host = new RoomHost((id, o) => onMsg(JSON.parse(JSON.stringify(o)))); this.host.join(1, name); this.timer = setInterval(() => { const t = performance.now(); this.host.tick(); perf.simNote(performance.now() - t); }, TICK * 1000); },
  leave() { if (this.ws) { const w = this.ws; this.ws = null; w.onclose = w.onerror = w.onmessage = null; try { w.close(1000); } catch (e) { } } if (this.timer) { clearInterval(this.timer); this.timer = null; } this.host = null; },
  send(o) { if (o && window.__tut) window.__tut.note(o.t);
    // test mode: a pick of a test map carries this headset's tester token, so the room never has to have heard it before
    if (o && /^(choose|map|restart|start)$/.test(o.t) && TEST.ok && TEST.token && MAPS[o.m || o.map] && MAPS[o.m || o.map].test) o = { ...o, tt: TEST.token };
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); else if (this.host) this.host.message(1, o); },
};

// ---------- voice chat (online rooms) ----------
const voice = createVoice(o => net.send(o));
$('voiceon').checked = voice.on; $('voiceon').onchange = e => { voice.setOn(e.target.checked); if (e.target.checked && !$('solo').checked) voice.startMic().then(ok => status(ok ? 'Microphone ready for squad voice chat.' : voice.err)); };
voice.getIce();
// a small speaker over a teammate's head while they talk
const TALK_MAT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#40e070'; g.beginPath(); g.moveTo(10, 24); g.lineTo(22, 24); g.lineTo(36, 10); g.lineTo(36, 54); g.lineTo(22, 40); g.lineTo(10, 40); g.fill(); g.strokeStyle = '#40e070'; g.lineWidth = 5; for (const r of [12, 22]) { g.beginPath(); g.arc(36, 32, r, -0.8, 0.8); g.stroke(); } const t = new THREE.CanvasTexture(c); return new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false }); })();
function voiceLine() { if (S.net !== 'online' || !voice.on) return ''; return voice.mic ? (voice.muted ? 'MIC OFF' : 'MIC ON') : 'NO MIC'; }
function toggleMic() {
  if (!voice.mic) {   // quest-store: no microphone yet: ask for it now (the app's first request shows Android's permission prompt)
    if (!voice.on) voice.setOn(true);
    hint(head.pos.x + head.fwd.x, head.pos.y, head.pos.z + head.fwd.z, 'ASKING FOR THE MICROPHONE...');
    voice.startMic().then(ok => { if (ok) voice.unlock(); hint(head.pos.x + head.fwd.x, head.pos.y, head.pos.z + head.fwd.z, ok ? 'MIC ON' : 'NO MIC: ' + (voice.err || 'blocked').split(':')[0].toUpperCase()); if (S.menu) toggleMenu(true); });
    return;
  } voice.setMuted(!voice.muted); sfx.beep(null, voice.muted ? 500 : 900); hint(head.pos.x + head.fwd.x * 1.2, head.pos.y - 0.2, head.pos.z + head.fwd.z * 1.2, voice.muted ? 'MIC MUTED' : 'MIC ON'); }

// ---------- hands & guns ----------
const mkIn = () => ({ trig: 0, grip: 0, a: 0, b: 0, stick: 0, sx: 0, sy: 0, thumb: 0, trigT: 0 });
const hands = [0, 1].map(i => { const h = { i, pos: V(), quat: new THREE.Quaternion(), active: false, item: null, magKind: null, support: false, rackG: null, rackStart: V(), rackDone: false, hold: null, aT: 0, vel: V(), last: V(), zone: null, in: mkIn(), prev: mkIn(), pad: null, xr: null, mags: { rifle: makeMag('rifle', true), pistol: makeMag('pistol', true) }, tools: { pick: makeTool('pick'), cutters: makeTool('cutters'), cam: makeTool('cam') }, nades: { flash: makeNade('flash'), smoke: makeNade('smoke') } }; for (const m of [...Object.values(h.mags), ...Object.values(h.tools), ...Object.values(h.nades)]) { m.visible = false; scene.add(m); } return h; });
const press = (h, k) => h.in[k] > 0.5 && !(h.prev[k] > 0.5), released = (h, k) => !(h.in[k] > 0.5) && h.prev[k] > 0.5;
const buzz = (h, s, ms) => { try { h.pad && h.pad.hapticActuators && h.pad.hapticActuators[0] && h.pad.hapticActuators[0].pulse(s, ms); } catch { } };
const mkGun = (kind, mesh) => { scene.add(mesh); return { kind, st: createGun(kind), mesh, ud: mesh.userData, where: 'holster', mags: GUNS[kind].mags, kick: 0, flashT: 0 }; };
const guns = { rifle: mkGun('rifle', makeRifle(true, true)), pistol: mkGun('pistol', makePistol(true, true)) };
// quest-store: the sidearm drawn 1.6x its modelled size (it read as a toy in the hand). Its points (muzzle, sight, magwell) are in the
// mesh's own frame, so they scale with it; the grip stays at the hand because the gun frame's origin is the top of the grip.
const PISTOL_SCALE = 1.396;   // 1.6 asked for with the old .22; the 9 mm model a third smaller, a quarter larger (18 Nov), then a sixth smaller (22 Nov)
guns.pistol.mesh.scale.setScalar(PISTOL_SCALE); for (const h of hands) h.mags.pistol.scale.setScalar(PISTOL_SCALE);
// quest-store: hands lock onto the gun. A held gun follows the controller (or, two-handed, the line to the support hand), and the
// hand drawn on it takes its pose from the gun: the gun hand round the pistol grip, the support hand round the foregrip, wherever
// the controllers really are. GRIP_AT: where the controller origin would be for a proper grip, in the gun's frame.
const GRIP_AT = { rifle: new THREE.Vector3(0, -0.035, 0.02), pistol: new THREE.Vector3(0, -0.03, 0.012), fore: new THREE.Vector3(0, -0.035, 0) };
let PISTOL_UNTILT = null; const lockQ = [new THREE.Quaternion(), new THREE.Quaternion()], lockP = [new THREE.Vector3(), new THREE.Vector3()];
function handOnGun(h) {
  if (!h.active) return null;
  const G = gunIn(h), o = hands[1 - h.i], OG = gunIn(o), q = lockQ[h.i], p = lockP[h.i];
  if (G) { q.copy(G.mesh.quaternion); if (G.kind === 'pistol' && S.mode === 'vr') q.multiply(PISTOL_UNTILT || (PISTOL_UNTILT = PISTOL_TILT.clone().invert())); G.mesh.localToWorld(p.copy(GRIP_AT[G.kind]).multiplyScalar(G.kind === 'pistol' ? 1 / PISTOL_SCALE : 1)); }
  else if (h.support && OG && OG.kind === 'rifle') { q.copy(OG.mesh.quaternion); OG.mesh.localToWorld(p.copy(OG.ud.fore).add(GRIP_AT.fore)); }
  else return h;
  return { pos: p, quat: q, pose: h.pose, i: h.i };
}
const gunIn = h => (h.item === 'rifle' || h.item === 'pistol') ? guns[h.item] : null;
const PISTOL_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
const HOLSTER = RIG, HOLSTER_ROT = { rifle: [0, 1.45, 0.25, 'ZYX'], pistol: [-1.5, 0, 0, 'XYZ'] }, _he = new THREE.Euler();   // the rifle hangs across your front, muzzle to the left and a little down   // grab zones sit exactly where the holders are drawn on the vest and belt
const bodyPt = (off, out) => out.set(off[0], 0, off[2] + (S.mode === 'vr' ? (myBody.back || 0) - (myBody.skin ? SELF_BACK.gear : 0) : 0)).applyAxisAngle(UP, S.bodyYaw)   // gear moves back with your body as you look down
  .add(head.pos).setY(head.pos.y + off[1] + (S.mode === 'vr' ? SELF_BACK.up + (myBody.skin ? SELF_BACK.gup : 0) : 0));
const myBody = new Body(true); myBody.g.visible = false; scene.add(myBody.g);
const ropes = createRopes({ THREE, S, rig, head, get hands() { return hands; }, sfx, buzz: (...a) => buzz(...a), hint: (...a) => hint(...a), M: () => M, level: () => level, gunIn: h => gunIn(h), headWorld: () => headWorld(),
  climb: () => (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - S.tmove.y });
// the VR map editor (vredit.js): MAP EDITOR on the training board. It builds the draft map around you and hands it back for TEST PLAY.
const ED = createVREditor({ THREE, scene, rig, head, hands, S, sfx, buzz, headWorld, map: () => M, level: () => level, worldRoot: () => world.root,
  rebuild: doc => { registerMap(compileCustom(doc, 'draft')); loadMap('draft', 'day', true); }, refreshList: () => loadCustomList(), test: map => testDraft(map), exit: () => leaveEditor() });
function openEditor() {
  if (S.mode !== 'vr' || ED.on) return; sfx.click(); if (!S.edTest) ED.prev = { id: M.id, tod: world.tod };
  panel.mesh.visible = false; S.panel = null; S.menu = false; coach.mesh.visible = false; for (const h of hands) { h.hold = null; }
  ED.enter();
}
function leaveEditor() {   // back to the training facility (or wherever the room is now)
  const P = ED.pendingInit; ED.pendingInit = null;
  if (S.edTest) { S.edTest = false; net.send({ t: 'restart', wx: S.wxPick, map: 'training' }); }
  else if (P) { applyInit(P); placeAtSpawn(); showLobbyPanel(); }
  else { const pv = ED.prev || { id: 'training', tod: 'day' }; loadMap(pv.id, pv.tod, true); placeAtSpawn(); showLobbyPanel(); }
}
// TEST PLAY: the draft as a solo mission. From an online room this drops you to solo play (the server cannot load a draft).
function testDraft(map) {
  S.edTest = true; try { localStorage.setItem('bl_draft', JSON.stringify(map)); } catch (e) { } registerMap(compileCustom(map, 'draft'));
  const go = () => net.send({ t: 'start', wx: 'clear', map: 'draft', tod: map.style && map.style.night ? 'night' : 'day' });
  if (net.ws) { const w = net.ws; net.ws = null; w.onclose = w.onerror = w.onmessage = null; try { w.close(); } catch { } S.net = 'solo'; net.local((nameIn.value.trim() || 'Officer').slice(0, 14)); setTimeout(go, 400); }
  else go();
}
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// quest-store: the flashlight is switched by its intensity, never by visible. Three.js builds every shader for the number of lights
// in view, so showing or hiding a light rebuilds them all: on a headset that was seconds of stutter each time a gun was drawn or
// holstered with the light on (in the casino, right after the rappel through the suite window). TORCH_I: its brightness when on.
const TORCH_I = 16, torch = new THREE.SpotLight(0xfff2dd, 0, 30, 0.44, 0.8, 1.6); scene.add(torch, torch.target);
const xrc = [0, 1].map(i => { const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i); rig.add(ray, grip); const o = { ray, grip, src: null }; ray.addEventListener('connected', e => { o.src = e.data; }); ray.addEventListener('disconnected', () => { o.src = null; }); return o; });
const tiltQ = new THREE.Quaternion(); const setTilt = d => { S.tilt = d; tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), d * Math.PI / 180); localStorage.setItem('bl_tilt', d); }; setTilt(S.tilt);

function resetLoadout() {
  // fresh ammunition; whatever is already in your hands stays there
  for (const k in guns) { const G = guns[k], mode = G.st.mode; G.st = createGun(k); G.st.mode = mode; G.mags = GUNS[k].mags; G.kick = 0; }
  for (const h of hands) { if (h.item === 'mag') h.item = null; h.rackG = null; h.hold = null; }
  if (S.mode === 'desktop' && !gunIn(hands[1])) { guns.rifle.where = 1; hands[1].item = 'rifle'; }
  S.reloading = false;
}
// The casino's fly-in: everyone starts aboard the helicopter far out over the boulevard and it carries them to the hover over the roof.
// The rig rides along (moved by the helicopter's offset each frame); you can look around but not walk; the server keeps you at the hover
// point all along (poses go out with the offset taken off), and other officers aboard are drawn riding with it.
function flyIn() { S.fly = null; if (!M.fly || S.mode == null || !M.fly.aboard(head.pos.x, head.pos.z, S.feetY)) return; S.fly = { t: 0, off: new THREE.Vector3() }; S.fadeT = 1.2; carry(0); }
function carry(dt) {
  if (!S.fly) return; const F = M.fly; if (!F || S.phase !== 'active') { rig.position.sub(S.fly.off); S.feetY -= S.fly.off.y; S.fly = null; return; }
  S.fly.t += dt; const o = F.at(S.fly.t); v1.set(o[0], o[1], o[2]).sub(S.fly.off); rig.position.add(v1); S.feetY += v1.y; S.fly.off.add(v1);
  if (S.fly.t > F.T + F.drop) S.fly = null;
}
const flyV = new THREE.Vector3(), fo = p => S.fly ? flyV.copy(p).sub(S.fly.off) : p;   // a position as the server should see it
// Climbing: onto anything solid between knee and shoulder height with room on top (a counter, a crate, a parapet).
// VR: grip its top edge with an empty hand and pull down. Desktop: SPACE (or USE with nothing else in reach). Phone: USE.
function climbTo(L) { S.perch = L.b; S.crouch = false; headWorld(); rig.position.x += L.x - head.pos.x; rig.position.z += L.z - head.pos.z; S.feetY = L.y; headWorld(); sfx.step && sfx.step(v1.set(L.x, L.y, L.z), 'concrete'); for (const h of hands) { h.ledge = null; if (S.mode === 'vr') buzz(h, 0.6, 60); } }
function liftHint() {   // in the lift, or waiting at its door on the other floor
  const Lf = M.lift; if (!Lf || S.phase !== 'active') return ''; const c = Lf.car, x = head.pos.x, z = head.pos.z, k = Lf.stops.findIndex(y => Math.abs(S.feetY - y) < 1.5); if (k < 0) return '';
  const di = level.doors.findIndex(d => d.lift === k), open = !!S.doorOpen[di];
  if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return open ? 'STAY IN THE LIFT TO RIDE' : '';
  return !open && Math.hypot(x - (c.x0 + c.x1) / 2, z - (c.z1 + 1.1)) < 1.3 ? 'WAIT HERE: THE LIFT IS COMING' : '';
}
function tryClimb() { if (S.me.down || S.rope || S.fly || S.spec) return false; const L = ledgeNear(level, S.doorOpen, head.pos.x + head.fwd.x * 0.45, head.pos.z + head.fwd.z * 0.45, S.feetY, 0.6); if (!L) return false; climbTo(L); return true; }
function ledgeGrab(h) {
  if (S.rope || S.fly || S.spec) return; const L = ledgeNear(level, S.doorOpen, h.pos.x, h.pos.z, S.feetY, 0.3); if (!L || Math.abs(h.pos.y - L.y) > 0.35) return;
  h.ledge = { L, y: h.pos.y }; buzz(h, 0.4, 30); hint(h.pos.x, L.y + 0.35, h.pos.z, 'PULL DOWN TO CLIMB UP');
}
function ledgePull() { for (const h of hands) if (h.ledge && h.active) { if (!(h.in.grip > 0.5)) h.ledge = null; else if (h.pos.y < h.ledge.y - 0.2) climbTo(h.ledge.L); } }
function placeAtSpawn() {
  if (ED.on) return;   // building in the map editor: the editor keeps you where you are
  const sp = S.spawnAt, [x, z] = sp ? [sp[0], sp[2]] : M.spawn[S.me.slot % 4], fy = sp ? sp[1] : M.spawnY ?? (M.yAt ? M.yAt(0, x, z) : 0); S.feetY = fy; ropes.reset(); S.perch = null; rig.rotation.y = 0; S.yaw = 0; S.pitch = 0;   // terrorist players start inside
  if (S.mode === 'vr') { rig.position.y = fy; headWorld(); rig.position.x += x - head.pos.x; rig.position.z += z - head.pos.z; headWorld(); } else rig.position.set(x, fy, z);
}

// ---------- effects ----------
const tracers = Array.from({ length: 14 }, () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.8 })); l.visible = false; l.frustumCulled = false; l.userData.t = 0; scene.add(l); return l; });
let tracerI = 0;
function tracer(a, b) { const l = tracers[tracerI = (tracerI + 1) % tracers.length], p = l.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; l.visible = true; l.userData.t = 0.07; }
const puffs = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true })); m.visible = false; m.userData.t = 0; scene.add(m); return m; });
let puffI = 0;
function puff(p, color) { const m = puffs[puffI = (puffI + 1) % puffs.length]; m.position.set(p[0], p[1], p[2]); m.material.color.set(color); m.visible = true; m.userData.t = 0.3; }
const says = [];
// glass bursting out of a breach window: a spray of glints that falls and fades
const SHARDS = []; const shardM = new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false });
{ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -500, 0]), 3)); scene.add(new THREE.Points(g, shardM)); }   // quest-store: one far-away point, so the shard shader is built with the rest at load (no hitch at the first broken window)
function shards(x, y, z, horiz) {
  const n = 90, pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = x + (Math.random() - 0.5) * (horiz ? 2 : 0.1); pos[i * 3 + 1] = y + (Math.random() - 0.5) * 2.4; pos[i * 3 + 2] = z + (Math.random() - 0.5) * (horiz ? 0.1 : 2); vel.push([(Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, shardM.clone()); scene.add(p); SHARDS.push({ p, vel, t: 0 });
}
function tickShards(dt) {
  for (let k = SHARDS.length - 1; k >= 0; k--) { const S2 = SHARDS[k], a = S2.p.geometry.attributes.position; S2.t += dt;
    for (let i = 0; i < S2.vel.length; i++) { const v = S2.vel[i]; v[1] -= 9.8 * dt; a.array[i * 3] += v[0] * dt; a.array[i * 3 + 1] = Math.max(-50, a.array[i * 3 + 1] + v[1] * dt); a.array[i * 3 + 2] += v[2] * dt; }
    a.needsUpdate = true; S2.p.material.opacity = Math.max(0, 0.9 - S2.t / 1.8); if (S2.t > 1.8) { scene.remove(S2.p); S2.p.geometry.dispose(); SHARDS.splice(k, 1); } }
}
function sayAt(x, y, z, text, color) { const s = label(text, color); s.position.set(x, y, z); scene.add(s); says.push({ s, t: 2.2 }); }
function say(actor, text, color) { const p = actor.g.position; sayAt(p.x, p.y + (actor.body.position.y < 0 ? 1.5 : 2.0), p.z, text, color); }
const bars = hands.map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.014), new THREE.MeshBasicMaterial({ color: 0x40ff80, depthTest: false, fog: false })); m.renderOrder = 997; m.visible = false; scene.add(m); return m; });
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })); veil.position.z = -0.3; veil.renderOrder = 998; camera.add(veil);
const downTag = label('OFFICER DOWN - WAIT FOR A TEAMMATE', '#ff8080', 768, 64); downTag.scale.set(1.2, 0.1, 1); downTag.position.set(0, 0, -1.2); downTag.visible = false; camera.add(downTag);
let hurtT = 0, flashWhite = 0;
// night vision: the scene is relit in amplified green (see gfx look), and a goggle mask narrows the view
const nvgMask = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 60, 128, 128, 104); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false })); m.position.z = -0.32; m.renderOrder = 996; m.visible = false; camera.add(m); return m; })();
const nvgFlip = makeNvgFlip(camera, on => { S.nvg = on; applyLook(); });
const irLamp = new THREE.PointLight(0x58ff68, 0, 34, 1.1); camera.add(irLamp);   // the goggles' own illuminator: nearby surfaces read brighter, which gives depth
const weather = makeWeather(scene, () => level), WXS = ['random', 'clear', 'rain', 'fog', 'storm'];
const pickTeam = () => { const t = S.me.team === 'tango' ? 'swat' : 'tango'; S.me.team = t; myBody.setTeam(t); sfx.click(); net.send({ t: 'team', team: t }); showLobbyPanel(); };
const TODS = ['random', 'day', 'night'], cycleTod = () => { S.todPick = TODS[(TODS.indexOf(S.todPick) + 1) % TODS.length]; sfx.click(); if (M.training) net.send({ t: 'choose', tod: S.todPick }); };
const cycleWx = () => { S.wxPick = WXS[(WXS.indexOf(S.wxPick) + 1) % WXS.length]; sfx.click(); if (M.training) net.send({ t: 'choose', wx: S.wxPick }); };
// main breaker in the plant room: throw the lever to cut every light in the house
const breaker = (() => { const g = new THREE.Group(); const box = (w, h, d, c, x, y, z, basic) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); return m; };
  const lever = new THREE.Group(); lever.position.set(0.08, 0, 0.07); lever.add(box(0.05, 0.2, 0.04, 0xc02020, 0, 0.09, 0.03)); const led = box(0.035, 0.035, 0.01, 0x30ff60, -0.1, 0.2, 0.062, true);
  g.add(box(0.42, 0.62, 0.12, 0x555a60, 0, 0, 0), box(0.36, 0.5, 0.01, 0x3a3e44, 0, -0.03, 0.062), box(0.2, 0.05, 0.012, 0xe8d040, -0.02, 0.26, 0.062, true), lever, led);
  for (let i = 0; i < 6; i++) g.add(box(0.06, 0.035, 0.02, 0x15171a, -0.1, 0.1 - i * 0.06, 0.07)); scene.add(g); return { g, lever, led, cur: 0 }; })();
const nearBreaker = (p, d) => !!M.breaker && Math.hypot(p.x - M.breaker.x, p.y - M.breaker.y, p.z - M.breaker.z) < d;
const lookFog = { c: new THREE.Color(), bg: new THREE.Color(), d: 0, on: false };   // the scene's own fog, for smoke to thicken without re-running the whole look
const applyLook = () => { GOG.night = S.night; world.look(S.night, S.nvg, S.wx); weather.set(S.wx, S.night, S.nvg); nvgMask.visible = S.nvg; irLamp.intensity = S.nvg ? (S.night ? 3.2 : 1.2) : 0; lookFog.on = false; };
function toggleNVG() { if (nvgFlip.busy()) return; const on = !S.nvg; sfx.nvg(on); nvgFlip.start(on); }   // the goggles flip down / up (js/store/nvgflip.js)
function hint(x, y, z, text) { if (S.now - S.hintT < 1.2) return; S.hintT = S.now; sayAt(x, y, z, text, '#ffd060'); sfx.beep(null, 300); }
// wounds: a leg hit slows you, an arm hit shakes your aim; a body diagram shows where you were hit
const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'], FIG = { head: [14, 0, 12, 12], torso: [10, 13, 20, 26], armL: [2, 13, 7, 26], armR: [31, 13, 7, 26], legL: [10, 40, 9, 34], legR: [21, 40, 9, 34] };
const legMul = () => [1, 0.65, 0.4][(S.me.w >> 4 & 1) + (S.me.w >> 5 & 1)] * (S.me.holding ? 0.5 : 1), armShake = () => [0, 0.012, 0.026][(S.me.w >> 2 & 1) + (S.me.w >> 3 & 1)];
// The damage figure (wrist and hit diagram): a SWAT officer in outline, helmet with ear cups, plate carrier, gloves, knee pads and
// boots, rifle hanging at the right side. Same six parts and the same 40 x 74 box as before (FIG); each part fills red when hurt.
// quest-store: the damage figure (wrist and HUD) is the soldier silhouette Jordan picked (22 Nov), traced into its six hit zones
// (tools: threshold, split at the neck, shoulders, hips and between the legs, a small gap between zones), 40 x 74 units.
const SWAT_FIG = (() => {
  const polys = list => (g, M) => { for (const pts of list) { pts.forEach(([a, b], i) => i ? g.lineTo(...M(a, b)) : g.moveTo(...M(a, b))); g.closePath(); } };
  return { head: polys([[[18.4,0.8],[17.3,2.0],[16.4,4.0],[16.4,7.0],[17.6,7.8],[17.7,9.3],[24.5,9.3],[24.7,8.9],[24.5,7.6],[25.4,7.0],[25.6,5.4],[25.3,3.8],[24.1,1.5],[23.1,0.6],[22.0,0.2],[19.7,0.2]]]),torso: polys([[[15.1,10.0],[14.5,10.6],[14.4,11.5],[12.5,13.0],[12.5,30.3],[13.2,30.6],[13.3,32.0],[13.5,32.3],[13.5,32.9],[13.2,33.6],[13.3,35.3],[13.0,36.2],[12.9,38.6],[12.5,40.0],[12.5,41.4],[29.5,41.4],[29.5,37.3],[29.1,35.6],[29.1,33.8],[28.8,33.3],[28.8,32.6],[29.5,32.4],[29.5,12.3],[28.6,11.6],[28.7,10.2],[28.5,9.8],[28.2,9.5],[26.2,9.5],[24.5,9.9],[24.5,9.5],[17.7,9.5],[17.4,10.3],[16.8,10.3],[16.4,9.8]]]),armL: polys([[[12.3,40.7],[11.8,42.0],[12.2,42.9],[12.1,46.5],[12.3,47.7]],[[12.3,13.1],[10.9,15.3],[9.3,17.3],[9.5,17.6],[9.5,18.2],[8.7,20.1],[8.6,22.2],[7.6,24.7],[6.1,29.5],[5.7,32.1],[5.7,34.2],[6.3,36.4],[6.0,39.6],[6.7,40.1],[6.7,40.7],[6.0,42.5],[8.4,42.5],[8.7,40.6],[9.5,40.5],[9.8,40.1],[9.8,37.9],[11.0,36.7],[11.2,36.1],[11.2,34.8],[10.9,34.2],[10.5,34.1],[10.5,33.6],[11.2,32.3],[11.6,30.0],[12.3,30.0]]]),armR: polys([[[29.7,38.9],[29.7,41.4],[30.6,41.4]],[[29.7,12.3],[29.7,32.4],[30.9,31.9],[31.6,31.8],[31.8,33.2],[32.3,34.1],[32.6,36.6],[31.5,38.5],[31.1,41.0],[31.9,41.0],[32.3,39.8],[32.9,39.8],[32.8,41.8],[32.2,43.0],[32.3,43.5],[32.6,43.6],[34.2,42.8],[35.7,41.0],[35.9,38.8],[35.7,36.1],[36.3,35.4],[36.4,32.7],[36.0,30.0],[36.0,27.8],[34.8,22.6],[34.0,20.4],[34.0,18.9],[33.3,17.4],[33.3,16.4],[31.6,14.3],[31.1,13.5]]]),legL: polys([[[21.0,41.6],[12.5,41.6],[12.5,48.1],[13.0,49.8],[12.9,51.4],[12.5,52.9],[12.5,54.2],[13.0,56.2],[13.5,57.3],[13.5,59.3],[14.2,60.8],[14.1,62.6],[15.5,63.8],[16.1,66.6],[16.1,67.7],[15.5,68.8],[12.7,71.9],[12.5,73.1],[13.2,73.6],[16.7,73.9],[17.7,73.6],[18.5,72.9],[20.0,72.7],[20.7,72.1],[20.1,68.3],[20.0,63.1],[20.8,62.3],[20.8,59.6],[20.2,57.6],[19.8,51.9],[20.1,51.2],[19.9,49.9],[20.5,48.2],[20.5,46.2],[21.0,44.2]]]),legR: polys([[[30.6,41.6],[21.2,41.6],[21.2,43.3],[21.7,43.3],[23.1,51.2],[23.1,53.0],[22.5,54.1],[22.2,56.6],[21.7,58.0],[21.6,58.9],[22.2,59.7],[22.2,60.6],[21.8,62.3],[21.2,63.6],[21.2,65.9],[22.4,67.3],[22.5,69.3],[22.8,70.1],[23.7,71.0],[25.2,71.5],[26.7,71.3],[27.3,70.4],[27.3,68.9],[26.0,65.4],[25.8,63.1],[26.5,61.0],[27.9,60.0],[27.9,58.6],[28.8,57.5],[28.9,56.3],[29.7,55.1],[30.2,53.5],[30.2,51.8],[30.0,51.3],[29.7,48.1],[30.5,46.5],[30.6,44.6],[30.2,42.4],[30.6,42.0]]]),
    lines: [], rifle: [[8.4,42.7],[5.8,42.7],[5.0,46.4],[4.9,48.5],[4.3,48.9],[4.4,49.5],[5.0,50.2],[4.9,51.6],[3.8,56.1],[3.5,56.1],[3.5,57.1],[4.3,57.1],[5.6,51.1],[6.4,49.1],[7.0,48.7],[7.3,47.4],[8.1,46.7],[8.6,44.7]] };
})();
function drawBody(g, x, y, k, flash) {
  const M = (a, b) => [x + a * k, y + b * k];
  PARTS.forEach((p, i) => { g.beginPath(); SWAT_FIG[p](g, M); g.fillStyle = p === flash ? '#ffffff' : S.me.w & (1 << i) ? '#e03030' : '#46505c'; g.fill('nonzero'); });
  g.save(); g.strokeStyle = 'rgba(8,12,18,0.55)'; g.lineWidth = Math.max(0.6, k * 0.55); g.lineJoin = 'round';
  for (const L of SWAT_FIG.lines) { g.beginPath(); L.forEach(([a, b], i) => i ? g.lineTo(...M(a, b)) : g.moveTo(...M(a, b))); if (L.length > 2) g.closePath(); g.stroke(); }
  g.beginPath(); SWAT_FIG.rifle.forEach(([a, b], i) => i ? g.lineTo(...M(a, b)) : g.moveTo(...M(a, b))); g.closePath(); g.fillStyle = '#1b222b'; g.fill(); g.strokeStyle = '#7d8794'; g.lineWidth = Math.max(0.6, k * 0.4); g.stroke();
  g.restore();
}
const fig = (() => { const c = document.createElement('canvas'); c.width = 96; c.height = 176; const tex = new THREE.CanvasTexture(c); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.156), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })); mesh.position.set(-0.17, -0.05, -0.5); mesh.renderOrder = 994; mesh.visible = false; camera.add(mesh); return { c, tex, mesh }; })();
function drawFig() { const g = fig.c.getContext('2d'); g.clearRect(0, 0, 96, 176); g.fillStyle = 'rgba(5,8,12,0.7)'; g.fillRect(0, 0, 96, 176); drawBody(g, 8, 8, 2, Math.floor(S.now * 5) % 2 ? S.lastPart : ''); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(S.lastPart ? ({ head: 'HEAD', torso: 'TORSO', armL: 'LEFT ARM', armR: 'RIGHT ARM', legL: 'LEFT LEG', legR: 'RIGHT LEG' })[S.lastPart] : 'TREATED', 48, 170); fig.tex.needsUpdate = true; }
function useMed() { if (S.me.down) return; if (S.me.med) { hint(head.pos.x + head.fwd.x, head.pos.y, head.pos.z + head.fwd.z, 'MED KIT USED'); return; } net.send({ t: 'heal' }); }
// tool wheel: hold the free hand's lower button, move the hand toward a wedge, let go
// PvP terrorist players: the lockpick locks a door, the cutters rig a wire trap (two of each)
const tangoTools = () => S.pvp && S.me.team === 'tango';
const toolLabel = (k, text) => !tangoTools() ? text : k === 'pick' ? 'LOCK (' + (S.me.locks || 0) + ')' : k === 'cutters' ? 'TRAP (' + (S.me.traps || 0) + ')' : text;
const WEDGE = [['pick', 'LOCKPICK', -90], ['cutters', 'CUTTERS', -30], ['cam', 'DOOR CAM', 30], ['med', 'MED KIT', 90], ['hands', 'HANDS', 150], ['nvg', 'NVG', 210]];
const wheel = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })); mesh.renderOrder = 995; mesh.visible = false; scene.add(mesh); return { c, tex, mesh, open: false, hand: null, sel: undefined, items: WEDGE, kind: 'tools', title: '' }; })();
function drawWheel(sel) {
  if (sel === wheel.sel) return; wheel.sel = sel; const g = wheel.c.getContext('2d'); g.clearRect(0, 0, 256, 256);
  const tools = wheel.kind === 'tools'; for (const [k, text, deg] of wheel.items) { const a = deg * Math.PI / 180, on = k === sel, cur = tools && (k === S.tool || (k === 'nvg' && S.nvg)), used = tools && k === 'med' && S.me.med, span = Math.min(0.5, Math.PI / wheel.items.length - 0.02);
    g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 124, a - span, a + span); g.closePath(); g.fillStyle = on ? (used ? '#5a2a2a' : '#1f7a3d') : 'rgba(12,17,24,0.86)'; g.fill(); g.strokeStyle = cur ? '#7dffa0' : '#3a6ea5'; g.lineWidth = cur ? 5 : 2; g.stroke();
    g.fillStyle = used ? '#8a8f96' : '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold ' + (wheel.items.length > 6 ? 13 : 15) + 'px sans-serif'; const words = (used ? 'USED' : tools ? toolLabel(k, text) : text).split(' & '); words.forEach((w, i) => g.fillText(w + (i < words.length - 1 ? ' &' : ''), 128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84 + (i - (words.length - 1) / 2) * 16)); }
  g.beginPath(); g.arc(128, 128, 30, 0, 7); g.fillStyle = '#0c1118'; g.fill(); if (wheel.title) { g.fillStyle = '#7dffa0'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(wheel.title, 128, 129); } wheel.tex.needsUpdate = true;
}
function openWheel(h, items = WEDGE, kind = 'tools', title = '') { wheel.items = items; wheel.kind = kind; wheel.title = title; wheel.open = true; wheel.hand = h; wheel.mesh.position.copy(h.pos); wheel.mesh.lookAt(head.pos); wheel.mesh.updateMatrixWorld(true); wheel.mesh.visible = true; wheel.sel = undefined; drawWheel(null); buzz(h, 0.4, 20); }
function wheelPick(h) {
  const p = wheel.mesh.worldToLocal(v1.copy(h.pos)); if (Math.hypot(p.x, p.y) < 0.04) return null;
  const a = Math.atan2(-p.y, p.x) * 180 / Math.PI; let best = null, bd = 999; for (const [k, , deg] of wheel.items) { let d = Math.abs(a - deg) % 360; if (d > 180) d = 360 - d; if (d < bd) { bd = d; best = k; } } return best;
}
function closeWheel(h) { const k = wheelPick(h); wheel.open = false; wheel.mesh.visible = false; if (wheel.kind === 'orders') { hideOrderAim(); if (k) { giveOrder(k, wheel.target); buzz(h, 0.6, 30); } return; } if (k === 'nvg') toggleNVG(); else if (k === 'med') useMed(); else if (k) { S.tool = k; sfx.click(); buzz(h, 0.6, 30); } }

// ---------- squad orders (SWAT bots) ----------
// Point at something (free hand in VR, crosshair otherwise) and open the order wheel: the orders that fit what you point at, plus
// FOLLOW ME and HOLD. VR: hold Y/B (a tap still shouts). Desktop: hold G, move the mouse toward an order, let go. Phone: SQUAD.
const ORD = { follow: 'FOLLOW ME', hold: 'HOLD', move: 'MOVE THERE', open: 'OPEN', pick: 'PICK LOCK', kick: 'KICK', breach: 'BREACH & CLEAR', unwire: 'CUT WIRE', defuse: 'DEFUSE', detain: 'DETAIN', revive: 'REVIVE' };
const BOT_ST = ['FOLLOW', 'HOLD', 'MOVING', 'DOOR', 'BOMB', 'DETAIN', 'REVIVE', 'FIGHT'];
const BSAY = { reload: ['RELOADING', 'Reloading!'], follow: ['ON YOU', 'Moving with you'], hold: ['HOLDING', 'Holding here'], onit: ['COPY', 'Copy'], contact: ['CONTACT!', 'Contact!'], up: ["YOU'RE GOOD", 'Get up, you are good'], cuffed: ['RESTRAINED', 'Restrained'], bomb: ['ON THE BOMB', 'Working the bomb'], defused: ['BOMB SAFE', 'Bomb is safe'], wire: ['WIRE ON THE DOOR', 'Tripwire, cutting it'], nowire: ['NO WIRE', 'Door is clean'], locked: ['LOCKED', 'It is locked'], flash: ['FLASHBANG OUT', 'Flashbang out'], clear: ['CLEAR', 'Room clear'], leave: ['HANDING OVER', ''] };
const botsUp = () => S.phase === 'active' && !M.training && S.me.team !== 'tango' && [...S.officers.values()].some(o => o.bot && !o.down);
const orderMark = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 28), new THREE.MeshBasicMaterial({ color: 0x40ff80, depthTest: false, fog: false, transparent: true })); orderMark.renderOrder = 996; orderMark.visible = false; scene.add(orderMark);
// while Y/B is held: a green laser from the hand and a ring on whatever it points at, with its name; let go to lock it and open the wheel
const orderLaser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x40ff80, depthTest: false, fog: false, transparent: true, opacity: 0.8 })); orderLaser.renderOrder = 996; orderLaser.visible = false; orderLaser.frustumCulled = false; scene.add(orderLaser);
const orderTag = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false })); sp.scale.set(0.5, 0.125, 1); sp.renderOrder = 997; sp.visible = false; scene.add(sp); sp.userData = { c, t, txt: '' }; return sp; })();
function markOrder(T) {
  if (!T || T.kind === 'none') { orderMark.visible = orderTag.visible = false; return; }
  const far = Math.max(1, head.pos.distanceTo(v1.set(T.x, T.y, T.z)) / 4), sc = (T.kind === 'door' ? 1.7 : T.kind === 'bomb' ? 0.8 : T.kind === 'spot' ? 1 : 1.3); orderMark.scale.setScalar(sc * far); orderMark.visible = true;   // bigger with distance so it stays easy to see
  orderMark.position.set(T.x, T.kind === 'spot' ? T.y + 0.05 : T.y, T.z); if (T.kind === 'spot') orderMark.rotation.set(-Math.PI / 2, 0, 0); else orderMark.lookAt(head.pos);
  const u = orderTag.userData, txt = T.kind === 'door' ? (S.doorOpen[T.d] ? 'OPEN DOOR' : S.doorLocked[T.d] ? 'LOCKED DOOR' : 'DOOR') : T.name;
  if (u.txt !== txt) { u.txt = txt; const g = u.c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.fillStyle = 'rgba(8,20,12,0.75)'; g.fillRect(0, 8, 256, 48); g.fillStyle = '#7dffa0'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 33); u.t.needsUpdate = true; }
  orderTag.scale.set(0.9 * far, 0.225 * far, 1); orderTag.position.set(T.x, T.y + (0.32 * sc + 0.12) * far, T.z); orderTag.visible = true;
}
function aimOrders(h) {   // the live pointer, every frame the button is held
  const o = h.pos, d = v2.set(0, 0, -1).applyQuaternion(h.quat).clone(), T = orderTarget(o.clone(), d); wheel.target = T; markOrder(T);
  const end = T.kind === 'none' ? o.clone().addScaledVector(d, 8) : new THREE.Vector3(T.x, T.y, T.z), pa = orderLaser.geometry.attributes.position;
  pa.setXYZ(0, o.x, o.y, o.z); pa.setXYZ(1, end.x, end.y, end.z); pa.needsUpdate = true; orderLaser.visible = true; return T;
}
function hideOrderAim() { orderLaser.visible = false; orderMark.visible = false; orderTag.visible = false; }
function orderTarget(o, d) {   // o, d: THREE.Vector3 ray
  let best = null, bs = 1e9; const v = new THREE.Vector3();
  const consider = (T, x, y, z, maxAng, maxD) => { v.set(x - o.x, y - o.y, z - o.z); const dist = v.length(); if (dist > maxD || dist < 0.2) return; v.normalize(); const a = v.angleTo(d); if (a > maxAng) return; const sc = a + dist * 0.004; if (sc >= bs) return;
    if (rayStatic(level, S.doorOpen, o.x, o.y, o.z, v.x, v.y, v.z, dist) < dist - 0.6) return;   // only what you can see: not a door behind a wall
    bs = sc; best = Object.assign(T, { x, y, z }); };
  S.bombs.forEach((b, i) => { if (!b.defused) consider({ kind: 'bomb', b: i, name: 'BOMB' }, b.g.position.x, b.g.position.y, b.g.position.z, 0.18, 20); });
  level.doors.forEach((D, i) => { if (!D.hidden && Math.abs(D.y - (head.pos.y - 1.6)) < 2) consider({ kind: 'door', d: i, name: 'DOOR' }, D.cx, D.y + 1.1, D.cz, 0.26, 18); });
  for (const [id, a] of S.actors) { const st = a.st; if (a.kind === 'c' ? (st === 'u' || st === 'd' || st === 'x') : !(st === 's' || st === 'k' || st === 'i')) continue; const p = a.g.position; consider({ kind: 'npc', n: id, name: a.kind === 'c' ? 'HOSTAGE' : 'SUSPECT' }, p.x, p.y + (st === 'i' ? 0.3 : 1.0), p.z, 0.16, 20); }
  for (const [id, of] of S.officers) if (of.down && of.team !== 'tango') { const p = of.head.position; consider({ kind: 'down', p: id, name: of.name }, p.x, p.y, p.z, 0.2, 20); }
  if (best) return best;
  const t = rayStatic(level, S.doorOpen, o.x, o.y, o.z, d.x, d.y, d.z, 30); if (t < 30) { const x = o.x + d.x * (t - 0.3), z = o.z + d.z * (t - 0.3), y = level.groundY(x, z, o.y + d.y * t + 0.3); return { kind: 'spot', name: 'HERE', x, y, z }; }
  return { kind: 'none', name: '' };
}
function orderList(T) {
  const k = T.kind === 'door' ? (S.doorOpen[T.d] ? ['breach'] : [...(S.doorTrap[T.d] ? ['unwire'] : []), 'open', ...(S.doorLocked[T.d] ? ['pick'] : []), 'kick', 'breach']) : T.kind === 'bomb' ? ['defuse'] : T.kind === 'npc' ? ['detain'] : T.kind === 'down' ? ['revive'] : T.kind === 'spot' ? ['move'] : [];
  const all = ['follow', 'hold', ...k], n = all.length; return all.map((key, i) => [key, ORD[key], -90 + i * 360 / n]);
}
function openOrders(h) { const o = h ? h.pos.clone() : head.pos.clone(), d = h ? new THREE.Vector3(0, 0, -1).applyQuaternion(h.quat) : head.fwd.clone(); const T = orderTarget(o, d); wheel.target = T; markOrder(T); return T; }
function giveOrder(k, T) { if (!k || !T) return; net.send({ t: 'order', k, d: T.d, b: T.b, n: T.n, p: T.p, x: T.x, y: T.y, z: T.z }); sfx.click(); }
// desktop / phone: the same wheel drawn as a ring of buttons over the screen
const OW = { open: false, mx: 0, my: 0, sel: null, items: [], T: null };
function openOW() {
  if (!botsUp()) { hint(head.pos.x + head.fwd.x * 1.5, head.pos.y, head.pos.z + head.fwd.z * 1.5, 'NO SQUAD BOTS'); return; }
  const T = openOrders(null), el = $('ow'); OW.T = T; OW.items = orderList(T); OW.open = true; OW.mx = OW.my = 0; OW.sel = null; el.innerHTML = '';
  const c = document.createElement('div'); c.className = 'owc'; c.textContent = T.name || 'SQUAD'; el.appendChild(c); c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); closeOW(false); });
  for (const [k, text, deg] of OW.items) { const b = document.createElement('div'), a = deg * Math.PI / 180; b.className = 'owb'; b.textContent = text; b.dataset.k = k; b.style.left = (150 + Math.cos(a) * 112 - 52) + 'px'; b.style.top = (150 + Math.sin(a) * 112 - 22) + 'px';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); OW.sel = k; closeOW(true); }); el.appendChild(b); }
  el.style.display = 'block';
}
function owMove(dx, dy) { OW.mx += dx; OW.my += dy; if (Math.hypot(OW.mx, OW.my) < 30) OW.sel = null; else { const a = Math.atan2(OW.my, OW.mx) * 180 / Math.PI; let bd = 999; for (const [k, , deg] of OW.items) { let d = Math.abs(a - deg) % 360; if (d > 180) d = 360 - d; if (d < bd) { bd = d; OW.sel = k; } } } for (const b of $('ow').querySelectorAll('.owb')) b.classList.toggle('on', b.dataset.k === OW.sel); }
function closeOW(pick) { if (!OW.open) return; OW.open = false; $('ow').style.display = 'none'; hideOrderAim(); if (pick && OW.sel) giveOrder(OW.sel, OW.T); }
function botSay(e) { const o = S.officers.get(e.p), L = BSAY[e.k]; if (!o || !L) return; const p = o.head.position; sayAt(p.x, p.y + 0.5, p.z, o.name + ': ' + L[0], '#a8ffb8');
  const now = performance.now(); if (now - (botSay.t[e.k] || 0) < 900) return;   // one voice per call-out: the whole squad answering "copy" at once is a mess
  if (sfx.vo('vo_o_' + e.k, p, 1.4)) { botSay.t[e.k] = now; return; }   // recorded radio line (SWAT walkie-talkie pack)
  if (L[1] && (e.k !== 'contact' || p.distanceTo(head.pos) < 25)) { botSay.t[e.k] = now; sfx.say(L[1], 0.9 + (o.slot || 0) * 0.08); } }
botSay.t = {};

// ---------- panels ----------
const BOARD_K = 1.3;   // quest-store: the start menu and mission board on the wall are drawn 30% larger (easier to read in the headset)
class Panel {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 1024; this.c.height = 768; this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ map: this.tex, fog: false, toneMapped: false })); scene.add(this.mesh);
    this.cursor = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ff80, depthTest: false })); this.cursor.renderOrder = 999; this.cursor.visible = false; scene.add(this.cursor);
    this.btns = []; this.key = '';
  }
  // btns: [[label, action], ...] stacked upward from the bottom edge
  draw(title, sub, lines, btns) {
    const key = title + sub + lines.join('|') + btns.join('|'); if (key === this.key) return; this.key = key;
    const g = this.c.getContext('2d'); g.fillStyle = '#0c1118'; g.fillRect(0, 0, 1024, 768); g.strokeStyle = '#3a6ea5'; g.lineWidth = 6; g.strokeRect(6, 6, 1012, 756);
    g.fillStyle = '#e8eef5'; let tf = 64; g.font = 'bold 64px sans-serif'; while (tf > 30 && g.measureText(title).width > 960) { tf -= 2; g.font = 'bold ' + tf + 'px sans-serif'; } g.textAlign = 'center'; g.fillText(title, 512, 86); g.font = '30px sans-serif'; g.fillStyle = '#8fb4dc'; g.fillText(sub, 512, 134);
    // quest-store: the text lines squeeze (closer, then smaller) to fit above the buttons instead of running under them
    const nb = btns.length, rowsB = nb <= 3 ? nb : Math.ceil((nb - 1) / (nb - 1 > 8 ? 3 : 2)) + 1, topB = 676 - (rowsB - 1) * 86, room = topB - 18 - 190, step = lines.length > 1 ? Math.min(39, room / (lines.length - 1)) : 39, fs = Math.max(17, Math.min(28, Math.round(step * 0.74)));
    g.textAlign = 'left'; g.font = fs + 'px sans-serif';
    lines.forEach((l, i) => { const [a, b] = Array.isArray(l) ? l : [l, null]; g.fillStyle = b != null && b < 0 ? '#ff8a8a' : '#d5dde6'; g.fillText(a, 60, 190 + i * step); if (b != null) { g.textAlign = 'right'; g.fillText((b > 0 ? '+' : '') + b, 964, 190 + i * step); g.textAlign = 'left'; } });
    // up to three buttons stack full width; more than that, the settings go two to a row and the last (START) runs full width
    if (btns.length <= 3) this.btns = btns.map(([text, act], i) => ({ x: 232, y: 676 - (btns.length - 1 - i) * 86, w: 560, h: 74, text, act }));
    else { const n = btns.length - 1, cols = n > 8 ? 3 : 2, rows = Math.ceil(n / cols), bw = cols === 3 ? 292 : 447; this.btns = btns.slice(0, n).map(([text, act], i) => ({ x: 60 + (i % cols) * (bw + (cols === 3 ? 14 : 10)), y: 676 - 86 * (rows - Math.floor(i / cols)), w: bw, h: 74, text, act })); const [t, a] = btns[n]; this.btns.push({ x: 60, y: 676, w: 904, h: 74, text: t, act: a }); }   // more than 8 settings: three to a row
    for (const b of this.btns) { g.fillStyle = b.act === 'close' || b.act === 'wx' || b.act === 'gfx' || b.act === 'tod' || b.act === 'home' || /back$/.test(b.act) ? '#39424e' : b.act === 'team' ? (S.me.team === 'tango' ? '#8a2a1f' : '#1f4a8a') : '#1f7a3d'; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; let f = 38; g.font = 'bold ' + f + 'px sans-serif'; while (f > 18 && g.measureText(b.text).width > b.w - 24) { f -= 2; g.font = 'bold ' + f + 'px sans-serif'; } g.textAlign = 'center'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    this.tex.needsUpdate = true;
  }
  place(x, y, z, tx, tz, k) { if (k) this.mesh.scale.setScalar(k); this.mesh.position.set(x, y, z); this.mesh.lookAt(tx, y, tz); this.mesh.updateMatrixWorld(true); }
  // returns null = miss, '' = on the panel, or the action of the button under the ray; moves the cursor
  probe(o, d, show) {
    if (!this.mesh.visible) return null;
    const n = v3.set(0, 0, 1).applyQuaternion(this.mesh.quaternion), den = d.dot(n); if (den > -1e-4) return null;
    const t = v4.copy(this.mesh.position).sub(o).dot(n) / den; if (t < 0 || t > 30) return null;
    const p = v4.copy(d).multiplyScalar(t).add(o); if (show) this.cursor.position.copy(p);
    this.mesh.worldToLocal(p); const u = (p.x / 1.6 + 0.5) * 1024, w = (0.5 - p.y / 1.2) * 768; if (u < 0 || u > 1024 || w < 0 || w > 768) return null;
    if (show) this.cursor.visible = true; for (const b of this.btns) if (u > b.x && u < b.x + b.w && w > b.y && w < b.y + b.h) return b.act; return '';
  }
}
const panel = new Panel();
const storeUI = makeStoreUI({ panel, S, voice, net, sfx, status, notify: t => hint(head.pos.x + head.fwd.x * 1.2, head.pos.y - 0.1, head.pos.z + head.fwd.z * 1.2, t), back: Object.assign(() => toggleMenu(true), { lobby: () => showLobbyPanel() }), placeBoard: () => { const P = M.lobby; panel.place(P.x, P.y, P.z, P.tx, P.tz, BOARD_K); },
  play: (solo, name, room, tut) => { nameIn.value = name; roomIn.value = room; if (tut) TUT = true; initAudio(); return connect(solo); } });
const coach = new Panel(); coach.mesh.scale.setScalar(0.7); coach.mesh.visible = false;   // the tutorial's own panel (VR)
const tut = window.__tut = createTutorial({ THREE, scene, S, M: () => M, head, coach, sfx,
  hits: () => trainLine().hits, mag: k => guns[k].st.mag, yaw: () => S.mode === 'vr' ? head.yaw : S.yaw, holding: k => hands.some(h => h.item === k), botsUp: () => botsUp(),
  groundY: (x, z) => level.groundY(x, z, S.feetY + 0.5), say: t => sayAt(head.pos.x + head.fwd.x * 1.2, head.pos.y + 0.2, head.pos.z + head.fwd.z * 1.2, t, '#7dffa0'),
  toTraining: () => net.send({ t: 'restart', wx: S.wxPick, map: 'training' }),
  pickMission: (m, wx, tod) => { S.nextMap = m; S.wxPick = wx; S.todPick = tod; net.send({ t: 'choose', m, wx, tod }); showLobbyPanel(); } });
// PvP: each player picks a side on the board; one terrorist is enough to make the next mission a PvP round
const pvpOn = () => (S.squadT || []).some(t => t === 'tango');
const teamBtn = () => ['TEAM: ' + (S.me.team === 'tango' ? 'TERRORIST' : 'SWAT'), 'team'];
const squadLine = () => (pvpOn() ? 'PvP  -  ' : 'Squad: ') + ((S.squad || []).map((n, i) => n + ((S.squadT || [])[i] === 'tango' ? ' (T)' : pvpOn() ? ' (SWAT)' : '')).join(', ') || '-');
function showLobbyPanel() {
  if (S.menu) return;
  if (S.watch) { if (storeUI.holdsPanel()) return storeUI.redraw(); panel.mesh.visible = false; S.panel = null; return; }   // spectators get no boards: B or Y opens their menu
  if (storeUI.holdsPanel()) return storeUI.redraw(); if (S.panel === 'fit' && M.training) return showFit(false); if (M.training) return showBoard(); S.panel = 'lobby'; panel.mesh.visible = true; const P = M.lobby; panel.place(P.x, P.y, P.z, P.tx, P.tz, BOARD_K);
  panel.draw("YOU CAN'T HIDE", M.op + '  -  ' + (S.net === 'online' ? 'Room ' + S.room : S.net === 'solo' ? 'Offline (no connection)' : 'connecting'),
    [squadLine(), ...M.brief, 'Free hand: grip/trigger = doors, stick click = KICK,', 'HOLD A/X = TOOL WHEEL, tap = light, tap B/Y = SHOUT, hold = SQUAD. Helmet = NVG.',
      'Gun hand A/X: drop mag  B/Y: bolt  stick: semi/auto. Radio: MENU', M.hint ? M.hint : M.id === 'mansion' ? 'Lights out: MAIN BREAKER in the basement plant room.' : M.id === 'grandprix' ? 'Lights out: MAIN BREAKER in the electrical room behind the garages.' : M.id === 'airport' ? 'Lights out: MAIN BREAKER in the electrical room behind airport police.' : 'Lights out: MAIN BREAKER in the operations building.'], [['MAP: ' + M.name + (M.test ? ' (TEST)' : ''), 'map'], ['WEATHER: ' + S.wxPick.toUpperCase(), 'wx'], ...(M.tods ? [['TIME: ' + S.todPick.toUpperCase(), 'tod']] : []), teamBtn(), ...(storeUI.store ? [['MAIN MENU', 'home']] : []), ['START ' + (pvpOn() ? 'PVP ' : '') + 'MISSION', 'start']]);
}
// the mission board in the training room, in two steps (quest-store, 22 Nov): 1. pick the mission (built-in, published, a friend's
// map, or the map editor); 2. its options (weather, time where the map has it, team) and START MISSION. Online, the room owner picks;
// everyone else sees the choice. BODY FIT and TUTORIAL are on the main menu.
const BOARD_PAGE = 6;
function showBoard() {
  S.panel = 'lobby'; panel.mesh.visible = true; const P = M.lobby; panel.place(P.x, P.y, P.z, P.tx, P.tz, BOARD_K); const T = trainLine(), cu = S.customList.find(c => c.id === S.nextMap), nx = MAPS[S.nextMap] || (cu ? { name: cu.name + ' (LOADING)', op: cu.name + '  (by ' + cu.creator + ')' } : MAPS[MISSION_IDS[0]]);
  const sub = 'Training facility  -  ' + (S.net === 'online' ? 'Room ' + S.room : S.net === 'solo' ? (TUT ? 'Tutorial' : 'Offline') : 'connecting'), range = 'Range: hits ' + T.hits + '/' + T.shots + ' (' + T.acc + '%)   kill house ' + T.run + ' (best ' + T.best + ')';
  const label = (id, m) => (m ? m.name + (m.test ? ' (TEST)' : '') : id) + storeUI.lockTag(id).replace('   [FULL GAME]', ' [FULL]');
  if (!storeUI.isOwner()) return panel.draw('MISSION BOARD', sub, [squadLine(), 'Next: ' + nx.op + '  (' + nx.name + ')', 'Weather ' + S.wxPick.toUpperCase() + (nx.tods ? ', time ' + S.todPick.toUpperCase() : ''), '', 'The room owner picks the mission and starts it.', range], [teamBtn(), ['MAP EDITOR', 'edit']]);
  if (S.bstep !== 'opts') {   // step 1: which mission
    const ids = [...missions(), ...S.customList.map(c => c.id).filter(id => !MISSION_IDS.includes(id))], pages = Math.max(1, Math.ceil(ids.length / BOARD_PAGE)); S.bpage = ((S.bpage | 0) % pages + pages) % pages;
    const page = ids.slice(S.bpage * BOARD_PAGE, S.bpage * BOARD_PAGE + BOARD_PAGE).map(id => [label(id, MAPS[id] || (S.customList.find(c => c.id === id) || {})), 'pick:' + id]);
    return panel.draw('PICK A MISSION', sub + (pages > 1 ? '   ·   page ' + (S.bpage + 1) + ' of ' + pages : ''), [squadLine(), range], [...page, ["FRIEND'S MAP", 'st:friend'], ...(pages > 1 ? [['MORE MISSIONS', 'bpage']] : []), ...(S.mode === 'vr' ? [['MAP EDITOR', 'edit']] : [])]);
  }
  // step 2: its options, then go
  panel.draw('MISSION OPTIONS', sub, [squadLine(), 'Mission: ' + nx.op + '  (' + nx.name + ')' + storeUI.lockTag(S.nextMap), ...(nx.test ? ['Test map  ·  test mode ' + (TEST.ok ? (TEST.off ? 'OFF' : 'ON') : 'NOT SET') + '  ·  build ' + BUILD] : []), range],
    [['WEATHER: ' + S.wxPick.toUpperCase(), 'wx'], ...(nx.tods ? [['TIME: ' + S.todPick.toUpperCase(), 'tod']] : []), teamBtn(), ['CHANGE MISSION', 'bmaps'], ...(S.nextMap.startsWith('s_') ? [['REPORT THIS MAP', 'st:freport']] : []), ['START ' + (pvpOn() ? 'PVP ' : '') + 'MISSION', 'start']]);
}
function pickMission(id) {
  sfx.click(); S.nextMap = id; S.bstep = 'opts'; showLobbyPanel();
  ensureCustom(id).then(ok => { if (ok && S.nextMap === id) { net.send({ t: 'choose', m: id }); showLobbyPanel(); } });
}
// BODY FIT (training board, VR): slide your own body forward/back and up/down under the headset; kept on this device
const FIT0 = { d: SELF_BACK.d, up: 0, gear: 0, gup: 0 };
try { const f = JSON.parse(localStorage.getItem('bl_fit') || 'null'); if (f && Number.isFinite(f.d) && Number.isFinite(f.up)) { SELF_BACK.d = f.d; SELF_BACK.up = f.up; SELF_BACK.gear = Number.isFinite(f.gear) ? f.gear : Number.isFinite(f.nade) ? f.nade : 0; SELF_BACK.gup = Number.isFinite(f.gup) ? f.gup : 0; } } catch (e) { }
function fitStep(k) {
  if (k === 'reset') { SELF_BACK.d = FIT0.d; SELF_BACK.up = FIT0.up; SELF_BACK.gear = FIT0.gear; SELF_BACK.gup = FIT0.gup; }
  else { const [key, dv] = { fwd: ['d', -0.02], back: ['d', 0.02], up: ['up', 0.02], down: ['up', -0.02], nfwd: ['gear', 0.02], nback: ['gear', -0.02], gup: ['gup', 0.02], gdown: ['gup', -0.02] }[k]; SELF_BACK[key] = Math.round(Math.max(-0.2, Math.min(0.3, SELF_BACK[key] + dv)) * 100) / 100; }
  try { localStorage.setItem('bl_fit', JSON.stringify({ d: SELF_BACK.d, up: SELF_BACK.up, gear: SELF_BACK.gear, gup: SELF_BACK.gup })); } catch (e) { } sfx.click();
}
function showFit(place = true) {
  S.panel = 'fit'; panel.mesh.visible = true; if (place) frontOfHead(1.1);
  const cm = v => (v >= 0 ? '+' : '') + Math.round(v * 100) + ' cm';
  panel.draw('BODY FIT', 'Look down at yourself, then nudge the body until it sits right', ['Body  back ' + cm(SELF_BACK.d - FIT0.d) + ', up ' + cm(SELF_BACK.up) + '     Gear  forward ' + cm(SELF_BACK.gear) + ', up ' + cm(SELF_BACK.gup), 'GEAR moves everything on the vest and belt and where you grab it.'],
    [['BODY BACK', 'fit:back'], ['BODY FORWARD', 'fit:fwd'], ['BODY UP', 'fit:up'], ['BODY DOWN', 'fit:down'], ['GEAR FORWARD', 'fit:nfwd'], ['GEAR BACK', 'fit:nback'], ['GEAR UP', 'fit:gup'], ['GEAR DOWN', 'fit:gdown'], ['RESET', 'fit:reset'], ['DONE', 'fit:done']]);
}
function showEndPanel() {
  const R = S.report; if (!R || S.menu) return; S.panel = 'end'; panel.mesh.visible = true; frontOfHead(1.9);
  const tm = Math.floor(R.time / 60) + ':' + String(R.time % 60).padStart(2, '0');
  panel.draw(R.result, R.pvp ? (R.winner === S.me.team ? 'YOUR SIDE WON' : 'YOUR SIDE LOST') + '   Time ' + tm : 'Grade ' + R.grade + '   Score ' + R.total + '/100   Time ' + tm, R.lines, [...(S.edTest ? [['BACK TO THE EDITOR', 'edit']] : []), ['RESTART', 'start'], ['TRAINING', 'train']]);
}
function frontOfHead(d) { const f = v1.copy(head.fwd).setY(0).normalize(); panel.place(head.pos.x + f.x * d, Math.max(head.pos.y, S.feetY + 1.2), head.pos.z + f.z * d, head.pos.x, head.pos.z, 1); }
// back to the start screen (or, testing a draft, to the editor): leave VR first, then reload the page fresh
// quest-store: MAIN MENU inside VR goes back to the start menu (SOLO / ONLINE / TUTORIAL) without leaving VR. It used to end the
// VR session and reload the page, which drops you out of the headset view. The room is left, the world goes back to the
// training facility, the microphone is kept (asking for it again would take the headset out of VR).
function backToStart() {
  sfx.click(); try { voice.stop(true); } catch (e) { } try { tut.stop(); } catch (e) { } TUT = false;
  net.leave(); connecting = null; S.net = 'offline'; S.watch = false; S.bstep = 'maps'; S.bpage = 0; voice.listenOnly = false; S.phase = 'lobby'; S.rope = null; S.fly = null; S.tmenu = false; S.me.down = false; S.me.hp = 100;
  for (const o of S.officers.values()) scene.remove(o.g); S.officers.clear();
  applyInit({ map: 'training', npcs: [], bombs: [], ph: 'lobby' });
  begin('vr'); storeUI.showStart(); status('Back at the start menu.');
}
function goHome() { if (renderer.xr.isPresenting && !DRAFT) return backToStart(); const to = DRAFT ? 'editor.html' : 'play.html'; sfx.click(); try { voice.stop(); } catch (e) { } const s = renderer.xr.getSession && renderer.xr.getSession(); if (s) s.end().catch(() => { }).finally(() => { location.href = to; }); else location.href = to; }
function toggleMenu(open = !S.menu) {
  S.menu = open; sfx.beep(null, open ? 900 : 600);
  if (open && S.watch) { panel.mesh.visible = true; frontOfHead(1.3); panel.draw('SPECTATING', 'Room ' + S.room, ['You are watching: nobody sees or hears you.', 'Left stick: fly where you look (push all the way: faster).', 'Right stick: up / down, and turn.', 'Point at a button and pull the trigger.'], [[gfxLabel(), 'gfx'], ['MAIN MENU', 'home'], ['CLOSE', 'close']]); return; }
  if (open) { panel.mesh.visible = true; frontOfHead(1.3); const mb = [['SUPPRESSOR: ' + (SUPP.on ? 'ON' : 'OFF'), 'supp'], ...(S.net === 'online' && voice.on && DBG.on ? [[voice.mic ? (voice.muted ? 'MIC: MUTED' : 'MIC: ON') : 'MIC: NONE', 'mic']] : []), ...(S.phase === 'active' ? [['END MISSION', 'end']] : []), ...storeUI.menuButtons(), ['RESTART MISSION', 'start'], [gfxLabel(), 'gfx'], ...(S.edTest && S.mode === 'vr' ? [['BACK TO THE MAP EDITOR', 'edit']] : []), [DRAFT ? 'BACK TO EDITOR' : storeUI.store ? 'MAIN MENU' : 'HOME SCREEN', 'home'], ['CLOSE', 'close']];
    const ml = ['Restart deals a new mission for the whole squad:', 'new suspect, hostage and bomb positions.', 'End Mission scores what is done now. Or walk out the gate.'];
    panel.draw('MENU', (S.net === 'online' ? 'Room ' + S.room : TUT ? 'Tutorial' : 'Offline') + (DBG.on ? '   ·   ' + perf.report() : ''), ml, mb); }
  else if (S.phase === 'ended') showEndPanel(); else if (S.phase === 'lobby' || M.training) showLobbyPanel(); else { panel.mesh.visible = false; S.panel = null; }
}
function tryPanel(o, d) {
  const ca = coach.probe(o, d, false); if (ca) return tut.act(ca); if (ca === '') return true;
  const act = panel.probe(o, d, false); if (!act) return act === '';
  if (act === 'tut') { sfx.click(); tut.showMenu(); return true; }
  if ((act === 'edit' || act === 'start') && storeUI.gate(act === 'edit' ? 'editor' : M.training ? S.nextMap : M.id)) { if (S.menu) { S.menu = false; } return true; }   // quest-store: demo limits (js/store/ui.js)
  if (act === 'edit') { if (S.menu) toggleMenu(false); openEditor(); return true; }   // a pull on the panel background is swallowed, not fired
  if (act === 'mic') { toggleMic(); toggleMenu(true); return true; }
  if (storeUI.act(act)) return true;
  if (act === 'home') { goHome(); return true; }
  if (act === 'gfx') { toggleGfx(); perf.fov = gfxMode() === 'quality' ? 0.35 : 1; applyGfx(world, renderer); toggleMenu(true); return true; }
  if (act === 'wx') { cycleWx(); if (S.menu) toggleMenu(true); else showLobbyPanel(); return true; }
  if (act === 'tod') { cycleTod(); showLobbyPanel(); return true; }
  if (act.startsWith('fit:')) { const k = act.slice(4); if (k === 'done') { sfx.click(); if (storeUI.store && !storeUI.started()) storeUI.showStart(); else { S.panel = 'lobby'; showLobbyPanel(); } } else { if (k !== 'open') fitStep(k); showFit(k === 'open'); } return true; }
  if (act === 'team') { pickTeam(); return true; }
  if (act === 'supp') { setSuppressor(!SUPP.on); sfx.click(); toggleMenu(true); return true; }   // quest-store: the pistol's suppressor
  if (act === 'map') { cycleMap(); return true; }
  if (act.startsWith('pick:')) { pickMission(act.slice(5)); return true; }
  if (act === 'bmaps') { sfx.click(); S.bstep = 'maps'; showLobbyPanel(); return true; }
  if (act === 'bpage') { sfx.click(); S.bpage = (S.bpage | 0) + 1; showLobbyPanel(); return true; }
  if (act === 'end') { net.send({ t: 'end' }); toggleMenu(false); return true; }
  if (act === 'train') { net.send({ t: 'restart', wx: S.wxPick, map: 'training' }); sfx.beep(null, 900); return true; }
  if (act === 'close') toggleMenu(false); else { net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() }); if (S.menu) toggleMenu(false); else sfx.beep(null, 900); }
  return true;
}

// wrist display (VR) + DOM HUD (desktop)
const wc = document.createElement('canvas'); wc.width = 512; wc.height = 352; const wtex = new THREE.CanvasTexture(wc); wtex.anisotropy = 4;
const WRIST_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));   // face +x (the palm side of a left hand), text up toward the fingers
const wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), new THREE.MeshBasicMaterial({ map: wtex, fog: false, toneMapped: false })); wrist.visible = false; scene.add(wrist);
let hudT = 0;
function hudText() {
  const t = Math.max(0, S.timer), mm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  if (M.training) { const T = trainLine(); return { mm: 'RANGE', hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: 'HITS ' + T.hits + '/' + T.shots + '  NO-SHOOT ' + T.ns + '  HOUSE ' + T.run + ' (best ' + T.best + ')', mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() }; }
  if (S.spec) return { mm, hp: S.me.hp, err: '', obj: 'DOWN - SPECTATING ' + S.spec, mags: S.me.team === 'tango' ? 'TERRORIST' : 'SWAT' };
  if (S.pvp && S.me.team === 'tango') return { mm, hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: 'TERRORIST  HOSTAGES RESCUED ' + S.secured + '/' + S.civs + '  BOMBS LIVE ' + (S.bombs.length - S.defused) + '  LOCKS ' + (S.me.locks || 0) + '  TRAPS ' + (S.me.traps || 0), mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() };
  for (const [id, o] of S.officers) { const talk = !o.bot && voice.level(id) > 0.12; if (talk && !o.talk) { o.talk = new THREE.Sprite(TALK_MAT); o.talk.scale.set(0.14, 0.14, 1); o.talk.position.y = 0.48; o.talk.renderOrder = 998; o.head.add(o.talk); } if (o.talk) o.talk.visible = talk; }
  const squad = [...S.officers.values()].filter(o => o.bot).map(o => o.name + ' ' + (o.down ? 'DOWN' : BOT_ST[o.bst] || '')).join('  ');
  return { mm, hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: (voiceLine() ? voiceLine() + '  ' : '') + (S.pvp ? 'SWAT  ' : '') + (squad ? squad + '  ' : '') + 'HOSTAGES ' + S.secured + '/' + S.civs + '  BOMBS ' + S.defused + '/' + S.bombs.length + (S.hvt ? '  HVT ' + S.hvt : '') + (S.wx !== 'clear' ? '  ' + S.wx.toUpperCase() : ''), mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() + '  ' + ({ hands: 'HANDS', pick: 'PICK', cutters: 'CUTTERS', cam: 'CAM' })[S.tool] + (S.nvg ? ' NVG' : '') + ' F' + S.me.fl + ' S' + S.me.sm };
}
function drawHud() {
  const h = hudText();
  if (S.mode === 'vr') {
    // wrist panel: 512 x 352. Timer and status figure on top, health bar, then one objective per line; long lines shrink to fit
    const g = wc.getContext('2d'), W = 512, fit = (t, x, y, w, px, bold) => { let f = px; g.font = (bold ? 'bold ' : '') + f + 'px monospace'; while (f > 12 && g.measureText(t).width > w) { f -= 1; g.font = (bold ? 'bold ' : '') + f + 'px monospace'; } g.fillText(t, x, y); };
    g.fillStyle = '#05080c'; g.fillRect(0, 0, W, 352); g.strokeStyle = '#1f3a2a'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, 348);
    g.textAlign = 'left'; g.fillStyle = S.phase === 'active' && S.timer < 60 ? '#ff5050' : '#7dffa0'; fit(S.phase === 'active' ? h.mm : S.phase.toUpperCase(), 18, 86, 360, 88, true);
    drawBody(g, 452, 12, 1.1, '');   // 44 x 81 px, above the health bar
    g.fillStyle = '#333'; g.fillRect(18, 104, 476, 22); g.fillStyle = h.hp > 40 ? '#40c060' : '#e04040'; g.fillRect(18, 104, 476 * h.hp / 100, 22);
    g.fillStyle = '#cfd8e3'; const lines = h.obj.split(/\s{2,}/).filter(Boolean); let y = 162;
    for (let k = 0; k < lines.length; k += 2) { fit(lines.slice(k, k + 2).join('   '), 18, y, 476, 32); y += 38; }
    fit(h.mags, 18, y, 476, 30); y += 36;
    if (h.err) { g.fillStyle = '#ff8060'; fit(h.err.slice(0, 70), 18, Math.min(y, 314), 476, 20); }
    g.fillStyle = S.net === 'online' ? '#7dffa0' : '#ffb060'; g.textAlign = 'right'; fit(S.net === 'online' ? 'ROOM ' + S.room : S.net.toUpperCase(), 494, 338, 300, 24); g.textAlign = 'left'; wtex.needsUpdate = true;
  } else if (S.mode === 'desktop') {
    const G = gunIn(hands[1]);
    $('hud').textContent = (S.phase === 'active' ? h.mm : S.phase.toUpperCase()) + '   HP ' + h.hp + '   ' + h.obj + '   ' + h.mags + (G ? (G.st.mag === null ? '   NO MAG' : G.st.locked ? '   BOLT OPEN' : !G.st.chamber ? '   CHAMBER EMPTY' : '') : '') + (S.me.down ? '   ** DOWN **' : '') + (S.me.w ? '   HIT: ' + PARTS.filter((p, i) => S.me.w & (1 << i)).join(',') : '') + (S.me.med ? '' : '   MED 1');
    if (S.touch) { $('bMic').style.display = S.net === 'online' && voice.on ? '' : 'none'; $('bMic').textContent = voice.mic ? (voice.muted ? 'MIC OFF' : 'MIC ON') : 'NO MIC'; $('bOrd').style.display = botsUp() ? '' : 'none'; $('tstart').style.display = S.phase !== 'active' || S.tmenu || M.training ? 'flex' : 'none'; $('tstart').classList.toggle('tr', !!M.training && !S.tmenu); $('bMap').textContent = M.training ? 'MISSION: ' + (MAPS[S.nextMap] || MAPS[MISSION_IDS[0]]).name : 'MAP: ' + M.name; $('bEnd').style.display = S.phase === 'active' && !M.training ? 'flex' : 'none'; $('bTool').textContent = tangoTools() && (S.tool === 'pick' || S.tool === 'cutters') ? toolLabel(S.tool, '') : ({ hands: 'HANDS', pick: 'PICK', cutters: 'CUTTER', cam: 'CAM' })[S.tool]; $('bFlash').textContent = 'FLASH ' + S.me.fl; $('bSmoke').textContent = 'SMOKE ' + S.me.sm; $('bMed').style.opacity = S.me.med ? 0.3 : 1; $('bWx').textContent = 'WEATHER: ' + S.wxPick.toUpperCase(); { const nx = M.training ? MAPS[S.nextMap] : M; $('bTod').style.display = $('tstart').style.display !== 'none' && nx && nx.tods ? 'flex' : 'none'; $('bTod').textContent = 'TIME: ' + S.todPick.toUpperCase(); } $('bTeam').style.display = $('tstart').style.display; $('bTeam').textContent = 'TEAM: ' + (S.me.team === 'tango' ? 'TERRORIST' : 'SWAT');  $('bMap').style.display = S.phase !== 'active' || M.training ? 'flex' : 'none'; $('bAim').classList.toggle('on', S.ads); }
  }
}

// ---------- server messages ----------
function applyInit(init) {
  if (ED.on) { ED.pendingInit = init; return; }   // the room moved on while you build: catch up when you leave the editor
  S.pvp = !!init.pvp; S.spawnAt = init.ph === 'active' && init.sp && init.sp[S.me.id] || null;
  if (init.rt != null) S.raceT = init.rt;
  if (init.map && (init.map !== M.id || (init.tod && init.tod !== world.tod))) { loadMap(init.map, init.tod); localStorage.setItem('bl_map', init.map); if (S.mode && S.watch) placeWatch(); else if (S.mode && S.phase !== 'active') placeAtSpawn(); }
  for (const a of S.actors.values()) scene.remove(a.g, a.blob); S.actors.clear(); for (const b of S.bombs) scene.remove(b.g); S.bombs = []; S.hvtId = 0;
  S.hvtIds = []; for (const [id, kind, v, hvt] of init.npcs) { const a = new Human(kind, v, id); scene.add(a.g, a.blob); S.actors.set(id, a); if (hvt) { S.hvtId = id; S.hvtIds.push(id); } }
  S.civs = init.npcs.filter(n => n[1] === 'c').length; if (S.night !== !!init.night || S.wx !== init.weather) { S.night = !!init.night; S.wx = init.weather || 'clear'; applyLook(); }
  for (const [x, y, z, wires, order, yaw] of init.bombs) { const b = new Bomb(x, y, z, wires, order, yaw); b.order = order; b.n = 0; scene.add(b.g); S.bombs.push(b); }
}
// Player-made maps: fetched from the library the first time anything names them, then registered like a built-in map.
const customLoads = new Map();
function ensureCustom(mid) {
  if (typeof mid !== 'string' || !(mid.startsWith('u_') || mid.startsWith('s_')) || MAPS[mid]) return Promise.resolve(true);
  if (!customLoads.has(mid)) customLoads.set(mid, fetch((mid[0] === 's' ? 'api/share/' : 'api/maps/') + mid.slice(2), { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error('map ' + r.status))).then(d => { registerMap(compileCustom(d, mid)); return true; }).catch(e => { customLoads.delete(mid); console.warn('custom map not loaded', e); return false; }));
  return customLoads.get(mid);
}
S.customList = [];
function loadCustomList() { return fetch('api/maps', { cache: 'no-store' }).then(r => r.ok ? r.json() : { maps: [] }).then(j => { S.customList = (j.maps || []).map(m => ({ id: 'u_' + m.id, name: String(m.name || '').toUpperCase(), creator: m.creator })); }).catch(() => { }); }
loadCustomList();
// quest-store: maps players share with friends (8-digit codes; js/store/ui.js has the keypad, src/worker.js the library)
storeUI.friendMap = code => ensureCustom('s_' + code).then(ok => { if (!ok) return false; S.nextMap = 's_' + code; S.bstep = 'opts'; net.send({ t: 'choose', m: S.nextMap }); showLobbyPanel(); return true; });
storeUI.reportMap = () => { const id = S.nextMap; if (!id.startsWith('s_')) return; fetch('api/share/' + id.slice(2) + '/report', { method: 'POST' }).catch(() => { });
  S.nextMap = MISSION_IDS[0]; net.send({ t: 'choose', m: S.nextMap }); status('Map reported. It is hidden from everyone until it has been looked at.'); showLobbyPanel(); };
// a message about a map we have not got yet waits (with everything after it) until the map has arrived
let msgGate = null;
function onMsg(m) {
  if (msgGate) { msgGate.push(m); return; }
  const mid = (m.t === 'init' || m.t === 'welcome') && m.init && m.init.map;
  if (typeof mid === 'string' && mid.startsWith('u_') && !MAPS[mid]) { msgGate = [m]; ensureCustom(mid).then(() => { const q = msgGate; msgGate = null; for (const x of q) onMsg(x); }); return; }
  onMsg2(m);
}
function onMsg2(m) {
  if (m.t === 'sig') { voice.signal(m.from, m.data); return; }
  if (storeUI.onMsg(m)) return;
  if (m.t === 'welcome' && m.spec) { S.watch = true; S.me.id = m.id; applyInit(m.init); placeWatch(); showLobbyPanel(); status('Spectating room ' + S.room + '. Left stick flies, right stick up and down; B or Y: menu.'); return; }   // quest-store: spectate
  if (m.t === 'welcome') { S.watch = false; S.bstep = 'maps'; S.bpage = 0; const want = M.id; S.me.id = m.id; S.me.slot = m.slot; applyInit(m.init); placeAtSpawn(); resetLoadout(); if (m.n === 1 && (m.ph !== 'active' || m.init.map === 'training') && want !== m.init.map) net.send({ t: 'map', m: want }); }   // first in an empty room: it loads the map you picked
  else if (m.t === 'init') { applyInit(m.init); if (S.phase !== 'active' || M.training) showLobbyPanel(); }
  else if (m.t === 'full') status('That room is full (4 officers). Try another code.');
  else if (m.t === 's') applySnap(m);
}
function applySnap(m) {
  const prev = S.phase; S.phase = m.ph; S.timer = m.tm; S.extract = m.X || 0; if (S.mode && performance.now() - (S.startAt || 0) > 2000 && level.objective(head.pos.x, head.pos.z)) S.everInside = true; if (m.ph !== 'active') S.everInside = false; let sec = 0;
  S.hvt = ''; for (const [id, x, y, z, yaw, st, armed] of m.N) { const a = S.actors.get(id); if (a) a.target(x, y, z, yaw, st, armed); if (id > 100 && st === 'u') sec++; if (S.hvtIds.length === 1 && id === S.hvtId) S.hvt = st === 'u' || st === 'j' ? 'ARRESTED' : st === 'd' ? 'DOWN' : 'AT LARGE'; }
  if (S.hvtIds.length > 1) { const done = m.N.filter(r => S.hvtIds.includes(r[0]) && (r[5] === 'u' || r[5] === 'j' || r[5] === 'd')).length; S.hvt = done + '/' + S.hvtIds.length; }
  for (const a of S.actors.values()) a.g.visible = a.blob.visible = m.ph !== 'lobby'; for (const b of S.bombs) b.g.visible = m.ph !== 'lobby';
  S.secured = sec; for (let i = 0; i < S.doorOpen.length; i++) { S.doorOpen[i] = m.D[i] === '1'; S.doorLocked[i] = m.L[i] === '1'; }
  S.defused = 0; m.B.forEach((b, i) => { const o = S.bombs[i]; if (o) { o.set(b[0], b[1]); o.n = b[2]; } if (b[1]) S.defused++; });
  const seen = new Set(); S.squad = m.P.map(p => p[1]); S.squadT = m.P.map(p => p[9] & 2048 ? 'tango' : 'swat');
  if (m.pw != null && S.night === !!m.pw) { S.night = !m.pw; applyLook(); }
  if (m.T) for (let i = 0; i < S.doorTrap.length; i++) { const v = +m.T[i]; S.doorTrap[i] = v; const d = world.doors[i]; d.trap.visible = v > 0 && m.ph === 'active'; if (v) { const o = (v === 1 ? 0.3 : -0.3); d.trap.position.set(level.doors[i].x0 + (d.horiz ? 0 : o), level.doors[i].y, level.doors[i].z0 + (d.horiz ? o : 0)); } }
  nadeView(m.G || [], m.SM || []);
  for (const [id, name, , hp, down, h, l, r, g, w] of m.P) {
    if (id === S.me.id) { const tm = w & 2048 ? 'tango' : 'swat'; if (tm !== S.me.team) { S.me.team = tm; myBody.setTeam(tm); } S.me.locks = w >> 13 & 3; S.me.traps = w >> 15 & 3; const hd = !!(w & 4096); if (hd !== !!S.me.holding) { S.me.holding = hd; if (!hd) for (const q of hands) q.shield = false; } S.me.hp = hp; S.me.down = !!down; S.me.w = w & 63; S.me.med = !!(w & 64); S.me.fl = w >> 7 & 3; S.me.sm = w >> 9 & 3; continue; }
    seen.add(id); let o = S.officers.get(id); const bot = !!(w & 1 << 17); if (!o) { o = new Officer(name, label(bot ? name + ' (AI)' : name, bot ? '#a8ffb8' : '#9fd0ff', 0, 64, 0.07)); scene.add(o.g); S.officers.set(id, o); }
    o.set(h, l, r, g, down); o.down = !!down; o.id = id; o.name = name; o.team = w & 2048 ? 'tango' : 'swat'; o.body.setTeam(o.team); o.bot = bot; o.bst = w >> 18 & 7; o.slot = id - 900;
  }
  for (const [id, o] of S.officers) if (!seen.has(id)) { scene.remove(o.g); S.officers.delete(id); }
  voice.sync(S.me.id, [...[...S.officers.entries()].filter(([, o]) => !o.bot).map(([id]) => id), ...(S.watch ? [] : storeUI.specIds())], S.net === 'online');   // spectators: they hear the players, nobody hears them
  if (m.R) S.report = m.R;
  if (m.RT != null) { const d = m.RT - S.raceT; S.raceT = Math.abs(d) > 0.6 ? m.RT : S.raceT + d * 0.25; }
  if (m.TP && S.net !== 'offline') S.todPick = m.TP;
  if (m.TG) { m.TG.forEach((r, i) => { const t = targets[i]; if (!t) return; t.up = r[0]; t.tx = r[1]; if (t.hostile !== r[2]) { t.hostile = r[2]; t.board.material = r[2] ? tgTex.h : tgTex.n; } }); S.house = m.HS; S.tstats = m.TS; if (m.NM) { S.nextMap = m.NM; ensureCustom(m.NM); } if (m.WP && S.net !== 'offline') S.wxPick = m.WP; }
  for (const e of m.E) onEvent(e);
  if (S.phase !== prev) { S.menu = false; if (S.phase === 'ended') showEndPanel(); else if (S.phase === 'active' && !M.training) { panel.mesh.visible = false; S.panel = null; } else showLobbyPanel(); }
}
const CIV_VO = { plead: 'help', comply: 'sigh' };   // hostage lines with a recording: grabbed or still tied up 'help!', a relieved sigh when told to stay down
const LINES = { spot: ['THERE!', '#ff7070', ''], medic: ['HANG ON!', '#ffb070', "Hang on, I've got you!"], surrender: ["DON'T SHOOT!", '#ffe080', "Don't shoot! I give up!"], defy: ['NO!', '#ff7070', 'No way!'], comply: ['OK! OK!', '#a0e0ff', 'Okay, okay!'], plead: ['PLEASE!', '#a0e0ff', 'Please help us!'], threat: ['BACK OFF OR THEY DIE!', '#ff3030', 'Back off or the hostage dies!'], fake: ['(draws weapon)', '#ff4040', ''] };
function onEvent(e) {
  tut.event(e, S.me.id);
  const a = e.n != null ? S.actors.get(e.n) : null;
  switch (e.e) {
    case 'start': S.startAt = performance.now(); S.everInside = false; if (!S.watch) { resetLoadout(); placeAtSpawn(); flyIn(); } S.report = null; S.menu = false; S.panel = null; panel.mesh.visible = false; if (M.training) showLobbyPanel(); sfx.ok(); break;
    case 'th': { const t = targets[e.t]; if (t) { const p = t.g.position; if (e.ns) sayAt(p.x, p.y + t.d.h + 0.4, p.z, 'NO-SHOOT!', '#6fa8ff'); if (e.p === S.me.id) sfx.beep(p, e.ns ? 300 : 1400); } break; }
    case 'house': sfx.ok(); sayAt(head.pos.x, head.pos.y + 0.5, head.pos.z - 1.5, 'HOUSE CLEAR ' + e.time + 's' + (e.ns ? '  (' + e.ns + ' no-shoot)' : '') + (e.time <= e.best ? '  BEST' : ''), '#80ff9a'); break;
    case 'bombreset': { const o = S.bombs[e.b]; if (o) { const b = new Bomb(o.g.position.x, o.g.position.y, o.g.position.z, e.wires, e.order, o.g.rotation.y); b.order = e.order; b.n = 0; scene.remove(o.g); scene.add(b.g); S.bombs[e.b] = b; sayAt(b.g.position.x, b.g.position.y + 0.5, b.g.position.z, 'BOMB RESET', '#ffb060'); } break; }
    case 'ps': { v1.set(e.o[0], e.o[1], e.o[2]); v2.set(e.h[0], e.h[1], e.h[2]); if (e.p !== S.me.id) { sfx.shot(v1, e.w); tracer(v1, v2); } puff(e.h, e.k === 'w' ? 0xcfcfcf : 0xa01010); if (e.k === 'w') sfx.impact(v2); break; }
    case 'ns': if (a) { a.muzzle(v1); v2.set(e.to[0], e.to[1], e.to[2]); tracer(v1, v2); sfx.shot(v1, 'rifle'); a.flashT = 0.05; } break;
    case 'hurt': if (e.p === S.me.id) { hudT = 0; hurtT = 1; sfx.hurt(); for (const h of hands) buzz(h, 1, 150); S.lastPart = e.part; S.figT = 4; } break;
    case 'heal': if (e.p === S.me.id) { sfx.ok(); S.lastPart = ''; S.figT = 2.5; } break;
    case 'down': if (e.p === S.me.id) sfx.hurt(); break;
    case 'tlock': case 'ttrap': { const d = level.doors[e.d]; if (e.p === S.me.id && d) { hint(d.cx, d.y + 1.3, d.cz, (e.e === 'tlock' ? 'DOOR LOCKED' : 'WIRE SET') + ' - ' + e.left + ' LEFT'); sfx.click(); } break; }
    case 'bsay': botSay(e); break;
    case 'hvtrun': { const a = S.actors.get(e.n), hv = M.hvts ? M.hvts[e.i || 0] : null; if (a) sayAt(a.g.position.x, a.g.position.y + 2.2, a.g.position.z, S.pvp && S.me.team === 'tango' ? (hv && hv.runT || 'THE BOSS IS HEADING FOR THE JET') : (hv && hv.run || 'HVT IS RUNNING FOR THE JET'), '#ff8040'); break; }
    case 'grab': { const a = S.actors.get(e.n); if (e.p === S.me.id && a) { hint(a.g.position.x, a.g.position.y + 2.0, a.g.position.z, 'SHIELD: PISTOL ONLY'); if (S.mode !== 'vr' && hands[1].item === 'rifle') deskKey('Digit2'); } break; }   // phone / desktop: switch to the pistol for you
    case 'drop': { const a = S.actors.get(e.n); if (a && e.why !== 'let go') sayAt(a.g.position.x, a.g.position.y + 2.0, a.g.position.z, e.why === 'flash' ? 'HOSTAGE BROKE FREE (FLASHED)' : e.why === 'shot' ? 'HOSTAGE BROKE FREE (SHOT)' : 'HOSTAGE FREE', '#80d0ff'); break; }
    case 'carhit': if (e.p != null) { sfx.boom({ x: e.x, y: 0.5, z: e.z }); if (e.p === S.me.id) sayAt(head.pos.x + head.fwd.x * 1.5, head.pos.y, head.pos.z + head.fwd.z * 1.5, 'HIT BY A RACE CAR', '#ff6060'); } break;
    case 'revive': if (e.p === S.me.id) { sfx.ok(); if (e.by) sayAt(head.pos.x + head.fwd.x * 1.2, head.pos.y, head.pos.z + head.fwd.z * 1.2, 'BACK ON YOUR FEET', '#7dffa0'); } break;
    case 'hit': if (a) { a.flinch = 1; if (a.kind === 's' && (e.dead || Math.random() < 0.7)) sfx.vo(e.dead ? 'vo_s_die' : 'vo_s_pain', v1.set(a.g.position.x, a.g.position.y + 1.4, a.g.position.z));
      else if (a.kind === 'c') sfx.vo('vo_c_die_' + (a.female ? 'f' : 'm'), v1.set(a.g.position.x, a.g.position.y + 1.2, a.g.position.z), e.dead ? 1.6 : 1.1); } break;   // a hostage hit: their cry (a man's or a woman's)
    case 'power': if (M.breaker) sfx.power(v1.set(M.breaker.x, M.breaker.y, M.breaker.z), e.on); break;
    case 'door': { const d = level.doors[e.d]; sfx.door(v1.set(d.cx, d.y + 1, d.cz), e.open); break; }
    case 'locked': { const d = level.doors[e.d]; sfx.rattle(v1.set(d.cx, d.y + 1, d.cz)); sayAt(d.cx, d.y + 1.5, d.cz, 'LOCKED', '#ffb060'); break; }
    case 'unlock': { const d = level.doors[e.d]; if (e.k === 'cut') { sfx.cut(v1.set(d.cx, d.y + 1.1, d.cz), true); sayAt(d.cx, d.y + 1.6, d.cz, 'LOCK CUT', '#80ff9a'); } else { sfx.unlock(v1.set(d.cx, d.y + 1, d.cz)); sayAt(d.cx, d.y + 1.5, d.cz, 'UNLOCKED', '#80ff9a'); } break; }
    case 'shatter': { const d = level.doors[e.d]; shards(d.cx, d.y + 1.4, d.cz, d.horiz); sfx.shatter(v1.set(d.cx, d.y + 1.4, d.cz)); break; }
    case 'clip': { const o = S.officers.get(e.p); if (o) sfx.clink(o.head.position); break; }
    case 'lift': { const L = M.lift; if (L) { const y = L.stops[e.from], c = L.car; sfx.chime(v1.set((c.x0 + c.x1) / 2, y + 2, c.z1)); sayAt((c.x0 + c.x1) / 2, y + 2.4, c.z1 + 0.3, e.to > e.from ? 'GOING UP' : 'GOING DOWN', '#9fd8ff'); } break; }
    case 'liftmove': { if (e.ids.includes(S.me.id)) { rig.position.y += e.dy; S.feetY += e.dy; headWorld(); for (const h of hands) buzz(h, 0.4, 120); } const L = M.lift; if (L) { const y = L.stops[e.at], c = L.car; sfx.chime(v1.set((c.x0 + c.x1) / 2, y + 2, c.z1)); } break; }
    case 'kick': { const d = level.doors[e.d]; const ko = S.officers.get(e.p); if (ko) ko.body.kick(); if (e.p === S.me.id) myBody.kick(); sfx.kick(v1.set(d.cx, d.y + 1, d.cz), e.ok); if (e.ok) world.doors[e.d].cur = 0.9; else sayAt(d.cx, d.y + 1.5, d.cz, 'HELD', '#ffb060'); break; }
    case 'say': if (a) { const L = LINES[e.k]; if (L) { say(a, L[0], L[1]); if (a.kind === 's' && sfx.vo('vo_s_' + e.k, v1.set(a.g.position.x, a.g.position.y + 1.6, a.g.position.z))) { /* recorded suspect line */ }
      else if (a.kind === 'c' && CIV_VO[e.k] && sfx.vo('vo_c_' + CIV_VO[e.k] + '_' + (a.female ? 'f' : 'm'), v1.set(a.g.position.x, a.g.position.y + 1.5, a.g.position.z), 1.5)) { cryT.set(e.n, 6 + Math.random() * 6); /* recorded hostage line */ } else if (L[2] && a.g.position.distanceTo(head.pos) < 14) { sfx.say(L[2], a.kind === 'c' ? 1.4 : 0.8); if (voiceState.error) noteErr(voiceState.error); } } } break;
    case 'shout': if (e.p !== S.me.id) { const o = S.officers.get(e.p), p = o && o.head.position; if (!sfx.vo('vo_p_shout', p || null, 1.3)) sfx.say('Police! Hands up!', 1); } break;
    case 'cuff': if (a) { sfx.cuff(a.g.position); if (a.kind === 's') sfx.vo('vo_s_cuffed', v1.set(a.g.position.x, a.g.position.y + 0.9, a.g.position.z), 1.3); } break;
    case 'flash': { v1.set(e.x, e.y, e.z); sfx.bang(v1); puff([e.x, e.y + 0.2, e.z], 0xffffff); const d = v1.distanceTo(head.pos);
      if (d < 12) { v2.copy(v1).sub(head.pos).multiplyScalar(1 / Math.max(d, 0.01)); if (rayStatic(level, S.doorOpen, head.pos.x, head.pos.y, head.pos.z, v2.x, v2.y, v2.z, d) >= d - 0.15) { const k = (1 - d / 12) * (v2.dot(head.fwd) > 0.15 ? 1 : 0.35) * (S.nvg ? 1.4 : 1); flashWhite = Math.max(flashWhite, k * 2.2); sfx.ring(k); for (const h of hands) buzz(h, 1, 200); } } break; }
    case 'smoke': sfx.hiss(v1.set(e.x, e.y, e.z)); break;
    case 'clink': sfx.clink(v1.set(e.x, e.y, e.z)); break;
    case 'trap': { const d = level.doors[e.d]; sfx.boom(v1.set(d.cx, d.y + 1, d.cz)); puff([d.cx, d.y + 0.4, d.cz], 0xffc070); if (Math.hypot(d.cx - head.pos.x, d.cz - head.pos.z) < 6) flashWhite = Math.max(flashWhite, 0.7); sayAt(d.cx, d.y + 1.5, d.cz, 'TRIPWIRE!', '#ff5050'); break; }
    case 'disarm': { const d = level.doors[e.d]; sfx.cut(v1.set(d.cx, d.y + 0.3, d.cz), true); sayAt(d.cx, d.y + 1.2, d.cz, 'WIRE CUT', '#80ff9a'); break; }
    case 'cut': { const b = S.bombs[e.b]; if (b) { sfx.cut(b.g.position, e.ok); if (M.training && !e.ok) sayAt(b.g.position.x, b.g.position.y + 0.5, b.g.position.z, 'WRONG WIRE - BOOM', '#ff5050'); } if (e.defused) sfx.ok(); break; }
    case 'end': if (e.result === 'DETONATION') { sfx.boom(); flashWhite = 1; } else if (e.result === 'MISSION COMPLETE') sfx.ok(); break;
  }
}

// ---------- input ----------
const keys = {}; let mouseL = false, mouseLPrev = false;
addEventListener('keydown', e => { if (S.mode !== 'desktop') return; keys[e.code] = true; if (!e.repeat) deskKey(e.code); });
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyG' && OW.open && !S.touch) closeOW(true); });
renderer.domElement.addEventListener('mousedown', e => { if (S.mode !== 'desktop' || S.touch) return; initAudio(); if (document.pointerLockElement !== renderer.domElement) { renderer.domElement.requestPointerLock?.(); } if (e.button === 0) mouseL = true; if (e.button === 2) S.ads = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) S.ads = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (OW.open && !S.touch) { owMove(e.movementX, e.movementY); return; } if (S.mode === 'desktop' && document.pointerLockElement === renderer.domElement) { S.yaw -= e.movementX * 0.0022; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - e.movementY * 0.0022)); } });
function deskKey(code) {
  const G = gunIn(hands[1]);
  if (code === 'Space') tryClimb();
  if (code === 'Enter' && (S.phase !== 'active' || M.training)) net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() });
  if (code === 'KeyO') cycleWx();
  if (code === 'KeyP' && (S.phase !== 'active' || M.training)) cycleMap();
  if (code === 'KeyM') return toggleMenu();
  if (code === 'KeyB') return toggleMic();
  if (S.me.down) return;
  if (code === 'KeyF') doShout();
  else if (code === 'KeyC') S.crouch = !S.crouch;
  else if (code === 'KeyT') S.light = !S.light;
  else if (code === 'KeyV' && G) { toggleMode(G.st); sfx.selector(); }
  else if (code === 'KeyL' && S.phase === 'active') net.send({ t: 'end' });
  else if (code === 'KeyE') deskInteract();
  else if (code === 'KeyG') openOW();
  else if (code === 'KeyK') tut.key();
  else if (code === 'KeyQ') doKick();
  else if (code === 'KeyN') toggleNVG();
  else if (code === 'KeyH') useMed();
  else if (code === 'Digit3' || code === 'Digit4' || code === 'Digit5' || code === 'Digit8') { S.tool = { Digit3: 'hands', Digit4: 'pick', Digit5: 'cutters', Digit8: 'cam' }[code]; sfx.click(); }
  else if (code === 'Digit6' || code === 'Digit7') { const k = code === 'Digit6' ? 'flash' : 'smoke'; if (S.me[k === 'flash' ? 'fl' : 'sm'] > 0) { v1.copy(head.pos).addScaledVector(head.fwd, 0.4); net.send({ t: 'throw', k, o: [v1.x, v1.y - 0.1, v1.z], v: [head.fwd.x * 11, head.fwd.y * 11 + 3, head.fwd.z * 11] }); sfx.click(); } else sfx.beep(null, 200); }
  else if ((code === 'Digit1' || code === 'Digit2') && !S.reloading) { const k = code === 'Digit1' ? 'rifle' : 'pistol'; if (G) G.where = 'holster'; guns[k].where = 1; hands[1].item = k; sfx.click(); }
  else if (code === 'KeyR' && G && !S.reloading) {
    S.reloading = true; if (G.st.mag !== null) { ejectMag(G.st); sfx.magOut(G.kind); }
    setTimeout(() => { if (G.mags > 0) { G.mags--; insertMag(G.st, GUNS[G.kind].cap); sfx.magIn(G.kind); } setTimeout(() => { if (!G.st.chamber && G.st.mag > 0) { if (G.st.locked) { release(G.st); sfx.bolt(G.kind); } else { rack(G.st); sfx.rack(G.kind); } } S.reloading = false; }, 350); }, 750);
  }
}
function nearestCuffable(p, maxD) { let best = null, bd = maxD; for (const [id, a] of S.actors) { if (a.st !== 's' && a.st !== 'k' && a.st !== 'y' && a.st !== 'i') continue; const d = Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z) + Math.abs(a.g.position.y + 0.9 - p.y) * 0.3; if (d < bd) { bd = d; best = id; } } return best; }
function nearestDowned(p, maxD) { let best = null, bd = maxD; for (const o of S.officers.values()) { if (!o.down) continue; const d = o.head.position.distanceTo(p); if (d < bd) { bd = d; best = o.id; } } return best; }
// PvP human shield (terrorist players): the nearest hostage still free within reach of p
const shieldOn = () => S.pvp && S.me.team === 'tango' && S.phase === 'active' && !S.me.down;
function nearestHostage(p, maxD) { let best = null, bd = maxD; for (const [id, a] of S.actors) { if (a.kind !== 'c' || a.st === 'u' || a.st === 'd' || a.st === 'x') continue; const d = Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z) + Math.abs(a.g.position.y + 1.1 - p.y) * 0.5; if (d < bd) { bd = d; best = id; } } return best; }
function deskInteract() {
  if (ropes.use()) return;   // clip in to a rope, or swing in / climb over at its end
  if (shieldOn()) { if (S.me.holding) return net.send({ t: 'release' }); const n = nearestHostage(head.pos, 1.5); if (n != null) return net.send({ t: 'hold', n }); }
  for (let i = 0; i < S.bombs.length; i++) { const b = S.bombs[i]; if (!b.defused && b.g.position.distanceTo(head.pos) < 1.7) { const p = b.g.position; return S.tool === 'cutters' ? net.send({ t: 'cut', b: i, w: b.order[b.n] }) : hint(p.x, p.y + 0.4, p.z, 'SELECT CUTTERS'); } }
  if (nearBreaker(head.pos, 1.7)) return net.send({ t: 'breaker' });
  const n = tangoTools() ? null : nearestCuffable(v1.copy(head.pos).setY(head.pos.y - 0.7), 1.6); if (n != null) return net.send({ t: 'cuff', n });
  const p = nearestDowned(head.pos, 2); if (p != null) return net.send({ t: 'revive', p });
  const bi = nearestDoor(head.pos, 2.2);
  if (bi < 0 && tryClimb()) return;
  if (shieldOn() && bi < 0) { hint(head.pos.x + head.fwd.x * 1.2, head.pos.y - 0.3, head.pos.z + head.fwd.z * 1.2, 'NO HOSTAGE OR DOOR IN REACH'); return; }
  if (bi < 0) return;
  if (tangoTools() && !S.doorOpen[bi] && (S.tool === 'pick' || S.tool === 'cutters')) { const D = level.doors[bi], lock = S.tool === 'pick';
    if (lock ? S.doorLocked[bi] || D.pad !== undefined : S.doorTrap[bi]) return hint(D.cx, D.y + 1.2, D.cz, lock ? 'ALREADY LOCKED' : 'ALREADY RIGGED');
    if (!(lock ? S.me.locks : S.me.traps)) return hint(D.cx, D.y + 1.2, D.cz, lock ? 'NO LOCKS LEFT' : 'NO TRAPS LEFT');
    S.deskPick = { id: bi, t: lock ? 2 : 1, lock, trap: !lock }; return; }
  if (S.tool === 'cam' && !S.doorOpen[bi]) { S.deskCam = { id: bi, t: 6 }; if (S.doorTrap[bi]) hint(level.doors[bi].cx, level.doors[bi].y + 1.3, level.doors[bi].cz, 'TRIPWIRE BEHIND DOOR'); return; }
  if (S.tool === 'cutters' && S.doorTrap[bi] && !S.doorOpen[bi]) { S.deskPick = { id: bi, t: 1.5, disarm: true }; return; }
  const D = level.doors[bi];
  if (D.pad !== undefined && S.doorLocked[bi]) { if (S.tool === 'cutters') S.deskPick = { id: bi, t: 2.5, snip: true }; else hint(D.cx, D.y + 1.2, D.cz, 'PADLOCKED: USE CUTTERS'); return; }
  net.send({ t: 'door', d: bi });
  if (S.doorLocked[bi] && !S.doorOpen[bi] && !tangoTools()) { if (S.tool === 'pick') S.deskPick = { id: bi, t: 0 }; else hint(D.cx, D.y + 1.2, D.cz, 'NEED LOCKPICK OR KICK'); }
}
// nearest door whose opening is within reach of a point (hand or head), on the same storey
function nearestDoor(p, maxD) { let bd = maxD, bi = -1; level.doors.forEach((d, i) => { const dd = Math.hypot(d.cx - p.x, d.cz - p.z); if (Math.abs(d.y - S.feetY) < 1.2 && dd < bd) { bd = dd; bi = i; } }); return bi; }
function doKick() {
  if (S.me.down) return; let bd = 2.0, bi = -1;
  level.doors.forEach((d, i) => { const dx = d.cx - head.pos.x, dz = d.cz - head.pos.z, dd = Math.hypot(dx, dz); if (!S.doorOpen[i] && Math.abs(d.y - S.feetY) < 1.2 && dd < bd && (dx * head.fwd.x + dz * head.fwd.z) / Math.max(dd, 0.01) > 0.2) { bd = dd; bi = i; } });
  if (bi >= 0) { net.send({ t: 'kick', d: bi }); for (const h of hands) buzz(h, 1, 80); }
}
// Your shout: a recorded line when sfx/manifest.json has 'vo_p_shout' (or 'vo_t_shout' as a terrorist), else the headset's speech
// voice, which Quest's browser may not have, so the words also show in front of you and the controller buzzes.
function doShout() { if (S.me.down) return; net.send({ t: 'shout' }); const t = S.pvp && S.me.team === 'tango', line = t ? 'GET DOWN! NOBODY MOVE!' : 'POLICE! HANDS UP!';
  if (!sfx.vo(t ? 'vo_t_shout' : 'vo_p_shout', null, 1.3)) sfx.say(line.toLowerCase(), 1);
  sayAt(head.pos.x + head.fwd.x * 1.6, head.pos.y - 0.15, head.pos.z + head.fwd.z * 1.6, line, '#ffffff'); for (const h of hands) buzz(h, 0.5, 60); }

function readVR() {
  for (const h of hands) { Object.assign(h.prev, h.in); h.active = false; }
  for (const o of xrc) {
    const s = o.src; if (!s || !s.gamepad || (s.handedness !== 'left' && s.handedness !== 'right')) continue;
    const h = hands[s.handedness === 'left' ? 0 : 1], b = s.gamepad.buttons, a = s.gamepad.axes; h.active = true; h.xr = o; h.pad = s.gamepad;
    h.in.trig = b[0] ? b[0].value : 0; h.in.grip = b[1] ? b[1].value : 0; h.in.stick = b[3] && b[3].pressed ? 1 : 0; h.in.a = b[4] && b[4].pressed ? 1 : 0; h.in.b = b[5] && b[5].pressed ? 1 : 0;
    h.in.thumb = [3, 4, 5].some(k => b[k] && (b[k].touched || b[k].pressed)) ? 1 : 0; h.in.trigT = b[0] && (b[0].touched || b[0].value > 0.05) ? 1 : 0;   // capacitive touch: a resting thumb or finger
    h.in.sx = a.length >= 4 ? a[2] : (a[0] || 0); h.in.sy = a.length >= 4 ? a[3] : (a[1] || 0);
  }
  for (const h of hands) if (!h.active) Object.assign(h.in, mkIn());
}
let snapLatch = false;
function moveVR(dt) {
  const L = hands[0].in, R = hands[1].in;
  if (!S.me.down && !S.fly) {
    if (Math.abs(R.sx) > 0.6 && !snapLatch) { snapLatch = true; headWorld(); const bx = head.pos.x, bz = head.pos.z; rig.rotation.y -= Math.sign(R.sx) * Math.PI / 6; headWorld(); rig.position.x += bx - head.pos.x; rig.position.z += bz - head.pos.z; }
    else if (Math.abs(R.sx) < 0.3) snapLatch = false;
    const dz = Math.abs(L.sy) > 0.15 ? L.sy : 0, dx = Math.abs(L.sx) > 0.15 ? L.sx : 0;
    if ((dx || dz) && !S.rope) { const sp = (Math.hypot(dx, dz) > 0.92 ? 3.4 : 2.3) * legMul() * dt, s = Math.sin(head.yaw), c = Math.cos(head.yaw); rig.position.x += (-s * -dz + c * dx) * sp; rig.position.z += (-c * -dz - s * dx) * sp; }
  }
}
// quest-store: spectate. Free flight through walls: the left stick flies where you look (pitch included), the right stick goes up and
// down and snap-turns. B or Y (either hand) opens the spectator menu; the trigger presses its buttons.
const WATCH_UP = 2.2;
function placeWatch() { placeAtSpawn(); headWorld(); rig.position.y += WATCH_UP; S.feetY = rig.position.y; }
function watchMove(dt) {
  const L = hands[0].in, R = hands[1].in;
  if (Math.abs(R.sx) > 0.6 && !snapLatch) { snapLatch = true; headWorld(); const bx = head.pos.x, bz = head.pos.z; rig.rotation.y -= Math.sign(R.sx) * Math.PI / 6; headWorld(); rig.position.x += bx - head.pos.x; rig.position.z += bz - head.pos.z; }
  else if (Math.abs(R.sx) < 0.3) snapLatch = false;
  const dz = Math.abs(L.sy) > 0.15 ? -L.sy : 0, dx = Math.abs(L.sx) > 0.15 ? L.sx : 0, up = Math.abs(R.sy) > 0.3 && Math.abs(R.sx) < 0.5 ? -R.sy : 0;
  const sp = (Math.hypot(dx, dz) > 0.92 ? 9 : 4) * dt; v2.set(0, 0, -1).applyQuaternion(head.quat); v3.set(1, 0, 0).applyQuaternion(head.quat).setY(0).normalize();
  rig.position.addScaledVector(v2, dz * sp).addScaledVector(v3, dx * sp); rig.position.y += up * 3 * dt;
  rig.position.y = Math.max(-1, Math.min(60, rig.position.y)); S.feetY = rig.position.y;
}
function watchDesk(dt) {   // desktop spectating: WASD flies along the view, Q / E down and up
  rig.rotation.y = S.yaw; camera.rotation.set(S.pitch, 0, 0); camera.position.set(0, S.eye, 0); camera.updateMatrixWorld(true);
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), u = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0), sp = (keys.ShiftLeft ? 12 : 5) * dt;
  v2.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())); v3.set(1, 0, 0).applyAxisAngle(UP, S.yaw);
  rig.position.addScaledVector(v2, f * sp).addScaledVector(v3, r * sp); rig.position.y += u * sp; headWorld();
}
function watchHands() {
  for (const h of hands) { if (!h.active) continue; h.item = null;
    if (press(h, 'b')) { toggleMenu(); continue; }
    if (press(h, 'trig')) { v2.set(0, 0, -1).applyQuaternion(h.quat); tryPanel(h.pos, v2); } }
}
function moveDesktop(dt) {
  rig.rotation.y = S.yaw; camera.rotation.set(S.pitch, 0, 0); S.eye += ((S.crouch ? 1.0 : 1.66) - S.eye) * Math.min(1, dt * 10); camera.position.set(0, S.eye, 0);
  if (S.me.down || S.rope || S.fly) { if (S.rope || S.fly) { const h = hands[1]; Object.assign(h.prev, h.in); h.active = true; h.in.trig = mouseL ? 1 : 0; } return; }   // on a rope: W / S climb and descend (rope.js)
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - S.tmove.y, r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + S.tmove.x, len = Math.hypot(f, r);
  if (len > 0.08) { const sp = (keys.ShiftLeft || (S.touch && len > 0.92) ? 3.5 : 2.3) * legMul() * Math.min(1, len) * dt / len, s = Math.sin(S.yaw), c = Math.cos(S.yaw); rig.position.x += (-s * f + c * r) * sp; rig.position.z += (-c * f - s * r) * sp; }
  const h = hands[1]; Object.assign(h.prev, h.in); h.active = true; h.in.trig = mouseL ? 1 : 0;
}
// PvP, one life: three seconds after you go down the view floats behind a teammate who is still up (shoulder height,
// 2 m back). Your own head still looks around freely. Back to your body as soon as you are revived or the round ends.
let specT = 0; const specAt = new THREE.Vector3(0, -99, 0);
function spectate(dt) {
  const want = S.pvp && S.me.down && S.phase === 'active';
  const now = performance.now(); if (!want) specT = 0; else if (!specT) specT = now;
  const mates = want && now - specT > 3000 ? [...S.officers.values()].filter(o => o.team === S.me.team && !o.down) : [];
  const o = mates.find(q => q.id === S.specId) || mates[0];
  if (!o) { if (S.spec) { S.spec = null; S.specId = 0; placeAtSpawn(); } return; }
  S.spec = o.name || 'TEAMMATE'; S.specId = o.id;
  const hp = o.head.position, yaw = o.e.y, tx = hp.x + Math.sin(yaw) * 2.0, tz = hp.z + Math.cos(yaw) * 2.0, ty = hp.y + 0.6;
  if (specAt.y < -50 || specAt.distanceTo(hp) > 12) specAt.set(tx, ty, tz); else specAt.lerp(v1.set(tx, ty, tz), Math.min(1, dt * 4));
  if (S.mode === 'vr') { headWorld(); rig.position.x += specAt.x - head.pos.x; rig.position.y += specAt.y - head.pos.y; rig.position.z += specAt.z - head.pos.z; }
  else { rig.position.set(specAt.x, specAt.y - S.eye, specAt.z); }
}
function headWorld() {
  rig.updateMatrixWorld(true); head.pos.copy(camera.position).applyMatrix4(rig.matrixWorld); head.quat.copy(rig.quaternion).multiply(camera.quaternion);
  head.fwd.set(0, 0, -1).applyQuaternion(head.quat); head.yaw = Math.atan2(-head.fwd.x, -head.fwd.z);
  // quest-store: your body faces between where you look and where your hands are (both hands out in front: halfway to them),
  // and catches up smoothly past 5 degrees. It used to turn only once you looked 40 degrees off it, so turning to aim left the
  // body behind: the far hand (usually the left, on the foregrip) had to reach across the chest and the arm looked broken.
  let want = head.yaw;
  if (S.mode === 'vr' && hands[0].active && hands[1].active) { const mx = (hands[0].pos.x + hands[1].pos.x) / 2 - head.pos.x, mz = (hands[0].pos.z + hands[1].pos.z) / 2 - head.pos.z;
    if (mx * mx + mz * mz > 0.04) { const hy = Math.atan2(-mx, -mz), dh = angd(hy, head.yaw); if (Math.abs(dh) < 1.2) want = head.yaw + dh * 0.5; } }
  const d = angd(want, S.bodyYaw); if (S.mode !== 'vr') S.bodyYaw += d; else if (Math.abs(d) > 0.08) S.bodyYaw += (d - Math.sign(d) * 0.08) * 0.15;
}
function collide() {
  if (S.spec) return;   // spectating: the camera floats behind a teammate
  if (S.rope || S.fly) { S.perch = null; headWorld(); return; }   // hanging on a rope, or riding in the helicopter
  if (S.perch) {   // standing on something you climbed: stay at its height while over it; step off where the drop is survivable
    const b = S.perch, m = 0.1; headWorld(); let x = head.pos.x, z = head.pos.z;
    if (!(x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m)) {
      const nb = ledgeNear(level, S.doorOpen, x, z, b.y1 - 1, 0.05, 0.7, 1.3);   // straight onto the next thing at about this height
      if (nb) S.perch = nb.b; else if (b.y1 - level.groundY(x, z, b.y1) > 2.5 || S.me.down) { x = Math.max(b.x0 - m, Math.min(x, b.x1 + m)); z = Math.max(b.z0 - m, Math.min(z, b.z1 + m)); } else S.perch = null;
    }
    if (S.perch) { const y = S.perch.y1; [x, z] = resolveCircle(level, S.doorOpen, x, z, 0.25, y); rig.position.x += x - head.pos.x; rig.position.z += z - head.pos.z; S.feetY = y; rig.position.y += (y - rig.position.y) * 0.3; headWorld(); return; }
  }
  headWorld(); let [x, z] = resolveCircle(level, S.doorOpen, head.pos.x, head.pos.z, 0.25, S.feetY);
  if (M.maxDrop) { if (S.feetY - level.groundY(x, z, S.feetY) > M.maxDrop && S.safe) [x, z] = S.safe; else S.safe = [x, z]; }   // no walking off a tower (out of a broken window, off a roof's edge)
  rig.position.x += x - head.pos.x; rig.position.z += z - head.pos.z; S.feetY = level.groundY(x, z, S.feetY); rig.position.y += (S.feetY - rig.position.y) * 0.35; headWorld();
}

// ---------- weapon handling ----------
function placeGuns(dt) {
  for (const k in guns) {
    const G = guns[k], m = G.mesh; G.kick *= Math.exp(-14 * dt);
    if (G.where === 'holster') {
      m.visible = S.mode === 'vr'; bodyPt(HOLSTER[k], m.position); q1.setFromAxisAngle(UP, head.yaw); m.quaternion.copy(q1).multiply(q1.setFromEuler(_he.set(...HOLSTER_ROT[k])));   // (x, y, z, order)
    } else {
      const h = hands[G.where], o = hands[1 - G.where]; m.visible = true; m.position.copy(h.pos);
      if (k === 'rifle' && o.support) { v1.set(0, 1, 0).applyQuaternion(h.quat); m1.lookAt(h.pos, v2.copy(o.pos).addScaledVector(v1, -0.02), v1); m.quaternion.setFromRotationMatrix(m1); }
      else { m.quaternion.copy(h.quat); if (k === 'pistol' && S.mode === 'vr') m.quaternion.multiply(PISTOL_TILT); }   // a controller is held at a steeper angle than a pistol grip
      const sh = armShake(); if (sh) { const t = S.now; m.quaternion.multiply(q1.setFromEuler(new THREE.Euler(sh * (Math.sin(t * 2.3) + 0.6 * Math.sin(t * 5.3 + 1)), sh * (Math.sin(t * 1.9 + 2) + 0.6 * Math.sin(t * 4.7)), 0))); }
      m.quaternion.multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), G.kick)); m.position.addScaledVector(v1.set(0, 0, 1).applyQuaternion(m.quaternion), G.kick * 0.25);
    }
    G.ud.mag.visible = G.st.mag !== null; if (G.ud.bolt) G.ud.bolt.visible = G.st.locked; if (G.ud.slide) G.ud.slide.position.z = G.ud.slideZ + (G.st.locked ? 0.03 : 0);
    if (G.flashT > 0) G.flashT -= dt; G.ud.flash.visible = G.flashT > 0; m.updateMatrixWorld(true);
  }
  guns.rifle.ud.ret.visible = guns.rifle.where !== 'holster'; if (guns.pistol.ud.ret) guns.pistol.ud.ret.visible = guns.pistol.where !== 'holster';   // the reticle's own shader decides, per eye, how much of it shows through the sight window
  // flashlight follows the gun in hand
  const A = gunIn(hands[1]) || gunIn(hands[0]); torch.intensity = A && S.light ? TORCH_I : 0;
  if (A) { A.mesh.localToWorld(torch.position.copy(A.ud.light)); torch.target.position.set(0, 0, -6).add(A.ud.light); A.mesh.localToWorld(torch.target.position); torch.target.updateMatrixWorld(); }
}
function fire(h, G, o) {
  const held = h.in.trig > 0.6, edge = held && !(h.prev.trig > 0.6);
  if (S.me.holding && G.kind === 'rifle') { if (edge) { hint(head.pos.x + head.fwd.x, head.pos.y - 0.2, head.pos.z + head.fwd.z, 'PISTOL ONLY WHILE HOLDING A HOSTAGE'); sfx.click(); } return; }
  if (h.block && !held) h.block = false;
  if (!held && !press(h, 'a') && !press(h, 'b') && !press(h, 'stick')) return;
  G.mesh.localToWorld(v1.copy(G.ud.muzzle)); v2.set((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, -1).normalize().applyQuaternion(G.mesh.quaternion);
  if (edge && tryPanel(v1, v2)) { h.block = true; return; }
  if (h.block) return;
  if (S.me.down) return;
  const r = pullTrigger(G.st, S.now, edge, held);
  if (r === 'fire') {
    net.send({ t: 'shot', o: [v1.x, v1.y, v1.z], d: [v2.x, v2.y, v2.z], w: G.kind });
    const d = rayStatic(level, S.doorOpen, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, 60, 'bullet'); tracer(v1, v3.copy(v2).multiplyScalar(d).add(v1));
    if (G.kind === 'pistol' && SUPP.on) sfx.shotSupp(); else sfx.shot(null, G.kind); G.kick += (o.support ? 0.03 : 0.07) * GUNS[G.kind].recoil; G.flashT = 0.045; buzz(h, 1, 50); if (o.support) buzz(o, 0.5, 40);
    if (G.st.locked) sfx.lock();
  } else if (r === 'click') sfx.dry(G.kind);
  if (S.mode !== 'vr') return;
  if (press(h, 'a') && G.st.mag !== null) { ejectMag(G.st); sfx.magOut(G.kind); buzz(h, 0.4, 30); }
  if (press(h, 'b') && release(G.st)) { sfx.bolt(G.kind); buzz(h, 0.6, 40); }
  if (press(h, 'stick') && G.kind === 'rifle') { toggleMode(G.st); sfx.selector(); }
}
function grab(h, o) {   // grip pressed on hand h; o is the other hand
  const G = gunIn(h); if (G) { G.where = 'holster'; h.item = null; o.support = false; o.rackG = null; sfx.click(); return; }
  if (h.item) return;
  if (ropes.grabVR(h)) return;   // a rope: hand over hand
  if (shieldOn() && !S.me.holding) { const n = nearestHostage(h.pos, 0.75); if (n != null) { h.shield = true; buzz(h, 0.6, 60); return net.send({ t: 'hold', n }); } }   // free hand on a hostage: take them as a shield
  const OG = gunIn(o), z = zoneFor(h, o);   // the same lookup that draws the highlight, so you grab exactly what is lit
  if (z) {
    buzz(h, 0.5, 30);
    if (z === 'nvg') toggleNVG(); else if (z === 'radio') toggleMenu();
    else if (z === 'rack') { h.rackG = OG; h.rackStart.copy(h.pos); h.rackDone = false; }
    else if (z === 'fore') h.support = true;
    else if (z === 'rifle' || z === 'pistol') { guns[z].where = h.i; h.item = z; sfx.click(); }
    else if (z === 'pouch') { const kind = OG ? OG.kind : 'rifle'; if (guns[kind].mags > 0) { guns[kind].mags--; h.item = 'mag'; h.magKind = kind; sfx.click(); } else sfx.beep(null, 200); }
    else if (z === 'flash' || z === 'smoke') { h.item = z; sfx.click(); }
    return;
  }
  if (S.me.down) return;
  if (useWorld(h)) return;
  ledgeGrab(h);
}
// empty hand, grip or trigger: cuff, revive, or work a door
function useWorld(h) {
  if (S.me.down) return false;
  if (nearBreaker(h.pos, 0.45)) { net.send({ t: 'breaker' }); buzz(h, 1, 60); return true; }
  const n = nearestCuffable(h.pos, 1.0); if (n != null) { h.hold = { kind: 'cuff', id: n, t: 0, need: 1.2 }; return true; }
  const p = nearestDowned(h.pos, 0.9); if (p != null) { h.hold = { kind: 'revive', id: p, t: 0, need: 3 }; return true; }
  const d = nearestDoor(h.pos, 0.95); if (d < 0) return false;
  if (tangoTools() && !S.doorOpen[d] && (S.tool === 'pick' || S.tool === 'cutters')) { const D = level.doors[d], lock = S.tool === 'pick';
    if (lock ? S.doorLocked[d] || D.pad !== undefined : S.doorTrap[d]) { hint(D.cx, D.y + 1.2, D.cz, lock ? 'ALREADY LOCKED' : 'ALREADY RIGGED'); return true; }
    if (!(lock ? S.me.locks : S.me.traps)) { hint(D.cx, D.y + 1.2, D.cz, lock ? 'NO LOCKS LEFT' : 'NO TRAPS LEFT'); return true; }
    h.hold = { kind: lock ? 'lockdoor' : 'trapdoor', id: d, t: 0, need: lock ? 2 : 3 }; return true; }   // terrorist: keep holding on the door to lock it / rig the wire
  if (S.tool === 'cam' && !S.doorOpen[d]) { h.hold = { kind: 'cam', id: d, t: 0, need: 1e9 }; if (S.doorTrap[d]) hint(level.doors[d].cx, level.doors[d].y + 1.3, level.doors[d].cz, 'TRIPWIRE BEHIND DOOR'); return true; }   // slide the camera under: keep holding to watch
  if (S.tool === 'cutters' && S.doorTrap[d] && !S.doorOpen[d]) { h.hold = { kind: 'disarm', id: d, t: 0, need: 2.5 }; return true; }
  const D0 = level.doors[d]; if (D0.pad !== undefined && S.doorLocked[d]) { if (S.tool === 'cutters') h.hold = { kind: 'snip', id: d, t: 0, need: 1.5 }; else hint(D0.cx, D0.y + 1.2, D0.cz, 'PADLOCKED: USE CUTTERS'); return true; }   // squeeze the cutters through the shackle
  net.send({ t: 'door', d }); buzz(h, 0.5, 30);
  if (S.doorLocked[d] && !S.doorOpen[d] && !tangoTools()) { const D = level.doors[d]; if (S.tool === 'pick') h.hold = { kind: 'pick', id: d, t: 0, need: 4 }; else hint(D.cx, D.y + 1.2, D.cz, 'NEED LOCKPICK OR KICK'); }   // with the lockpick out, keep holding to pick
  return true;
}
function handVR(h, o, dt) {
  if (!h.active) return;
  if (press(h, 'grip')) grab(h, o);
  if (released(h, 'grip')) { ropes.releaseVR(h); h.ledge = null; if (h.shield) { h.shield = false; net.send({ t: 'release' }); } h.support = false; h.rackG = null; if (h.item === 'mag') { guns[h.magKind].mags++; h.item = null; }
    else if (h.item === 'flash' || h.item === 'smoke') { net.send({ t: 'throw', k: h.item, o: [h.pos.x, h.pos.y, h.pos.z], v: [h.vel.x * 1.3, h.vel.y * 1.3 + 0.6, h.vel.z * 1.3] }); h.item = null; buzz(h, 0.7, 40); } }   // let go to throw: it leaves with your hand's speed
  if (h.hold && !(h.in.grip > 0.5) && !(h.in.trig > 0.5)) h.hold = null;
  const G = gunIn(h), OG = gunIn(o);
  if (G) fire(h, G, o);
  else {
    // order wheel open on this hand: trigger or Y/B picks the order under the hand (or cancels from the middle)
    const confirm = wheel.open && wheel.hand === h && wheel.kind === 'orders' && (press(h, 'trig') || press(h, 'b')); if (confirm) { closeWheel(h); h.bLock = true; }
    if (!confirm && press(h, 'trig')) {
      let cut = null, cd = 0.07;   // nearest wire to the hand, so neighbouring wires are not cut by mistake
      const tip = v2.set(0, 0, -0.09).applyQuaternion(h.quat).add(h.pos);   // the cutter jaws reach past the hand
      if (!S.me.down) for (let i = 0; i < S.bombs.length; i++) { const b = S.bombs[i]; if (b.defused) continue; for (let w = 0; w < 4; w++) if (b.wires[w].visible) { b.wirePos(w, v1); const d = Math.min(v1.distanceTo(h.pos), v1.distanceTo(tip)); if (d < cd) { cd = d; cut = { t: 'cut', b: i, w }; } } }
      if (cut) { if (S.tool === 'cutters') { net.send(cut); buzz(h, 0.8, 40); } else { const p = S.bombs[cut.b].g.position; hint(p.x, p.y + 0.4, p.z, 'SELECT CUTTERS'); } }
      else { v2.set(0, 0, -1).applyQuaternion(h.quat); if (!tryPanel(h.pos, v2) && !h.item && !h.hold) useWorld(h); }
    }
    // Y/B: tap = shout; hold = point (green laser and ring on the target), let go = lock it and open the order wheel
    if (press(h, 'b') && !confirm) { h.bT = 0; h.bAim = false; }
    if (h.in.b > 0.5 && !h.bLock) { h.bT += dt; if (!h.bAim && h.bT > 0.25 && !wheel.open && botsUp()) h.bAim = true; if (h.bAim) aimOrders(h); }
    if (released(h, 'b')) { if (h.bLock) h.bLock = false; else if (h.bAim) { h.bAim = false; orderLaser.visible = false; const T = wheel.target || { kind: 'none', name: '' }; markOrder(T); openWheel(h, orderList(T), 'orders', T.kind === 'door' ? orderTag.userData.txt : T.name); } else if (!wheel.open) doShout(); }
    if (press(h, 'a')) h.aT = 0;
    if (h.in.a > 0.5) { h.aT += dt; if (h.aT > 0.22 && !wheel.open) openWheel(h); }
    if (released(h, 'a')) { if (wheel.open && wheel.hand === h && wheel.kind === 'tools') closeWheel(h); else S.light = !S.light; }
    if (wheel.open && wheel.hand === h) drawWheel(wheelPick(h));
    if (press(h, 'stick')) doKick();
  }
  if (h.item === 'mag') {
    const mm = h.mags[h.magKind]; mm.position.copy(h.pos); mm.quaternion.copy(h.quat);
    if (OG && OG.kind === h.magKind && OG.st.mag === null && OG.mesh.localToWorld(v1.copy(OG.ud.magwell)).distanceTo(h.pos) < 0.1) { insertMag(OG.st, GUNS[OG.kind].cap); h.item = null; sfx.magIn(OG.kind); buzz(h, 0.8, 40); buzz(o, 0.5, 40); }
  }
  for (const k in h.mags) h.mags[k].visible = h.item === 'mag' && h.magKind === k;
  for (const k in h.nades) { const m = h.nades[k]; m.visible = h.item === k; if (m.visible) { m.position.copy(h.pos); m.quaternion.copy(h.quat); } }
  for (const k in h.tools) { const m = h.tools[k]; m.visible = !h.item && S.tool === k && (!!OG || h.i === 0); if (m.visible) { m.position.copy(h.pos); m.quaternion.copy(h.quat); } }
  if (h.rackG && !h.rackDone) { const back = v1.set(0, 0, 1).applyQuaternion(h.rackG.mesh.quaternion); if (v2.copy(h.pos).sub(h.rackStart).dot(back) > 0.045) { rack(h.rackG.st); h.rackDone = true; sfx.rack(h.rackG.kind); buzz(h, 0.8, 50); buzz(o, 0.4, 50); } }
  const bar = bars[h.i]; bar.visible = !!h.hold;
  if (h.hold) {
    const H = h.hold; let tx, tz, ok = true;
    if (H.kind === 'pick' || H.kind === 'cam' || H.kind === 'disarm' || H.kind === 'snip' || H.kind === 'lockdoor' || H.kind === 'trapdoor') { const d = level.doors[H.id]; tx = d.cx; tz = d.cz; ok = !S.doorOpen[H.id] && (H.kind === 'pick' || H.kind === 'snip' ? S.doorLocked[H.id] : H.kind === 'disarm' ? S.doorTrap[H.id] > 0 : H.kind === 'lockdoor' ? !S.doorLocked[H.id] : H.kind === 'trapdoor' ? !S.doorTrap[H.id] : true); if (H.kind === 'cam') { dcam.door = H.id; dcam.hand = h; } }
    else { const tgt = H.kind === 'cuff' ? S.actors.get(H.id) : S.officers.get(H.id), tp = tgt && (H.kind === 'cuff' ? tgt.g.position : tgt.head.position); ok = !!tp; if (tp) { tx = tp.x; tz = tp.z; } }
    if (!ok || Math.hypot(tx - h.pos.x, tz - h.pos.z) > 1.3) h.hold = null;
    else {
      H.t += dt; if (H.kind !== 'cam') buzz(h, H.kind === 'pick' ? 0.12 + 0.2 * Math.random() : 0.2, 20); if (H.kind === 'pick' && Math.floor(H.t * 3) !== Math.floor((H.t - dt) * 3)) sfx.pickTick();
      bar.position.copy(h.pos).y += 0.09; bar.quaternion.copy(head.quat); bar.scale.x = Math.max(0.02, Math.min(1, H.t / H.need)); bar.material.color.set(H.kind === 'pick' ? 0xffc040 : 0x40ff80);
      if (H.kind === 'cam') bar.visible = false;
      if (H.t >= H.need) { net.send(H.kind === 'cuff' ? { t: 'cuff', n: H.id } : H.kind === 'revive' ? { t: 'revive', p: H.id } : { t: H.kind, d: H.id }); h.hold = null; }
    }
  }
}

// ---------- vest zones: what an empty hand would grab, lit up and labelled before you grab it ----------
const ZONES = [['rifle', 0.22], ['pistol', 0.2], ['pouch', 0.17], ['radio', 0.14], ['flash', 0.12], ['smoke', 0.12], ['nvg', 0.17]];
function zonePos(k, out) { return k === 'nvg' ? out.copy(head.pos).addScaledVector(head.fwd, 0.05).setY(head.pos.y + 0.07) : k === 'rifle' || k === 'pistol' ? out.copy(guns[k].mesh.position) : bodyPt(HOLSTER[k], out); }
function zoneFor(h, o) {
  const OG = gunIn(o);
  if (OG) { if (OG.mesh.localToWorld(v3.copy(OG.ud.rack)).distanceTo(h.pos) < 0.11) return 'rack'; if (OG.kind === 'rifle' && OG.mesh.localToWorld(v3.copy(OG.ud.fore)).distanceTo(h.pos) < 0.2) return 'fore'; }
  let best = null, bd = 1e9;
  for (const [k, r] of ZONES) { if ((k === 'rifle' || k === 'pistol') && guns[k].where !== 'holster') continue; if ((k === 'flash' && S.me.fl <= 0) || (k === 'smoke' && S.me.sm <= 0)) continue; const d = zonePos(k, v3).distanceTo(h.pos); if (d < r && d < bd) { bd = d; best = k; } }
  return best;
}
const hintFx = hands.map(() => { const ring = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.32, depthTest: false, fog: false })); ring.renderOrder = 993; ring.visible = false;
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const tex = new THREE.CanvasTexture(c), tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false })); tag.scale.set(0.2, 0.0375, 1); tag.renderOrder = 993; tag.visible = false; scene.add(ring, tag); return { ring, tag, c, tex, text: '' }; });
function vestHints() {
  hands.forEach((h, i) => {
    const F = hintFx[i], o = hands[1 - i], z = S.mode === 'vr' && h.active && !h.item && !h.support && !h.rackG && !h.hold && !(h.in.grip > 0.5) ? zoneFor(h, o) : null;
    if (z && z !== h.zone) buzz(h, 0.25, 15); h.zone = z; F.ring.visible = F.tag.visible = !!z; if (!z) return;
    const OG = gunIn(o); if (z === 'rack') OG.mesh.localToWorld(F.ring.position.copy(OG.ud.rack)); else if (z === 'fore') OG.mesh.localToWorld(F.ring.position.copy(OG.ud.fore)); else zonePos(z, F.ring.position);
    const text = { rifle: 'RIFLE', pistol: 'PISTOL', pouch: 'MAGAZINE x' + guns[OG ? OG.kind : 'rifle'].mags, radio: 'RADIO: MENU', flash: 'FLASHBANG x' + S.me.fl, smoke: 'SMOKE x' + S.me.sm, nvg: 'NIGHT VISION', rack: 'CHARGING HANDLE', fore: 'FOREGRIP' }[z];
    if (text !== F.text) { F.text = text; const g = F.c.getContext('2d'); g.clearRect(0, 0, 256, 48); g.fillStyle = 'rgba(5,10,8,0.75)'; g.fillRect(0, 0, 256, 48); g.fillStyle = '#7dffa0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 25); F.tex.needsUpdate = true; }
    F.tag.position.copy(F.ring.position); F.tag.position.y += 0.11;
  });
}
// ---------- grenades in flight and smoke clouds (positions come from the server) ----------
const softTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const nadePool = Array.from({ length: 6 }, (_, i) => { const m = makeNade(i % 2 ? 'smoke' : 'flash'); m.visible = false; scene.add(m); return m; });
// Smoke is drawn as a handful of soft quads turned to face you (not point sprites, which headsets cap in size).
const SMOKE_N = 14, smokePool = Array.from({ length: 4 }, () => {
  const off = new Float32Array(SMOKE_N * 4), pos = new Float32Array(SMOKE_N * 12), uv = new Float32Array(SMOKE_N * 8), idx = [];
  for (let i = 0; i < SMOKE_N; i++) { const u = Math.random() * 6.28, r = Math.cbrt(Math.random()) * 0.8; off.set([Math.cos(u) * r, Math.random() * 0.7 + 0.1, Math.sin(u) * r, 0.75 + Math.random() * 0.5], i * 4); uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: softTex, color: 0xb8bcc0, transparent: true, opacity: 0.5, depthWrite: false })); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6; scene.add(mesh); return { mesh, off, pos, g, s: null };
});
function nadeView(G, SM) {
  const used = [0, 0]; for (const m of nadePool) m.visible = false;
  for (const [k, x, y, z] of G) { const m = nadePool[k + 2 * used[k]++]; if (m) { m.visible = true; m.position.set(x, y + 0.03, z); m.rotation.x += 0.6; } }
  smokePool.forEach((c, i) => { c.s = SM[i] || null; });
}
let smokeFog = 0, smokeFogCur = 0; const smokeCol = new THREE.Color();
function smokeDraw() {
  smokeFog = 0; const R = v1.set(1, 0, 0).applyQuaternion(head.quat), U = v2.set(0, 1, 0).applyQuaternion(head.quat);
  for (const c of smokePool) {
    const s = c.s; c.mesh.visible = !!s; if (!s) continue; const [x, y, z, t] = s, r = Math.min(3.4, 0.8 + t * 1.6), op = Math.min(1, t / 1.5) * (t > 16 ? (20 - t) / 4 : 1);
    // standing inside a cloud would mean many screen-filling layers; thick fog does the same job for almost nothing
    const dx = head.pos.x - x, dy = head.pos.y - y - 1, dz = head.pos.z - z; if (dx * dx + dy * dy * 0.5 + dz * dz < r * r * 0.8) { c.mesh.visible = false; smokeFog = Math.max(smokeFog, op); continue; }
    for (let i = 0; i < SMOKE_N; i++) { const cx = x + c.off[i * 4] * r, cy = y + c.off[i * 4 + 1] * r, cz = z + c.off[i * 4 + 2] * r, h = 0.62 * r * c.off[i * 4 + 3], p = c.pos, k = i * 12;
      p[k] = cx - (R.x + U.x) * h; p[k + 1] = cy - (R.y + U.y) * h; p[k + 2] = cz - (R.z + U.z) * h; p[k + 3] = cx + (R.x - U.x) * h; p[k + 4] = cy + (R.y - U.y) * h; p[k + 5] = cz + (R.z - U.z) * h;
      p[k + 6] = cx + (R.x + U.x) * h; p[k + 7] = cy + (R.y + U.y) * h; p[k + 8] = cz + (R.z + U.z) * h; p[k + 9] = cx - (R.x - U.x) * h; p[k + 10] = cy - (R.y - U.y) * h; p[k + 11] = cz - (R.z - U.z) * h; }
    c.g.attributes.position.needsUpdate = true; c.mesh.material.opacity = 0.5 * op; c.mesh.material.color.setHex(S.nvg ? 0x5aa868 : S.night ? 0x5a6068 : 0xb8bcc0);
  }
}
// ---------- under-door camera: a second small view rendered to a hand-held screen ----------
const dcam = { cam: new THREE.PerspectiveCamera(105, 4 / 3, 0.03, 40), rt: new THREE.WebGLRenderTarget(256, 192), door: -1, hand: null, n: 0 };
dcam.cam.layers.enable(5);   // it sees people the headset view has culled behind walls (layer 5, see occlude below)
dcam.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshBasicMaterial({ map: dcam.rt.texture, fog: false, toneMapped: false, depthTest: false })); dcam.screen.renderOrder = 992; dcam.screen.visible = false; scene.add(dcam.screen);
function doorCam(dt) {
  if (S.deskCam) { if ((S.deskCam.t -= dt) <= 0 || S.doorOpen[S.deskCam.id] || S.tool !== 'cam') S.deskCam = null; else { dcam.door = S.deskCam.id; dcam.hand = null; } }
  const i = dcam.door; dcam.door = -1; dcam.screen.visible = i >= 0; if (i < 0) return;
  const d = level.doors[i], side = d.horiz ? (Math.sign(d.cz - head.pos.z) || 1) : (Math.sign(d.cx - head.pos.x) || 1);   // look away from whoever is holding it
  dcam.cam.position.set(d.cx + (d.horiz ? 0 : side * 0.22), d.y + 0.1, d.cz + (d.horiz ? side * 0.22 : 0)); dcam.cam.lookAt(d.cx + (d.horiz ? 0 : side * 3), d.y + 0.9, d.cz + (d.horiz ? side * 3 : 0));
  if (dcam.hand) { dcam.screen.position.copy(dcam.hand.pos).y += 0.14; dcam.screen.lookAt(head.pos); } else { dcam.screen.position.copy(head.pos).addScaledVector(head.fwd, 0.55).addScaledVector(v1.set(1, 0, 0).applyQuaternion(head.quat), 0.24).addScaledVector(v1.set(0, 1, 0).applyQuaternion(head.quat), -0.12); dcam.screen.quaternion.copy(head.quat); }
  if (dcam.n++ % 2) return;                                             // refresh every other frame
  const xe = renderer.xr.enabled, rt = renderer.getRenderTarget(); renderer.xr.enabled = false; dcam.screen.visible = false; myBody.g.visible = false;
  renderer.setRenderTarget(dcam.rt); renderer.render(scene, dcam.cam); renderer.setRenderTarget(rt); renderer.xr.enabled = xe; dcam.screen.visible = true; myBody.g.visible = S.mode === 'vr';
}

// ---------- finger pose from what the hand holds and what the controller senses ----------
function handPose(h, o) {
  const I = h.in, P = h.pose || (h.pose = { i: 0, g: 0, t: 0 });
  if (gunIn(h)) { P.i = 0.3 + 0.5 * I.trig; P.g = 0.95; P.t = 0.85; }                                   // wrapped round the grip, index on the trigger
  else if (h.item) { P.i = 0.8; P.g = 0.88; P.t = 0.7; }                                               // magazine, grenade
  else if (h.support) { P.i = 0.75; P.g = 0.85; P.t = 0.5; }                                           // on the foregrip
  else if (h.rackG) { P.i = 0.9; P.g = 0.9; P.t = 0.8; }                                               // pinching the charging handle
  else if (S.tool !== 'hands' && h.tools[S.tool] && h.tools[S.tool].visible) { P.i = 0.55; P.g = 0.85; P.t = 0.6; }
  else { P.i = Math.max(I.trigT ? 0.22 : 0.05, I.trig * 0.95); P.g = 0.08 + I.grip * 0.87; P.t = I.thumb ? 0.55 : 0.1; }   // empty: point, fist, open
  return P;
}
// ---------- hostages who are still held (waiting to be freed) sob now and then: a man's or a woman's voice to match their model,
// one at a time, only within earshot, each on their own few-second rhythm. Dead, freed and shielded hostages are quiet ----------
const cryT = new Map(); let cryHold = 0;
function hostageCries(dt) {
  cryHold -= dt; if (!S.mode || S.phase !== 'active') return;
  for (const [id, a] of S.actors) {
    if (a.kind !== 'c' || a.st !== 'w') { cryT.delete(id); continue; }   // (heard through walls too: a hidden actor is only not drawn)
    let t = cryT.get(id); if (t === undefined) t = 2 + Math.random() * 10; t -= dt;
    if (t <= 0 && cryHold <= 0) { const p = a.g.position, d = Math.hypot(p.x - head.pos.x, p.z - head.pos.z);
      if (d < 16 && Math.abs(p.y - head.pos.y) < 4 && sfx.vo('vo_c_cry_' + (a.female ? 'f' : 'm'), v1.set(p.x, p.y + 1.0, p.z), 0.9)) { cryHold = 3.5; t = 9 + Math.random() * 10; } else t = 1.5; }
    cryT.set(id, t);
  }
}
// ---------- footsteps: suspects, hostages and teammates are heard walking (muffled through walls); your own steps are quieter ----------
const stepAcc = new Map(), stepPos = new THREE.Vector3(), myStep = { x: 0, z: 0, acc: 0, init: false };
function stepSound(key, x, y, z, moved, gainK, self) {
  let a = (stepAcc.get(key) || 0) + moved; const stride = 0.7;
  if (a > stride) { a -= stride; if (Math.hypot(x - head.pos.x, z - head.pos.z) < 26 || self) sfx.step(self ? null : stepPos.set(x, y + 0.05, z), level.floorAt(x, z, y), gainK); }
  stepAcc.set(key, Math.min(a, stride));
}
function footsteps() {
  for (const [id, a] of S.actors) { const st = a.st; if (!a.g.visible || !(st === 'g' || st === 'a' || st === 'c' || st === 'h') || a.moved < 0.003) continue; stepSound('n' + id, a.g.position.x, a.g.position.y, a.g.position.z, a.moved, Math.min(1.4, 0.5 + a.speed * 0.35)); }
  for (const [id, o] of S.officers) { const p = o.head.position, prev = o.lastStep || (o.lastStep = p.clone()), moved = Math.hypot(p.x - prev.x, p.z - prev.z); prev.copy(p); if (moved > 0.003 && moved < 1 && !o.down && !S.fly) stepSound('o' + id, p.x, p.y - 1.65, p.z, moved, 0.9); }
  if (!S.mode || S.me.down || S.fly) { myStep.init = false; return; } const moved = myStep.init ? Math.hypot(head.pos.x - myStep.x, head.pos.z - myStep.z) : 0; myStep.x = head.pos.x; myStep.z = head.pos.z; myStep.init = true;
  if (moved > 0.002 && moved < 1) stepSound('me', head.pos.x, S.feetY, head.pos.z, moved, S.crouch ? 0.12 : 0.28, true);
}
// sounds behind a wall, floor or closed door come through muffled
setOccluder((x, y, z) => { const dx = x - head.pos.x, dy = y - head.pos.y, dz = z - head.pos.z, d = Math.hypot(dx, dy, dz); return d > 0.5 && rayStatic(level, S.doorOpen, head.pos.x, head.pos.y, head.pos.z, dx / d, dy / d, dz / d, d, true) < d - 0.3; });
// ---------- walking out: a marked zone at the front gate, and a countdown while the squad stands in it ----------
const exitMat = new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.55, toneMapped: false }), exitTag = label('EXIT - LEAVE MISSION', '#7dffa0', 512, 64), exitMark = new THREE.Group(); scene.add(exitMark);
function buildExitMark() {   // a marked rectangle on the ground at the map's way out
  for (const c of [...exitMark.children]) { exitMark.remove(c); if (c.geometry) c.geometry.dispose(); }
  const E = M.exit, w = E.x1 - E.x0, d = E.z1 - E.z0;
  for (const [x, z, sx, sz] of [[0, -d / 2, w, 0.08], [0, d / 2, w, 0.08], [-w / 2, 0, 0.08, d], [w / 2, 0, 0.08, d]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.01, sz), exitMat); b.position.set(x, 0.035, z); exitMark.add(b); }
  exitTag.scale.set(1.6, 0.2, 1); exitTag.position.set(0, 2.2, M.id === 'mansion' ? -d / 2 + 0.3 : 0); exitMark.add(exitTag); exitMark.position.set((E.x0 + E.x1) / 2, E.y || 0, (E.z0 + E.z1) / 2);
}
function placeMapProps() { breaker.g.visible = !!M.breaker; if (M.breaker) { breaker.g.position.set(M.breaker.x, M.breaker.y, M.breaker.z); breaker.g.rotation.y = breakerFacing(M.breaker); } buildExitMark(); }
// The panel's front is its +z: it turns to face away from the wall it hangs on (the nearest wall within 0.4 m at its height)
function breakerFacing(b) {
  let best = null; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let r = 0.05; r <= 0.4; r += 0.05) {
    const x = b.x + dx * r, z = b.z + dz * r; if (level.boxes.some(w => (w.kind === 'wall' || w.kind === 'lintel') && x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && b.y > w.y0 && b.y < w.y1)) { if (!best || r < best.r) best = { r, dx, dz }; break; } }
  return best ? Math.atan2(-best.dx, -best.dz) : 0;
}
const missions = () => MISSION_IDS.filter(TEST.shown);   // quest-store: maps marked test only show in test mode (js/store/tester.js)
function nextMission() { return M.training ? (missions().includes(S.nextMap) ? S.nextMap : missions()[0]) : M.id; }
function cycleMap() {
  if (M.training) {   // built-in missions, then the published ones from the map library
    const ids = [...missions(), ...S.customList.map(c => c.id).filter(id => !MISSION_IDS.includes(id))], next = ids[(ids.indexOf(S.nextMap) + 1) % ids.length]; sfx.click();
    S.nextMap = next; showLobbyPanel(); ensureCustom(next).then(ok => { if (ok && S.nextMap === next) { net.send({ t: 'choose', m: next }); showLobbyPanel(); } }); return; }
  const vis = MAP_IDS.filter(TEST.shown), id = vis[(vis.indexOf(M.id) + 1) % vis.length]; sfx.click(); net.send({ t: 'map', m: id }); if (!net.ws && !net.host) { loadMap(id); showLobbyPanel(); } }
placeMapProps(); ready = true;
let exitT = 0, exitShown = -1;
function exitPrompt(dt) {
  exitMark.visible = S.phase === 'active' && !M.training && !(S.pvp && S.me.team === 'tango');
  const E = M.exit, inZone = S.phase === 'active' && head.pos.x > E.x0 && head.pos.x < E.x1 && head.pos.z > E.z0 && head.pos.z < E.z1, n = S.extract || 0;
  if ((exitT -= dt) > 0 || !inZone) return; exitT = 1;
  const text = n > 0 ? 'LEAVING IN ' + n : S.everInside ? 'WAITING FOR SQUAD' : null; if (!text) return;
  sayAt(head.pos.x + head.fwd.x * 1.4, head.pos.y + 0.1, head.pos.z + head.fwd.z * 1.4, text, n > 0 ? '#7dffa0' : '#ffd060'); if (n > 0 && n !== exitShown) sfx.beep(null, 900); exitShown = n;
}

// ---------- frame loop ----------
let last = performance.now(), poseT = 0, lobbyT = 0;
const arr7 = (p, q) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4)];
const code = h => h.item === 'rifle' ? 1 : h.item === 'pistol' ? 2 : h.item === 'mag' ? 3 : 0;
// People behind walls are not drawn (quest-store, VRC.Quest.Performance.1): every person is several draw calls per eye, and on
// the big maps most of them are in other rooms. A few people are checked each frame with sight lines from either side of your
// head to their head and chest (glass, breach windows included, lets sight through; anyone within 10 m is always drawn). Someone seen is drawn at once; someone unseen
// for half a second moves to layer 5 (1 and 2 are three.js's per-eye layers), which the headset view skips and the door and security cameras still draw. Only the
// drawing changes: they keep moving, talking and making footsteps.
const occ = { i: 0, eye: V(), dir: V(), side: V() };
function occlude(dt) {
  const list = [...S.actors.values()], n = list.length; if (!n) return;
  occ.side.set(-head.fwd.z, 0, head.fwd.x).normalize().multiplyScalar(0.35);
  // breach windows are doors in the game logic, but glass to the eye: sight passes them shut or broken
  const seeOpen = occ.open || (occ.open = []); for (let i = 0; i < level.doors.length; i++) seeOpen[i] = S.doorOpen[i] || !!level.doors[i].win; seeOpen.length = level.doors.length;
  for (let k = 0; k < Math.min(n, 8); k++) {
    const a = list[occ.i++ % n], p = a.g.position; a.occT = (a.occT || 0) + dt * n / Math.min(n, 8);
    let seen = !a.g.visible || Math.hypot(p.x - head.pos.x, p.z - head.pos.z) < 10;
    for (let e = -1; e <= 1 && !seen; e += 2) for (const h of [1.55, 0.95]) {
      occ.eye.copy(head.pos).addScaledVector(occ.side, e); occ.dir.set(p.x - occ.eye.x, p.y + h - occ.eye.y, p.z - occ.eye.z); const d = occ.dir.length(); occ.dir.multiplyScalar(1 / d);
      if (rayStatic(level, seeOpen, occ.eye.x, occ.eye.y, occ.eye.z, occ.dir.x, occ.dir.y, occ.dir.z, d) >= d - 0.35) { seen = true; break; }
    }
    if (seen) a.occT = 0;
    const hide = a.occT > 0.5; if (hide !== !!a.occHid || hide) { a.occHid = hide; a.g.traverse(o => { if (o.isMesh || o.isPoints || o.isSprite || o.isLine) { o.layers.set(hide ? 5 : 0); } }); }
  }
}
function frame(t) {
  const c0 = performance.now();
  perf.tick((t - last) / 1000, renderer.xr.isPresenting);
  { const want = !!S.mode && (!!M.training || !storeUI.started()) && S.music !== false; if (want !== S.musicOn) { S.musicOn = want; setMusic(want); } }   // quest-store: theme music on the main menu and in the training room (MUSIC toggle on the start menu)
  const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); last = t; S.now += dt;
  nvgFlip.tick(dt);
  if (ED.on) {   // building in the map editor: only the hands, the editor and the map
    readVR(); headWorld(); for (const h of hands) if (h.active) { (h.xr.src && h.xr.src.gripSpace ? h.xr.grip : h.xr.ray).getWorldPosition(h.pos); h.xr.ray.getWorldQuaternion(h.quat).multiply(tiltQ); }
    ED.tick(dt); setListener(head.pos, head.fwd, false); renderer.render(scene, camera); return;
  }
  if (S.spawnIn && --S.spawnIn === 0) { headWorld(); placeAtSpawn(); showLobbyPanel(); }
  carry(dt);
  if (TUT && S.mode && !S.spawnIn && S.me.id) { TUT = false; tut.start('core'); }   // the tutorial starts once you stand in the facility
  if (S.mode === 'vr') { readVR(); headWorld(); if (S.watch) watchMove(dt); else { moveVR(dt); collide(); } for (const h of hands) if (h.active) { (h.xr.src && h.xr.src.gripSpace ? h.xr.grip : h.xr.ray).getWorldPosition(h.pos); h.xr.ray.getWorldQuaternion(h.quat).multiply(tiltQ); } if (!S.watch) { ropes.tick(dt, hands[0].in); ledgePull(); } }
  else if (S.mode === 'desktop') {
    if (S.watch) watchDesk(dt); else moveDesktop(dt); ropes.tick(dt); collide(); camera.updateMatrixWorld(true);
    const h = hands[1]; h.pos.copy(S.ads ? v1.set(0, -guns[h.item || 'rifle'].ud.sightY, -0.3) : v1.set(0.16, -0.17, -0.34)).applyMatrix4(camera.matrixWorld); h.quat.copy(head.quat);
  } else { const a = t * 0.00005, Y = M.YARD, cx = (Y.x0 + Y.x1) / 2, cz = (Y.z0 + Y.z1) / 2, k = M.id === 'mansion' ? 1 : 2.6; camera.position.set(cx + Math.sin(a) * 26 * k, 9 * k, cz + 14 + Math.cos(a) * 14 * k); camera.lookAt(cx, 2, cz - 7); headWorld(); }
  for (const h of hands) { if (h.active) { v1.copy(h.pos).sub(h.last).multiplyScalar(1 / dt); if (v1.lengthSq() < 900) h.vel.lerp(v1, 0.45); h.last.copy(h.pos); } }
  placeGuns(dt);
  for (const h of hands) h.pose = handPose(h, hands[1 - h.i]);
  if (S.watch) { for (const g of Object.values(guns)) g.mesh.visible = false; }
  myBody.g.visible = S.mode === 'vr' && !S.watch; if (S.mode === 'vr' && !S.watch) myBody.update(head.pos, S.bodyYaw, [handOnGun(hands[0]), handOnGun(hands[1])], S.feetY, head.quat, { down: !!S.me.down, stride: 0.5, nvg: S.nvg });   // your own legs step, smaller
  if (S.mode === 'vr' && S.watch) watchHands(); else if (S.mode === 'vr') { handVR(hands[0], hands[1], dt); handVR(hands[1], hands[0], dt); }
  else if (S.mode === 'desktop' && !S.watch) { const h = hands[1], G = gunIn(h); if (G && !S.reloading) fire(h, G, hands[0]); mouseLPrev = mouseL; }
  if (S.deskPick) { const P = S.deskPick, d = level.doors[P.id]; if (S.doorOpen[P.id] && (P.lock || P.trap) || !(P.lock ? !S.doorLocked[P.id] : P.trap ? !S.doorTrap[P.id] : P.disarm ? S.doorTrap[P.id] : S.doorLocked[P.id]) || Math.hypot(d.cx - head.pos.x, d.cz - head.pos.z) > 2.2) S.deskPick = null; else if ((P.t += dt) >= 4) { net.send({ t: P.lock ? 'lockdoor' : P.trap ? 'trapdoor' : P.disarm ? 'disarm' : P.snip ? 'snip' : 'pick', d: P.id }); S.deskPick = null; } else if (Math.floor(P.t * 3) !== Math.floor((P.t - dt) * 3)) sfx.click(); }
  vestHints(); doorCam(dt); smokeDraw();
  if (smokeFog > 0.01 || smokeFogCur > 0.01) { if (!lookFog.on) { lookFog.on = true; lookFog.c.copy(scene.fog.color); lookFog.d = scene.fog.density; if (scene.background && scene.background.isColor) lookFog.bg.copy(scene.background); }
    smokeFogCur += (smokeFog - smokeFogCur) * Math.min(1, dt * 4); scene.fog.color.copy(lookFog.c); scene.fog.density = lookFog.d; if (scene.background && scene.background.isColor) scene.background.copy(lookFog.bg); if (smokeFogCur > 0.01) { scene.fog.density += smokeFogCur * 0.6; scene.fog.color.lerp(smokeCol.setRGB(S.nvg ? 0.2 : 0.5, S.nvg ? 0.5 : 0.51, S.nvg ? 0.25 : 0.53), smokeFogCur * 0.8); scene.background.copy(scene.fog.color); } else lookFog.on = false; }
  // a door lever lights up when an empty hand can work it
  for (const d of world.doors) d.hot = false;
  if (S.mode === 'vr') for (const h of hands) if (h.active && !h.item) { const i = nearestDoor(h.pos, 0.95); if (i >= 0) world.doors[i].hot = true; }
  for (const d of world.doors) d.hm.emissive.setHex(d.hot ? 0x30c060 : 0);
  // panel cursor
  panel.cursor.visible = false; coach.cursor.visible = false;
  if (coach.mesh.visible && S.mode === 'vr') for (const h of hands) { if (!h.active) continue; const G = gunIn(h); if (G) { G.mesh.localToWorld(v1.copy(G.ud.muzzle)); v2.set(0, 0, -1).applyQuaternion(G.mesh.quaternion); } else { v1.copy(h.pos); v2.set(0, 0, -1).applyQuaternion(h.quat); } if (coach.probe(v1, v2, true) !== null) break; }
  if (panel.mesh.visible && S.mode) for (const h of hands) { if (!h.active) continue; const G = gunIn(h); if (G) { G.mesh.localToWorld(v1.copy(G.ud.muzzle)); v2.set(0, 0, -1).applyQuaternion(G.mesh.quaternion); } else { v1.copy(h.pos); v2.set(0, 0, -1).applyQuaternion(h.quat); } if (panel.probe(v1, v2, true) !== null) break; }
  if ((S.phase === 'lobby' || M.training && S.phase === 'active') && !S.menu && (lobbyT -= dt) < 0) { lobbyT = 0.5; showLobbyPanel(); }
  updateTargets(dt); tut.tick(dt); for (const o of S.officers.values()) o.tick(dt); tickShards(dt);
  for (const o of S.officers.values()) { const p = o.head.position; if (S.fly && M.fly.aboard(p.x, p.z, p.y)) o.g.position.copy(S.fly.off); else o.g.position.set(0, 0, 0); }   // others aboard the helicopter ride in with it
  if (world && world.lampTick) world.lampTick(head.pos, dt);
  if (world && world.gfx.tick) world.gfx.tick(dt, { S, head, officers: S.officers, level, M, renderer, scene });
  { const rt = S.mode && S.phase !== 'ended' ? (S.ropeHint || ropes.prompt() || liftHint()) : ''; if (rt !== S.ropeSaid && !rt) S.ropeSaid = ''; if (rt && (rt !== S.ropeSaid || (S.rope && S.now - (S.ropeHintT || 0) > 7))) { S.ropeSaid = rt; S.ropeHintT = S.now;   /* once as it comes up; repeated now and then only while you hang on the rope */ sayAt(head.pos.x + head.fwd.x * 1.1, head.pos.y - 0.25, head.pos.z + head.fwd.z * 1.1, rt, '#9fffb0'); } }
  if (!S.watch) spectate(dt);
  if (race) { S.raceT += dt; race.update(S.raceT, head.pos, level.inside(head.pos.x, head.pos.z, head.pos.y)); }
  // world animation
  for (const a of S.actors.values()) a.update(dt);
  occlude(dt);
  breaker.cur += ((S.night ? 1 : 0) - breaker.cur) * Math.min(1, dt * 14); breaker.lever.rotation.x = breaker.cur * 2.2; breaker.led.material.color.setHex(S.night ? 0x401010 : 0x30ff60);
  world.doors.forEach((d, i) => { d.cur += ((S.doorOpen[i] ? 1.65 : 0) - d.cur) * Math.min(1, dt * 7); const D = level.doors[i];
    if (D.win) { d.g.visible = !S.doorOpen[i]; return; }   // a breach window: there, or burst
    if (D.lift !== undefined) { d.g.visible = !(world.gfx.liftDoors && world.gfx.liftDoors()); d.g.rotation.y = d.base; d.g.position.x = D.x0 - (D.x1 - D.x0) * 0.95 * d.cur / 1.65; return; }   // the lift's door slides aside
    d.g.visible = true; d.g.rotation.y = d.base + d.swing * d.cur; if (d.g2) d.g2.rotation.y = d.base + Math.PI - d.swing * d.cur; if (d.lock) d.lock.visible = !!S.doorLocked[i] && !S.doorOpen[i]; });
  for (const l of tracers) if (l.visible && (l.userData.t -= dt) <= 0) l.visible = false;
  for (const m of puffs) if (m.visible) { m.userData.t -= dt; m.material.opacity = Math.max(0, m.userData.t / 0.3); m.scale.setScalar(1 + (0.3 - m.userData.t) * 4); if (m.userData.t <= 0) m.visible = false; }
  for (let i = says.length - 1; i >= 0; i--) { const s = says[i]; s.t -= dt; s.s.position.y += dt * 0.1; if (s.t <= 0) { scene.remove(s.s); s.s.material.map.dispose(); s.s.material.dispose(); says.splice(i, 1); } }
  const blink = S.phase === 'active' && Math.floor(S.now * (S.timer < 60 ? 6 : 2)) % 2 === 0; for (const b of S.bombs) if (!b.defused) b.led.visible = blink; else b.led.visible = true;
  hurtT = Math.max(0, hurtT - dt * 1.5); flashWhite = Math.max(0, flashWhite - dt * 0.4);
  S.fadeT = Math.max(0, S.fadeT - dt); const vm = veil.material; if (flashWhite > 0) { vm.color.set(0xffffff); vm.opacity = flashWhite; } else if (S.fadeT > 0) { vm.color.set(0x000000); vm.opacity = Math.min(1, S.fadeT / 0.8); } else if (S.me.down) { vm.color.set(0x200000); vm.opacity = 0.72; } else { vm.color.set(0xaa0000); vm.opacity = hurtT * 0.45 + (S.me.hp < 40 && S.mode ? 0.12 : 0); }
  veil.visible = vm.opacity > 0.01; downTag.visible = S.me.down && S.phase === 'active';
  // wrist display on the left forearm, floating 7 cm above it so the sleeve doesn't cut into it
  wrist.visible = S.mode === 'vr' && hands[0].active && !S.watch;
  if (wrist.visible) { const h = hands[0]; wrist.position.copy(v1.set(0.07, -0.01, 0.12).applyQuaternion(h.quat).add(h.pos)); wrist.quaternion.copy(h.quat).multiply(WRIST_Q); }   // inside of the wrist: turn the palm up to read it
  if ((hudT -= dt) < 0) { hudT = 0.25; drawHud(); if (S.figT > 0) drawFig(); }
  S.figT = Math.max(0, S.figT - dt); fig.mesh.visible = S.figT > 0 && !!S.mode; fig.mesh.material.opacity = Math.min(1, S.figT);
  weather.update(dt, head.pos, () => sfx.thunder());
  setAmbience(S.wx === 'storm' ? 1 : S.wx === 'rain' ? 0.7 : 0, weather.state.inside);
  { const ins = level.inside(head.pos.x, head.pos.z, head.pos.y); setListener(head.pos, head.fwd, ins); setEnvInside(ins); }   // the reflections show pot lights indoors, the sky outside
  if (!S.watch) { footsteps(dt); exitPrompt(dt); }
  hostageCries(dt);
  if (S.mode && !S.watch && (poseT -= dt) < 0) { poseT = 1 / 12; net.send({ t: 'pose', h: arr7(fo(head.pos), head.quat), l: hands[0].active ? (lh => arr7(fo(lh.pos), lh.quat))(handOnGun(hands[0])) : null, r: hands[1].active ? (rh => arr7(fo(rh.pos), rh.quat))(handOnGun(hands[1])) : null, g: [code(hands[0]), code(hands[1])], f: S.light && torch.intensity > 0 ? 1 : 0 }); }
  const c1 = performance.now(); renderer.render(scene, camera); perf.cpuNote(c1 - c0, performance.now() - c1, renderer.info.render.calls);
}
renderer.setAnimationLoop(frame);

// ---------- lobby UI ----------
const nameIn = $('name'), roomIn = $('room');
nameIn.value = localStorage.getItem('bl_name') || ''; roomIn.value = [Q.get('room'), localStorage.getItem('bl_room')].map(c => (c || '').toUpperCase()).find(isRoomCode) || randomRoomCode();   // quest-store: 6-character codes
$('tilt').value = S.tilt; $('tiltv').textContent = S.tilt + '°'; $('tilt').oninput = e => { setTilt(+e.target.value); $('tiltv').textContent = S.tilt + '°'; };
let connecting = null;
function connect(solo) {
  if (connecting) return connecting;
  const name = (nameIn.value.trim() || 'Officer').slice(0, 14), typed = roomIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), room = solo ? (typed || 'SOLO') : isRoomCode(typed) ? typed : (roomIn.value = randomRoomCode());
  localStorage.setItem('bl_name', name); localStorage.setItem('bl_room', room); S.room = room; history.replaceState(null, '', '?room=' + room);
  if (DRAFT) solo = true;
  return connecting = net.connect(room, name, solo).then(r => { S.net = r; if (r === 'solo' && !solo) status('Can\'t reach the server: playing offline with AI officers.'); if (DRAFT) setTimeout(() => net.send({ t: 'start', wx: 'clear', map: 'draft', tod: DRAFT.style && DRAFT.style.night ? 'night' : 'day' }), 300); status(r === 'online' ? 'Connected to room ' + room + '. Friends join with the same code.' : solo ? 'Solo practice.' : 'Server not reachable: running solo practice on this device.'); return r; });
}
function begin(mode) { S.mode = mode; $('ui').style.display = 'none'; $('hud').style.display = mode === 'desktop' ? 'block' : 'none'; camera.rotation.set(0, 0, 0); camera.position.set(0, 1.66, 0); S.spawnIn = mode === 'vr' ? 4 : 0; placeAtSpawn(); resetLoadout(); showLobbyPanel(); }
$('vr').onclick = async () => {
  initAudio(); const solo = $('solo').checked;
  // the headset cannot show the microphone prompt once inside VR: ask on the page first, then enter VR with a second tap
  if (!solo && voice.on && !voice.mic && !voice.asked && await voice.permission() !== 'granted') { voice.asked = true; status('Allow the microphone for squad voice chat...'); const ok = await voice.startMic(); status(ok ? 'Microphone ready. Press ENTER VR again.' : voice.err + ' Press ENTER VR again to play without talking.'); return; }
  if (!solo && voice.on) voice.startMic().then(() => voice.unlock());
  try {
    const sp = navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); connect(solo);
    const session = await sp; perf.beforeSession(); await renderer.xr.setSession(session); perf.onSession(session); begin('vr');
    session.addEventListener('end', () => { S.mode = null; $('ui').style.display = 'flex'; });
  } catch (e) { status('Could not start VR: ' + (e && e.message || e)); }
};
$('desk').onclick = () => { initAudio(); if (!$('solo').checked && voice.on) voice.startMic().then(() => voice.unlock()); connect($('solo').checked); begin('desktop'); };
if (storeLaunch({ renderer, begin, resume: () => { S.mode = 'vr'; $('ui').style.display = 'none'; camera.position.set(0, 1.66, 0); camera.rotation.set(0, 0, 0); try { voice.unlock(); } catch (e) { } }, storeUI, voice, perf, initAudio, status, $ })) { /* store build: js/store/launch.js owns ENTER VR */ }
else if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { $('vr').disabled = !ok; if (!ok) $('vrnote').textContent = 'No VR headset detected on this device. Open this page in the Quest browser.'; }).catch(() => { $('vr').disabled = true; });
else { $('vr').disabled = true; $('vrnote').textContent = 'This browser has no WebXR. Open this page in the Quest browser.'; }
// ---------- phone / tablet controls: left thumb moves, right thumb looks, buttons do the rest ----------
function initTouch() {
  // iOS zooms the page on a double tap unless the touch itself is cancelled; pointer handlers alone do not stop it.
  for (const ev of ['touchstart', 'touchend', 'touchmove']) document.addEventListener(ev, e => { if (S.touch) e.preventDefault(); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  S.touch = true; $('touch').style.display = 'block'; document.body.classList.add('touching');
  const bind = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('on'); down(); }); const end = () => { el.classList.remove('on'); if (up) up(); }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end); };
  bind('bFire', () => { mouseL = true; }, () => { mouseL = false; }); bind('bAim', () => { S.ads = !S.ads; }); bind('bReload', () => deskKey('KeyR')); bind('bUse', () => deskKey('KeyE')); bind('bShout', () => deskKey('KeyF')); bind('bKick', () => deskKey('KeyQ'));
  bind('bMic', () => toggleMic()); bind('bOrd', () => { if (OW.open) closeOW(false); else openOW(); }); bind('bSwap', () => deskKey(hands[1].item === 'rifle' ? 'Digit2' : 'Digit1')); bind('bTool', () => deskKey({ hands: 'Digit4', pick: 'Digit5', cutters: 'Digit8', cam: 'Digit3' }[S.tool])); bind('bFlash', () => deskKey('Digit6')); bind('bSmoke', () => deskKey('Digit7')); bind('bMed', () => deskKey('KeyH')); bind('bNvg', () => deskKey('KeyN')); bind('bLight', () => deskKey('KeyT')); bind('bCrouch', () => deskKey('KeyC'));
  bind('bMenu', () => { S.tmenu = !S.tmenu; hudT = 0; }); bind('bDusk', () => { net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() }); S.tmenu = false; }); bind('bMap', () => { cycleMap(); hudT = 0; }); bind('bEnd', () => { net.send({ t: 'end' }); S.tmenu = false; }); bind('bHome', () => goHome()); bind('bTutT', () => { tut.showMenu(); S.tmenu = false; }); if (DRAFT) $('bHome').textContent = 'EDITOR'; bind('bWx', () => { cycleWx(); hudT = 0; }); bind('bTod', () => { cycleTod(); hudT = 0; }); bind('bTeam', () => { pickTeam(); hudT = 0; });
  const stick = $('tstick'), knob = $('tknob'); let sid = null;
  const sMove = e => { const r = stick.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(dx, dy)); S.tmove.x = dx / l; S.tmove.y = dy / l; knob.style.transform = `translate(${S.tmove.x * 34}px,${S.tmove.y * 34}px)`; };
  const sEnd = e => { if (e.pointerId !== sid) return; sid = null; S.tmove.x = S.tmove.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); sid = e.pointerId; try { stick.setPointerCapture(sid); } catch { } sMove(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) sMove(e); }); stick.addEventListener('pointerup', sEnd); stick.addEventListener('pointercancel', sEnd);
  let lid = null, lx = 0, ly = 0; const cv = renderer.domElement;
  cv.addEventListener('pointerdown', e => { if (lid !== null) return; initAudio(); lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; S.yaw -= (e.clientX - lx) * 0.0055; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - (e.clientY - ly) * 0.0055)); lx = e.clientX; ly = e.clientY; });
  const lEnd = e => { if (e.pointerId === lid) lid = null; }; cv.addEventListener('pointerup', lEnd); cv.addEventListener('pointercancel', lEnd);
}
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) $('tplay').style.display = 'block';
$('tplay').onclick = () => { initAudio(); if (!$('solo').checked && voice.on) voice.startMic().then(() => voice.unlock()); connect($('solo').checked); begin('desktop'); initTouch(); try { document.documentElement.requestFullscreen?.().catch(() => { }); screen.orientation?.lock?.('landscape').catch(() => { }); } catch { } };
let installEvt = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').style.display = 'inline-block'; });
$('install').onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; $('install').style.display = 'none'; } };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
// Self-update: a home-screen app can sit in memory for days; when it comes back to the front, check for a newer build and reload (never mid-mission)
const BUILD = 'q92';   // quest-store builds: q1, q2... (main uses vNN)
DBG.build = BUILD;
function checkBuild() { fetch('version.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : BUILD).then(v => { v = v.trim(); if (v && v !== BUILD && S.phase !== 'active' && !renderer.xr.isPresenting) location.reload(); }).catch(() => { }); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkBuild(); });
setTimeout(checkBuild, 3000);
window.__bl = { perf, storeUI, voice, drawBody, sfx, onEvent: e => onEvent(e), panelAct: a => { const pr = panel.probe; panel.probe = () => a; try { return tryPanel(v1.set(0, 0, 0), v2.set(0, 0, -1)); } finally { panel.probe = pr; } }, onMsg: m => onMsg(m), cycleMap: () => cycleMap(), showLobbyPanel: () => showLobbyPanel(), toggleMenu, goHome, ropes, ED, openEditor, get wheel() { return wheel; }, rifleMesh: guns.rifle.mesh, coach, tut, OW, orderTag, orderMark, showFit, fitStep, tryPanel, HOLSTER_ROT, camera, myBody, loadMap, get level() { return level; }, get M() { return M; }, get world() { return world; }, dcam, zoneFor, breaker, weather, initTouch, useMed, S, hands, guns, net, rig, camera, head, panel, renderer, begin, connect, keys, deskKey, bodyPt, HOLSTER, myBody, toggleMenu, toggleNVG, wheel, THREE, setMouse: v => { mouseL = v; } };
if (Q.get('auto')) { connect(true); begin(Q.get('auto') === 'touch' ? 'desktop' : Q.get('auto')); if (Q.get('auto') === 'touch') initTouch(); }
