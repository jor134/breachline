import sys, json
from playwright.sync_api import sync_playwright
W,H=int(sys.argv[1]),int(sys.argv[2]); out=sys.argv[3]; cfg=sys.argv[4] if len(sys.argv)>4 else '{}'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':W,'height':H}); pg.set_default_timeout(600000)
    pg.add_init_script('window.SHOT='+cfg)
    pg.goto('http://localhost:8765/play.html?lite=1&classic=1&map=mansion'); pg.wait_for_timeout(2500)
    print(pg.evaluate(open('/tmp/art/scene.js').read()))
    pg.wait_for_timeout(1500); pg.screenshot(path=out); b.close()
