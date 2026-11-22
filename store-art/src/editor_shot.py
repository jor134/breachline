import base64, json, sys
from playwright.sync_api import sync_playwright
import subprocess, time
srv = subprocess.Popen(["python3","-m","http.server","8765"], cwd="public", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
W,H=2560,1440
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1100,'height':600}); pg.set_default_timeout(600000)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script(path='test/xrmock.js')
    pg.goto('http://localhost:8765/play.html?classic=1'); pg.wait_for_timeout(2500)
    pg.check('#solo'); pg.click('#vr'); pg.wait_for_timeout(2500)
    print(pg.evaluate(open('/tmp/eds/build.js').read()))
    for name, js in json.load(open(sys.argv[1])).items():
        pg.evaluate(js); pg.wait_for_timeout(2500)
        url = pg.evaluate("""([W,H]) => { const B = window.__bl, T = B.THREE, r = B.renderer; const cam = new T.PerspectiveCamera(78, W / H, 0.02, 600);
          cam.position.copy(B.head.pos); cam.quaternion.copy(B.head.quat); cam.updateMatrixWorld(true);
          const rt = new T.WebGLRenderTarget(W, H, { samples: 4, colorSpace: T.SRGBColorSpace }); const xr = r.xr.enabled; r.xr.enabled = false;
          r.setRenderTarget(rt); r.render(B.world.root.parent, cam); const px = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null); r.xr.enabled = xr;
          const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), id = g.createImageData(W, H);
          for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); g.putImageData(id, 0, 0); return c.toDataURL('image/png'); }""", [W,H])
        open('/tmp/eds/'+name+'.png','wb').write(base64.b64decode(url.split(',')[1])); print(name)
    print(errs[:5]); b.close()
srv.kill()
