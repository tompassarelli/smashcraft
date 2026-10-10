"""Read-only compositor/OCR investigation boundary; emits text and pixel coordinates."""
import argparse
import csv
import io
import json
import subprocess
import time
from pathlib import Path
from PIL import Image, ImageChops

parser = argparse.ArgumentParser(description=__doc__)
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--window', type=int)
source.add_argument('--input', type=Path)
parser.add_argument('--output-prefix', type=Path, required=True)
parser.add_argument('--region', type=int, nargs=4, action='append', required=True,
                    metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'))
parser.add_argument('--scale', type=float, required=True,
                    help='Measured physical pixels per compositor logical pixel')
args = parser.parse_args()
if args.scale <= 0:
    parser.error('--scale must be positive')
started = time.time_ns()
if args.window is not None:
    path = Path(str(args.output_prefix) + f'-{started}.png')
    windows = json.loads(subprocess.check_output(['niri', 'msg', '--json', 'windows'],
                                                 text=True, timeout=5))
    window = next(window for window in windows if window['id'] == args.window)
    workspaces = json.loads(subprocess.check_output(['niri', 'msg', '--json', 'workspaces'],
                                                    text=True, timeout=5))
    workspace = next(workspace for workspace in workspaces
                     if workspace['id'] == window['workspace_id'])
    outputs = json.loads(subprocess.check_output(['niri', 'msg', '--json', 'outputs'],
                                                 text=True, timeout=5))
    output = outputs[workspace['output']]['logical']
    layout = window['layout']
    tile_x, tile_y = layout['tile_pos_in_workspace_view']
    offset_x, offset_y = layout['window_offset_in_tile']
    width, height = layout['window_size']
    x, y = round(output['x'] + tile_x + offset_x), round(output['y'] + tile_y + offset_y)
    subprocess.run(['grim', '-g', f'{x},{y} {width}x{height}', '-s', str(args.scale), str(path)],
                   check=True, timeout=5)
    deadline = time.monotonic() + 10
    while True:
        try:
            with Image.open(path) as candidate:
                candidate.load()
            if path.stat().st_mtime_ns < started:
                raise OSError('capture predates request')
            break
        except (FileNotFoundError, OSError):
            if time.monotonic() >= deadline:
                raise SystemExit('Fresh capture failed: no complete new image within 10 seconds. '
                                 'A locked Niri session accepts the command without saving an image; '
                                 'check session state. No earlier image was used.')
            time.sleep(0.1)
else:
    path = args.input
image = Image.open(path).convert('RGB')
result = {'source': str(path), 'fresh_capture': args.window is not None,
          'source_mtime_ns': path.stat().st_mtime_ns, 'physical_size': image.size,
          'logical_scale': args.scale, 'regions': []}
for index, region in enumerate(args.region):
    left, top, right, bottom = region
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        parser.error(f'region outside image: {region}')
    crop = image.crop(region)
    red, green, _ = crop.split()
    bright = ImageChops.multiply(red.point(lambda x: 255 if x > 170 else 0),
                                green.point(lambda x: 255 if x > 150 else 0))
    mask_path = Path(str(args.output_prefix) + f'-region-{index}.png')
    ImageChops.invert(bright).save(mask_path)
    tsv = subprocess.check_output(['tesseract', str(mask_path), 'stdout', '--psm', '7', 'tsv'],
                                  text=True, timeout=10)
    words = []
    for word in csv.DictReader(io.StringIO(tsv), delimiter='\t'):
        if word['level'] != '5' or not word['text'].strip():
            continue
        x, y = left + int(word['left']), top + int(word['top'])
        width, height = int(word['width']), int(word['height'])
        words.append({'text': word['text'], 'confidence': float(word['conf']),
                      'physical_box': [x, y, width, height],
                      'logical_box': [v / args.scale for v in (x, y, width, height)]})
    result['regions'].append({'physical_region': region, 'words': words})
print(json.dumps(result, indent=2))
