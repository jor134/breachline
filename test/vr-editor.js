// The VR map editor: open it from the board, build a two-floor house with the laser (room, door, window, furniture, stairs,
// spots, spawn), sculpt, plant, wall and gate, select and move, undo, a tablet button pressed with the laser, test play, back, exit.
(async () => {
  const B = window.__bl, THREE = B.THREE, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, ED = B.ED, E = ED._E;
  const until = async (f, n = 60) => { for (let i = 0; i < n && !f(); i++) await wait(150); return !!f(); };
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message))); const ce = console.error; console.error = (...a) => { errs.push(a.map(x => x && x.stack ? x.stack.slice(0, 300) : String(x)).join(' ').slice(0, 300)); ce(...a); };
  await until(() => B.S.mode === 'vr' && B.M.id === 'training' && B.S.me.id, 80); await wait(800);
  // point the right hand from where it is at a world point (the game tilts the ray by S.tilt degrees)
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (B.S.tilt || 0) * Math.PI / 180);
  const point = async (x, y, z) => { B.rig.updateMatrixWorld(true); const hp = new THREE.Vector3(...X.right.p).applyMatrix4(B.rig.matrixWorld), d = new THREE.Vector3(x, y, z).sub(hp).normalize();
    const qw = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), d).multiply(tilt.clone().invert()); const ql = B.rig.quaternion.clone().invert().multiply(qw); X.right.q = [ql.x, ql.y, ql.z, ql.w]; await wait(120); };
  const trig = async v => { X.btn('right', 0, v); await wait(150); };
  const tap = async (x, z, y = 0) => { await point(x, y, z); await trig(1); await trig(0); await wait(250); };
  const drag = async (x0, z0, x1, z1, y = 0) => { await point(x0, y, z0); await trig(1); for (let k = 1; k <= 5; k++) await point(x0 + (x1 - x0) * k / 5, y, z0 + (z1 - z0) * k / 5); await trig(0); await wait(300); };
  B.openEditor(); await wait(400); out.open = ED.on && B.S.edit;
  ED.act('open:blank'); await wait(400); out.blankWorld = B.M.id === 'draft';
  // stand south of where the house goes, eyes 1.7 up
  B.rig.position.x += 14 - B.head.pos.x; B.rig.position.z += 24 - B.head.pos.z; await wait(300);
  ED.act('tool:room'); await drag(10, 10, 18, 16); out.room = ED.doc.rooms.length === 1 && ED.doc.rooms[0].slice(1, 5).join() === '10,10,18,16'; await wait(300);
  out.walls = B.level.boxes.filter(b => b.kind === 'wall').length; out.aimAtWall = (() => { const p = ED.aim(); return p && +p.z.toFixed(1); })();
  ED.act('tool:door'); await tap(14, 16.2); out.door = ED.doc.openings.length === 1 && ED.doc.openings[0][5] === 'door';
  ED.act('tool:glass'); await drag(11, 16.2, 13, 16.2); out.window = ED.doc.glass.length === 1;
  const go = async (x, z) => { B.rig.position.x += x - B.head.pos.x; B.rig.position.z += z - B.head.pos.z; await wait(300); };
  await go(14, 15.2);   // walk in (the editor lets you pass through walls)
  ED.act('tool:furn'); await tap(15.5, 12); out.furn = ED.doc.furniture.length === 1;
  ED.act('tool:s'); await tap(16, 14); ED.act('tool:c'); await tap(12, 13.5); ED.act('tool:b'); await tap(17, 14.6); await go(14, 24); ED.act('tool:spawn'); await tap(14, 21);
  out.spots = [ED.doc.spawn && ED.doc.spawn.join(), ED.doc.s.length, ED.doc.c.length, ED.doc.b.length].join('|');
  // second floor: one more floor, a room over the first, stairs from the ground floor
  ED.act('map:f+'); await wait(300); ED.act('floor:+'); await wait(1600); out.floor2 = [E.F, E.M.floors, +B.S.feetY.toFixed(2)].join('|');
  ED.act('tool:room'); await drag(10, 10, 18, 16, 3.2); out.room2 = ED.doc.rooms.map(r => r.slice(0, 5).join(',')).join(' ; '); ED.act('floor:-'); await wait(500); await go(14, 15.2); ED.act('tool:stairs'); await tap(11.2, 13); await go(14, 24);
  out.upstairs = ED.doc.rooms.filter(r => r[0] === 1).length === 1 && ED.doc.stairs.length === 1;
  // landscape
  ED.act('tool:sculpt'); await point(40, 0, 30); await trig(1); await wait(900); await trig(0); await wait(400); out.sculpt = !!ED.doc.ter && Math.max(...ED.doc.ter) > 0;
  ED.act('tool:tree'); await tap(6, 22); ED.act('tool:pwall'); await drag(2, 26, 24, 26); ED.act('tool:gate'); await tap(8, 26); out.gateMsg = E.log.slice(-3).join(' / '); out.pw = JSON.stringify(ED.doc.pwalls) + JSON.stringify(ED.doc.gates);
  out.land = [ED.doc.trees.length, ED.doc.pwalls.length, ED.doc.gates.length].join('|');
  // select the furniture and move it 2 m east, then undo the move
  await go(14, 15.2); ED.act('tool:select'); const f0 = ED.doc.furniture[0][1]; await point(15.6, 0.2, 12.2); await trig(1); out.selAt = JSON.stringify(E.sel) + ' ' + JSON.stringify(E.drag && { move: E.drag.move, x0: E.drag.x0, z0: E.drag.z0 }); for (let k = 1; k <= 4; k++) await point(15.6 + k * 0.5, 0.2, 12.2); out.mid = ED.doc.furniture[0][1] - f0; await trig(0); await wait(300);
  out.moved = ED.doc.furniture[0][1] - f0; X.btn('right', 4, 1); await wait(150); X.btn('right', 4, 0); await wait(300); out.undone = ED.doc.furniture[0][1] === f0;
  // the tablet: point the laser at its MISSION tab and pull
  await wait(300); const pp = ED.padPoint('page:mission'); if (pp) { await point(pp.x, pp.y, pp.z); await wait(150); await trig(1); await trig(0); } out.tabletPress = E.page === 'mission';
  ED.act('file:check'); out.check = E.msg.slice(0, 160);
  out.saved = (() => { try { return JSON.parse(localStorage.getItem('bl_edit')).map.rooms.length; } catch (e) { return -1; } })();
  // test play, then back to the editor, then out
  ED.act('file:test'); out.testStarted = await until(() => B.M.id === 'draft' && B.S.phase === 'active' && !ED.on, 60); out.testRooms = B.M.rooms && B.M.rooms.length;
  await wait(800); B.openEditor(); await wait(500); out.back = ED.on && ED.doc.rooms.length === 2;
  ED.act('file:exit'); out.exited = await until(() => !ED.on && B.M.id === 'training', 80);
  out.msg = E.msg; out.errors = errs.slice(0, 6); return out;
})()
