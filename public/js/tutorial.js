// The guided tutorial: a coach that walks a new player through BREACHLINE one step at a time. Each step waits until you
// actually do the thing (walk to the green marker, reload, open a door, shout...), with the prompt worded for VR, phone or
// keyboard and mouse. Part one runs in the training facility, part two on a first real mission with the squad bots.
// Optional extra lessons cover the rest. Everything here is client-side: it watches the game, it never changes the rules.

const T3 = (vr, touch, desk) => ({ vr, touch, desk });
const MARK = { line: [10, 15.7], house: [22.5, 17.2], kick: [29.2, 24.4], pick: [22.2, 24.4], trap: [25.7, 24.4], bomb: [32.1, 21.2], board: [10, 26.2] };

// done(c) is checked every frame; c.base holds what things were when the step began. info steps wait for NEXT.
const CORE = [
  { id: 'hello', title: "WELCOME TO YOU CAN'T HIDE", info: true, text: T3(
    'You lead a SWAT squad: rescue hostages, arrest suspects, defuse bombs. Shoot only people who threaten you. This coach panel follows you. Point at a button and pull the trigger to press it. Every step waits until you do it; SKIP if you already know it.',
    'You lead a SWAT squad: rescue hostages, arrest suspects, defuse bombs. Shoot only people who threaten you. Each step waits until you do it; tap SKIP if you already know it.',
    'You lead a SWAT squad: rescue hostages, arrest suspects, defuse bombs. Shoot only people who threaten you. Each step waits until you do it. Press K (or click NEXT / SKIP; Esc frees the mouse).') },
  { id: 'move', title: 'MOVE', mark: 'line', text: T3(
    'Push the LEFT stick to walk to the green marker at the firing line. Click the left stick to jog. You can also just step around in your room.',
    'Use the LEFT thumb pad to walk to the green marker at the firing line. Drag anywhere on the right half of the screen to look.',
    'W A S D to walk to the green marker at the firing line. Move the mouse to look (click the game first).'),
    done: c => c.near(MARK.line, 1.2) },
  { id: 'turn', title: 'TURN', text: T3(
    'Flick the RIGHT stick left or right to snap-turn. Turn all the way round once, then face the targets again.',
    'Drag on the right half of the screen to turn. Turn all the way round once.',
    'Move the mouse to turn. Turn all the way round once.'),
    done: c => c.turned() > 5.5 },
  { id: 'rifle', title: 'YOUR RIFLE', vrOnly: true, text: T3(
    'Your rifle hangs on your chest. Reach to your chest with your right hand and squeeze GRIP to take it. Grip it again near your chest to let it hang. Grab the front of the rifle with your left hand to steady it.'),
    done: c => c.holding('rifle') },
  { id: 'shoot', title: 'SHOOT', text: T3(
    'Hit three of the targets downrange. TRIGGER fires. Look down the sight: the red dot is where it hits. Gun hand STICK CLICK swaps semi and full auto.',
    'Hit three targets downrange. Hold AIM to look down the sight, tap FIRE to shoot.',
    'Hit three targets downrange. Hold RIGHT click to aim, LEFT click to fire. V swaps semi and full auto.'),
    done: c => c.hits() - c.base.hits >= 3 },
  { id: 'reload', title: 'RELOAD', text: T3(
    'On the hand holding the gun press A or X: the magazine drops. Grab a fresh one from your LEFT belt (GRIP), push it up into the gun, then press B or Y to release the bolt (or pull the charging handle back with your other hand).',
    'Tap RELOAD. Watch the ammo count: an empty gun is a dead officer.',
    'Press R to reload. Watch the ammo count: an empty gun is a dead officer.'),
    done: c => c.reloads > 0 },
  { id: 'pistol', title: 'SIDEARM', text: T3(
    'Your pistol is on your RIGHT hip. Let the rifle hang (grip it at your chest), reach to your hip and GRIP the pistol. Swap back the same way.',
    'Tap GUN to swap to the pistol. Tap it again to go back to the rifle.',
    'Press 2 for the pistol, 1 for the rifle.'),
    done: c => c.holding('pistol') },
  { id: 'light', title: 'FLASHLIGHT', text: T3(
    'With your EMPTY hand, TAP A or X to switch the weapon light off and on.',
    'Tap LIGHT to switch your weapon light off and on.',
    'Press T to switch your weapon light off and on.'),
    done: c => c.S.light !== c.base.light },
  { id: 'door', title: 'DOORS', mark: 'house', text: T3(
    'Go to the marker at the kill house door. Reach for the lever with your EMPTY hand: it glows when you can work it. Squeeze GRIP or TRIGGER to open it. Doors open both ways; push them wide or crack them open.',
    'Go to the marker at the kill house door, face it and tap USE to open it. USE again closes it.',
    'Go to the marker at the kill house door, face it and press E to open it. E again closes it.'),
    done: c => c.sent.door > c.base.door },
  { id: 'kick', title: 'KICK', mark: 'kick', text: T3(
    'Locked doors can be kicked in. Go to the marker by the KICK door in the skill bay, face it and CLICK the stick of your empty hand to kick. It may take more than one.',
    'Locked doors can be kicked in. Go to the marker by the KICK door in the skill bay, face it and tap KICK. It may take more than one.',
    'Locked doors can be kicked in. Go to the marker by the KICK door in the skill bay, face it and press Q. It may take more than one.'),
    done: c => c.sent.kick > c.base.kick },
  { id: 'shout', title: 'SHOUT', text: T3(
    'Before you shoot, shout. On your EMPTY hand TAP B or Y: "POLICE! GET DOWN!" Hostages kneel. Suspects may give up, or fight. Shout again and again: each shout adds pressure.',
    'Before you shoot, shout. Tap SHOUT: "POLICE! GET DOWN!" Hostages kneel. Suspects may give up, or fight. Each shout adds pressure.',
    'Before you shoot, shout. Press F: "POLICE! GET DOWN!" Hostages kneel. Suspects may give up, or fight. Each shout adds pressure.'),
    done: c => c.sent.shout > c.base.shout },
  { id: 'tools', title: 'TOOL WHEEL', text: T3(
    'HOLD A or X on your EMPTY hand: the tool wheel opens. Point at a tool and let go: lockpick, wire cutters, door camera, med kit, hands, night vision. Pick any tool now.',
    'Tap the HANDS button to cycle tools: lockpick, wire cutters, door camera. USE works with the tool you hold. Pick any tool now.',
    'Number keys pick tools: 3 hands, 4 lockpick, 5 wire cutters, 8 door camera. E uses the tool. Pick any tool now.'),
    done: c => c.S.tool !== c.base.tool },
  { id: 'menu', title: 'WRIST AND RADIO', text: T3(
    'Turn your LEFT palm up: the inside of your wrist shows the timer and objectives. The radio on your LEFT chest is the menu: GRIP it to open (weather, restart, end mission, home). Open it now.',
    'The top of the screen shows the timer and objectives. MENU shows the mission buttons (start, end, home). Tap MENU now.',
    'The top left shows the timer and objectives. M opens the menu (weather, restart, end mission, home). Press M now.'),
    done: c => c.S.menu || c.S.tmenu },
  { id: 'board', title: 'THE MISSION BOARD', mark: 'board', text: T3(
    'Walk to the big board in the lobby. MISSION picks the map, WEATHER and TIME set the mood, TEAM picks SWAT or terrorist (PvP). I have set the MANSION, clear, daytime for you. Point at START MISSION and pull the trigger.',
    'In the training facility the mission board is the row of buttons across the top: MAP, WEATHER, TIME and TEAM (SWAT or terrorist for PvP). I have set the MANSION, clear, daytime for you. Tap START MISSION.',
    'Walk to the big board in the lobby. MAP, WEATHER, TIME and TEAM are set with O and the board buttons; I have set the MANSION, clear, daytime for you. Press ENTER (or click START MISSION) to go.'),
    enter: c => c.pickFirstMission(), done: c => !c.M().training },
  // part two: a real mission
  { id: 'brief', title: 'YOUR FIRST MISSION', info: true, mission: true, text: T3(
    'Suspects are inside with hostages and a bomb. The timer is on your wrist. Three squad bots follow you and fight back. Go slowly: open doors, shout, look before you step in. Your score is on the report at the end.',
    'Suspects are inside with hostages and a bomb. The timer is at the top. Three squad bots follow you and fight back. Go slowly: open doors, shout, look before you step in.',
    'Suspects are inside with hostages and a bomb. The timer is top left. Three squad bots follow you and fight back. Go slowly: open doors, shout, look before you step in.') },
  { id: 'order', title: 'ORDER YOUR SQUAD', mission: true, skipIf: c => !c.botsUp(), text: T3(
    'HOLD B or Y on your empty hand and point: a green ring marks a door or person. Let go to open the order wheel, point at an order (open, kick, breach, follow, hold...) and pull the trigger.',
    'Tap SQUAD, then tap an order: follow, hold, open or breach the door you face, detain, revive.',
    'Press G for the squad wheel, then click an order: follow, hold, open or breach the door you face, detain, revive.'),
    done: c => c.sent.order > c.base.order },
  { id: 'cuff', title: 'ARREST SOMEONE', mission: true, text: T3(
    'Find a person. SHOUT (B/Y) until they kneel with hands up, then walk up and HOLD GRIP on them to cuff. Cuffed hostages and suspects count to your score. An armed suspect who turns on you: shoot.',
    'Find a person. SHOUT until they kneel with hands up, then go close and tap USE to cuff them. An armed suspect who turns on you: shoot.',
    'Find a person. Press F until they kneel with hands up, then go close and press E to cuff them. An armed suspect who turns on you: shoot.'),
    done: c => c.sent.cuff > c.base.cuff },
  { id: 'finish', title: 'FINISH THE MISSION', mission: true, text: T3(
    'Clear the house, then walk out of the front gate, or open the radio menu (GRIP the radio) and END MISSION. The report shows what you scored and lost.',
    'Clear the house, then walk out of the front gate, or tap MENU then END MISSION. The report shows what you scored and lost.',
    'Clear the house, then walk out of the front gate, or press L to end the mission. The report shows what you scored and lost.'),
    done: c => c.S.phase === 'ended' },
];
const DONE = { id: 'done', title: 'TUTORIAL COMPLETE', info: true, end: true, text: T3(
  'Well done, officer. The training facility has the range, a kill house and skill stations. Extra lessons cover night vision, grenades, locks and traps, bombs, playing online with friends, PvP and the level editor.',
  'Well done, officer. Extra lessons cover night vision, grenades, locks and traps, bombs, playing online with friends, PvP and the level editor.',
  'Well done, officer. Extra lessons cover night vision, grenades, locks and traps, bombs, playing online with friends, PvP and the level editor.') };

const EXTRAS = {
  fit: { label: 'BODY FIT (VR)', vrOnly: true, steps: [
    { title: 'BODY FIT', mark: 'board', text: T3('If your body or vest looks wrong when you look down, walk to the mission board and press BODY FIT. Slide your body back or forward and up or down, and move the gear on your vest. It is saved on this headset.'), done: c => c.S.panel === 'fit' },
    { title: 'BODY FIT', info: true, text: T3('Look down while you press the buttons. DONE goes back to the board. Your rifle hangs at your chest, the pistol at your right hip, magazines on your left belt, grenades on the front of your vest.') }] },
  nvg: { label: 'NIGHT VISION', steps: [
    { title: 'NIGHT VISION', text: T3('Reach up to your helmet and GRIP to flip the night vision down. Grip again to raise it. (It is also on the tool wheel.)', 'Tap NVG to switch night vision on.', 'Press N to switch night vision on.'), done: c => c.S.nvg },
    { title: 'LIGHTS OUT', info: true, text: T3('On missions, the MAIN BREAKER cuts every light in the building: suspects cannot see, you can with night vision. Go to the breaker and use it with an empty hand. The mission board says where it is.', 'On missions, the MAIN BREAKER cuts every light in the building: suspects cannot see, you can with NVG. Go to it and tap USE. The mission board says where it is.', 'On missions, the MAIN BREAKER cuts every light in the building: suspects cannot see, you can with NVG. Go to it and press E. The mission board says where it is.') }] },
  nades: { label: 'GRENADES', steps: [
    { title: 'FLASHBANG', text: T3('Flashbangs and smoke sit on the front of your vest. GRIP one, swing your arm and let go to throw it. A flashbang stuns everyone who sees it: throw it into a room, then go in. Throw one now.', 'Tap FLASH to throw a flashbang where you face; SMOKE throws smoke. A flashbang stuns everyone who sees it. Throw one now.', 'Press 6 to throw a flashbang, 7 for smoke. A flashbang stuns everyone who sees it. Throw one now.'), done: c => c.sent.throw > c.base.throw },
    { title: 'SMOKE', info: true, text: T3('Smoke hides you while you cross open ground or pull a hostage out. You carry two flashbangs and one smoke per mission.') }] },
  locks: { label: 'LOCKS AND TRAPS', steps: [
    { title: 'PICK A LOCK', mark: 'pick', text: T3('This door is locked. HOLD A/X for the tool wheel and choose the LOCKPICK, then hold your hand on the lever and wiggle until it gives. Quieter than kicking.', 'This door is locked. Tap HANDS until it reads PICK, face the door and tap USE, then keep tapping USE until it gives.', 'This door is locked. Press 4 for the lockpick, face the door and hold E until it gives.'), done: c => !c.S.doorLocked[c.door('pick')] },
    { title: 'RIGGED DOOR', mark: 'trap', text: T3('Some doors are rigged with a wire. Choose the DOOR CAMERA from the wheel and slide it under the door to look first. Then choose the WIRE CUTTERS and cut the wire before you open it.', 'Some doors are rigged with a wire. Set the tool to CAM and USE it to look under the door, then CUTTER and USE to cut the wire.', 'Some doors are rigged with a wire. 8 = door camera to look under first, 5 = wire cutters, then E to cut the wire.'), done: c => !c.S.doorTrap[c.door('trap')] }] },
  bomb: { label: 'DEFUSE A BOMB', steps: [
    { title: 'THE DUMMY BOMB', mark: 'bomb', text: T3('Go to the bench. The bomb shows which wire colours to cut, in order. Cut them with the TRIGGER of an EMPTY hand (or the wire cutters). A wrong wire takes 45 seconds off the clock on a mission.', 'Go to the bench. The bomb shows which wire colours to cut, in order. Set the tool to CUTTER and tap USE for each wire. A wrong wire costs 45 seconds on a mission.', 'Go to the bench. The bomb shows which wire colours to cut, in order. Press 5 for the cutters and E for each wire. A wrong wire costs 45 seconds on a mission.'), done: c => c.defused > c.base.defused }] },
  house: { label: 'KILL HOUSE', steps: [
    { title: 'KILL HOUSE', mark: 'house', text: T3('Go through the kill house door: the clock starts. In each room shoot the RED (armed) cut-out and leave the BLUE ones alone. Out the far door to stop the clock. Each blue hit adds 5 seconds.'), done: c => c.houseRuns() > c.base.houseRuns }] },
  online: { label: 'PLAY WITH FRIENDS', steps: [
    { title: 'ONLINE ROOMS', info: true, text: T3('From the MAIN MENU (radio menu) pick PLAY ONLINE: one of you presses NEW for a room code, the others type the same four digits. Up to four play together; each friend takes a squad bot\'s place. VOICE CHAT on the start menu; MIC on the radio menu mutes you, PLAYERS mutes others.', 'On the start screen untick SOLO, type the same ROOM CODE as your friends and join. Up to four play together; each friend takes a squad bot\'s place. Tick VOICE CHAT to talk (MIC button mutes).', 'On the start screen untick SOLO, type the same ROOM CODE as your friends and join. Up to four play together; each friend takes a squad bot\'s place. Tick VOICE CHAT to talk (B mutes).') },
    { title: 'PVP', info: true, text: T3('On the mission board press TEAM to play as a TERRORIST. If anyone is a terrorist the next mission is PvP: SWAT against terrorists, with the AI suspects on the terrorists\' side. Playing a terrorist solo pits you against the squad bots.') }] },
  editor: { label: 'LEVEL EDITOR', steps: [
    { title: 'BUILD YOUR OWN MAPS', info: true, text: T3('MAP EDITOR on the training board builds a map life-size around you: rooms, doors, windows, floors and stairs, furniture, ground, trees and walls, with the tool tablet on your left hand. TEST PLAY runs your draft solo.', 'The LEVEL EDITOR (on the start screen) builds maps on a phone or computer: rooms, doors, windows, floors and stairs, furniture, ground, trees and walls. TEST plays your draft; PUBLISH (with the creator code) puts it on everyone\'s mission board.', 'The LEVEL EDITOR (on the start screen) builds maps on a phone or computer: rooms, doors, windows, floors and stairs, furniture, ground, trees and walls. TEST plays your draft; PUBLISH (with the creator code) puts it on everyone\'s mission board.') }] },
};

export function createTutorial(ctx) {
  const { THREE } = ctx;
  let steps = null, i = 0, c = null, active = false, menu = false, lesson = null, coachAt = null, lastKey = '';
  const sent = { door: 0, kick: 0, shout: 0, order: 0, cuff: 0, throw: 0 }; let reloads = 0, defused = 0, prevMag = {}, turnAcc = 0, lastYaw = null, houseRuns = 0;
  // the green marker: a ring and a soft beam
  const mk = new THREE.Group(), ringM = new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 40), ringM); ring.rotation.x = Math.PI / 2; mk.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.position.y = 1.5; mk.add(beam);
  mk.visible = false; ctx.scene.add(mk);
  const plat = () => ctx.S.mode === 'vr' ? 'vr' : ctx.S.touch ? 'touch' : 'desk';
  const textOf = st => st.text[plat()] || st.text.vr;
  const cx = {
    S: ctx.S, M: ctx.M, sent, get reloads() { return reloads; }, get defused() { return defused; }, base: {},
    near: ([x, z], r) => Math.hypot(ctx.head.pos.x - x, ctx.head.pos.z - z) < r, turned: () => turnAcc,
    holding: k => ctx.holding(k), hits: () => ctx.hits(), houseRuns: () => houseRuns, botsUp: () => ctx.botsUp(), door: k => ctx.M().doorsOf ? ctx.M().doorsOf[k] : -1,
    pickFirstMission: () => ctx.pickMission('mansion', 'clear', 'day'),
  };
  function snapshot() { return { hits: ctx.hits(), light: ctx.S.light, tool: ctx.S.tool, defused, houseRuns, ...sent }; }
  function begin(k) {
    i = k; const st = steps[i]; if (!st) return finish();
    if (st.vrOnly && plat() !== 'vr') return begin(i + 1);
    if (st.mission && ctx.M().training && !st.end) { /* waits for the mission to load */ }
    cx.base = snapshot(); turnAcc = 0; lastYaw = null; reloads = 0; coachAt = null; if (st.enter) st.enter(cx); ctx.sfx && ctx.sfx.beep(null, 1100); draw();
  }
  function finish() { if (lesson) { lesson = null; return showMenu(); } stop(); }
  function stop() { active = false; menu = false; steps = null; mk.visible = false; ctx.coach.mesh.visible = false; ctx.coach.cursor.visible = false; dom.style.display = 'none'; lastKey = ''; }
  function start(which = 'core') {
    try { localStorage.setItem('bl_tutseen', '1'); } catch (e) { }
    active = true; menu = false; lesson = null;
    if (which === 'menu') return showMenu();
    if (EXTRAS[which]) { lesson = which; steps = EXTRAS[which].steps.map(s => ({ ...s })); if (!ctx.M().training) ctx.toTraining(); return begin(0); }
    steps = [...CORE, DONE]; if (!ctx.M().training) ctx.toTraining(); begin(0);
  }
  function showMenu() { active = true; menu = true; steps = null; mk.visible = false; coachAt = null; draw(); }
  const menuBtns = () => [['FULL TUTORIAL', 'tut:core'], ...Object.entries(EXTRAS).filter(([, e]) => !e.vrOnly || plat() === 'vr').map(([k, e]) => [e.label, 'tut:' + k]), ['CLOSE', 'tut:exit']];
  function act(a) {
    if (!a.startsWith('tut:')) return false; const k = a.slice(4); ctx.sfx && ctx.sfx.click();
    if (k === 'exit') stop(); else if (k === 'next' || k === 'skip') { if (steps && steps[i] && steps[i].end) { if (k === 'next') return stop(), true; } begin(i + 1); }
    else if (k === 'extras') { if (!ctx.M().training) ctx.toTraining(); showMenu(); } else if (k === 'menu') showMenu(); else start(k);
    return true;
  }
  // what the coach shows: title, progress, the words for this platform, buttons
  function view() {
    if (menu) return { title: 'TUTORIAL', sub: 'Pick a lesson', text: plat() === 'vr' ? 'FULL TUTORIAL: the basics and a first mission. Extras: short, any order.' : 'The FULL TUTORIAL teaches the basics in about ten minutes, then takes you on a first mission. The extra lessons are short and can be done in any order.', btns: menuBtns() };
    const st = steps[i], n = steps.filter(s => !(s.vrOnly && plat() !== 'vr')).length, at = steps.slice(0, i + 1).filter(s => !(s.vrOnly && plat() !== 'vr')).length;
    const wait = st.mission && ctx.M().training ? 'This part happens on a mission. Press START MISSION on the mission board (I picked the mansion, clear, daytime).' : null;
    const btns = st.end ? [['EXTRA LESSONS', 'tut:extras'], ['DONE', 'tut:next']] : st.info ? [['NEXT', 'tut:next'], ['EXIT TUTORIAL', 'tut:exit']] : [['SKIP STEP', 'tut:skip'], ['EXIT TUTORIAL', 'tut:exit']];
    return { title: st.title, sub: (lesson ? EXTRAS[lesson].label : 'TUTORIAL') + '   ' + at + ' / ' + n + (st.info || st.end ? '' : '   (do it to go on)'), text: wait || textOf(st), btns };
  }
  // ---- the on-screen coach (phone and desktop) ----
  const dom = document.createElement('div'); dom.id = 'coach'; dom.style.display = 'none'; document.body.appendChild(dom);
  dom.addEventListener('pointerdown', e => { e.stopPropagation(); const b = e.target.closest('[data-a]'); if (b) { e.preventDefault(); act(b.dataset.a); } else if (e.target.closest('.cmin')) { dom.classList.toggle('min'); } });
  function draw() {
    const v = view(), key = JSON.stringify(v) + plat(); if (key === lastKey) return; lastKey = key;
    if (plat() === 'vr') { dom.style.display = 'none'; ctx.coach.mesh.visible = true; const top = v.btns.length > 3 ? 676 - 86 * Math.ceil((v.btns.length - 1) / 2) : 676 - 86 * (v.btns.length - 1), room = Math.max(1, Math.floor((top - 198) / 39) + 1);   // as many lines as fit above the buttons
      ctx.coach.draw(v.title, v.sub, wrap(v.text, 56).slice(0, room), v.btns); return; }
    ctx.coach.mesh.visible = false; dom.style.display = 'block';
    dom.innerHTML = `<div class="ch"><b>${v.title}</b><span>${v.sub}</span><span class="cmin">_</span></div><div class="ct">${v.text}</div><div class="cb">${v.btns.map(([t, a]) => `<button data-a="${a}">${t}</button>`).join('')}</div>${plat() === 'desk' ? '<div class="ck">K = ' + (v.btns[0][0]) + '</div>' : ''}`;
  }
  function wrap(s, n) { const out = []; let line = ''; for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; }
  // ---- every frame ----
  function tick(dt) {
    if (!active) return;
    for (const k of ['rifle', 'pistol']) { const m = ctx.mag(k); if (prevMag[k] === null && m !== null && m !== undefined) reloads++; prevMag[k] = m; }
    const y = ctx.yaw(); if (lastYaw !== null) { let d = y - lastYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turnAcc += Math.abs(d); } lastYaw = y;
    if (!menu && steps) {
      const st = steps[i];
      const fin = steps.findIndex(q => q.id === 'finish');
      if (st.mission && st.id !== 'finish' && fin > i && ctx.S.phase === 'ended' && !ctx.M().training) begin(fin);   // the mission ended early: straight to the wrap-up
      else if (st.skipIf && !(st.mission && ctx.M().training) && st.skipIf(cx)) begin(i + 1);
      else if (st.done && !(st.mission && ctx.M().training) && st.done(cx)) { ctx.sfx && ctx.sfx.beep(null, 1400); ctx.say && ctx.say('DONE'); begin(i + 1); }
      const s2 = steps && steps[i]; const m = s2 && s2.mark && ctx.M().training ? MARK[s2.mark] : null;
      mk.visible = !!m; if (m) { mk.position.set(m[0], ctx.groundY(m[0], m[1]) + 0.03, m[1]); ring.scale.setScalar(1 + 0.12 * Math.sin(ctx.S.now * 4)); }
    } else mk.visible = false;
    draw();
    if (plat() === 'vr') placeCoach(dt);
  }
  // the VR coach floats ahead and a little to the left; it catches up when you turn away from it
  function placeCoach(dt) {
    const h = ctx.head, f = new THREE.Vector3(h.fwd.x, 0, h.fwd.z); if (f.lengthSq() < 1e-6) return; f.normalize();
    const want = f.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.42).multiplyScalar(1.45).add(h.pos); want.y = h.pos.y - 0.15;
    const m = ctx.coach.mesh;
    if (!coachAt || coachAt.distanceTo(want) > 1.3 || m.position.distanceTo(h.pos) > 2.6) coachAt = want;
    m.position.lerp(coachAt, coachAt === want && m.position.distanceTo(want) > 1.2 ? 1 : Math.min(1, dt * 3)); m.lookAt(h.pos.x, m.position.y, h.pos.z); m.updateMatrixWorld(true);
  }
  // what the game reports: messages this player sends and events about them
  function note(t) { if (!active || t === 'cuff') return; if (t in sent) sent[t]++; }   // a cuff counts when it lands (the event)
  function event(e, me) {
    if (!active) return;
    if (e.e === 'cut' && e.defused) defused++;
    if (e.e === 'house') houseRuns++;
    if (e.e === 'cuff' && e.p === me) sent.cuff++;
  }
  return { start, stop, tick, note, event, act, showMenu, get active() { return active; }, key: () => { const v = view(); if (active) act(v.btns[0][1]); } };
}
export const TUT_STEPS = CORE, TUT_EXTRAS = EXTRAS, TUT_MARKS = MARK;
