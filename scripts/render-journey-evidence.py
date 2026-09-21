"""Assemble honest walkthrough clips from actual browser screenshots.

Requires Pillow and FFmpeg. Run after the browser checks have saved their frames:
  python scripts/render-journey-evidence.py /path/to/evidence
Screens are not fabricated. A caption explicitly identifies capture-based evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('evidence', type=Path)
args = parser.parse_args()
root = args.evidence.resolve()
assert root.is_dir(), 'Evidence directory must already exist'
ffmpeg = shutil.which('ffmpeg')
assert ffmpeg, 'FFmpeg is required'

stages = ['Discover', 'Open Days', 'Apply', 'Your portal', 'Welcome Day',
          'While you wait', 'Complete application', 'Results', 'Enrolment', 'Student']
clips = {
    '01-student-journey-desktop': [(f'desktop-{n:02}.jpg', stages[n-1]) for n in range(1,11)],
    '02-student-journey-mobile': [(f'pixel-{n:02}.jpg', stages[n-1]) for n in range(1,11)],
    '03-results-photo-flow': [('desktop-08.jpg','Choose photo, upload or manual entry'),
        ('results-photo-extracted.jpg','Actual local OCR: check proposed grades'),
        ('results-confirmed.jpg','Student confirmation and course comparison')],
    '04-enrolment-flow': [('desktop-09.jpg','Simulated arrival at college'),
        ('enrolment-checklist.jpg','Evidence carried into the enrolment checklist'),
        ('enrolment-ready.jpg','Local payload: ready for staff verification'),
        ('desktop-10.jpg','Explicit simulated college confirmation: Student')],
    '05-alternative-course-flow': [('alternative-extracted.jpg','Uploaded synthetic image: OCR grades'),
        ('alternative-options.jpg','Course requirements and the gaps'),
        ('alternative-chosen.jpg','Alternative saved for a college conversation')],
}

font_path = next((p for p in [Path('C:/Windows/Fonts/arial.ttf'),
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if p.exists()), None)
font = ImageFont.truetype(str(font_path), 23) if font_path else ImageFont.load_default()
small = ImageFont.truetype(str(font_path), 17) if font_path else ImageFont.load_default()
report = {'method':'Timed actual browser screen captures; not continuous recordings', 'videos':[]}
for name, sources in clips.items():
    size = (720,1440) if 'mobile' in name else (1440,1080)
    with tempfile.TemporaryDirectory(prefix='journey-frames-', dir=root) as temp:
        temp = Path(temp)
        inputs=[]
        for number,(filename,caption) in enumerate(sources):
            source=root/filename
            image=Image.open(source).convert('RGB')
            image.thumbnail((size[0], size[1]-86), Image.Resampling.LANCZOS)
            frame=Image.new('RGB',size,'#063956')
            frame.paste(image,((size[0]-image.width)//2,(size[1]-86-image.height)//2))
            draw=ImageDraw.Draw(frame)
            draw.text((22,size[1]-73),caption,fill='white',font=font)
            draw.text((22,size[1]-39),'Verified browser captures | synthetic student demo',fill='#ffdf64',font=small)
            output=temp/f'{number:02}.png'
            frame.save(output)
            inputs.append(output)
        listing=temp/'frames.txt'
        lines=[]
        for path in inputs:
            lines.extend([f"file '{path.as_posix()}'", 'duration 5'])
        lines.append(f"file '{inputs[-1].as_posix()}'")
        listing.write_text('\n'.join(lines)+'\n',encoding='utf-8')
        destination=root/f'{name}.mp4'
        subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0',
            '-i',str(listing),'-r','24','-c:v','libx264','-preset','fast','-crf','21',
            '-pix_fmt','yuv420p','-movflags','+faststart',str(destination)],check=True)
        subprocess.run([ffmpeg,'-v','error','-i',str(destination),'-f','null','-'],check=True)
        report['videos'].append({'file':destination.name,'frames':[p for p,_ in sources],
            'seconds':5*len(sources),'bytes':destination.stat().st_size,
            'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()})
(root/'video-manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
