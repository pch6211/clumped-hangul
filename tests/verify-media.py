"""Independent decoder test, run after browser.cjs. Requires FFmpeg on PATH."""
import json
import os
import subprocess
from pathlib import Path

ffmpeg = os.environ.get('FFMPEG_EXE', 'ffmpeg')
movie = 'test-results/transparent.mov'
first = subprocess.run([ffmpeg, '-hide_banner', '-i', movie, '-frames:v', '1',
                        '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], capture_output=True, check=True)
alpha = first.stdout[3::4]
assert len(first.stdout) == 1280 * 720 * 4
report = {'transparentPixels': alpha.count(0), 'opaquePixels': alpha.count(255),
          'fractionalAlphaPixels': sum(0 < a < 255 for a in alpha),
          'decoder': first.stderr.decode(errors='replace')}
assert report['transparentPixels'] > 1000 and report['opaquePixels'] > 100
subprocess.run([ffmpeg, '-v', 'error', '-i', movie, '-f', 'null', '-'], check=True)
for path in Path('test-results').glob('opaque.*'):
    subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
Path('test-results/decoder.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps({k: v for k, v in report.items() if k != 'decoder'}, indent=2))
