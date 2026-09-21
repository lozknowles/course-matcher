"""Generate synthetic, non-personal results images for repeatable browser OCR checks."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
fontpath=Path('C:/Windows/Fonts/arial.ttf')
if not fontpath.exists():fontpath=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
font=ImageFont.truetype(str(fontpath),38)
title=ImageFont.truetype(str(fontpath),48)
small=ImageFont.truetype(str(fontpath),26)
for scenario,grades in [('standard',['6','5','6','6','5']),('alternatives',['3','3','4','3','4'])]:
    img=Image.new('RGB',(1300,1050),'white');draw=ImageDraw.Draw(img)
    draw.text((80,70),'SYNTHETIC RESULTS - DEMONSTRATION ONLY',font=title,fill='#063956')
    draw.text((80,155),'Jamie Taylor - fictional student',font=font,fill='black')
    draw.text((80,220),'Example Community School | GCSE results',font=small,fill='black')
    draw.line((80,280,1220,280),fill='#063956',width=3)
    for i,(subject,grade) in enumerate(zip(['Mathematics','English Language','Biology','Chemistry','Physics'],grades)):
        draw.text((90,330+i*110),subject,font=font,fill='black')
        draw.text((1030,330+i*110),grade,font=font,fill='black')
    draw.text((80,950),'Not an exam board document. Not valid as qualification evidence.',font=small,fill='#555555')
    path=root/'journey-assets'/f'results-{scenario}.png';path.parent.mkdir(exist_ok=True);img.save(path)
    print(path.name)
