# Title cards for trailer v5 (same glow style as the old end card): intro, end, two lower-third overlays
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D = '/usr/share/fonts/opentype/inter/'; FB = lambda s: ImageFont.truetype(D + 'Inter-Black.otf', s); FS = lambda s: ImageFont.truetype(D + 'Inter-SemiBold.otf', s)
def card(lines, size, out, bg=(0, 0, 0, 255), sub=None, lower=False):
    W, H = 1920, 1080; txt = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(txt); f = FB(size); lh = size * 1.08; tot = lh * len(lines)
    y = (H - tot - (90 if sub else 0)) / 2 if not lower else H - 190 - tot
    for l in lines: d.text((W / 2, y + lh / 2), l, font=f, fill=(232, 255, 236, 255), anchor='mm'); y += lh
    if sub: d.text((W / 2, y + 60), sub, font=FS(int(size * 0.3)), fill=(200, 230, 205, 255), anchor='mm')
    r, g, b, a = txt.split(); glow = Image.merge('RGBA', (r.point(lambda v: 40), g.point(lambda v: 200), b.point(lambda v: 90), a)).filter(ImageFilter.GaussianBlur(14))
    base = Image.new('RGBA', (W, H), bg)
    if lower: band = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(band).rectangle([0, H - 190 - tot - 50, W, H - 110], fill=(0, 0, 0, 130)); base = Image.alpha_composite(base, band.filter(ImageFilter.GaussianBlur(30)))
    for _ in range(2): base = Image.alpha_composite(base, glow)
    Image.alpha_composite(base, txt).save(out)
card(['CO-OP SWAT', 'FOR META QUEST'], 150, '/tmp/tr4/intro.png')
card(["YOU CAN'T", 'HIDE'], 230, '/tmp/tr4/end.png', sub='AVAILABLE ON META QUEST')
card(['EVERY RAID RESHUFFLED'], 92, '/tmp/tr4/c_raid.png', bg=(0, 0, 0, 0), lower=True)
card(['BUILD AND SHARE YOUR OWN MAPS'], 84, '/tmp/tr4/c_edit.png', bg=(0, 0, 0, 0), lower=True)
