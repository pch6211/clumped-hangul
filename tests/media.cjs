const assert = require('node:assert/strict');
const { makePngMov } = require('../media-export.js');

(async () => {
  const frames = [new Blob([new Uint8Array(27)]), new Blob([new Uint8Array(39)])];
  const movie = makePngMov(frames, 640, 480, [70, 130]);
  const data = Buffer.from(await movie.arrayBuffer());
  assert.equal(movie.type, 'video/quicktime');
  assert.equal(data.toString('ascii', 4, 8), 'ftyp');
  const mdat = data.readUInt32BE(0);
  assert.equal(data.toString('ascii', mdat + 4, mdat + 8), 'mdat');
  assert.equal(data.readUInt32BE(mdat), 8 + 27 + 39);
  const offset = data.indexOf('stco');
  assert.equal(data.readUInt32BE(offset + 12), mdat + 8);
  const sample = data.indexOf('stsz');
  assert.equal(data.readUInt32BE(sample + 12), 2);
  assert.deepEqual([data.readUInt32BE(sample + 16), data.readUInt32BE(sample + 20)], [27, 39]);
  const timing = data.indexOf('stts');
  assert.deepEqual([data.readUInt32BE(timing + 16), data.readUInt32BE(timing + 24)], [70, 130]);
  assert.throws(() => makePngMov([], 640, 480, []));
  assert.throws(() => makePngMov(frames, 0, 480, [70, 130]));
  assert.throws(() => makePngMov(frames, 640, 480, [0, 130]));
  assert.throws(() => makePngMov(frames, 640, 480, [70000, 130]));
  console.log('PASS: MOV sample offsets, sizes, variable timing, input limits');
})().catch(e => { console.error(e); process.exitCode = 1; });
