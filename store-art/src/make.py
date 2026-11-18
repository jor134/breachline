from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import numpy as np
F='/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
r1=Image.open('/tmp/art/r1.png').convert('RGB'); r2=Image.open('/tmp/art/r2.png').convert('RGB')

def fix_moon(im, box):
    # the moon renders as a tilted ellipse at these aspect ratios: paint it out with the surrounding sky, redraw it round
    a=np.asarray(im).astype(np.float32); x0,y0,x1,y1=box; pad=12
    top=a[max(0,y0-pad):y0, x0-pad:x1+pad].mean(axis=(0,1)); bot=a[y1:y1+pad, x0-pad:x1+pad].mean(axis=(0,1))
    for y in range(y0-4,y1+4):
        t=(y-y0+4)/max(1,(y1-y0+8)); row=top*(1-t)+bot*t
        a[y, x0-4:x1+4]=row
    im=Image.fromarray(a.clip(0,255).astype(np.uint8))
    cx,cy=(x0+x1)//2,(y0+y1)//2; r=int(min(x1-x0,y1-y0)*0.47)
    glow=Image.new('L',im.size,0); ImageDraw.Draw(glow).ellipse([cx-r*2,cy-r*2,cx+r*2,cy+r*2],fill=70); glow=glow.filter(ImageFilter.GaussianBlur(r))
    disc=Image.new('L',im.size,0); ImageDraw.Draw(disc).ellipse([cx-r,cy-r,cx+r,cy+r],fill=255); disc=disc.filter(ImageFilter.GaussianBlur(1.5))
    col=Image.new('RGB',im.size,(170,255,180))
    im=Image.composite(col,im,glow.point(lambda v:v//3)); im=Image.composite(col,im,disc)
    return im

def find_moon(im):
    a=np.asarray(im).astype(int); m=(a[:,:,1]>200)&(a[:,:,0]>120)
    h=a.shape[0]; m[int(h*0.5):]=False
    ys,xs=np.nonzero(m)
    if len(xs)<50: return None
    # biggest blob: take the cluster around the median
    mx,my=np.median(xs),np.median(ys); k=(abs(xs-mx)<h*0.1)&(abs(ys-my)<h*0.1)
    return (xs[k].min(),ys[k].min(),xs[k].max()+1,ys[k].max()+1)

def grade(im, vig=0.55, grain=7, seed=1):
    w,h=im.size; a=np.asarray(im).astype(np.float32)/255
    a=np.clip((a-0.03)*1.18,0,1)**0.95                                  # a little more contrast
    hi=Image.fromarray((np.clip(a-0.55,0,1)/0.45*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(w/120))
    a=np.clip(a+np.asarray(hi).astype(np.float32)/255*0.35,0,1)          # bloom on the lights
    yy,xx=np.mgrid[0:h,0:w]; d=np.sqrt(((xx-w/2)/(w/2))**2+((yy-h/2)/(h/2))**2)
    a*= (1-vig*np.clip(d-0.45,0,1)**1.6)[...,None]                        # goggle vignette
    a*= (1-0.05*(yy%4<1))[...,None]                                      # faint scanlines
    rng=np.random.default_rng(seed); a=np.clip(a+rng.normal(0,grain/255,(h,w,1)),0,1)  # sensor noise
    return Image.fromarray((a*255).astype(np.uint8))

def shade(im, box, strength=0.6, feather=0.25):
    # darken behind the title so it reads, soft-edged
    w,h=im.size; m=Image.new('L',im.size,0); x0,y0,x1,y1=box
    ImageDraw.Draw(m).rounded_rectangle([x0,y0,x1,y1],radius=int((y1-y0)*0.3),fill=int(255*strength)); m=m.filter(ImageFilter.GaussianBlur(int((y1-y0)*feather)))
    return Image.composite(Image.new('RGB',im.size,(0,8,2)),im,m)

def title(im, lines, cx, cy, size, track=0.04, lead=0.95, align='center', anchor_x='center'):
    f=ImageFont.truetype(F,size); d0=ImageDraw.Draw(im)
    widths=[sum(f.getlength(c) for c in t)+track*size*(len(t)-1) for t in lines]
    asc,desc=f.getmetrics(); lh=int(size*lead); H=lh*len(lines)
    W=max(widths); left=cx-W/2 if anchor_x=='center' else cx
    txt=Image.new('L',im.size,0); d=ImageDraw.Draw(txt)
    y=cy-H/2
    for t,wd in zip(lines,widths):
        x=left+(W-wd)/2 if align=='center' else left
        for c in t: d.text((x,y-size*0.12),c,font=f,fill=255); x+=f.getlength(c)+track*size
        y+=lh
    glow=txt.filter(ImageFilter.GaussianBlur(size*0.12)); glow2=txt.filter(ImageFilter.GaussianBlur(size*0.35))
    im=Image.composite(Image.new('RGB',im.size,(60,255,110)),im,glow2.point(lambda v:int(v*0.45)))
    im=Image.composite(Image.new('RGB',im.size,(110,255,140)),im,glow.point(lambda v:int(v*0.8)))
    im=Image.composite(Image.new('RGB',im.size,(236,255,238)),im,txt)
    bb=txt.getbbox(); return im,bb

def save(im,name,size):
    im=im.resize(size,Image.LANCZOS).convert('RGB'); im.save('/tmp/art/out/'+name,optimize=True); print(name,im.size,im.mode)

mb=find_moon(r1); r1f=fix_moon(r1,mb) if mb else r1
mb2=find_moon(r2); r2f=fix_moon(r2,mb2) if mb2 else r2
print('moons',mb,mb2)

# landscape 2560x1440
L=r1f.crop((300,120,3200,1751)); L=grade(L); W,H=L.size
L=shade(L,(int(W*0.03),int(H*0.32),int(W*0.49),int(H*0.64)),0.55)
L,bb=title(L,["YOU CAN'T","HIDE"],int(W*0.26),int(H*0.48),int(H*0.125)); print('land title',[round(v/s,2) for v,s in zip(bb,(W,H,W,H))])
save(L,'cover_landscape_2560x1440.png',(2560,1440))
# hero 3000x900 (title centred)
Hh=r1f.crop((0,335,3200,1295)); Hh=grade(Hh,vig=0.45); W,H=Hh.size
Hh=shade(Hh,(int(W*0.27),int(H*0.24),int(W*0.73),int(H*0.62)),0.6)
Hh,bb=title(Hh,["YOU CAN'T HIDE"],W//2,int(H*0.43),int(H*0.2)); print('hero title',[round(v/s,2) for v,s in zip(bb,(W,H,W,H))])
save(Hh,'hero_cover_3000x900.png',(3000,900))
# mini landscape 1080x360
M=r1f.crop((0,330,3200,1397)); M=grade(M,vig=0.45); W,H=M.size
M=shade(M,(int(W*0.22),int(H*0.25),int(W*0.78),int(H*0.62)),0.6)
M,bb=title(M,["YOU CAN'T HIDE"],W//2,int(H*0.43),int(H*0.21)); print('mini title',[round(v/s,2) for v,s in zip(bb,(W,H,W,H))])
save(M,'cover_mini_landscape_1080x360.png',(1080,360))
# square 1440
S=r2f.crop((100,200,1700,1800)); S=grade(S); W,H=S.size
S=shade(S,(int(W*0.08),int(H*0.6),int(W*0.92),int(H*0.8)),0.5)
S,bb=title(S,["YOU CAN'T","HIDE"],W//2,int(H*0.70),int(H*0.095)); print('square title',[round(v/s,2) for v,s in zip(bb,(W,H,W,H))])
save(S,'cover_square_1440x1440.png',(1440,1440))
# portrait 1008x1440
P=r2f.crop((270,0,1530,1800)); P=grade(P); W,H=P.size
P=shade(P,(int(W*0.06),int(H*0.6),int(W*0.94),int(H*0.79)),0.5)
P,bb=title(P,["YOU CAN'T","HIDE"],W//2,int(H*0.695),int(H*0.08)); print('portrait title',[round(v/s,2) for v,s in zip(bb,(W,H,W,H))])
save(P,'cover_portrait_1008x1440.png',(1008,1440))
# icon 1024 (image only: the suspect in the lit window)
I=r2f.crop((560,600,1240,1280)); I=grade(I,vig=0.7,grain=6); save(I,'icon_1024x1024.png',(1024,1024))
# logo, transparent 24-bit PNG with alpha
size=520; f=ImageFont.truetype(F,size); lines=["YOU CAN'T","HIDE"]; track=0.04
cw=Image.new("RGB",(3400,1500),(0,0,0)); _,bb=title(cw,lines,1700,750,size)
txt=Image.new('L',cw.size,0); d=ImageDraw.Draw(txt)
logo=Image.new('RGBA',cw.size,(0,0,0,0))
glow_src=Image.new('L',cw.size,0); dd=ImageDraw.Draw(glow_src)
lh=int(size*0.95); y=750-lh
for t in lines:
    wd=sum(f.getlength(c) for c in t)+track*size*(len(t)-1); x=1700-wd/2
    for c in t: dd.text((x,y-size*0.12),c,font=f,fill=255); x+=f.getlength(c)+track*size
    y+=lh
g=glow_src.filter(ImageFilter.GaussianBlur(size*0.1)).point(lambda v:int(v*0.7))
logo=Image.merge('RGBA',[Image.new('L',cw.size,90),Image.new('L',cw.size,255),Image.new('L',cw.size,130),g])
face=Image.merge('RGBA',[Image.new('L',cw.size,236),Image.new('L',cw.size,255),Image.new('L',cw.size,238),glow_src])
logo=Image.alpha_composite(logo,face); bb=logo.getbbox(); logo=logo.crop((max(0,bb[0]-10),max(0,bb[1]-10),min(cw.size[0],bb[2]+10),min(cw.size[1],bb[3]+10)))
logo.save('/tmp/art/out/logo_transparent.png',optimize=True); print('logo',logo.size,logo.mode)
