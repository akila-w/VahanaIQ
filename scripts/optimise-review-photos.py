#!/usr/bin/env python3
"""Normalise review frames without the old inset border or clipped cut-out vehicles."""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import json, concurrent.futures
root=Path(__file__).resolve().parent.parent
file=root/'docs/catalogue-review/photo-candidates.json';data=json.loads(file.read_text());out=root/'assets/images/review-thumbnails';out.mkdir(exist_ok=True)
def job(p):
 src=root/p['localPath'].removeprefix('../');thumb=out/(p['sha256'][:24]+'.webp')
 with Image.open(src) as original:
  image=ImageOps.exif_transpose(original).convert('RGBA')
  transparent=image.getextrema()[3][0]<255
  corners=[image.getpixel(pt)[:3] for pt in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]]
  white=all(min(c)>235 for c in corners)
  if transparent:
   box=image.getbbox();image=image.crop(box) if box else image
  elif white:
   difference=ImageChops.difference(image.convert('RGB'),Image.new('RGB',image.size,'white')).convert('L').point(lambda v:255 if v>18 else 0)
   box=difference.getbbox()
   if box:image=image.crop((max(0,box[0]-5),max(0,box[1]-5),min(image.width,box[2]+5),min(image.height,box[3]+5)))
  if transparent or white:
   # The vehicle silhouette stays intact. This is its source background, with no inset frame.
   image.thumbnail((640,400),Image.Resampling.LANCZOS)
   canvas=Image.new('RGBA',(640,400),'white');canvas.alpha_composite(image,((640-image.width)//2,(400-image.height)//2))
  else:
   canvas=ImageOps.fit(image,(640,400),method=Image.Resampling.LANCZOS)
  canvas.convert('RGB').save(thumb,'WEBP',quality=82,method=4)
 p['thumbnailPath']='../assets/images/review-thumbnails/'+thumb.name
 return p
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 for m in data:m['photos']=list(pool.map(job,m['photos']))
file.write_text(json.dumps(data,ensure_ascii=False,indent=2))
print('Thumbnails',sum(len(m['photos']) for m in data))
