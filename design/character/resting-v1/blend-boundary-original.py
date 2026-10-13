import imageio_ffmpeg,subprocess
ff=imageio_ffmpeg.get_ffmpeg_exe();b='artifacts/character-motion/'
source=b+'seated-continuous-15s-silent.mp4';out=b+'seated-continuous-loop.mp4'
# Circular overlap: start at source frame 18. Blend the final 18 frames
# into frames 0..17; playback then continues naturally at frame 18.
f='[0:v]split[a][h];[a]trim=start_frame=18:end_frame=362,setpts=PTS-STARTPTS,fps=24,format=yuv420p[a1];[h]trim=start_frame=0:end_frame=18,setpts=PTS-STARTPTS,fps=24,format=yuv420p[h1];[a1][h1]xfade=transition=fade:duration=0.75:offset=13.5833333333,trim=end_frame=344,settb=1/24000,setpts=N*1000,format=yuv420p[v]'
p=subprocess.run([ff,'-i',source,'-filter_complex',f,'-map','[v]','-an','-r','24','-fps_mode','cfr','-c:v','libx264','-crf','18','-movflags','+faststart','-y',out],capture_output=True,text=True)
if p.returncode:raise RuntimeError(p.stderr[-3000:])
def frames(path):
 p=subprocess.run([ff,'-i',path,'-vf','scale=96:168','-pix_fmt','rgb24','-f','rawvideo','-'],capture_output=True,check=True)
 n=96*168*3;return [p.stdout[i:i+n] for i in range(0,len(p.stdout),n)]
def diff(a,b):return sum(abs(x-y) for x,y in zip(a,b))/len(a)
original=frames(source);loop=frames(out)
assert len(loop)==344,len(loop)
old=diff(original[-1],original[0]);new=diff(loop[-1],loop[0])
assert new<old/3,(old,new)
print(f'PASS: 344 frames / 14.33 seconds. Restart pixel change reduced from {old:.2f} to {new:.2f}.')
subprocess.run([ff,'-i',out,'-vf','select=gte(n\\,326),fps=8,scale=210:-1,tile=4x2','-frames:v','1','-y',b+'blend-review.jpg'],capture_output=True,check=True)
