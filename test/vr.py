import sys, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1100,'height':600})
    logs=[]
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' or 'BL' in m.text else None)
    pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
    pg.add_init_script(path='test/xrmock.js')
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(1500)
    pg.check('#solo'); pg.click('#vr'); pg.wait_for_timeout(1500)
    r = pg.evaluate(open(sys.argv[1]).read()); print('RESULT', json.dumps(r, indent=0)[:4000])
    pg.wait_for_timeout(400); pg.screenshot(path=sys.argv[2])
    print('\n'.join(logs[:25]) or 'no console errors')
    b.close()
