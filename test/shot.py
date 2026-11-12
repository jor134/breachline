import sys, json
from playwright.sync_api import sync_playwright
url = sys.argv[1]; out = sys.argv[2]; script = sys.argv[3] if len(sys.argv) > 3 else None
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1100,'height':650})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.goto(url); pg.wait_for_timeout(2500); pg.set_default_timeout(400000)
    if script:
        r = pg.evaluate(open(script).read()); print('RESULT', json.dumps(r)[:3000])
        pg.wait_for_timeout(600)
    pg.screenshot(path=out)
    print('\n'.join(logs[:25]) or 'no console errors')
    b.close()
