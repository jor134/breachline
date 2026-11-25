# quest-store: the page goes straight into VR (boot.js), shows the loading card, game.js takes the session over and shows
# the in-VR start menu; SOLO, ONLINE (keypad) and TUTORIAL start the game from there. Needs the static server on :8765.
import json
from playwright.sync_api import sync_playwright
JS_STATE = "(() => { const B = window.__bl, b = window.__boot; return { boot: !!(b && b.store), taken: !!(b && b.taken), presenting: !!(B && B.renderer.xr.isPresenting), panel: B && B.S.panel, mode: B && B.S.mode, net: B && B.S.net, btns: B ? B.panel.btns.map(x => x.act) : [], ui: getComputedStyle(document.getElementById('ui')).display, desk: getComputedStyle(document.getElementById('desk')).display }; })()"
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1000, 'height': 600}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(path='test/xrmock.js')
    pg.add_init_script("window.__t0 = performance.now(); addEventListener('DOMContentLoaded', () => { const b = window.__boot; if (b) b.on(w => { if (w === 'session') window.__tSession = performance.now() - window.__t0; }); });")
    pg.goto('http://localhost:8765/play.html?lite=1'); pg.wait_for_function('window.__bl && window.__bl.S.panel === "start"', timeout=20000)
    out['sessionMs'] = pg.evaluate('window.__tSession'); out['menuMs'] = round(pg.evaluate('performance.now() - window.__t0'))
    out['start'] = pg.evaluate(JS_STATE)
    out['controllers'] = pg.evaluate("[0, 1].map(i => window.__bl.renderer.xr.getController(i).visible)")   # both hands there (they connected before three.js took the session)
    pg.wait_for_timeout(1200); out['startStays'] = pg.evaluate('window.__bl.S.panel')   # the game's twice-a-second redraw must not replace it
    pg.evaluate("window.__bl.storeUI.act('st:word')"); out['callsign'] = pg.evaluate("localStorage.getItem('bl_name')")
    pg.evaluate("window.__bl.storeUI.act('st:online')"); pg.evaluate("window.__bl.storeUI.act('st:code')"); pg.evaluate("for (const k of ['4','7','2','9']) window.__bl.storeUI.act('st:key:' + k)")
    out['keypad'] = pg.evaluate("[window.__bl.S.panel, window.__bl.panel.btns.find(x => x.act === 'st:join').text]")
    pg.evaluate("window.__bl.storeUI.act('st:back')"); pg.evaluate("window.__bl.storeUI.act('st:mine')")   # PLAY AS SWAT: no server here, so it falls back to offline
    pg.wait_for_function('window.__bl.S.net === "solo"', timeout=15000); pg.wait_for_timeout(1500)
    out['afterSolo'] = pg.evaluate(JS_STATE)
    pg.screenshot(path='/tmp/store-launch.png')
    # VR ends without quitting (the headset leaves VR for a permission prompt): the game keeps going, ENTER VR comes back to it
    pg.evaluate("window.__bl.renderer.xr.getSession().end()"); pg.wait_for_timeout(800)
    out['afterEnd'] = pg.evaluate("[getComputedStyle(document.getElementById('ui')).display, window.__bl.S.net, window.__bl.S.mode, document.getElementById('status').textContent]")
    pg.click('#vr'); pg.wait_for_timeout(1500)
    out['micAsk'] = pg.evaluate("document.getElementById('status').textContent")   # first ENTER VR asks for the microphone on the flat page
    if not pg.evaluate('window.__bl.renderer.xr.isPresenting'): pg.click('#vr')
    pg.wait_for_function('window.__bl.renderer.xr.isPresenting', timeout=10000); pg.wait_for_timeout(800)
    out['resumed'] = pg.evaluate("[window.__bl.S.mode, window.__bl.S.net, window.__bl.S.panel, getComputedStyle(document.getElementById('ui')).display]")
    out['errors'] = errs
    b.close()
print(json.dumps(out, indent=1))
