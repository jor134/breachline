import subprocess
V={1:'/mnt/user-data/uploads/com_oculus_browser-20261117-234609-0.mp4',2:'/mnt/user-data/uploads/com_oculus_browser-20261117-235049-0.mp4',3:'/mnt/user-data/uploads/com_oculus_browser-20261117-235412-0.mp4'}
EDL=[(1,15,18),(1,73.2,78.2),(2,6.6,11.6),(2,59,63),(2,64,66.5),(2,102,105),(2,114.3,118.5),(2,136.3,140.3),(2,141,144.2),(2,150,153),(2,156,159.2),(3,14,17.5),(3,62.5,66),(3,159,163)]
inputs=[];fc=[];n=0
for k,(v,a,b) in enumerate(EDL):
    inputs+=['-ss',str(a),'-t',str(b-a),'-i',V[v]]; d=b-a
    fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,eq=gamma=1.12:contrast=1.04:saturation=1.05,format=yuv420p,fade=t=in:st=0:d=0.2,fade=t=out:st={d-0.2:.2f}:d=0.2,setpts=PTS-STARTPTS[v{k}]')
    fc.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.15,afade=t=out:st={d-0.2:.2f}:d=0.2,asetpts=PTS-STARTPTS[a{k}]')
k=len(EDL); inputs+=['-loop','1','-t','4.5','-i','endcard.png','-f','lavfi','-t','4.5','-i','anullsrc=r=48000:cl=stereo']
fc.append(f'[{k}:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st=3.8:d=0.7[v{k}]'); fc.append(f'[{k+1}:a]anull[a{k}]')
fc.append(''.join(f'[v{i}][a{i}]' for i in range(k+1))+f'concat=n={k+1}:v=1:a=1[vv][aa0]'); fc.append('[aa0]loudnorm=I=-16:TP=-1.5:LRA=11[aa]')
cmd=['ffmpeg','-v','error','-y']+inputs+['-filter_complex',';'.join(fc),'-map','[vv]','-map','[aa]','-c:v','libx264','-preset','medium','-crf','18','-profile:v','high','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','out/trailer_1920x1080.mp4']
subprocess.run(cmd,check=True)
