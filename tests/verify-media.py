"""Independent decoder test, run after recorder.cjs. Requires FFmpeg on PATH."""
import json
import os
import subprocess
from pathlib import Path

ffmpeg = os.environ.get('FFMPEG_EXE', 'ffmpeg')
movie = 'test-results/transparent.mov'
first = subprocess.run([ffmpeg, '-hide_banner', '-i', movie, '-frames:v', '1',
                        '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], capture_output=True, check=True)
alpha = first.stdout[3::4]
assert len(first.stdout) == 640 * 480 * 4
assert all(first.stdout[(y * 640 + x) * 4 + 3] == 0 for y in range(8) for x in range(8)), 'MOV corner must be transparent'
report = {'transparentPixels': alpha.count(0), 'opaquePixels': alpha.count(255),
          'fractionalAlphaPixels': sum(0 < a < 255 for a in alpha),
          'decoder': first.stderr.decode(errors='replace')}
assert report['transparentPixels'] > 1000 and report['opaquePixels'] > 100
subprocess.run([ffmpeg, '-v', 'error', '-i', movie, '-fps_mode', 'passthrough', '-enc_time_base', '1:1000', '-f', 'null', '-'], check=True)
for path in Path('test-results').glob('opaque.*'):
    subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
Path('test-results/decoder.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print(json.dumps({k: v for k, v in report.items() if k != 'decoder'}, indent=2))

# Verify the documented editing alternative, not just that a conversion exits 0.
prores = 'test-results/prores4444.mov'
subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', movie, '-c:v', 'prores_ks',
                '-profile:v', '4', '-pix_fmt', 'yuva444p10le', prores], check=True)
converted = subprocess.run([ffmpeg, '-v', 'error', '-i', prores, '-frames:v', '1',
                            '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], capture_output=True, check=True)
converted_alpha = converted.stdout[3::4]
prores_report = {'transparent': converted_alpha.count(0), 'opaque': converted_alpha.count(255),
                 'fractional': sum(0 < a < 255 for a in converted_alpha)}
assert prores_report['transparent'] > 1000 and prores_report['opaque'] > 100
Path('test-results/prores-alpha.json').write_text(json.dumps(prores_report, indent=2), encoding='utf8')
print('PASS: ProRes 4444 conversion retains alpha', prores_report)
