// The VR map editor: build a custom map life-size, inside the game. Same map format, same rules (core/maps/edits.js) and the same
// saved draft as the 2D editor, so a map can be started on a computer and finished in the headset, or the other way round.
//
// Left hand holds the tool tablet; the right hand points. Right trigger uses the tool where the laser lands (press, drag and
// release for rooms, exits, furniture, windows and walls; hold to sculpt or scatter plants); on the tablet it presses buttons.
// Right A: undo. Right B: hide or show the tablet. Left X / Y: floor down / up. Left stick: move (you pass through walls).
// Right stick: left / right turns, up / down flies you up and down for a look from above. Left trigger while sculpting: the
// opposite (lower instead of raise). The map rebuilds around you after each change.
import * as X from './core/maps/edits.js';
import { check, FINISHES, PRESETS } from './core/maps/custom.js';
import { buildLevel, findPath, registerMap, rayStatic } from './core/level.js';

const TOOL_NAMES = { select: 'SELECT / MOVE', room: 'ROOM', door: 'DOOR', arch: 'ARCHWAY', gap: 'OPEN GAP', glass: 'WINDOW', furn: 'FURNITURE', stairs: 'STAIRS', erase: 'ERASE',
  spawn: 'SQUAD SPAWN', exit: 'EXIT ZONE', s: 'SUSPECT', c: 'HOSTAGE', b: 'BOMB', hvt: 'HVT', breaker: 'BREAKER', sculpt: 'SCULPT', tree: 'TREES', shrub: 'SHRUBS', pwall: 'PROPERTY WALL', gate: 'GATE' };
const HELP = { select: 'Point at something and pull to select it; drag to move it. Drag the far corner of a room to resize it.', room: 'Pull and drag across the floor: a room, walls all round.',
  door: 'Point at a wall and pull.', arch: 'Point at a wall and pull.', gap: 'Point at a wall and pull: a 2 m opening.', glass: 'Drag along a wall: a window.', furn: 'Pull for one, or drag a box to size it.',
  stairs: 'Pull on the floor below: stairs up to the next floor.', erase: 'Pull on anything to remove it.', spawn: 'Where the squad starts (ground floor, outside).', exit: 'Drag a box: where the squad leaves.',
  s: 'A spot a suspect may start at.', c: 'A spot a hostage may be held at.', b: 'A spot a bomb may be planted at.', hvt: 'Where the high-value target starts.', breaker: 'The main breaker: on the nearest wall.',
  sculpt: 'Hold the trigger to shape the ground. Left trigger: the opposite.', tree: 'Pull for a tree, drag to plant a row.', shrub: 'Pull for a shrub, drag to plant a row.', pwall: 'Drag along a line: a wall or fence.', gate: 'Pull on a property wall.' };
const COL = { s: 0xff4a3a, c: 0x3a8aff, b: 0xffa020, hvt: 0xc050ff, breaker: 0xffe040, spawn: 0x40ff80, exit: 0x40ff80 };
const cyc = (list, cur, d = 1) => list[(list.indexOf(cur) + d + list.length) % list.length];

export function createVREditor(c) {
  const { THREE, scene, rig, head, hands, S, sfx } = c;
  const V = () => new THREE.Vector3(), v1 = V(), v2 = V(), v3 = V(), q1 = new THREE.Quaternion();
  const E = { on: false, M: null, pubId: null, F: 0, tool: 'room', furnKind: 'table', brush: { mode: 'raise', r: 4, k: 4, flat: 0, pick: false }, land: { tree: 'mix', shrub: 'mix', pwall: 'privacy', gateW: 1.5 },
    sel: null, hist: [], page: 'build', msg: 'Pick a tool, point and pull the trigger.', err: false, lift: 0, showPad: true, drag: null, kb: null, dirtyT: -1, hidden: [], open: null, footY: 0, snapLatch: false };

  // ---- the document ----
  const save = () => { try { localStorage.setItem('bl_edit', JSON.stringify({ map: E.M, pubId: E.pubId })); } catch (e) { } };
  const drafts = () => { try { return JSON.parse(localStorage.getItem('bl_drafts') || '{}'); } catch (e) { return {}; } };
  const say = (t, err = false) => { E.msg = t; E.err = err; (E.log || (E.log = [])).push(t); if (E.log.length > 30) E.log.shift(); if (err) { sfx.beep(null, 320); c.buzz(hands[1], 0.5, 60); } };
  const H = () => E.M.H;
  function load(m, id = null) { E.M = X.normalize(m, localStorage.getItem('bl_name') || 'Anon'); E.pubId = id; E.F = 0; E.sel = null; E.hist = []; E.lift = 0; rebuild(true); save(); }
  function change(fn) { E.hist.push(JSON.stringify(E.M)); if (E.hist.length > 60) E.hist.shift(); fn(); save(); E.dirtyT = 0; }
  function undo() { if (!E.hist.length) return say('Nothing to undo.'); E.M = JSON.parse(E.hist.pop()); E.sel = null; E.F = Math.min(E.F, E.M.floors - 1); save(); E.dirtyT = 0; sfx.click(); say('Undone.'); }
  const run = r => { if (!r) return false; if (r.err != null) { if (r.err) say(r.err, true); return false; } change(r.apply); if (r.sel) E.sel = r.sel; sfx.click(); return true; };

  // ---- the world: the map built from the document, and the editor's own marks over it ----
  const G = new THREE.Group(); G.visible = false; scene.add(G);
  const mk = (geo, col, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: o.op ?? 0.75, depthTest: o.depth ?? true, depthWrite: false, fog: false, toneMapped: false })); if (o.order) m.renderOrder = o.order; return m; };
  const marks = new THREE.Group(); G.add(marks);
  let grid = null;
  const floorY = (x, z) => E.F > 0 ? E.F * H() : (c.map() && c.map().terrainY ? c.map().terrainY(z, x) : 0);
  function rebuild(now) { if (!now) { E.dirtyT = 0; return; } c.rebuild(E.M); drawMarks(); E.dirtyT = -1; }
  function clearGroup(g) { for (const o of [...g.children]) { g.remove(o); o.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material) q.material.dispose(); }); } }
  function drawMarks() {
    clearGroup(marks); const M = E.M, [W, D] = M.size, F = E.F;
    // the grid on the floor being edited: a line every metre, brighter every five, following the ground on the ground floor
    const pts = [], cols = [], add = (a, b, k) => { pts.push(...a, ...b); const col = k ? [0.45, 0.85, 1] : [0.2, 0.4, 0.5]; cols.push(...col, ...col); };
    const yy = (x, z) => floorY(x, z) + 0.03;
    for (let x = 0; x <= W; x++) for (let z = 0; z < D; z += 1) add([x, yy(x, z), z], [x, yy(x, Math.min(D, z + 1)), Math.min(D, z + 1)], x % 5 === 0);
    for (let z = 0; z <= D; z++) for (let x = 0; x < W; x += 1) add([x, yy(x, z), z], [Math.min(W, x + 1), yy(Math.min(W, x + 1), z), z], z % 5 === 0);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, fog: false, toneMapped: false })); marks.add(grid);
    // the mission's invisible things: spots, the HVT, the breaker, the spawn and the exit
    const spotY = (f, x, z) => f > 0 ? f * H() : (c.map().yAt ? c.map().yAt(0, x, z) : 0);
    const pin = (k, f, x, z, h = 1.0) => { const op = f === F ? 0.8 : 0.25, m = mk(new THREE.CylinderGeometry(0.2, 0.2, h, 12), COL[k], { op }); m.position.set(x, spotY(f, x, z) + h / 2, z); marks.add(m);   // waist high: never in your eyes
      const top = mk(new THREE.SphereGeometry(0.24, 12, 8), COL[k], { op }); top.position.set(x, spotY(f, x, z) + h + 0.16, z); marks.add(top); };
    for (const k of ['s', 'c', 'b']) for (const [f, x, z] of M[k]) pin(k, f, x, z, k === 'b' ? 0.5 : 1.0);
    if (M.hvt) pin('hvt', M.hvt[0], M.hvt[1], M.hvt[2], 1.3);
    if (M.breaker) { const [f, x, z] = M.breaker, m = mk(new THREE.BoxGeometry(0.4, 0.5, 0.4), COL.breaker, { op: f === F ? 0.85 : 0.25 }); m.position.set(x, spotY(f, x, z) + 1.4, z); marks.add(m); }
    if (M.spawn) { const [x, z] = M.spawn; for (const dx of [-1.5, -0.5, 0.5, 1.5]) { const m = mk(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 14), COL.spawn, { op: 0.8 }); m.position.set(x + dx, spotY(0, x + dx, z) + 0.05, z); marks.add(m); }
      const a = mk(new THREE.ConeGeometry(0.35, 0.8, 12), COL.spawn, { op: 0.8 }); a.position.set(x, spotY(0, x, z) + 2.2, z); a.rotation.x = Math.PI; marks.add(a); }
    if (M.exit) { const [x0, z0, x1, z1] = M.exit, m = mk(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), COL.exit, { op: 0.3 }); m.position.set((x0 + x1) / 2, spotY(0, (x0 + x1) / 2, (z0 + z1) / 2) + 0.15, (z0 + z1) / 2); marks.add(m); }
    // the edge of the map
    const e = []; for (const [a, b] of [[[0, 0], [W, 0]], [[W, 0], [W, D]], [[W, D], [0, D]], [[0, D], [0, 0]]]) for (let t = 0; t < 1; t += 0.05) { const p = (u, k) => a[k] + (b[k] - a[k]) * u; e.push(p(t, 0), yy(p(t, 0), p(t, 1)) + 0.02, p(t, 1), p(t + 0.05, 0), yy(p(t + 0.05, 0), p(t + 0.05, 1)) + 0.02, p(t + 0.05, 1)); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(e, 3)); marks.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0xffe080, fog: false, toneMapped: false })));
    drawSel();
  }
  // the selection: a box round it
  const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffff40, depthTest: false, fog: false, toneMapped: false })); selBox.renderOrder = 990; selBox.visible = false; G.add(selBox);
  const corner = mk(new THREE.SphereGeometry(0.18, 12, 8), 0xffff40, { depth: false, order: 991 }); corner.visible = false; G.add(corner);
  function selBounds(it) {
    const M = E.M; if (!it) return null; const a = it.i != null ? M[it.t][it.i] : M[it.t]; if (!a) return null; const fy = f => f * H();
    if (it.t === 'rooms') return [a[1], fy(a[0]), a[2], a[3], fy(a[0]) + H(), a[4]];
    if (it.t === 'furniture') return [a[1], fy(a[0]), a[2], a[3], fy(a[0]) + a[5], a[4]];
    if (it.t === 'stairs') return [a[1], fy(a[0]), a[2], a[3], fy(a[0] + 1), a[4]];
    if (it.t === 'openings' || it.t === 'glass') return [a[1] - 0.12, fy(a[0]), a[2] - 0.12, a[3] + 0.12, fy(a[0]) + 2.2, a[4] + 0.12];
    if (it.t === 'pwalls' || it.t === 'gates') return [a[0] - 0.15, 0, a[1] - 0.15, a[2] + 0.15, 2.4, a[3] + 0.15];
    if (it.t === 'trees' || it.t === 'shrubs') { const r = it.t === 'trees' ? 0.8 : 0.5; return [a[0] - r, 0, a[1] - r, a[0] + r, it.t === 'trees' ? 6 : 1.4, a[1] + r]; }
    if (it.t === 'spawn') return [a[0] - 2, 0, a[1] - 0.5, a[0] + 2, 2.6, a[1] + 0.5];
    if (it.t === 'exit') return [a[0], 0, a[1], a[2], 0.4, a[3]];
    return [a[1] - 0.35, fy(a[0]), a[2] - 0.35, a[1] + 0.35, fy(a[0]) + 2.2, a[2] + 0.35];   // spots, the HVT, the breaker
  }
  function drawSel() {
    const b = selBounds(E.sel); selBox.visible = !!b; corner.visible = false; if (!b) return;
    const g0 = E.sel.t === 'pwalls' || E.sel.t === 'gates' || E.sel.t === 'trees' || E.sel.t === 'shrubs' || E.sel.t === 'spawn' || E.sel.t === 'exit' ? floorY((b[0] + b[3]) / 2, (b[2] + b[5]) / 2) : 0;
    selBox.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2 + g0, (b[2] + b[5]) / 2); selBox.scale.set(Math.max(0.05, b[3] - b[0]), Math.max(0.05, b[4] - b[1]), Math.max(0.05, b[5] - b[2]));
    const R = X.rectOf(E.M, E.sel); if (R && E.sel.t !== 'stairs') { corner.visible = true; corner.position.set(R[2], b[1] + g0 + 0.1, R[3]); }
  }

  // ---- the laser, the cursor and what a drag will make ----
  const laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineBasicMaterial({ color: 0x60ffa0, depthTest: false, fog: false, toneMapped: false })); laser.renderOrder = 992; laser.frustumCulled = false; G.add(laser);
  const ring = mk(new THREE.RingGeometry(0.16, 0.22, 24), 0x60ffa0, { depth: false, order: 993, op: 0.9 }); ring.rotation.x = -Math.PI / 2; G.add(ring);
  const dot = mk(new THREE.SphereGeometry(0.06, 10, 8), 0xffffff, { depth: false, order: 994 }); G.add(dot);
  const brushRing = mk(new THREE.RingGeometry(0.97, 1, 48), 0xffe08a, { depth: false, order: 993, op: 0.8 }); brushRing.rotation.x = -Math.PI / 2; brushRing.visible = false; G.add(brushRing);
  const preview = mk(new THREE.BoxGeometry(1, 1, 1), 0x60c0ff, { op: 0.35 }); preview.visible = false; G.add(preview);
  const handBox = [0, 1].map(() => { const m = mk(new THREE.BoxGeometry(0.05, 0.04, 0.12), 0x9fb4c8, { op: 1 }); G.add(m); return m; });
  // where the right hand points: { x, z, y, sx, sz } (sx, sz on the half-metre grid), or null off the map
  function aim() {
    const h = hands[1]; if (!h.active) return null; const o = h.pos, d = v1.set(0, 0, -1).applyQuaternion(h.quat).normalize(), [W, D] = E.M.size;
    let t = Infinity;
    if (E.F > 0) { const py = E.F * H(); if (Math.abs(d.y) > 1e-4) { const tt = (py - o.y) / d.y; if (tt > 0) t = tt; } }
    else for (let tt = 0.2; tt < 90; tt += 0.25) { const x = o.x + d.x * tt, z = o.z + d.z * tt; if (o.y + d.y * tt <= floorY(x, z)) { let a = tt - 0.25, b = tt; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= floorY(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } t = b; break; } }
    const lv = c.level(); if (lv) { const tw = rayStatic(lv, S.doorOpen, o.x, o.y, o.z, d.x, d.y, d.z, Math.min(90, t)); if (tw < t) t = Math.max(0, tw + (E.tool === 'select' || E.tool === 'erase' ? 0.06 : -0.05)); }   // a wall or a thing in the way: the point on its face (just inside it when picking it)
    if (!Number.isFinite(t)) return { miss: true, o: o.clone(), e: v2.copy(d).multiplyScalar(8).add(o).clone() };
    const x = o.x + d.x * t, z = o.z + d.z * t, y = o.y + d.y * t, inMap = x >= -0.5 && z >= -0.5 && x <= W + 0.5 && z <= D + 0.5;
    const cx = Math.max(0, Math.min(W, x)), cz = Math.max(0, Math.min(D, z));
    return { x: cx, z: cz, y, sx: X.snap(cx), sz: X.snap(cz), q: [Math.round(cx * 4) / 4, Math.round(cz * 4) / 4], o: o.clone(), e: new THREE.Vector3(x, y, z), miss: !inMap };
  }

  // ---- the tablet on the left hand ----
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 1152; const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.45), new THREE.MeshBasicMaterial({ map: ptex, fog: false, toneMapped: false, transparent: true, depthTest: false })); pad.renderOrder = 995; G.add(pad);
  const padCur = mk(new THREE.SphereGeometry(0.008, 8, 6), 0x40ff80, { depth: false, order: 999, op: 1 }); G.add(padCur);
  let btns = [], padKey = '', padH = 1152;
  const TEX = () => { try { return JSON.parse(localStorage.getItem('bl_tex') || '[]'); } catch (e) { return []; } };
  const finishes = def => [...(def ? [''] : []), ...FINISHES, ...TEX().map(t => 'utex:' + t.id)];
  const finName = v => !v ? 'STYLE' : v.startsWith('utex:') ? (TEX().find(t => 'utex:' + t.id === v) || { name: 'TEXTURE' }).name.toUpperCase() : v.toUpperCase();
  const counts = () => { const M = E.M; return M.s.length + ' suspect, ' + M.c.length + ' hostage, ' + M.b.length + ' bomb spots'; };
  // a page: rows of [label, action, { on, w }]; a label starting with '#' is a heading
  function pageRows() {
    const M = E.M, t = E.tool, on = k => ({ on: t === k }), T = k => [TOOL_NAMES[k], 'tool:' + k, on(k)], rows = [];
    if (E.page === 'kb') {
      const k = E.kb; rows.push(['#' + k.title + ':  ' + (k.mask ? '•'.repeat(k.text.length) : k.text) + '_']);
      for (const r of ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL\'', 'ZXCVBNM.,-']) rows.push([...r].map(ch => { const k2 = k.upper ? ch : ch.toLowerCase(); return [k2, 'key:' + k2]; }));
      rows.push([['SHIFT', 'kb:shift', { w: 2, on: k.upper }], ['SPACE', 'key: ', { w: 3 }], ['DELETE', 'key:del', { w: 2 }], ['CANCEL', 'kb:cancel', { w: 2 }], ['DONE', 'kb:done', { w: 2, on: true }]]); return rows;
    }
    if (E.page === 'open') {
      rows.push(['#Open a map (the one open now is saved first)']); const all = drafts(), names = Object.keys(all).slice(0, 8);
      rows.push([['NEW BLANK MAP', 'open:blank', { w: 2 }], ['SAMPLE HOUSE', 'open:sample', { w: 2 }]]);
      if (names.length) { rows.push(['#Saved on this device']); for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2).map(n => [n.toUpperCase().slice(0, 22), 'open:d:' + n])); }
      const pub = (S.customList || []).slice(0, 8); if (pub.length) { rows.push(['#Published (edit a copy)']); for (let i = 0; i < pub.length; i += 2) rows.push(pub.slice(i, i + 2).map(m => [m.name.slice(0, 22), 'open:p:' + m.id.slice(2)])); }
      rows.push([['BACK', 'page:map']]); return rows;
    }
    if (E.page === 'pub') {
      rows.push(['#Publish "' + M.name + '" to the mission board']); if (E.pubId) rows.push([['UPDATE THE PUBLISHED MAP', 'pub:upd', { on: true }]]); rows.push([[E.pubId ? 'PUBLISH AS A NEW MAP' : 'PUBLISH', 'pub:new', { on: !E.pubId }]]);
      if (E.pubId) rows.push([['REMOVE IT FROM THE BOARD', 'pub:del']]); rows.push([['FORGET THE CREATOR CODE', 'pub:forget'], ['BACK', 'page:map']]); return rows;
    }
    // selected: its own options first
    if (E.tool === 'select' && E.sel) { const s = E.sel, a = s.i != null ? M[s.t][s.i] : M[s.t];
      if (a) { rows.push(['#Selected: ' + ({ rooms: 'room', furniture: (a[6] || '') + '', openings: a[5] + '', glass: 'window', stairs: 'stairs', s: 'suspect spot', c: 'hostage spot', b: 'bomb spot', hvt: 'HVT', breaker: 'breaker', spawn: 'squad spawn', exit: 'exit', trees: 'tree', shrubs: 'shrub', pwalls: 'wall', gates: 'gate' })[s.t]]);
        if (s.t === 'rooms') rows.push([['FLOOR: ' + finName(a[5]), 'sel:fin', { w: 2 }], [(a[3] - a[1]) + ' × ' + (a[4] - a[2]) + ' M', '']]);
        if (s.t === 'furniture') rows.push([['KIND: ' + a[6].toUpperCase(), 'sel:kind', { w: 2 }], ['ROTATE', 'sel:rot']], [['LOWER', 'sel:h-'], ['HEIGHT ' + a[5].toFixed(2) + ' M', ''], ['HIGHER', 'sel:h+']]);
        if (s.t === 'openings') rows.push([['KIND: ' + a[5].toUpperCase(), 'sel:okind'], ['OUTSIDE DOOR: ' + (a[6] === 'ext' ? 'YES' : 'NO'), 'sel:ext', { w: 2 }]]);
        if (s.t === 'trees' || s.t === 'shrubs') rows.push([['KIND: ' + a[2].toUpperCase(), 'sel:plant', { w: 2 }]]);
        if (s.t === 'pwalls') rows.push([[X.PWALLS[a[4]].label.split(' (')[0].toUpperCase(), 'sel:pw', { w: 2 }]]);
        rows.push([['DELETE', 'sel:del'], ['DESELECT', 'sel:none']]); } }
    if (E.page === 'build') {
      rows.push([T('select'), T('room'), T('door')], [T('arch'), T('gap'), T('glass')], [T('furn'), T('stairs'), T('erase')]);
      if (t === 'furn') rows.push([['◀', 'furn:-'], ['FURNITURE: ' + E.furnKind.toUpperCase(), 'furn:+', { w: 2 }], ['▶', 'furn:+']]);
    } else if (E.page === 'mission') {
      rows.push([T('spawn'), T('exit'), T('breaker')], [T('s'), T('c'), T('b')], [T('hvt'), ['TIME ' + Math.round(M.time / 60) + ' MIN', ''], ['−', 'cnt:t-'], ['+', 'cnt:t+']]);
      for (const [k, n] of [['s', 'SUSPECTS'], ['c', 'HOSTAGES'], ['b', 'BOMBS']]) rows.push([[n + ' ' + M.counts[k], '', { w: 2 }], ['−', 'cnt:' + k + '-'], ['+', 'cnt:' + k + '+']]);
      rows.push(['#' + counts()]);
    } else if (E.page === 'land') {
      rows.push([T('sculpt'), T('tree'), T('shrub')], [T('pwall'), T('gate'), ['FLATTEN ALL', 'ter:reset']]);
      if (t === 'sculpt') { const B = E.brush; rows.push([['MODE: ' + B.mode.toUpperCase(), 'br:mode', { w: 2 }], ['PICK HEIGHT', 'br:pick', { on: B.pick }]], [['SIZE −', 'br:r-'], ['BRUSH ' + B.r + ' M', ''], ['SIZE +', 'br:r+']], [['SOFTER', 'br:k-'], ['STRENGTH ' + B.k, ''], ['HARDER', 'br:k+']]);
        if (B.mode === 'flatten') rows.push([['−1 STOREY', 'br:f-'], ['FLATTEN TO ' + B.flat.toFixed(1) + ' M', ''], ['+1 STOREY', 'br:f+']]); }
      if (t === 'tree') rows.push([['TREE: ' + E.land.tree.toUpperCase(), 'land:tree', { w: 2 }], [M.trees.length + ' PLACED', '']]);
      if (t === 'shrub') rows.push([['SHRUB: ' + E.land.shrub.toUpperCase(), 'land:shrub', { w: 2 }], [M.shrubs.length + ' PLACED', '']]);
      if (t === 'pwall') rows.push([[X.PWALLS[E.land.pwall].label.split(' (')[0].toUpperCase(), 'land:pwall', { w: 2 }]]);
      if (t === 'gate') rows.push([['GATE WIDTH ' + E.land.gateW + ' M', 'land:gate', { w: 2 }]]);
    } else if (E.page === 'map') {
      rows.push([['NAME: ' + M.name.toUpperCase(), 'kb:name', { w: 2 }], ['BY: ' + M.creator.toUpperCase(), 'kb:by']]);
      rows.push([['WIDTH ' + M.size[0], 'map:w+'], ['−', 'map:w-'], ['DEPTH ' + M.size[1], 'map:d+'], ['−', 'map:d-']]);
      rows.push([['FLOORS ' + M.floors, 'map:f+'], ['−', 'map:f-'], ['CEILING ' + M.H.toFixed(1), 'map:h+'], ['−', 'map:h-']]);
      rows.push([['LOOK: ' + M.style.preset.toUpperCase(), 'map:look'], ['NIGHT: ' + (M.style.night ? 'ON' : 'OFF'), 'map:night'], ['FLOORS: ' + finName(M.style.floor), 'map:fin:floor']]);
      rows.push([['WALLS: ' + finName(M.style.wall), 'map:fin:wall'], ['OUTSIDE: ' + finName(M.style.outer), 'map:fin:outer'], ['GROUND: ' + finName(M.style.ground), 'map:fin:ground']]);
      rows.push([['OPEN / NEW', 'page:open'], ['SAVE', 'file:save'], ['CHECK', 'file:check']], [['TEST PLAY', 'file:test', { on: true }], ['PUBLISH', 'page:pub'], ['EXIT EDITOR', 'file:exit']]);
    }
    return rows;
  }
  function drawPad() {
    const rows = pageRows(), status = [E.msg], key = JSON.stringify([rows, status, E.err, E.page, E.F, E.M.floors, E.hist.length, E.tool]); if (key === padKey) return; padKey = key;
    const g = pc.getContext('2d'), W = 1024; g.clearRect(0, 0, W, 1152); g.fillStyle = 'rgba(10,16,24,0.94)'; g.fillRect(0, 0, W, 1152); g.strokeStyle = '#3a6ea5'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, 1146);
    btns = []; const btn = (x, y, w, h, text, act, on) => { g.fillStyle = !act ? '#1a222c' : on ? '#2f8f4f' : act.startsWith('file:exit') || act === 'sel:del' || act === 'pub:del' ? '#7a2a24' : '#24384e'; g.fillRect(x, y, w, h);
      g.fillStyle = act ? '#fff' : '#9fb4c8'; let f = 34; g.font = 'bold ' + f + 'px sans-serif'; while (f > 16 && g.measureText(text).width > w - 16) { f -= 2; g.font = 'bold ' + f + 'px sans-serif'; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 1); if (act) btns.push({ x, y, w, h, act }); };
    // tabs, floor, undo
    const tabs = [['BUILD', 'build'], ['MISSION', 'mission'], ['LAND', 'land'], ['MAP', 'map']]; tabs.forEach(([t, p], i) => btn(14 + i * 251, 14, 241, 76, t, 'page:' + p, E.page === p || (p === 'map' && ['open', 'pub', 'kb'].includes(E.page))));
    btn(14, 100, 160, 76, 'FLOOR −', 'floor:-'); btn(184, 100, 300, 76, 'FLOOR ' + (E.F + 1) + ' OF ' + E.M.floors, ''); btn(494, 100, 160, 76, 'FLOOR +', 'floor:+'); btn(664, 100, 346, 76, 'UNDO (' + E.hist.length + ')', 'undo');
    // the message
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '30px sans-serif'; g.fillStyle = E.err ? '#ff9a8a' : '#cfe3f5';
    const words = (TOOL_NAMES[E.tool] ? TOOL_NAMES[E.tool] + ': ' : '') + E.msg, lines = []; let ln = ''; for (const w of words.split(' ')) { if (g.measureText(ln + ' ' + w).width > 980) { lines.push(ln); ln = w; } else ln = ln ? ln + ' ' + w : w; } lines.push(ln);
    lines.slice(0, 3).forEach((l, i) => g.fillText(l, 22, 222 + i * 36));
    // the page
    let y = 340; for (const r of rows) { if (typeof r[0] === 'string') { g.fillStyle = '#8fb4dc'; g.font = 'bold 28px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(r[0].slice(1), 22, y + 34); y += 52; continue; }
      const tw = r.reduce((a, b) => a + ((b[2] && b[2].w) || 1), 0), gap = 10, unit = (W - 28 - gap * (r.length - 1)) / tw; let x = 14;
      for (const [t, a, o] of r) { const w = unit * ((o && o.w) || 1); btn(x, y, w, 84, t, a, o && o.on); x += w + gap; } y += 94; if (y > 1060) break; }
    padH = Math.min(1152, y + 14); const k = padH / 1152; pad.scale.y = k; ptex.repeat.set(1, k); ptex.offset.set(0, 1 - k); ptex.needsUpdate = true;
  }
  function padHit(o, d) { if (!pad.visible) return null; const n = v3.set(0, 0, 1).applyQuaternion(pad.quaternion), den = d.dot(n); if (den > -1e-4) return null;
    const t = v2.copy(pad.position).sub(o).dot(n) / den; if (t < 0 || t > 3) return null; const p = v2.copy(d).multiplyScalar(t).add(o), wp = p.clone(); pad.worldToLocal(p);
    const u = (p.x / 0.4 + 0.5) * 1024, w = (0.5 - p.y / 0.45) * padH; if (u < 0 || u > 1024 || w < 0 || w > padH) return null; padCur.position.copy(wp);
    for (const b of btns) if (u > b.x && u < b.x + b.w && w > b.y && w < b.y + b.h) return b.act; return ''; }

  // ---- buttons ----
  const stepNum = (v, d, lo, hi) => Math.max(lo, Math.min(hi, Math.round((v + d) * 10) / 10));
  function act(a) {
    sfx.click(); const M = E.M, [k, v, w] = a.split(':');
    if (k === 'page') { E.page = v; if (v === 'open') { c.refreshList && c.refreshList(); } return; }
    if (k === 'tool') { E.tool = v; if (v !== 'select') E.sel = null; E.brush.pick = false; return say(HELP[v] || ''); }
    if (k === 'floor') { const f = Math.max(0, Math.min(M.floors - 1, E.F + (v === '+' ? 1 : -1))); if (f === E.F) return say(v === '+' ? 'This is the top floor. Add floors on the MAP page.' : 'This is the ground floor.'); E.F = f; E.sel = null; E.lift = 0; drawMarks(); return say('Editing floor ' + (f + 1) + '.'); }
    if (k === 'undo') return undo();
    if (k === 'furn') { E.furnKind = cyc(X.FURN, E.furnKind, v === '-' ? -1 : 1); return; }
    if (k === 'cnt') { const d = v.endsWith('+') ? 1 : -1, c0 = v[0]; return change(() => { if (c0 === 't') M.time = Math.max(180, Math.min(1800, M.time + d * 60)); else M.counts[c0] = Math.max(c0 === 's' ? 1 : 0, Math.min(c0 === 'b' ? 6 : 20, M.counts[c0] + d)); }); }
    if (k === 'ter') return change(() => { M.ter = null; });
    if (k === 'br') { const B = E.brush; if (v === 'mode') B.mode = cyc(['raise', 'lower', 'smooth', 'flatten'], B.mode); if (v === 'pick') { B.pick = !B.pick; if (B.pick) say('Pull on the ground where the height is right.'); }
      if (v === 'r-' || v === 'r+') B.r = stepNum(B.r, v === 'r+' ? 1 : -1, 1, 12); if (v === 'k-' || v === 'k+') B.k = stepNum(B.k, v === 'k+' ? 1 : -1, 1, 10);
      if (v === 'f-' || v === 'f+') B.flat = Math.max(-2 * H(), Math.min(2 * H(), Math.round((B.flat + (v === 'f+' ? H() : -H())) * 10) / 10)); return; }
    if (k === 'land') { const L = E.land; if (v === 'tree') L.tree = cyc(['mix', ...Object.keys(X.TREES)], L.tree); if (v === 'shrub') L.shrub = cyc(['mix', ...Object.keys(X.SHRUBS)], L.shrub); if (v === 'pwall') L.pwall = cyc(Object.keys(X.PWALLS), L.pwall); if (v === 'gate') L.gateW = cyc([1, 1.5, 2, 3, 4], L.gateW); return; }
    if (k === 'sel') { const s = E.sel; if (!s) return; const a2 = s.i != null ? M[s.t][s.i] : M[s.t];
      if (v === 'none') { E.sel = null; drawSel(); return; } if (v === 'del') { change(() => X.remove(M, s)); E.sel = null; return; }
      if (v === 'fin') return change(() => { a2[5] = cyc(finishes(true), a2[5] || ''); });
      if (v === 'kind') return change(() => { a2[6] = cyc(X.FURN, a2[6]); a2[5] = X.FURN_H[a2[6]]; });
      if (v === 'rot') return change(() => X.rotateFurn(a2)); if (v === 'h-' || v === 'h+') return change(() => { a2[5] = stepNum(a2[5], v === 'h+' ? 0.1 : -0.1, 0.3, 3); });
      if (v === 'okind') return change(() => { a2[5] = cyc(['door', 'arch', 'gap'], a2[5]); }); if (v === 'ext') return change(() => { const e = a2[6] === 'ext'; a2.length = 6; if (!e) a2.push('ext'); });
      if (v === 'plant') return change(() => { a2[2] = cyc(Object.keys(s.t === 'trees' ? X.TREES : X.SHRUBS), a2[2]); }); if (v === 'pw') return change(() => { a2[4] = cyc(Object.keys(X.PWALLS), a2[4]); }); return; }
    if (k === 'map') {
      if (v === 'w+' || v === 'w-' || v === 'd+' || v === 'd-') { const i = v[0] === 'w' ? 0 : 1, o = M.size.slice(); return change(() => { M.size[i] = Math.max(20, Math.min(120, M.size[i] + (v[1] === '+' ? 4 : -4))); X.resampleTer(M, o); }); }
      if (v === 'f+' || v === 'f-') return change(() => { M.floors = Math.max(1, Math.min(3, M.floors + (v === 'f+' ? 1 : -1))); E.F = Math.min(E.F, M.floors - 1); });
      if (v === 'h+' || v === 'h-') return change(() => { M.H = stepNum(M.H, v === 'h+' ? 0.1 : -0.1, 2.8, 4.5); X.clampTer(M); });
      if (v === 'look') return change(() => { M.style.preset = cyc(Object.keys(PRESETS), M.style.preset); }); if (v === 'night') return change(() => { M.style.night = !M.style.night; });
      if (v === 'fin') return change(() => { M.style[w] = cyc(finishes(true), M.style[w] || '') || null; }); return; }
    if (k === 'kb') {
      if (v === 'shift') { E.kb.upper = !E.kb.upper; return; }
      if (v === 'name' || v === 'by') { E.kb = { upper: true, title: v === 'name' ? 'Map name' : 'Made by', field: v, text: v === 'name' ? M.name : M.creator, max: v === 'name' ? X.LIMITS.name : X.LIMITS.creator, back: E.page }; E.page = 'kb'; return; }
      if (v === 'cancel') { E.page = E.kb.back; E.kb = null; return; }
      if (v === 'done') { const K = E.kb; E.page = K.back; E.kb = null; const txt = K.text.trim(); if (K.field === 'code') { if (txt) { sessionStorage.setItem('bl_code', txt); K.then(txt); } return; }
        if (txt) change(() => { if (K.field === 'name') M.name = txt; else { M.creator = txt; localStorage.setItem('bl_name', txt); } }); return; } return; }
    if (a.startsWith('key:')) { const K = E.kb, ch = a.slice(4); if (ch === 'del') K.text = K.text.slice(0, -1); else if (K.text.length < K.max) K.text += ch; return; }
    if (k === 'open') {
      save(); if (v === 'blank') { load(X.blank(localStorage.getItem('bl_name') || 'Anon')); E.page = 'build'; return say('A blank map. Draw your first room.'); }
      if (v === 'sample') { say('Loading the sample house...'); fetch('maps/sample.json').then(r => r.json()).then(m => { m.name = 'My map'; m.creator = localStorage.getItem('bl_name') || 'Anon'; load(m); E.page = 'build'; say('The sample house. Change anything.'); }).catch(() => say('Could not load the sample.', true)); return; }
      if (v === 'd') { const e = drafts()[a.slice(7)]; if (e) { load(e.map, e.pubId || null); E.page = 'build'; say('Opened "' + E.M.name + '".'); } return; }
      if (v === 'p') { say('Loading...'); fetch('api/maps/' + w).then(r => r.ok ? r.json() : Promise.reject()).then(m => { load(m, w); E.page = 'build'; say('Opened "' + E.M.name + '". Publishing it again updates it.'); }).catch(() => say('The map library is not reachable.', true)); return; }
    }
    if (k === 'file') {
      if (v === 'save') { const all = drafts(); all[M.name] = { map: M, pubId: E.pubId }; try { localStorage.setItem('bl_drafts', JSON.stringify(all)); say('Saved "' + M.name + '" on this device.'); } catch (e) { say('Could not save: this device is out of storage.', true); } return; }
      if (v === 'check') { const r = check(M, { buildLevel, findPath, registerMap }); c.rebuild(E.M); return say(r.ok ? 'Ready to play.' + (r.warnings.length ? ' Notes: ' + r.warnings.join(' ') : '') : 'Problems: ' + r.errors.join(' '), !r.ok); }
      if (v === 'test') { const r = check(M, { buildLevel, findPath, registerMap }); c.rebuild(E.M); if (!r.ok) return say('Fix these first: ' + r.errors.join(' '), true); save(); leave(); c.test(r.map, E.M); return; }
      if (v === 'exit') { save(); leave(); c.exit(); return; }
    }
    if (k === 'pub') {
      if (v === 'forget') { sessionStorage.removeItem('bl_code'); return say('The creator code is forgotten on this headset.'); }
      const go = fn => { const cd = sessionStorage.getItem('bl_code'); if (cd) return fn(cd); E.kb = { title: 'Creator code', field: 'code', text: '', max: 64, mask: true, back: 'pub', then: fn }; E.page = 'kb'; };
      const fail = j => { if (/creator code/i.test(j.error || '')) sessionStorage.removeItem('bl_code'); say((j.error || 'That did not work') + (j.errors ? ': ' + j.errors.join(' ') : ''), true); };
      if (v === 'del') return go(cd => fetch('api/maps/' + E.pubId, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: cd }) }).then(x => x.json()).then(j => { if (!j.ok) return fail(j); E.pubId = null; save(); E.page = 'map'; say('Removed from the mission board.'); c.refreshList && c.refreshList(); }).catch(() => say('The map library is not reachable.', true)));
      const r = check(M, { buildLevel, findPath, registerMap }); c.rebuild(E.M); if (!r.ok) return say('Fix these before publishing: ' + r.errors.join(' '), true);
      return go(cd => { say('Publishing...'); fetch('api/maps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: cd, id: v === 'upd' ? E.pubId : null, map: r.map }) }).then(x => x.json().then(j => ({ ok: x.ok, j }))).then(({ ok, j }) => {
        if (!ok) return fail(j); E.pubId = j.id; save(); const all = drafts(); all[M.name] = { map: M, pubId: E.pubId }; try { localStorage.setItem('bl_drafts', JSON.stringify(all)); } catch (e) { } E.page = 'map'; say('Published. It is on the mission board (pick it with MISSION).'); c.refreshList && c.refreshList(); }).catch(() => say('The map library is not reachable.', true)); });
    }
  }

  // ---- the tool, on the world ----
  function press(p) {
    const t = E.tool, B = E.brush;
    if (t === 'sculpt') { if (B.pick) { B.flat = Math.round(X.groundAt(E.M, p.x, p.z) * 10) / 10; B.pick = false; return say('Flatten height ' + B.flat.toFixed(1) + ' m.'); } E.hist.push(JSON.stringify(E.M)); if (E.hist.length > 60) E.hist.shift(); E.drag = { sculpt: true, t: 0, rb: 0 }; return; }
    if (t === 'select') { const R = X.rectOf(E.M, E.sel); if (R && E.sel.t !== 'stairs' && Math.hypot(p.x - R[2], p.z - R[3]) < 0.6) { E.drag = { resize: true, orig: JSON.stringify(E.M) }; return; }
      const it = X.itemAt(E.M, E.F, p.x, p.z); E.sel = it; drawSel(); if (it) { E.drag = { move: true, orig: JSON.stringify(E.M), x0: p.x, z0: p.z }; sfx.click(); } return; }
    E.drag = { x0: p.x, z0: p.z, p0: [p.sx, p.sz], q0: p.q, moved: false, hist: t === 'tree' || t === 'shrub' ? JSON.stringify(E.M) : null, planted: false, last: null };
  }
  function dragTo(p, dt) {
    const d = E.drag, t = E.tool; if (!d) return;
    if (d.sculpt) { const B = E.brush, inv = hands[0].in.trig > 0.5, mode = inv ? ({ raise: 'lower', lower: 'raise' })[B.mode] || B.mode : B.mode; if ((d.t -= dt) <= 0) { d.t = 0.05; X.dab(E.M, { ...B, mode }, p.x, p.z); } if ((d.rb -= dt) <= 0) { d.rb = 0.6; rebuild(true); } return; }
    if (d.resize) { E.M = JSON.parse(d.orig); X.resizeItem(E.M, E.sel, p.x, p.z); showPreview(); drawSel(); return; }
    if (d.move) { E.M = JSON.parse(d.orig); X.moveItem(E.M, E.sel, p.x - d.x0, p.z - d.z0); drawSel(); return; }
    if (Math.hypot(p.x - d.x0, p.z - d.z0) > 0.35) d.moved = true;
    if ((t === 'tree' || t === 'shrub') && d.moved) { const gap = t === 'tree' ? 3.5 : 1.3; if (!d.last || Math.hypot(p.x - d.last[0], p.z - d.last[1]) >= gap) { if (X.plant(E.M, t === 'tree' ? 'trees' : 'shrubs', p.x + (Math.random() - 0.5) * gap * 0.4, p.z + (Math.random() - 0.5) * gap * 0.4, t === 'tree' ? E.land.tree : E.land.shrub) === true) d.planted = true; d.last = [p.x, p.z]; } }
  }
  function releaseAt(p) {
    const d = E.drag, t = E.tool; E.drag = null; preview.visible = false; if (!d) return;
    if (d.sculpt) { save(); rebuild(true); return; }
    if (d.resize || d.move) { const now = JSON.stringify(E.M); if (now !== d.orig) { E.hist.push(d.orig); save(); E.dirtyT = 0; sfx.click(); } return; }
    if (t === 'tree' || t === 'shrub') { if (d.moved) { if (d.planted) { E.hist.push(d.hist); save(); E.dirtyT = 0; sfx.click(); } return; } const r = X.plant(E.M, t === 'tree' ? 'trees' : 'shrubs', p.x, p.z, t === 'tree' ? E.land.tree : E.land.shrub); if (r === true) { E.hist.push(d.hist); save(); E.dirtyT = 0; sfx.click(); } else say(r, true); return; }
    if ((t === 'room' || t === 'exit' || t === 'furn') && d.moved) { const [a, b] = t === 'furn' ? d.q0 : d.p0, [x1, z1] = t === 'furn' ? p.q : [p.sx, p.sz]; run(X.rect(E.M, E.F, t, a, b, x1, z1, { furnKind: E.furnKind })); return; }
    if (t === 'glass') { if (!d.moved) return say('Drag along the wall to make the window.', true); run(X.glass(E.M, E.F, d.x0, d.z0, p.x, p.z)); return; }
    if (t === 'pwall') { if (!d.moved) return say(HELP.pwall, true); const s = X.pwSeg(d.x0, d.z0, p.x, p.z); run(X.pwall(E.M, ...s, E.land.pwall)); return; }
    if (t === 'room' || t === 'exit') return say(HELP[t], true);
    run(X.point(E.M, E.F, t, d.x0, d.z0, { furnKind: E.furnKind, gateW: E.land.gateW }));
  }
  function showPreview(p) {
    const d = E.drag, t = E.tool; preview.visible = false; if (!d || !p) return; const fy = floorY(p.x, p.z);
    const box = (x0, z0, x1, z1, h, col) => { const a = Math.min(x0, x1), b = Math.min(z0, z1), cc = Math.max(x0, x1), dd = Math.max(z0, z1); preview.visible = true; preview.material.color.setHex(col); preview.position.set((a + cc) / 2, fy + h / 2, (b + dd) / 2); preview.scale.set(Math.max(0.05, cc - a), h, Math.max(0.05, dd - b)); };
    if ((t === 'room' || t === 'exit' || t === 'furn') && d.moved) { const [a, b] = t === 'furn' ? d.q0 : d.p0, [x1, z1] = t === 'furn' ? p.q : [p.sx, p.sz]; box(a, b, x1, z1, t === 'room' ? H() : t === 'exit' ? 0.3 : X.FURN_H[E.furnKind], t === 'exit' ? 0x40ff80 : 0x60c0ff); }
    if (t === 'glass' && d.moved) box(X.snap(d.x0), X.snap(d.z0), Math.abs(p.x - d.x0) >= Math.abs(p.z - d.z0) ? p.sx : X.snap(d.x0) + 0.1, Math.abs(p.x - d.x0) >= Math.abs(p.z - d.z0) ? X.snap(d.z0) + 0.1 : p.sz, 1.4, 0x9fe0ff);
    if (t === 'pwall' && d.moved) { const s = X.pwSeg(d.x0, d.z0, p.x, p.z); box(s[0] - 0.1, s[1] - 0.1, s[2] + 0.1, s[3] + 0.1, X.PWALLS[E.land.pwall].h, 0xc8b090); }
  }

  // ---- each frame ----
  function tick(dt) {
    const L = hands[0], R = hands[1], Li = L.in, Ri = R.in, edge = (h, k) => h.in[k] > 0.5 && !(h.prev[k] > 0.5), M = E.M;
    // move: left stick, through walls; right stick turns and flies
    if (Math.abs(Ri.sx) > 0.6 && !E.snapLatch) { E.snapLatch = true; c.headWorld(); const bx = head.pos.x, bz = head.pos.z; rig.rotation.y -= Math.sign(Ri.sx) * Math.PI / 6; c.headWorld(); rig.position.x += bx - head.pos.x; rig.position.z += bz - head.pos.z; }
    else if (Math.abs(Ri.sx) < 0.3) E.snapLatch = false;
    if (Math.abs(Ri.sy) > 0.3 && Math.abs(Ri.sx) < 0.5) E.lift = Math.max(0, Math.min(40, E.lift - Ri.sy * 5 * dt));
    const dz = Math.abs(Li.sy) > 0.15 ? Li.sy : 0, dx = Math.abs(Li.sx) > 0.15 ? Li.sx : 0;
    if (dx || dz) { const sp = (Math.hypot(dx, dz) > 0.92 ? 6 : 3) * (1 + E.lift / 10) * dt, s = Math.sin(head.yaw), co = Math.cos(head.yaw); rig.position.x += (-s * -dz + co * dx) * sp; rig.position.z += (-co * -dz - s * dx) * sp; }
    const [W, D] = M.size; c.headWorld(); rig.position.x += Math.max(-20, Math.min(W + 20, head.pos.x)) - head.pos.x; rig.position.z += Math.max(-20, Math.min(D + 20, head.pos.z)) - head.pos.z;
    const fy = floorY(Math.max(0, Math.min(W, head.pos.x)), Math.max(0, Math.min(D, head.pos.z))); E.footY += (fy + E.lift - E.footY) * Math.min(1, dt * 8); rig.position.y = E.footY; S.feetY = E.footY; c.headWorld();
    for (let i = 0; i < 2; i++) { const h = hands[i]; handBox[i].visible = h.active; if (h.active) { handBox[i].position.copy(h.pos); handBox[i].quaternion.copy(h.quat); } }
    // buttons
    if (edge(R, 'a')) undo();
    if (edge(R, 'b')) { E.showPad = !E.showPad; sfx.click(); }
    if (edge(L, 'a')) act('floor:-'); if (edge(L, 'b')) act('floor:+');
    // the tablet over the left hand, facing you
    pad.visible = E.showPad && L.active; padCur.visible = false;
    if (pad.visible) { drawPad(); pad.position.copy(L.pos).add(v1.set(0, 0.04 + 0.225 * pad.scale.y, 0)); pad.lookAt(head.pos); pad.updateMatrixWorld(true); }
    // the laser: the tablet first, then the world
    let p = null; laser.visible = ring.visible = dot.visible = brushRing.visible = false;
    if (R.active) {
      const o = R.pos, d = v3.set(0, 0, -1).applyQuaternion(R.quat).normalize().clone(), pa = E.drag ? null : padHit(o, d);
      if (pa != null) { padCur.visible = true; laser.visible = true; laser.geometry.setFromPoints([o, padCur.position]); laser.material.color.setHex(0x40c0ff); if (edge(R, 'trig') && pa) act(pa); }
      else { p = aim(); if (p) { laser.visible = true; laser.geometry.setFromPoints([p.o, p.e]); laser.material.color.setHex(p.miss ? 0xff6050 : 0x60ffa0);
        if (!p.miss) { ring.visible = dot.visible = true; const gy = floorY(p.x, p.z) + 0.05; ring.position.set(p.x, gy, p.z); const fine = E.tool === 'furn' || E.tool === 'sculpt' || E.tool === 'tree' || E.tool === 'shrub' || E.tool === 'select';
          dot.position.set(fine ? p.x : p.sx, floorY(fine ? p.x : p.sx, fine ? p.z : p.sz) + 0.06, fine ? p.z : p.sz);
          if (E.tool === 'sculpt') { brushRing.visible = true; brushRing.position.set(p.x, X.groundAt(M, p.x, p.z) + 0.08, p.z); brushRing.scale.setScalar(E.brush.r); } } } }
    }
    if (p && !p.miss) { if (edge(R, 'trig')) press(p); else if (E.drag && Ri.trig > 0.5) { dragTo(p, dt); showPreview(p); } }
    if (E.drag && !(Ri.trig > 0.5)) releaseAt(p && !p.miss ? p : { x: E.drag.x0 || 0, z: E.drag.z0 || 0, sx: X.snap(E.drag.x0 || 0), sz: X.snap(E.drag.z0 || 0), q: E.drag.q0 || [0, 0] });
    // rebuild the map a moment after a change (not while a move or a sculpt is still going on)
    if (E.dirtyT >= 0 && !(E.drag && (E.drag.move || E.drag.resize))) { E.dirtyT += dt; if (E.dirtyT > 0.08) { rebuild(true); if (E.sel) drawSel(); } }
  }

  // ---- in and out ----
  function enter(doc) {
    E.on = true; S.edit = true;
    E.hidden = scene.children.filter(o => o !== G && o !== rig && o !== c.worldRoot() && !o.isLight && o.visible); for (const o of E.hidden) o.visible = false;
    G.visible = true; E.page = 'build'; E.drag = null; E.showPad = true; padKey = '';
    let st = null; try { st = JSON.parse(localStorage.getItem('bl_edit') || 'null'); } catch (e) { }
    load(doc || (st && st.map) || X.blank(localStorage.getItem('bl_name') || 'Anon'), doc ? (E.pubId || null) : st && st.pubId || null);
    // stand at the spawn (or the middle of the map), facing in
    const [W, D] = E.M.size, sp = E.M.spawn || [W / 2, D - 3]; c.headWorld(); rig.position.x += sp[0] - head.pos.x; rig.position.z += sp[1] + 2 - head.pos.z; E.footY = floorY(sp[0], sp[1]);
    say(E.M.rooms.length ? 'Editing "' + E.M.name + '". Pick a tool on this tablet, point at the world and pull the trigger.' : 'A blank map. Pick ROOM, point at the floor and drag to draw your first room.');
  }
  function leave() { if (!E.on) return; E.on = false; S.edit = false; G.visible = false; for (const o of E.hidden) o.visible = true; E.hidden = []; preview.visible = false; }
  // where a tablet button is in the world (for tests): its centre
  const padPoint = a => { drawPad(); const b = btns.find(q => q.act === a); if (!b) return null; const u = (b.x + b.w / 2) / 1024 - 0.5, w = 0.5 - (b.y + b.h / 2) / 1152; return pad.localToWorld(new THREE.Vector3(u * 0.4, (0.5 - (b.y + b.h / 2) / padH) * 0.45, 0)); };
  return { get on() { return E.on; }, enter, leave, tick, get doc() { return E.M; }, act, _E: E, aim, padPoint };
}
