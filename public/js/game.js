// BREACHLINE client: WebXR rig, manual weapon handling, interactions, networking, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld, label } from './gfx.js';
import { Human, Officer, Bomb, Body, RIG, makeRifle, makePistol, makeMag, makeTool, makeNade } from './actors.js';
import { loadCar, loadParkedCars } from './car.js';
import { voiceState, initAudio, setListener, setAmbience, setOccluder, sfx } from './audio.js';
import { makeWeather } from './weather.js';
import { loadVegetation } from './veg.js';
import { resolveCircle, rayStatic, MAP_IDS, MAPS, MISSION_IDS } from './core/level.js';
import { createRace } from './race.js';
import { createGun, pullTrigger, ejectMag, insertMag, release, rack, toggleMode, GUNS } from './core/weapon.js';
import { RoomHost, TICK } from './core/host.js';

const $ = id => document.getElementById(id), Q = new URLSearchParams(location.search);
const V = () => new THREE.Vector3(), v1 = V(), v2 = V(), v3 = V(), v4 = V(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
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
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 640), rig = new THREE.Group();
camera.rotation.order = 'YXZ'; rig.add(camera); scene.add(rig);
addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
// The world is rebuilt when the squad picks another map in the lobby: geometry, doors, lights, the breaker, the exit, plants and cars.
let world = null, level = null, M = null, extras = [], mapGen = 0, ready = false;

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
function loadMap(id, tod) {
  const T = MAPS[id] && MAPS[id].tods ? (MAPS[id].tods.includes(tod) ? tod : (world && world.level.id === id ? world.tod : MAPS[id].tods[0])) : 'dusk';
  if (world && world.level.id === id && world.tod === T) return;
  if (world) world.dispose(); if (race) { race.dispose(); race = null; } for (const o of extras) { scene.remove(o); o.geometry && o.geometry.dispose(); } extras = []; const gen = ++mapGen;
  world = buildWorld(scene, id, T); level = world.level; M = level.map; if (M.race) race = createRace(scene);
  buildTargets();
  if (ready) { S.doorTrap = level.doors.map(() => 0); S.doorOpen = level.doors.map(() => false); S.doorLocked = level.doors.map(() => false); S.deskCam = null; S.deskPick = null; for (const h of hands) h.hold = null; placeMapProps(); applyLook(); }
  renderer.shadowMap.needsUpdate = true;
  if (!Q.get('lite')) {   // ?lite=1 skips the heavy models (used by the automated tests)
    const keep = m => { if (!m || gen !== mapGen) { if (m) scene.remove(m); return; } if (m.isMesh) m.castShadow = m.receiveShadow = true; extras.push(m); renderer.shadowMap.needsUpdate = true; };
    if (M.veg) loadVegetation(scene, M).then(v => keep(v && v.mesh)).catch(e => console.warn('vegetation not loaded', e));
    for (const c of M.cars || []) loadCar(scene, c.x, 0, c.z, Math.PI, c.length).then(keep).catch(e => console.warn('car not loaded', e));
    if (M.parked) loadParkedCars(scene, M.parked).then(keep).catch(e => console.warn('parked cars not loaded', e));
  }
}
loadMap(MAP_IDS.includes(Q.get('map')) ? Q.get('map') : 'training');   // everyone arrives at the training facility; the mission board sends the squad out

const S = { mode: null, me: { id: 0, slot: 0, hp: 100, down: false, w: 0, med: false, fl: 2, sm: 1 }, doorTrap: level.doors.map(() => 0), deskCam: null, touch: false, tmove: { x: 0, y: 0 }, tmenu: false, figT: 0, lastPart: '', phase: 'lobby', timer: 600, doorOpen: level.doors.map(() => false), actors: new Map(), officers: new Map(), bombs: [], feetY: 0,
  net: 'offline', room: '', report: null, doorLocked: level.doors.map(() => false), bodyYaw: 0, panel: 'lobby', menu: false, deskPick: null, night: false, nvg: false, tool: 'hands', hintT: 0, wx: 'clear', wxPick: 'random', squad: [], secured: 0, civs: 5, defused: 0, light: true, now: 0, eye: 1.66, crouch: false, yaw: 0, pitch: 0, ads: false, reloading: false, tilt: +(localStorage.getItem('bl_tilt') || 0) };
S.nextMap = MISSION_IDS[0]; S.todPick = 'random'; S.raceT = 0;
const head = { pos: V(), quat: new THREE.Quaternion(), fwd: V(), yaw: 0 };
const status = t => { $('status').textContent = t; };

// ---------- networking ----------
const net = {
  ws: null, host: null, timer: null,
  connect(room, name, solo) {
    return new Promise(res => {
      if (solo) { this.local(name); return res('solo'); }
      let done = false; const fail = () => { if (done) { if (S.net === 'online') { S.net = 'lost'; status('Connection lost. Reload to rejoin.'); } return; } done = true; this.ws = null; this.local(name); res('solo'); };
      try {
        const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws/' + room + '?name=' + encodeURIComponent(name));
        ws.onopen = () => { done = true; res('online'); }; ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } }; ws.onerror = fail; ws.onclose = fail;
        setTimeout(() => { if (!done) { try { ws.close(); } catch { } fail(); } }, 5000);
      } catch { fail(); }
    });
  },
  local(name) { this.host = new RoomHost((id, o) => onMsg(JSON.parse(JSON.stringify(o)))); this.host.join(1, name); this.timer = setInterval(() => this.host.tick(), TICK * 1000); },
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); else if (this.host) this.host.message(1, o); },
};

// ---------- hands & guns ----------
const mkIn = () => ({ trig: 0, grip: 0, a: 0, b: 0, stick: 0, sx: 0, sy: 0, thumb: 0, trigT: 0 });
const hands = [0, 1].map(i => { const h = { i, pos: V(), quat: new THREE.Quaternion(), active: false, item: null, magKind: null, support: false, rackG: null, rackStart: V(), rackDone: false, hold: null, aT: 0, vel: V(), last: V(), zone: null, in: mkIn(), prev: mkIn(), pad: null, xr: null, mags: { rifle: makeMag('rifle', true), pistol: makeMag('pistol') }, tools: { pick: makeTool('pick'), cutters: makeTool('cutters'), cam: makeTool('cam') }, nades: { flash: makeNade('flash'), smoke: makeNade('smoke') } }; for (const m of [...Object.values(h.mags), ...Object.values(h.tools), ...Object.values(h.nades)]) { m.visible = false; scene.add(m); } return h; });
const press = (h, k) => h.in[k] > 0.5 && !(h.prev[k] > 0.5), released = (h, k) => !(h.in[k] > 0.5) && h.prev[k] > 0.5;
const buzz = (h, s, ms) => { try { h.pad && h.pad.hapticActuators && h.pad.hapticActuators[0] && h.pad.hapticActuators[0].pulse(s, ms); } catch { } };
const mkGun = (kind, mesh) => { scene.add(mesh); return { kind, st: createGun(kind), mesh, ud: mesh.userData, where: 'holster', mags: GUNS[kind].mags, kick: 0, flashT: 0 }; };
const guns = { rifle: mkGun('rifle', makeRifle(true, true)), pistol: mkGun('pistol', makePistol(true, true)) };
const gunIn = h => (h.item === 'rifle' || h.item === 'pistol') ? guns[h.item] : null;
const PISTOL_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.3);
const HOLSTER = RIG, HOLSTER_ROT = { rifle: [-1.3, 0, 0.5], pistol: [-1.5, 0, 0] }, _he = new THREE.Euler();   // grab zones sit exactly where the holders are drawn on the vest and belt
const bodyPt = (off, out) => out.set(off[0], 0, off[2] + (S.mode === 'vr' ? myBody.back || 0 : 0)).applyAxisAngle(UP, S.bodyYaw)   // gear moves back with your body as you look down
  .add(head.pos).setY(head.pos.y + off[1]);
const myBody = new Body(true); myBody.g.visible = false; scene.add(myBody.g);
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const torch = new THREE.SpotLight(0xfff2dd, 16, 30, 0.44, 0.8, 1.6); torch.visible = false; scene.add(torch, torch.target);
const xrc = [0, 1].map(i => { const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i); rig.add(ray, grip); const o = { ray, grip, src: null }; ray.addEventListener('connected', e => { o.src = e.data; }); ray.addEventListener('disconnected', () => { o.src = null; }); return o; });
const tiltQ = new THREE.Quaternion(); const setTilt = d => { S.tilt = d; tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), d * Math.PI / 180); localStorage.setItem('bl_tilt', d); }; setTilt(S.tilt);

function resetLoadout() {
  // fresh ammunition; whatever is already in your hands stays there
  for (const k in guns) { const G = guns[k], mode = G.st.mode; G.st = createGun(k); G.st.mode = mode; G.mags = GUNS[k].mags; G.kick = 0; }
  for (const h of hands) { if (h.item === 'mag') h.item = null; h.rackG = null; h.hold = null; }
  if (S.mode === 'desktop' && !gunIn(hands[1])) { guns.rifle.where = 1; hands[1].item = 'rifle'; }
  S.reloading = false;
}
function placeAtSpawn() {
  const sp = S.spawnAt, [x, z] = sp ? [sp[0], sp[2]] : M.spawn[S.me.slot % 4], fy = sp ? sp[1] : 0; S.feetY = fy; rig.rotation.y = 0; S.yaw = 0; S.pitch = 0;   // terrorist players start inside
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
function sayAt(x, y, z, text, color) { const s = label(text, color); s.position.set(x, y, z); scene.add(s); says.push({ s, t: 2.2 }); }
function say(actor, text, color) { const p = actor.g.position; sayAt(p.x, p.y + (actor.body.position.y < 0 ? 1.5 : 2.0), p.z, text, color); }
const bars = hands.map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.014), new THREE.MeshBasicMaterial({ color: 0x40ff80, depthTest: false, fog: false })); m.renderOrder = 997; m.visible = false; scene.add(m); return m; });
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })); veil.position.z = -0.3; veil.renderOrder = 998; camera.add(veil);
const downTag = label('OFFICER DOWN - WAIT FOR A TEAMMATE', '#ff8080', 768, 64); downTag.scale.set(1.2, 0.1, 1); downTag.position.set(0, 0, -1.2); downTag.visible = false; camera.add(downTag);
let hurtT = 0, flashWhite = 0;
// night vision: the scene is relit in amplified green (see gfx look), and a goggle mask narrows the view
const nvgMask = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 60, 128, 128, 104); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, depthWrite: false, fog: false })); m.position.z = -0.32; m.renderOrder = 996; m.visible = false; camera.add(m); return m; })();
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
const nearBreaker = (p, d) => Math.hypot(p.x - M.breaker.x, p.y - M.breaker.y, p.z - M.breaker.z) < d;
const applyLook = () => { world.look(S.night, S.nvg, S.wx); weather.set(S.wx, S.night, S.nvg); nvgMask.visible = S.nvg; irLamp.intensity = S.nvg ? (S.night ? 3.2 : 1.2) : 0; };
function toggleNVG() { S.nvg = !S.nvg; sfx.nvg(S.nvg); applyLook(); }
function hint(x, y, z, text) { if (S.now - S.hintT < 1.2) return; S.hintT = S.now; sayAt(x, y, z, text, '#ffd060'); sfx.beep(null, 300); }
// wounds: a leg hit slows you, an arm hit shakes your aim; a body diagram shows where you were hit
const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'], FIG = { head: [14, 0, 12, 12], torso: [10, 13, 20, 26], armL: [2, 13, 7, 26], armR: [31, 13, 7, 26], legL: [10, 40, 9, 34], legR: [21, 40, 9, 34] };
const legMul = () => [1, 0.65, 0.4][(S.me.w >> 4 & 1) + (S.me.w >> 5 & 1)] * (S.me.holding ? 0.5 : 1), armShake = () => [0, 0.012, 0.026][(S.me.w >> 2 & 1) + (S.me.w >> 3 & 1)];
function drawBody(g, x, y, k, flash) { PARTS.forEach((p, i) => { const [a, b, c, d] = FIG[p]; g.fillStyle = p === flash ? '#ffffff' : S.me.w & (1 << i) ? '#e03030' : '#46505c'; g.fillRect(x + a * k, y + b * k, c * k, d * k); }); }
const fig = (() => { const c = document.createElement('canvas'); c.width = 96; c.height = 176; const tex = new THREE.CanvasTexture(c); const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.156), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })); mesh.position.set(-0.17, -0.05, -0.5); mesh.renderOrder = 994; mesh.visible = false; camera.add(mesh); return { c, tex, mesh }; })();
function drawFig() { const g = fig.c.getContext('2d'); g.clearRect(0, 0, 96, 176); g.fillStyle = 'rgba(5,8,12,0.7)'; g.fillRect(0, 0, 96, 176); drawBody(g, 8, 8, 2, Math.floor(S.now * 5) % 2 ? S.lastPart : ''); g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.fillText(S.lastPart ? ({ head: 'HEAD', torso: 'TORSO', armL: 'LEFT ARM', armR: 'RIGHT ARM', legL: 'LEFT LEG', legR: 'RIGHT LEG' })[S.lastPart] : 'TREATED', 48, 170); fig.tex.needsUpdate = true; }
function useMed() { if (S.me.down) return; if (S.me.med) { hint(head.pos.x + head.fwd.x, head.pos.y, head.pos.z + head.fwd.z, 'MED KIT USED'); return; } net.send({ t: 'heal' }); }
// tool wheel: hold the free hand's lower button, move the hand toward a wedge, let go
// PvP terrorist players: the lockpick locks a door, the cutters rig a wire trap (two of each)
const tangoTools = () => S.pvp && S.me.team === 'tango';
const toolLabel = (k, text) => !tangoTools() ? text : k === 'pick' ? 'LOCK (' + (S.me.locks || 0) + ')' : k === 'cutters' ? 'TRAP (' + (S.me.traps || 0) + ')' : text;
const WEDGE = [['pick', 'LOCKPICK', -90], ['cutters', 'CUTTERS', -30], ['cam', 'DOOR CAM', 30], ['med', 'MED KIT', 90], ['hands', 'HANDS', 150], ['nvg', 'NVG', 210]];
const wheel = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })); mesh.renderOrder = 995; mesh.visible = false; scene.add(mesh); return { c, tex, mesh, open: false, hand: null, sel: undefined }; })();
function drawWheel(sel) {
  if (sel === wheel.sel) return; wheel.sel = sel; const g = wheel.c.getContext('2d'); g.clearRect(0, 0, 256, 256);
  for (const [k, text, deg] of WEDGE) { const a = deg * Math.PI / 180, on = k === sel, cur = k === S.tool || (k === 'nvg' && S.nvg), used = k === 'med' && S.me.med;
    g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 124, a - 0.5, a + 0.5); g.closePath(); g.fillStyle = on ? (used ? '#5a2a2a' : '#1f7a3d') : 'rgba(12,17,24,0.86)'; g.fill(); g.strokeStyle = cur ? '#7dffa0' : '#3a6ea5'; g.lineWidth = cur ? 5 : 2; g.stroke();
    g.fillStyle = used ? '#8a8f96' : '#fff'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(used ? 'USED' : toolLabel(k, text), 128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); }
  g.beginPath(); g.arc(128, 128, 26, 0, 7); g.fillStyle = '#0c1118'; g.fill(); wheel.tex.needsUpdate = true;
}
function openWheel(h) { wheel.open = true; wheel.hand = h; wheel.mesh.position.copy(h.pos); wheel.mesh.lookAt(head.pos); wheel.mesh.updateMatrixWorld(true); wheel.mesh.visible = true; wheel.sel = undefined; drawWheel(null); buzz(h, 0.4, 20); }
function wheelPick(h) {
  const p = wheel.mesh.worldToLocal(v1.copy(h.pos)); if (Math.hypot(p.x, p.y) < 0.04) return null;
  const a = Math.atan2(-p.y, p.x) * 180 / Math.PI; let best = null, bd = 999; for (const [k, , deg] of WEDGE) { let d = Math.abs(a - deg) % 360; if (d > 180) d = 360 - d; if (d < bd) { bd = d; best = k; } } return best;
}
function closeWheel(h) { const k = wheelPick(h); wheel.open = false; wheel.mesh.visible = false; if (k === 'nvg') toggleNVG(); else if (k === 'med') useMed(); else if (k) { S.tool = k; sfx.click(); buzz(h, 0.6, 30); } }

// ---------- panels ----------
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
    g.textAlign = 'left'; g.font = '28px sans-serif';
    lines.forEach((l, i) => { const [a, b] = Array.isArray(l) ? l : [l, null]; g.fillStyle = b != null && b < 0 ? '#ff8a8a' : '#d5dde6'; g.fillText(a, 60, 190 + i * 39); if (b != null) { g.textAlign = 'right'; g.fillText((b > 0 ? '+' : '') + b, 964, 190 + i * 39); g.textAlign = 'left'; } });
    // up to three buttons stack full width; more than that, the settings go two to a row and the last (START) runs full width
    if (btns.length <= 3) this.btns = btns.map(([text, act], i) => ({ x: 232, y: 676 - (btns.length - 1 - i) * 86, w: 560, h: 74, text, act }));
    else { const n = btns.length - 1, rows = Math.ceil(n / 2); this.btns = btns.slice(0, n).map(([text, act], i) => ({ x: i % 2 ? 517 : 60, y: 676 - 86 * (rows - Math.floor(i / 2)), w: 447, h: 74, text, act })); const [t, a] = btns[n]; this.btns.push({ x: 60, y: 676, w: 904, h: 74, text: t, act: a }); }
    for (const b of this.btns) { g.fillStyle = b.act === 'close' || b.act === 'wx' || b.act === 'tod' ? '#39424e' : b.act === 'team' ? (S.me.team === 'tango' ? '#8a2a1f' : '#1f4a8a') : '#1f7a3d'; g.fillRect(b.x, b.y, b.w, b.h); g.fillStyle = '#fff'; let f = 38; g.font = 'bold ' + f + 'px sans-serif'; while (f > 18 && g.measureText(b.text).width > b.w - 24) { f -= 2; g.font = 'bold ' + f + 'px sans-serif'; } g.textAlign = 'center'; g.fillText(b.text, b.x + b.w / 2, b.y + 51); }
    this.tex.needsUpdate = true;
  }
  place(x, y, z, tx, tz) { this.mesh.position.set(x, y, z); this.mesh.lookAt(tx, y, tz); this.mesh.updateMatrixWorld(true); }
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
// PvP: each player picks a side on the board; one terrorist is enough to make the next mission a PvP round
const pvpOn = () => (S.squadT || []).some(t => t === 'tango');
const teamBtn = () => ['TEAM: ' + (S.me.team === 'tango' ? 'TERRORIST' : 'SWAT'), 'team'];
const squadLine = () => (pvpOn() ? 'PvP  -  ' : 'Squad: ') + ((S.squad || []).map((n, i) => n + ((S.squadT || [])[i] === 'tango' ? ' (T)' : pvpOn() ? ' (SWAT)' : '')).join(', ') || '-');
function showLobbyPanel() {
  if (S.menu) return; if (M.training) return showBoard(); S.panel = 'lobby'; panel.mesh.visible = true; const P = M.lobby; panel.place(P.x, P.y, P.z, P.tx, P.tz);
  panel.draw('BREACHLINE', M.op + '  -  ' + (S.net === 'online' ? 'Room ' + S.room : S.net === 'solo' ? 'Solo practice (not connected)' : 'connecting'),
    [squadLine(), ...M.brief, 'Free hand: grip/trigger = doors, stick click = KICK,', 'HOLD A/X = TOOL WHEEL, tap = light, B/Y = SHOUT. Helmet = NVG.',
      'Gun hand A/X: drop mag  B/Y: bolt  stick: semi/auto. Radio: MENU', M.id === 'mansion' ? 'Lights out: MAIN BREAKER in the basement plant room.' : M.id === 'grandprix' ? 'Lights out: MAIN BREAKER in the electrical room behind the garages.' : M.id === 'airport' ? 'Lights out: MAIN BREAKER in the electrical room behind airport police.' : 'Lights out: MAIN BREAKER in the operations building.'], [['MAP: ' + M.name, 'map'], ['WEATHER: ' + S.wxPick.toUpperCase(), 'wx'], ...(M.tods ? [['TIME: ' + S.todPick.toUpperCase(), 'tod']] : []), teamBtn(), ['START ' + (pvpOn() ? 'PVP ' : '') + 'MISSION', 'start']]);
}
function showBoard() {   // the mission board in the training lobby: pick where the squad goes next, see how the range went
  S.panel = 'lobby'; panel.mesh.visible = true; const P = M.lobby; panel.place(P.x, P.y, P.z, P.tx, P.tz); const T = trainLine(), nx = MAPS[S.nextMap] || MAPS[MISSION_IDS[0]];
  panel.draw('MISSION BOARD', 'Training facility  -  ' + (S.net === 'online' ? 'Room ' + S.room : S.net === 'solo' ? 'Solo (not connected)' : 'connecting'),
    [squadLine(), 'Next: ' + nx.op + '  (' + nx.name + ')', 'Range: hits ' + T.hits + '/' + T.shots + ' (' + T.acc + '%)  no-shoot hits ' + T.ns,
      'Kill house (east): ' + T.run + '   best ' + T.best + '   +5s per no-shoot hit', 'Skill bay: pick, kick and a rigged door; dummy bomb on the bench.',
      'Red = armed, shoot.  Blue = no-shoot.', 'Free hand: grip/trigger = doors, stick click = KICK, HOLD A/X = TOOLS.'],
    [['MISSION: ' + nx.name, 'map'], ['WEATHER: ' + S.wxPick.toUpperCase(), 'wx'], ...(nx.tods ? [['TIME: ' + S.todPick.toUpperCase(), 'tod']] : []), teamBtn(), ['START ' + (pvpOn() ? 'PVP ' : '') + 'MISSION', 'start']]);
}
function showEndPanel() {
  const R = S.report; if (!R || S.menu) return; S.panel = 'end'; panel.mesh.visible = true; frontOfHead(1.9);
  const tm = Math.floor(R.time / 60) + ':' + String(R.time % 60).padStart(2, '0');
  panel.draw(R.result, R.pvp ? (R.winner === S.me.team ? 'YOUR SIDE WON' : 'YOUR SIDE LOST') + '   Time ' + tm : 'Grade ' + R.grade + '   Score ' + R.total + '/100   Time ' + tm, R.lines, [['RESTART', 'start'], ['TRAINING', 'train']]);
}
function frontOfHead(d) { const f = v1.copy(head.fwd).setY(0).normalize(); panel.place(head.pos.x + f.x * d, Math.max(head.pos.y, S.feetY + 1.2), head.pos.z + f.z * d, head.pos.x, head.pos.z); }
function toggleMenu(open = !S.menu) {
  S.menu = open; sfx.beep(null, open ? 900 : 600);
  if (open) { panel.mesh.visible = true; frontOfHead(1.3); panel.draw('MENU', S.net === 'online' ? 'Room ' + S.room : 'Solo practice', ['Restart deals a new mission for the whole squad:', 'new suspect, hostage and bomb positions.', 'Now: power ' + (S.night ? 'OFF' : 'ON') + ', weather ' + S.wx.toUpperCase(), 'End Mission scores what is done now. Or walk out the gate.'], [['WEATHER: ' + S.wxPick.toUpperCase(), 'wx'], ...(S.phase === 'active' ? [['END MISSION', 'end']] : []), ['RESTART MISSION', 'start'], ['CLOSE', 'close']]); }
  else if (S.phase === 'ended') showEndPanel(); else if (S.phase === 'lobby' || M.training) showLobbyPanel(); else { panel.mesh.visible = false; S.panel = null; }
}
function tryPanel(o, d) {
  const act = panel.probe(o, d, false); if (!act) return act === '';   // a pull on the panel background is swallowed, not fired
  if (act === 'wx') { cycleWx(); if (S.menu) toggleMenu(true); else showLobbyPanel(); return true; }
  if (act === 'tod') { cycleTod(); showLobbyPanel(); return true; }
  if (act === 'team') { pickTeam(); return true; }
  if (act === 'map') { cycleMap(); return true; }
  if (act === 'end') { net.send({ t: 'end' }); toggleMenu(false); return true; }
  if (act === 'train') { net.send({ t: 'restart', wx: S.wxPick, map: 'training' }); sfx.beep(null, 900); return true; }
  if (act === 'close') toggleMenu(false); else { net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() }); if (S.menu) toggleMenu(false); else sfx.beep(null, 900); }
  return true;
}

// wrist display (VR) + DOM HUD (desktop)
const wc = document.createElement('canvas'); wc.width = 512; wc.height = 352; const wtex = new THREE.CanvasTexture(wc); wtex.anisotropy = 4;
const wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), new THREE.MeshBasicMaterial({ map: wtex, fog: false, toneMapped: false })); wrist.visible = false; scene.add(wrist);
let hudT = 0;
function hudText() {
  const t = Math.max(0, S.timer), mm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  if (M.training) { const T = trainLine(); return { mm: 'RANGE', hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: 'HITS ' + T.hits + '/' + T.shots + '  NO-SHOOT ' + T.ns + '  HOUSE ' + T.run + ' (best ' + T.best + ')', mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() }; }
  if (S.spec) return { mm, hp: S.me.hp, err: '', obj: 'DOWN - SPECTATING ' + S.spec, mags: S.me.team === 'tango' ? 'TERRORIST' : 'SWAT' };
  if (S.pvp && S.me.team === 'tango') return { mm, hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: 'TERRORIST  HOSTAGES RESCUED ' + S.secured + '/' + S.civs + '  BOMBS LIVE ' + (S.bombs.length - S.defused) + '  LOCKS ' + (S.me.locks || 0) + '  TRAPS ' + (S.me.traps || 0), mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() };
  return { mm, hp: S.me.hp, err: ERRS[ERRS.length - 1] || '', obj: (S.pvp ? 'SWAT  ' : '') + 'HOSTAGES ' + S.secured + '/' + S.civs + '  BOMBS ' + S.defused + '/' + S.bombs.length + (S.hvt ? '  HVT ' + S.hvt : '') + (S.wx !== 'clear' ? '  ' + S.wx.toUpperCase() : ''), mags: 'MAGS R' + guns.rifle.mags + ' P' + guns.pistol.mags + ' ' + guns.rifle.st.mode.toUpperCase() + '  ' + ({ hands: 'HANDS', pick: 'PICK', cutters: 'CUTTERS', cam: 'CAM' })[S.tool] + (S.nvg ? ' NVG' : '') + ' F' + S.me.fl + ' S' + S.me.sm };
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
    if (S.touch) { $('tstart').style.display = S.phase !== 'active' || S.tmenu || M.training ? 'flex' : 'none'; $('tstart').classList.toggle('tr', !!M.training && !S.tmenu); $('bMap').textContent = M.training ? 'MISSION: ' + (MAPS[S.nextMap] || MAPS[MISSION_IDS[0]]).name : 'MAP: ' + M.name; $('bEnd').style.display = S.phase === 'active' && !M.training ? 'flex' : 'none'; $('bTool').textContent = tangoTools() && (S.tool === 'pick' || S.tool === 'cutters') ? toolLabel(S.tool, '') : ({ hands: 'HANDS', pick: 'PICK', cutters: 'CUTTER', cam: 'CAM' })[S.tool]; $('bFlash').textContent = 'FLASH ' + S.me.fl; $('bSmoke').textContent = 'SMOKE ' + S.me.sm; $('bMed').style.opacity = S.me.med ? 0.3 : 1; $('bWx').textContent = 'WEATHER: ' + S.wxPick.toUpperCase(); { const nx = M.training ? MAPS[S.nextMap] : M; $('bTod').style.display = $('tstart').style.display !== 'none' && nx && nx.tods ? 'flex' : 'none'; $('bTod').textContent = 'TIME: ' + S.todPick.toUpperCase(); } $('bTeam').style.display = $('tstart').style.display; $('bTeam').textContent = 'TEAM: ' + (S.me.team === 'tango' ? 'TERRORIST' : 'SWAT');  $('bMap').style.display = S.phase !== 'active' || M.training ? 'flex' : 'none'; $('bAim').classList.toggle('on', S.ads); }
  }
}

// ---------- server messages ----------
function applyInit(init) {
  S.pvp = !!init.pvp; S.spawnAt = init.ph === 'active' && init.sp && init.sp[S.me.id] || null;
  if (init.rt != null) S.raceT = init.rt;
  if (init.map && (init.map !== M.id || (init.tod && init.tod !== world.tod))) { loadMap(init.map, init.tod); localStorage.setItem('bl_map', init.map); if (S.mode && S.phase !== 'active') placeAtSpawn(); }
  for (const a of S.actors.values()) scene.remove(a.g, a.blob); S.actors.clear(); for (const b of S.bombs) scene.remove(b.g); S.bombs = []; S.hvtId = 0;
  for (const [id, kind, v, hvt] of init.npcs) { const a = new Human(kind, v, id); scene.add(a.g, a.blob); S.actors.set(id, a); if (hvt) S.hvtId = id; }
  S.civs = init.npcs.filter(n => n[1] === 'c').length; if (S.night !== !!init.night || S.wx !== init.weather) { S.night = !!init.night; S.wx = init.weather || 'clear'; applyLook(); }
  for (const [x, y, z, wires, order, yaw] of init.bombs) { const b = new Bomb(x, y, z, wires, order, yaw); b.order = order; b.n = 0; scene.add(b.g); S.bombs.push(b); }
}
function onMsg(m) {
  if (m.t === 'welcome') { const want = M.id; S.me.id = m.id; S.me.slot = m.slot; applyInit(m.init); placeAtSpawn(); resetLoadout(); if (m.n === 1 && (m.ph !== 'active' || m.init.map === 'training') && want !== m.init.map) net.send({ t: 'map', m: want }); }   // first in an empty room: it loads the map you picked
  else if (m.t === 'init') { applyInit(m.init); if (S.phase !== 'active' || M.training) showLobbyPanel(); }
  else if (m.t === 'full') status('That room is full (4 officers). Try another code.');
  else if (m.t === 's') applySnap(m);
}
function applySnap(m) {
  const prev = S.phase; S.phase = m.ph; S.timer = m.tm; S.extract = m.X || 0; if (S.mode && level.objective(head.pos.x, head.pos.z)) S.everInside = true; if (m.ph !== 'active') S.everInside = false; let sec = 0;
  S.hvt = ''; for (const [id, x, y, z, yaw, st, armed] of m.N) { const a = S.actors.get(id); if (a) a.target(x, y, z, yaw, st, armed); if (id > 100 && st === 'u') sec++; if (id === S.hvtId) S.hvt = st === 'u' || st === 'j' ? 'ARRESTED' : st === 'd' ? 'DOWN' : 'AT LARGE'; }
  for (const a of S.actors.values()) a.g.visible = a.blob.visible = m.ph !== 'lobby'; for (const b of S.bombs) b.g.visible = m.ph !== 'lobby';
  S.secured = sec; for (let i = 0; i < S.doorOpen.length; i++) { S.doorOpen[i] = m.D[i] === '1'; S.doorLocked[i] = m.L[i] === '1'; }
  S.defused = 0; m.B.forEach((b, i) => { const o = S.bombs[i]; if (o) { o.set(b[0], b[1]); o.n = b[2]; } if (b[1]) S.defused++; });
  const seen = new Set(); S.squad = m.P.map(p => p[1]); S.squadT = m.P.map(p => p[9] & 2048 ? 'tango' : 'swat');
  if (m.pw != null && S.night === !!m.pw) { S.night = !m.pw; applyLook(); }
  if (m.T) for (let i = 0; i < S.doorTrap.length; i++) { const v = +m.T[i]; S.doorTrap[i] = v; const d = world.doors[i]; d.trap.visible = v > 0 && m.ph === 'active'; if (v) { const o = (v === 1 ? 0.3 : -0.3); d.trap.position.set(level.doors[i].x0 + (d.horiz ? 0 : o), level.doors[i].y, level.doors[i].z0 + (d.horiz ? o : 0)); } }
  nadeView(m.G || [], m.SM || []);
  for (const [id, name, , hp, down, h, l, r, g, w] of m.P) {
    if (id === S.me.id) { const tm = w & 2048 ? 'tango' : 'swat'; if (tm !== S.me.team) { S.me.team = tm; myBody.setTeam(tm); } S.me.locks = w >> 13 & 3; S.me.traps = w >> 15 & 3; const hd = !!(w & 4096); if (hd !== !!S.me.holding) { S.me.holding = hd; if (!hd) for (const q of hands) q.shield = false; } S.me.hp = hp; S.me.down = !!down; S.me.w = w & 63; S.me.med = !!(w & 64); S.me.fl = w >> 7 & 3; S.me.sm = w >> 9 & 3; continue; }
    seen.add(id); let o = S.officers.get(id); if (!o) { o = new Officer(name, label(name, '#9fd0ff')); scene.add(o.g); S.officers.set(id, o); }
    o.set(h, l, r, g, down); o.down = !!down; o.id = id; o.name = name; o.team = w & 2048 ? 'tango' : 'swat'; o.body.setTeam(o.team);
  }
  for (const [id, o] of S.officers) if (!seen.has(id)) { scene.remove(o.g); S.officers.delete(id); }
  if (m.R) S.report = m.R;
  if (m.RT != null) { const d = m.RT - S.raceT; S.raceT = Math.abs(d) > 0.6 ? m.RT : S.raceT + d * 0.25; }
  if (m.TP && S.net !== 'offline') S.todPick = m.TP;
  if (m.TG) { m.TG.forEach((r, i) => { const t = targets[i]; if (!t) return; t.up = r[0]; t.tx = r[1]; if (t.hostile !== r[2]) { t.hostile = r[2]; t.board.material = r[2] ? tgTex.h : tgTex.n; } }); S.house = m.HS; S.tstats = m.TS; if (m.NM) S.nextMap = m.NM; if (m.WP && S.net !== 'offline') S.wxPick = m.WP; }
  for (const e of m.E) onEvent(e);
  if (S.phase !== prev) { S.menu = false; if (S.phase === 'ended') showEndPanel(); else if (S.phase === 'active' && !M.training) { panel.mesh.visible = false; S.panel = null; } else showLobbyPanel(); }
}
const LINES = { surrender: ["DON'T SHOOT!", '#ffe080', "Don't shoot! I give up!"], defy: ['NO!', '#ff7070', 'No way!'], comply: ['OK! OK!', '#a0e0ff', 'Okay, okay!'], plead: ['PLEASE!', '#a0e0ff', 'Please help us!'], threat: ['BACK OFF OR THEY DIE!', '#ff3030', 'Back off or the hostage dies!'], fake: ['(draws weapon)', '#ff4040', ''] };
function onEvent(e) {
  const a = e.n != null ? S.actors.get(e.n) : null;
  switch (e.e) {
    case 'start': resetLoadout(); placeAtSpawn(); S.report = null; S.menu = false; S.panel = null; panel.mesh.visible = false; if (M.training) showLobbyPanel(); sfx.ok(); break;
    case 'th': { const t = targets[e.t]; if (t) { const p = t.g.position; if (e.ns) sayAt(p.x, p.y + t.d.h + 0.4, p.z, 'NO-SHOOT!', '#6fa8ff'); if (e.p === S.me.id) sfx.beep(p, e.ns ? 300 : 1400); } break; }
    case 'house': sfx.ok(); sayAt(head.pos.x, head.pos.y + 0.5, head.pos.z - 1.5, 'HOUSE CLEAR ' + e.time + 's' + (e.ns ? '  (' + e.ns + ' no-shoot)' : '') + (e.time <= e.best ? '  BEST' : ''), '#80ff9a'); break;
    case 'bombreset': { const o = S.bombs[e.b]; if (o) { const b = new Bomb(o.g.position.x, o.g.position.y, o.g.position.z, e.wires, e.order, o.g.rotation.y); b.order = e.order; b.n = 0; scene.remove(o.g); scene.add(b.g); S.bombs[e.b] = b; sayAt(b.g.position.x, b.g.position.y + 0.5, b.g.position.z, 'BOMB RESET', '#ffb060'); } break; }
    case 'ps': { v1.set(e.o[0], e.o[1], e.o[2]); v2.set(e.h[0], e.h[1], e.h[2]); if (e.p !== S.me.id) { sfx.shot(v1, e.w); tracer(v1, v2); } puff(e.h, e.k === 'w' ? 0xcfcfcf : 0xa01010); if (e.k === 'w') sfx.impact(v2); break; }
    case 'ns': if (a) { a.muzzle(v1); v2.set(e.to[0], e.to[1], e.to[2]); tracer(v1, v2); sfx.shot(v1, 'rifle'); a.flashT = 0.05; } break;
    case 'hurt': if (e.p === S.me.id) { hudT = 0; hurtT = 1; sfx.hurt(); for (const h of hands) buzz(h, 1, 150); S.lastPart = e.part; S.figT = 4; } break;
    case 'heal': if (e.p === S.me.id) { sfx.ok(); S.lastPart = ''; S.figT = 2.5; } break;
    case 'down': if (e.p === S.me.id) sfx.hurt(); break;
    case 'tlock': case 'ttrap': { const d = level.doors[e.d]; if (e.p === S.me.id && d) { hint(d.cx, d.y + 1.3, d.cz, (e.e === 'tlock' ? 'DOOR LOCKED' : 'WIRE SET') + ' - ' + e.left + ' LEFT'); sfx.click(); } break; }
    case 'hvtrun': { const a = S.actors.get(e.n); if (a) sayAt(a.g.position.x, a.g.position.y + 2.2, a.g.position.z, S.pvp && S.me.team === 'tango' ? 'THE BOSS IS HEADING FOR THE JET' : 'HVT IS RUNNING FOR THE JET', '#ff8040'); break; }
    case 'grab': { const a = S.actors.get(e.n); if (e.p === S.me.id && a) { hint(a.g.position.x, a.g.position.y + 2.0, a.g.position.z, 'SHIELD: PISTOL ONLY'); if (S.mode !== 'vr' && hands[1].item === 'rifle') deskKey('Digit2'); } break; }   // phone / desktop: switch to the pistol for you
    case 'drop': { const a = S.actors.get(e.n); if (a && e.why !== 'let go') sayAt(a.g.position.x, a.g.position.y + 2.0, a.g.position.z, e.why === 'flash' ? 'HOSTAGE BROKE FREE (FLASHED)' : e.why === 'shot' ? 'HOSTAGE BROKE FREE (SHOT)' : 'HOSTAGE FREE', '#80d0ff'); break; }
    case 'carhit': if (e.p != null) { sfx.boom({ x: e.x, y: 0.5, z: e.z }); if (e.p === S.me.id) sayAt(head.pos.x + head.fwd.x * 1.5, head.pos.y, head.pos.z + head.fwd.z * 1.5, 'HIT BY A RACE CAR', '#ff6060'); } break;
    case 'revive': if (e.p === S.me.id) sfx.ok(); break;
    case 'hit': if (a) a.flinch = 1; break;
    case 'power': sfx.power(v1.set(M.breaker.x, M.breaker.y, M.breaker.z), e.on); break;
    case 'door': { const d = level.doors[e.d]; sfx.door(v1.set(d.cx, d.y + 1, d.cz), e.open); break; }
    case 'locked': { const d = level.doors[e.d]; sfx.rattle(v1.set(d.cx, d.y + 1, d.cz)); sayAt(d.cx, d.y + 1.5, d.cz, 'LOCKED', '#ffb060'); break; }
    case 'unlock': { const d = level.doors[e.d]; if (e.k === 'cut') { sfx.cut(v1.set(d.cx, d.y + 1.1, d.cz), true); sayAt(d.cx, d.y + 1.6, d.cz, 'LOCK CUT', '#80ff9a'); } else { sfx.unlock(v1.set(d.cx, d.y + 1, d.cz)); sayAt(d.cx, d.y + 1.5, d.cz, 'UNLOCKED', '#80ff9a'); } break; }
    case 'kick': { const d = level.doors[e.d]; sfx.kick(v1.set(d.cx, d.y + 1, d.cz), e.ok); if (e.ok) world.doors[e.d].cur = 0.9; else sayAt(d.cx, d.y + 1.5, d.cz, 'HELD', '#ffb060'); break; }
    case 'say': if (a) { const L = LINES[e.k]; if (L) { say(a, L[0], L[1]); if (L[2] && a.g.position.distanceTo(head.pos) < 14) { sfx.say(L[2], a.kind === 'c' ? 1.4 : 0.8); if (voiceState.error) noteErr(voiceState.error); } } } break;
    case 'shout': if (e.p !== S.me.id) sfx.say('Police! Hands up!', 1); break;
    case 'cuff': if (a) sfx.cuff(a.g.position); break;
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
addEventListener('keyup', e => { keys[e.code] = false; });
renderer.domElement.addEventListener('mousedown', e => { if (S.mode !== 'desktop' || S.touch) return; initAudio(); if (document.pointerLockElement !== renderer.domElement) { renderer.domElement.requestPointerLock?.(); } if (e.button === 0) mouseL = true; if (e.button === 2) S.ads = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) S.ads = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (S.mode === 'desktop' && document.pointerLockElement === renderer.domElement) { S.yaw -= e.movementX * 0.0022; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - e.movementY * 0.0022)); } });
function deskKey(code) {
  const G = gunIn(hands[1]);
  if (code === 'Enter' && (S.phase !== 'active' || M.training)) net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() });
  if (code === 'KeyO') cycleWx();
  if (code === 'KeyP' && (S.phase !== 'active' || M.training)) cycleMap();
  if (code === 'KeyM') return toggleMenu();
  if (S.me.down) return;
  if (code === 'KeyF') doShout();
  else if (code === 'KeyC') S.crouch = !S.crouch;
  else if (code === 'KeyT') S.light = !S.light;
  else if (code === 'KeyV' && G) { toggleMode(G.st); sfx.selector(); }
  else if (code === 'KeyL' && S.phase === 'active') net.send({ t: 'end' });
  else if (code === 'KeyE') deskInteract();
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
  if (shieldOn()) { if (S.me.holding) return net.send({ t: 'release' }); const n = nearestHostage(head.pos, 1.5); if (n != null) return net.send({ t: 'hold', n }); }
  for (let i = 0; i < S.bombs.length; i++) { const b = S.bombs[i]; if (!b.defused && b.g.position.distanceTo(head.pos) < 1.7) { const p = b.g.position; return S.tool === 'cutters' ? net.send({ t: 'cut', b: i, w: b.order[b.n] }) : hint(p.x, p.y + 0.4, p.z, 'SELECT CUTTERS'); } }
  if (nearBreaker(head.pos, 1.7)) return net.send({ t: 'breaker' });
  const n = tangoTools() ? null : nearestCuffable(v1.copy(head.pos).setY(head.pos.y - 0.7), 1.6); if (n != null) return net.send({ t: 'cuff', n });
  const p = nearestDowned(head.pos, 2); if (p != null) return net.send({ t: 'revive', p });
  const bi = nearestDoor(head.pos, 2.2);
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
function doShout() { if (S.me.down) return; net.send({ t: 'shout' }); sfx.say(S.pvp && S.me.team === 'tango' ? 'Get down! Nobody move!' : 'Police! Hands up!', 1); }

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
  if (!S.me.down) {
    if (Math.abs(R.sx) > 0.6 && !snapLatch) { snapLatch = true; headWorld(); const bx = head.pos.x, bz = head.pos.z; rig.rotation.y -= Math.sign(R.sx) * Math.PI / 6; headWorld(); rig.position.x += bx - head.pos.x; rig.position.z += bz - head.pos.z; }
    else if (Math.abs(R.sx) < 0.3) snapLatch = false;
    const dz = Math.abs(L.sy) > 0.15 ? L.sy : 0, dx = Math.abs(L.sx) > 0.15 ? L.sx : 0;
    if (dx || dz) { const sp = (Math.hypot(dx, dz) > 0.92 ? 3.4 : 2.3) * legMul() * dt, s = Math.sin(head.yaw), c = Math.cos(head.yaw); rig.position.x += (-s * -dz + c * dx) * sp; rig.position.z += (-c * -dz - s * dx) * sp; }
  }
}
function moveDesktop(dt) {
  rig.rotation.y = S.yaw; camera.rotation.set(S.pitch, 0, 0); S.eye += ((S.crouch ? 1.0 : 1.66) - S.eye) * Math.min(1, dt * 10); camera.position.set(0, S.eye, 0);
  if (S.me.down) return;
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
  const d = angd(head.yaw, S.bodyYaw); if (S.mode !== 'vr' || Math.abs(d) > 0.7) S.bodyYaw += S.mode !== 'vr' ? d : d - Math.sign(d) * 0.7;   // hips only turn once you look well past your shoulder
}
function collide() {
  if (S.spec) return;   // spectating: the camera floats behind a teammate
  headWorld(); const [x, z] = resolveCircle(level, S.doorOpen, head.pos.x, head.pos.z, 0.25, S.feetY);
  rig.position.x += x - head.pos.x; rig.position.z += z - head.pos.z; S.feetY = level.groundY(x, z, S.feetY); rig.position.y += (S.feetY - rig.position.y) * 0.35; headWorld();
}

// ---------- weapon handling ----------
function placeGuns(dt) {
  for (const k in guns) {
    const G = guns[k], m = G.mesh; G.kick *= Math.exp(-14 * dt);
    if (G.where === 'holster') {
      m.visible = S.mode === 'vr'; bodyPt(HOLSTER[k], m.position); q1.setFromAxisAngle(UP, head.yaw); m.quaternion.copy(q1).multiply(q1.setFromEuler(_he.set(...HOLSTER_ROT[k])));
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
  const A = gunIn(hands[1]) || gunIn(hands[0]); torch.visible = !!A && S.light;
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
    const d = rayStatic(level, S.doorOpen, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, 60); tracer(v1, v3.copy(v2).multiplyScalar(d).add(v1));
    sfx.shot(null, G.kind); G.kick += (o.support ? 0.03 : 0.07) * GUNS[G.kind].recoil; G.flashT = 0.045; buzz(h, 1, 50); if (o.support) buzz(o, 0.5, 40);
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
  useWorld(h);
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
  if (released(h, 'grip')) { if (h.shield) { h.shield = false; net.send({ t: 'release' }); } h.support = false; h.rackG = null; if (h.item === 'mag') { guns[h.magKind].mags++; h.item = null; }
    else if (h.item === 'flash' || h.item === 'smoke') { net.send({ t: 'throw', k: h.item, o: [h.pos.x, h.pos.y, h.pos.z], v: [h.vel.x * 1.3, h.vel.y * 1.3 + 0.6, h.vel.z * 1.3] }); h.item = null; buzz(h, 0.7, 40); } }   // let go to throw: it leaves with your hand's speed
  if (h.hold && !(h.in.grip > 0.5) && !(h.in.trig > 0.5)) h.hold = null;
  const G = gunIn(h), OG = gunIn(o);
  if (G) fire(h, G, o);
  else {
    if (press(h, 'trig')) {
      let cut = null, cd = 0.07;   // nearest wire to the hand, so neighbouring wires are not cut by mistake
      const tip = v2.set(0, 0, -0.09).applyQuaternion(h.quat).add(h.pos);   // the cutter jaws reach past the hand
      if (!S.me.down) for (let i = 0; i < S.bombs.length; i++) { const b = S.bombs[i]; if (b.defused) continue; for (let w = 0; w < 4; w++) if (b.wires[w].visible) { b.wirePos(w, v1); const d = Math.min(v1.distanceTo(h.pos), v1.distanceTo(tip)); if (d < cd) { cd = d; cut = { t: 'cut', b: i, w }; } } }
      if (cut) { if (S.tool === 'cutters') { net.send(cut); buzz(h, 0.8, 40); } else { const p = S.bombs[cut.b].g.position; hint(p.x, p.y + 0.4, p.z, 'SELECT CUTTERS'); } }
      else { v2.set(0, 0, -1).applyQuaternion(h.quat); if (!tryPanel(h.pos, v2) && !h.item && !h.hold) useWorld(h); }
    }
    if (press(h, 'b')) doShout();
    if (press(h, 'a')) h.aT = 0;
    if (h.in.a > 0.5) { h.aT += dt; if (h.aT > 0.22 && !wheel.open) openWheel(h); }
    if (released(h, 'a')) { if (wheel.open && wheel.hand === h) closeWheel(h); else S.light = !S.light; }
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
// ---------- footsteps: suspects, hostages and teammates are heard walking (muffled through walls); your own steps are quieter ----------
const stepAcc = new Map(), stepPos = new THREE.Vector3(), myStep = { x: 0, z: 0, acc: 0, init: false };
function stepSound(key, x, y, z, moved, gainK, self) {
  let a = (stepAcc.get(key) || 0) + moved; const stride = 0.7;
  if (a > stride) { a -= stride; if (Math.hypot(x - head.pos.x, z - head.pos.z) < 26 || self) sfx.step(self ? null : stepPos.set(x, y + 0.05, z), level.floorAt(x, z, y), gainK); }
  stepAcc.set(key, Math.min(a, stride));
}
function footsteps() {
  for (const [id, a] of S.actors) { const st = a.st; if (!a.g.visible || !(st === 'g' || st === 'a' || st === 'c' || st === 'h') || a.moved < 0.003) continue; stepSound('n' + id, a.g.position.x, a.g.position.y, a.g.position.z, a.moved, Math.min(1.4, 0.5 + a.speed * 0.35)); }
  for (const [id, o] of S.officers) { const p = o.head.position, prev = o.lastStep || (o.lastStep = p.clone()), moved = Math.hypot(p.x - prev.x, p.z - prev.z); prev.copy(p); if (moved > 0.003 && moved < 1 && !o.down) stepSound('o' + id, p.x, p.y - 1.65, p.z, moved, 0.9); }
  if (!S.mode || S.me.down) return; const moved = myStep.init ? Math.hypot(head.pos.x - myStep.x, head.pos.z - myStep.z) : 0; myStep.x = head.pos.x; myStep.z = head.pos.z; myStep.init = true;
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
function placeMapProps() { breaker.g.position.set(M.breaker.x, M.breaker.y, M.breaker.z); buildExitMark(); }
function nextMission() { return M.training ? (MISSION_IDS.includes(S.nextMap) ? S.nextMap : MISSION_IDS[0]) : M.id; }
function cycleMap() {
  if (M.training) { S.nextMap = MISSION_IDS[(MISSION_IDS.indexOf(S.nextMap) + 1) % MISSION_IDS.length]; sfx.click(); net.send({ t: 'choose', m: S.nextMap }); showLobbyPanel(); return; }
  const id = MAP_IDS[(MAP_IDS.indexOf(M.id) + 1) % MAP_IDS.length]; sfx.click(); net.send({ t: 'map', m: id }); if (!net.ws && !net.host) { loadMap(id); showLobbyPanel(); } }
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
function frame(t) {
  const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000)); last = t; S.now += dt;
  if (S.spawnIn && --S.spawnIn === 0) { headWorld(); placeAtSpawn(); showLobbyPanel(); }
  if (S.mode === 'vr') { readVR(); headWorld(); moveVR(dt); collide(); for (const h of hands) if (h.active) { (h.xr.src && h.xr.src.gripSpace ? h.xr.grip : h.xr.ray).getWorldPosition(h.pos); h.xr.ray.getWorldQuaternion(h.quat).multiply(tiltQ); } }
  else if (S.mode === 'desktop') {
    moveDesktop(dt); collide(); camera.updateMatrixWorld(true);
    const h = hands[1]; h.pos.copy(S.ads ? v1.set(0, -guns[h.item || 'rifle'].ud.sightY, -0.3) : v1.set(0.16, -0.17, -0.34)).applyMatrix4(camera.matrixWorld); h.quat.copy(head.quat);
  } else { const a = t * 0.00005, Y = M.YARD, cx = (Y.x0 + Y.x1) / 2, cz = (Y.z0 + Y.z1) / 2, k = M.id === 'mansion' ? 1 : 2.6; camera.position.set(cx + Math.sin(a) * 26 * k, 9 * k, cz + 14 + Math.cos(a) * 14 * k); camera.lookAt(cx, 2, cz - 7); headWorld(); }
  for (const h of hands) { if (h.active) { v1.copy(h.pos).sub(h.last).multiplyScalar(1 / dt); if (v1.lengthSq() < 900) h.vel.lerp(v1, 0.45); h.last.copy(h.pos); } }
  placeGuns(dt);
  for (const h of hands) h.pose = handPose(h, hands[1 - h.i]);
  myBody.g.visible = S.mode === 'vr'; if (S.mode === 'vr') myBody.update(head.pos, S.bodyYaw, [hands[0].active ? hands[0] : null, hands[1].active ? hands[1] : null], S.feetY, head.quat);
  if (S.mode === 'vr') { handVR(hands[0], hands[1], dt); handVR(hands[1], hands[0], dt); }
  else if (S.mode === 'desktop') { const h = hands[1], G = gunIn(h); if (G && !S.reloading) fire(h, G, hands[0]); mouseLPrev = mouseL; }
  if (S.deskPick) { const P = S.deskPick, d = level.doors[P.id]; if (S.doorOpen[P.id] && (P.lock || P.trap) || !(P.lock ? !S.doorLocked[P.id] : P.trap ? !S.doorTrap[P.id] : P.disarm ? S.doorTrap[P.id] : S.doorLocked[P.id]) || Math.hypot(d.cx - head.pos.x, d.cz - head.pos.z) > 2.2) S.deskPick = null; else if ((P.t += dt) >= 4) { net.send({ t: P.lock ? 'lockdoor' : P.trap ? 'trapdoor' : P.disarm ? 'disarm' : P.snip ? 'snip' : 'pick', d: P.id }); S.deskPick = null; } else if (Math.floor(P.t * 3) !== Math.floor((P.t - dt) * 3)) sfx.click(); }
  vestHints(); doorCam(dt); smokeDraw();
  if (smokeFog > 0.01 || smokeFogCur > 0.01) { smokeFogCur += (smokeFog - smokeFogCur) * Math.min(1, dt * 4); applyLook(); if (smokeFogCur > 0.01) { scene.fog.density += smokeFogCur * 0.6; scene.fog.color.lerp(smokeCol.setRGB(S.nvg ? 0.2 : 0.5, S.nvg ? 0.5 : 0.51, S.nvg ? 0.25 : 0.53), smokeFogCur * 0.8); scene.background.copy(scene.fog.color); } }
  // a door lever lights up when an empty hand can work it
  for (const d of world.doors) d.hot = false;
  if (S.mode === 'vr') for (const h of hands) if (h.active && !h.item) { const i = nearestDoor(h.pos, 0.95); if (i >= 0) world.doors[i].hot = true; }
  for (const d of world.doors) d.hm.emissive.setHex(d.hot ? 0x30c060 : 0);
  // panel cursor
  panel.cursor.visible = false;
  if (panel.mesh.visible && S.mode) for (const h of hands) { if (!h.active) continue; const G = gunIn(h); if (G) { G.mesh.localToWorld(v1.copy(G.ud.muzzle)); v2.set(0, 0, -1).applyQuaternion(G.mesh.quaternion); } else { v1.copy(h.pos); v2.set(0, 0, -1).applyQuaternion(h.quat); } if (panel.probe(v1, v2, true) !== null) break; }
  if ((S.phase === 'lobby' || M.training && S.phase === 'active') && !S.menu && (lobbyT -= dt) < 0) { lobbyT = 0.5; showLobbyPanel(); }
  updateTargets(dt);
  spectate(dt);
  if (race) { S.raceT += dt; race.update(S.raceT, head.pos, level.inside(head.pos.x, head.pos.z, head.pos.y)); }
  // world animation
  for (const a of S.actors.values()) a.update(dt);
  breaker.cur += ((S.night ? 1 : 0) - breaker.cur) * Math.min(1, dt * 14); breaker.lever.rotation.x = breaker.cur * 2.2; breaker.led.material.color.setHex(S.night ? 0x401010 : 0x30ff60);
  world.doors.forEach((d, i) => { d.cur += ((S.doorOpen[i] ? 1.65 : 0) - d.cur) * Math.min(1, dt * 7); d.g.visible = true; d.g.rotation.y = d.base + d.swing * d.cur; if (d.g2) d.g2.rotation.y = d.base + Math.PI - d.swing * d.cur; if (d.lock) d.lock.visible = !!S.doorLocked[i] && !S.doorOpen[i]; });
  for (const l of tracers) if (l.visible && (l.userData.t -= dt) <= 0) l.visible = false;
  for (const m of puffs) if (m.visible) { m.userData.t -= dt; m.material.opacity = Math.max(0, m.userData.t / 0.3); m.scale.setScalar(1 + (0.3 - m.userData.t) * 4); if (m.userData.t <= 0) m.visible = false; }
  for (let i = says.length - 1; i >= 0; i--) { const s = says[i]; s.t -= dt; s.s.position.y += dt * 0.1; if (s.t <= 0) { scene.remove(s.s); s.s.material.map.dispose(); s.s.material.dispose(); says.splice(i, 1); } }
  const blink = S.phase === 'active' && Math.floor(S.now * (S.timer < 60 ? 6 : 2)) % 2 === 0; for (const b of S.bombs) if (!b.defused) b.led.visible = blink; else b.led.visible = true;
  hurtT = Math.max(0, hurtT - dt * 1.5); flashWhite = Math.max(0, flashWhite - dt * 0.4);
  const vm = veil.material; if (flashWhite > 0) { vm.color.set(0xffffff); vm.opacity = flashWhite; } else if (S.me.down) { vm.color.set(0x200000); vm.opacity = 0.72; } else { vm.color.set(0xaa0000); vm.opacity = hurtT * 0.45 + (S.me.hp < 40 && S.mode ? 0.12 : 0); }
  veil.visible = vm.opacity > 0.01; downTag.visible = S.me.down && S.phase === 'active';
  // wrist display on the left forearm, floating 7 cm above it so the sleeve doesn't cut into it
  wrist.visible = S.mode === 'vr' && hands[0].active;
  if (wrist.visible) { const h = hands[0]; wrist.position.copy(v1.set(0, 0.075, 0.11).applyQuaternion(h.quat).add(h.pos)); wrist.quaternion.copy(h.quat).multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), -Math.PI / 2)); }
  if ((hudT -= dt) < 0) { hudT = 0.25; drawHud(); if (S.figT > 0) drawFig(); }
  S.figT = Math.max(0, S.figT - dt); fig.mesh.visible = S.figT > 0 && !!S.mode; fig.mesh.material.opacity = Math.min(1, S.figT);
  weather.update(dt, head.pos, () => sfx.thunder());
  setAmbience(S.wx === 'storm' ? 1 : S.wx === 'rain' ? 0.7 : 0, weather.state.inside);
  setListener(head.pos, head.fwd, level.inside(head.pos.x, head.pos.z, head.pos.y));
  footsteps(dt); exitPrompt(dt);
  if (S.mode && (poseT -= dt) < 0) { poseT = 1 / 12; net.send({ t: 'pose', h: arr7(head.pos, head.quat), l: hands[0].active ? arr7(hands[0].pos, hands[0].quat) : null, r: hands[1].active ? arr7(hands[1].pos, hands[1].quat) : null, g: [code(hands[0]), code(hands[1])], f: S.light && torch.visible ? 1 : 0 }); }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// ---------- lobby UI ----------
const nameIn = $('name'), roomIn = $('room');
nameIn.value = localStorage.getItem('bl_name') || ''; roomIn.value = (Q.get('room') || localStorage.getItem('bl_room') || Math.random().toString(36).slice(2, 6)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
$('tilt').value = S.tilt; $('tiltv').textContent = S.tilt + '°'; $('tilt').oninput = e => { setTilt(+e.target.value); $('tiltv').textContent = S.tilt + '°'; };
let connecting = null;
function connect(solo) {
  if (connecting) return connecting;
  const name = (nameIn.value.trim() || 'Officer').slice(0, 14), room = (roomIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ALPHA').slice(0, 8);
  localStorage.setItem('bl_name', name); localStorage.setItem('bl_room', room); S.room = room; history.replaceState(null, '', '?room=' + room);
  return connecting = net.connect(room, name, solo).then(r => { S.net = r; status(r === 'online' ? 'Connected to room ' + room + '. Friends join with the same code.' : solo ? 'Solo practice.' : 'Server not reachable: running solo practice on this device.'); return r; });
}
function begin(mode) { S.mode = mode; $('ui').style.display = 'none'; $('hud').style.display = mode === 'desktop' ? 'block' : 'none'; camera.rotation.set(0, 0, 0); camera.position.set(0, 1.66, 0); S.spawnIn = mode === 'vr' ? 4 : 0; placeAtSpawn(); resetLoadout(); showLobbyPanel(); }
$('vr').onclick = async () => {
  initAudio(); const solo = $('solo').checked;
  try {
    const sp = navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); connect(solo);
    const session = await sp; await renderer.xr.setSession(session); begin('vr');
    session.addEventListener('end', () => { S.mode = null; $('ui').style.display = 'flex'; });
  } catch (e) { status('Could not start VR: ' + (e && e.message || e)); }
};
$('desk').onclick = () => { initAudio(); connect($('solo').checked); begin('desktop'); };
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { $('vr').disabled = !ok; if (!ok) $('vrnote').textContent = 'No VR headset detected on this device. Open this page in the Quest browser.'; }).catch(() => { $('vr').disabled = true; });
else { $('vr').disabled = true; $('vrnote').textContent = 'This browser has no WebXR. Open this page in the Quest browser.'; }
// ---------- phone / tablet controls: left thumb moves, right thumb looks, buttons do the rest ----------
function initTouch() {
  // iOS zooms the page on a double tap unless the touch itself is cancelled; pointer handlers alone do not stop it.
  for (const ev of ['touchstart', 'touchend', 'touchmove']) document.addEventListener(ev, e => { if (S.touch) e.preventDefault(); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  S.touch = true; $('touch').style.display = 'block'; document.body.classList.add('touching');
  const bind = (id, down, up) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('on'); down(); }); const end = () => { el.classList.remove('on'); if (up) up(); }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end); };
  bind('bFire', () => { mouseL = true; }, () => { mouseL = false; }); bind('bAim', () => { S.ads = !S.ads; }); bind('bReload', () => deskKey('KeyR')); bind('bUse', () => deskKey('KeyE')); bind('bShout', () => deskKey('KeyF')); bind('bKick', () => deskKey('KeyQ'));
  bind('bSwap', () => deskKey(hands[1].item === 'rifle' ? 'Digit2' : 'Digit1')); bind('bTool', () => deskKey({ hands: 'Digit4', pick: 'Digit5', cutters: 'Digit8', cam: 'Digit3' }[S.tool])); bind('bFlash', () => deskKey('Digit6')); bind('bSmoke', () => deskKey('Digit7')); bind('bMed', () => deskKey('KeyH')); bind('bNvg', () => deskKey('KeyN')); bind('bLight', () => deskKey('KeyT')); bind('bCrouch', () => deskKey('KeyC'));
  bind('bMenu', () => { S.tmenu = !S.tmenu; hudT = 0; }); bind('bDusk', () => { net.send({ t: 'restart', wx: S.wxPick, tod: S.todPick, map: nextMission() }); S.tmenu = false; }); bind('bMap', () => { cycleMap(); hudT = 0; }); bind('bEnd', () => { net.send({ t: 'end' }); S.tmenu = false; }); bind('bWx', () => { cycleWx(); hudT = 0; }); bind('bTod', () => { cycleTod(); hudT = 0; }); bind('bTeam', () => { pickTeam(); hudT = 0; });
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
$('tplay').onclick = () => { initAudio(); connect($('solo').checked); begin('desktop'); initTouch(); try { document.documentElement.requestFullscreen?.().catch(() => { }); screen.orientation?.lock?.('landscape').catch(() => { }); } catch { } };
let installEvt = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').style.display = 'inline-block'; });
$('install').onclick = async () => { if (installEvt) { installEvt.prompt(); installEvt = null; $('install').style.display = 'none'; } };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
// Self-update: a home-screen app can sit in memory for days; when it comes back to the front, check for a newer build and reload (never mid-mission)
const BUILD = 'v30';
function checkBuild() { fetch('version.txt', { cache: 'no-store' }).then(r => r.ok ? r.text() : BUILD).then(v => { v = v.trim(); if (v && v !== BUILD && S.phase !== 'active' && !renderer.xr.isPresenting) location.reload(); }).catch(() => { }); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkBuild(); });
setTimeout(checkBuild, 3000);
window.__bl = { HOLSTER_ROT, camera, myBody, loadMap, get level() { return level; }, get M() { return M; }, get world() { return world; }, dcam, zoneFor, breaker, weather, initTouch, useMed, S, hands, guns, net, rig, camera, head, panel, renderer, begin, connect, keys, deskKey, bodyPt, HOLSTER, myBody, toggleMenu, toggleNVG, wheel, THREE, setMouse: v => { mouseL = v; } };
if (Q.get('auto')) { connect(true); begin(Q.get('auto') === 'touch' ? 'desktop' : Q.get('auto')); if (Q.get('auto') === 'touch') initTouch(); }
