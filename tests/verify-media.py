"""Independent MOV color/opacity and PNG transparency checks. Requires FFmpeg."""
import json
import os
import subprocess
from pathlib import Path

ffmpeg = os.environ.get('FFMPEG_EXE', 'ffmpeg')

def decode(path, first=False):
    command = [ffmpeg, '-v', 'error', '-i', str(path)]
    if first:
        command += ['-frames:v', '1']
    return subprocess.run(command + ['-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], capture_output=True, check=True).stdout

metadata = json.loads(Path('test-results/recording-colors.json').read_text(encoding='utf8'))
size = metadata['width'] * metadata['height'] * 4
frames = decode('test-results/recording-colors.mov')
assert len(frames) == size * len(metadata['cases'])
report = []
for case in metadata['cases']:
    index = case['index']
    actual = frames[index * size:(index + 1) * size]
    expected = decode(Path('test-results') / case['file'], first=True)
    assert actual == expected, f"Decoded MOV differs from captured frame: {case['label']}"
    assert actual[3::4] == bytes([255]) * (size // 4), case['label']
    assert actual[:4] == bytes(case['bg'] + [255]), case['label']
    report.append({'label': case['label'], 'pixelDifferences': 0, 'background': case['bg'], 'foreground': case['fg'], 'opaquePixels': size // 4})

# PNG still excludes the background and retains antialiased transparent edges.
png = decode('test-results/color-artwork.png', first=True)
alpha = png[3::4]
assert alpha.count(0) > 1000 and alpha.count(255) > 100
assert any(0 < value < 255 for value in alpha)

movie = Path('test-results/colored.mov')
if movie.exists():
    first = decode(movie, first=True)
    assert len(first) == size and first[3::4] == bytes([255]) * (size // 4)
    subprocess.run([ffmpeg, '-v', 'error', '-i', str(movie), '-fps_mode', 'passthrough', '-f', 'null', '-'], check=True)

Path('test-results/decoder.json').write_text(json.dumps({'MOV': report, 'PNG': {'transparent': alpha.count(0), 'opaque': alpha.count(255)}}, indent=2), encoding='utf8')
print('PASS: independently decoded 7 MOV frames preserve captured RGB exactly and include an opaque background; PNG transparency preserved')
