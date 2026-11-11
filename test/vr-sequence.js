(async () => {
  const THREE = await import('/vendor/three.module.min.js');
  const B = window.__bl, X = window.__xr, wait = ms => new Promise(r => setTimeout(r, ms)), out = {}, sim = B.net.host.sim;
  const toLocal = v => { const p = v.clone(); B.rig.worldToLocal(p); return [p.x, p.y, p.z]; };
  const body = off => new THREE.Vector3(off[0], 0, off[2]).applyAxisAngle(new THREE.Vector3(0, 1, 0), B.head.yaw).add(B.head.pos).setY(B.head.pos.y + off[1]);
  const gunPt = (G, key) => G.mesh.localToWorld(G.ud[key].clone());
  const tap = async (hand, i) => { X.btn(hand, i, 1); await wait(280); X.btn(hand, i, 0); await wait(220); };
  out.mode = B.S.mode; out.frames = X.frames; out.handsActive = B.hands.map(h => h.active); out.headY = +B.head.pos.y.toFixed(2); out.spawn = [B.head.pos.x, B.head.pos.z].map(v => +v.toFixed(2));
  // 1 take rifle from chest with right hand
  X.right.p = toLocal(body([0.03, -0.42, -0.2])); await wait(260); await tap('right', 1); out.took = B.hands[1].item;
  X.right.p = toLocal(body([0.2, -0.3, -0.35])); await wait(260);
  // 2 fire two shots
  await tap('right', 0); await tap('right', 0); out.magAfter2 = B.guns.rifle.st.mag; out.pulses = X.right.pad.pulses;
  // 3 drop mag (A), fire chambered round, then click
  await tap('right', 4); out.magDropped = B.guns.rifle.st.mag; await tap('right', 0); out.chamberAfter = B.guns.rifle.st.chamber; out.locked = B.guns.rifle.st.locked;
  // 4 grab fresh mag from pouch with left, bring to magwell
  X.left.p = toLocal(body([-0.2, -0.62, -0.16])); await wait(260); X.btn('left', 1, 1); await wait(260); out.leftItem = B.hands[0].item; out.magsLeft = B.guns.rifle.mags;
  X.left.p = toLocal(gunPt(B.guns.rifle, 'magwell')); await wait(280); out.inserted = B.guns.rifle.st.mag; out.leftItemAfter = B.hands[0].item; X.btn('left', 1, 0); await wait(100);
  // 5 rack with left hand
  const rp = gunPt(B.guns.rifle, 'rack'); X.left.p = toLocal(rp); await wait(260); X.btn('left', 1, 1); await wait(260);
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(B.guns.rifle.mesh.quaternion); X.left.p = toLocal(rp.clone().addScaledVector(back, 0.07)); await wait(280); X.btn('left', 1, 0); await wait(100);
  out.rackedChamber = B.guns.rifle.st.chamber; out.magAfterRack = B.guns.rifle.st.mag;
  // 6 two-hand support: left grips the handguard, then moves up -> barrel pitches up
  X.left.p = toLocal(gunPt(B.guns.rifle, 'fore')); await wait(260); X.btn('left', 1, 1); await wait(260); out.support = B.hands[0].support;
  const f0 = new THREE.Vector3(0, 0, -1).applyQuaternion(B.guns.rifle.mesh.quaternion).y; X.left.p[1] += 0.1; await wait(280);
  out.pitchUp = +(new THREE.Vector3(0, 0, -1).applyQuaternion(B.guns.rifle.mesh.quaternion).y - f0).toFixed(2); X.btn('left', 1, 0); await wait(100);
  // 7 fire mode + auto burst
  await tap('right', 3); out.mode2 = B.guns.rifle.st.mode; const m0 = B.guns.rifle.st.mag; X.btn('right', 0, 1); await wait(500); X.btn('right', 0, 0); await wait(80); out.autoShots = m0 - B.guns.rifle.st.mag;
  // 8 locomotion + snap turn
  const z0 = B.head.pos.z; X.left.pad.axes[3] = -1; await wait(600); X.left.pad.axes[3] = 0; out.walked = +(z0 - B.head.pos.z).toFixed(2);
  const y0 = B.head.yaw, hx = B.head.pos.x; X.right.pad.axes[2] = 1; await wait(280); X.right.pad.axes[2] = 0; await wait(100); out.turned = +((y0 - B.head.yaw) * 180 / Math.PI).toFixed(0); out.pivot = +(B.head.pos.x - hx).toFixed(2);
  X.right.pad.axes[2] = -1; await wait(280); X.right.pad.axes[2] = 0; await wait(100);
  // 9 start mission by shooting the START button
  const bw = B.panel.mesh.localToWorld(new THREE.Vector3((512 / 1024 - 0.5) * 1.6, (0.5 - 688 / 768) * 1.2, 0));
  const aim = async (target) => { for (let i = 0; i < 3; i++) { const mz = gunPt(B.guns.rifle, 'muzzle'), m = new THREE.Matrix4().lookAt(mz, target, new THREE.Vector3(0, 1, 0)), q = new THREE.Quaternion().setFromRotationMatrix(m), rq = B.rig.quaternion.clone().invert().multiply(q); X.right.q = [rq.x, rq.y, rq.z, rq.w]; await wait(100); } };
  await aim(bw); out.probe = B.panel.cursor.visible; await tap('right', 0); await wait(400); out.phase = B.S.phase; out.magAtStart = B.guns.rifle.st.mag; out.itemAtStart = B.hands[1].item;
  // 10 door by hand: go to the front door, grip the handle with left
  B.rig.position.x += 12 - B.head.pos.x; B.rig.position.z += 17 - B.head.pos.z; await wait(280);
  X.left.p = toLocal(B.world.doors[0].handle.getWorldPosition(new THREE.Vector3())); await wait(260); await tap('left', 1); await wait(250); out.door = sim.doorOpen[0];
  // 11 cuff: force nearest civilian to comply, stand next to them, hold left grip
  const c = sim.npcs.find(n => n.kind === 'c'); for (const n of sim.npcs) if (n.kind === 's') n.st = 'u'; c.st = 'y';
  B.rig.position.x += c.x + 0.6 - B.head.pos.x; B.rig.position.z += c.z - B.head.pos.z; B.S.feetY = c.y; B.rig.position.y = c.y; await wait(300);
  out.near = [+(B.head.pos.x - c.x).toFixed(2), +(B.head.pos.z - c.z).toFixed(2), +(B.S.feetY - c.y).toFixed(2)];
  X.left.p = toLocal(new THREE.Vector3(c.x + 0.2, c.y + 0.9, c.z)); await wait(280); X.btn('left', 1, 1); for (let i = 0; i < 60 && c.st !== 'u'; i++) await wait(300); X.btn('left', 1, 0); await wait(200); out.cuffed = c.st;
  // 12 bomb: stand by it, cut wires in order with left trigger
  const bi = 0, b = sim.bombs[bi], bo = B.S.bombs[bi];
  B.rig.position.x += b.x - B.head.pos.x; B.rig.position.z += b.z + 0.5 - B.head.pos.z; B.S.feetY = b.y > 3 ? 3.2 : 0; B.rig.position.y = B.S.feetY; await wait(300);
  for (const w of b.order) { X.left.p = toLocal(bo.wirePos(w, new THREE.Vector3())); await wait(280); await tap('left', 0); await wait(200); }
  out.defused = b.defused; out.bdbg = [b.x, b.y, b.z, b.cut.join(''), b.order.join(''), B.head.pos.toArray().map(v => +v.toFixed(2)).join(','), sim.phase, B.hands[0].item, JSON.stringify(B.hands[0].in)]; out.hud = B.S.defused + '/' + B.S.secured;
  // 13 shout with left B
  const t0 = sim.players.get(1).lastShout; await tap('left', 5); await wait(200); out.shouted = sim.players.get(1).lastShout > t0;
  // 14 stow rifle, draw pistol
  await tap('right', 1); out.stowed = B.guns.rifle.where; X.right.p = toLocal(body([0.24, -0.72, 0.02])); await wait(280); await tap('right', 1); out.pistol = B.hands[1].item;
  X.right.p = toLocal(body([0.2, -0.3, -0.4])); X.right.q = [0, 0, 0, 1]; await wait(280); await tap('right', 0); out.pistolMag = B.guns.pistol.st.mag;
  out.hp = B.S.me.hp;
  return out;
})()
