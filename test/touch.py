import json
from playwright.sync_api import sync_playwright
JS = """
(async () => {
  const B = window.__bl, wait = ms => new Promise(r => setTimeout(r, ms)), sim = B.net.host.sim, out = {}, $ = id => document.getElementById(id);
  const tap = async id => { const el = $(id), r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, pointerId: 7, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch' }; el.dispatchEvent(new PointerEvent('pointerdown', o)); await wait(250); el.dispatchEvent(new PointerEvent('pointerup', o)); await wait(250); };
  out.startShown = getComputedStyle($('tstart')).display; await tap('bNight'); await wait(500); out.phase = B.S.phase; out.night = B.S.night; await wait(400); out.startHidden = getComputedStyle($('tstart')).display;
  for (const n of sim.npcs) if (n.kind === 's') n.st = 'u';
  // stick: push forward
  const st = $('tstick'), r = st.getBoundingClientRect(), z0 = B.head.pos.z; let o = { bubbles: true, cancelable: true, pointerId: 3, clientX: r.left + r.width / 2, clientY: r.top + 4, pointerType: 'touch' };
  st.dispatchEvent(new PointerEvent('pointerdown', o)); await wait(1200); const dz1 = z0 - B.head.pos.z; out.walked = +dz1.toFixed(2);
  sim.hurt(sim.players.get(1), 5, 'legL'); sim.hurt(sim.players.get(1), 5, 'legR'); await wait(500); const z1 = B.head.pos.z; await wait(1200); out.walkedWounded = +(z1 - B.head.pos.z).toFixed(2); out.w = B.S.me.w; out.fig = B.S.figT > 0;
  st.dispatchEvent(new PointerEvent('pointerup', o)); await wait(200); out.stopped = B.S.tmove.y === 0;
  // look drag on the canvas
  const cv = B.renderer.domElement, y0 = B.S.yaw; cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, clientX: 500, clientY: 200 })); cv.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, clientX: 560, clientY: 200 })); cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: 560, clientY: 200 })); out.looked = +(y0 - B.S.yaw).toFixed(2);
  const m0 = B.guns.rifle.st.mag; await tap('bFire'); out.fired = m0 - B.guns.rifle.st.mag; await tap('bTool'); out.tool = B.S.tool; await tap('bNvg'); out.nvg = B.S.nvg; await tap('bNvg');
  sim.hurt(sim.players.get(1), 5, 'armR'); await wait(400); const q0 = B.guns.rifle.mesh.quaternion.clone(); await wait(500); out.wobble = +q0.angleTo(B.guns.rifle.mesh.quaternion).toFixed(4);
  await tap('bMed'); await wait(500); out.afterMed = [B.S.me.w, B.S.me.med, B.S.me.hp]; await tap('bSwap'); out.gun = B.hands[1].item;
  sim.hurt(sim.players.get(1), 5, 'armL'); await wait(700);
  return out;
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':844,'height':390}, has_touch=True, is_mobile=True, device_scale_factor=1)
    pg = ctx.new_page(); logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None); pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1500); print('tplay visible:', pg.is_visible('#tplay'))
    pg.check('#solo'); pg.click('#tplay'); pg.wait_for_timeout(1500)
    print('RESULT', json.dumps(pg.evaluate(JS))); pg.wait_for_timeout(300); pg.screenshot(path='/tmp/touch.png'); print('\n'.join(logs[:10]) or 'no console errors'); b.close()
