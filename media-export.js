/* QuickTime PNG video: lossless RGBA frames, one video track, no audio.
 * Bounded by the recorder to 64 MiB / 30 seconds; 32-bit atom offsets suffice.
 * Format: https://developer.apple.com/documentation/quicktime-file-format
 */
(function (root) {
  'use strict';
  const bytes = text => Uint8Array.from(text, c => c.charCodeAt(0));
  const u32 = n => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n); return a; };
  const u16 = n => { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n); return a; };
  const zero = n => new Uint8Array(n);
  const join = (...parts) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; } return out;
  };
  const atom = (type, ...parts) => { const data = join(...parts); return join(u32(data.length + 8), bytes(type), data); };
  const full = (type, flags, ...parts) => atom(type, u32(flags), ...parts);
  const matrix = () => join(...[65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824].map(u32));

  function makePngMov(frames, width, height, durations) {
    if (!frames.length || frames.length !== durations.length || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('Invalid movie dimensions or frames');
    if (!durations.every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid frame durations');
    const duration = durations.reduce((a, b) => a + b, 0);
    const size = frames.reduce((n, f) => n + f.size, 0);
    if (size > 64 * 1024 * 1024 || duration > 60000) throw new Error('Movie exceeds recording limits');
    const ftyp = atom('ftyp', bytes('qt  '), u32(512), bytes('qt  '));
    const mvhd = full('mvhd', 0, u32(0), u32(0), u32(1000), u32(duration), u32(65536), u16(256), zero(10), matrix(), zero(24), u32(2));
    const tkhd = full('tkhd', 3, u32(0), u32(0), u32(1), u32(0), u32(duration), zero(8), zero(8), matrix(), u32(width * 65536), u32(height * 65536));
    const mdhd = full('mdhd', 0, u32(0), u32(0), u32(1000), u32(duration), u16(0), u16(0));
    const hdlr = full('hdlr', 0, u32(0), bytes('vide'), zero(12), bytes('Clumped Hangul PNG\0'));
    const name = zero(32); name[0] = 3; name.set(bytes('PNG'), 1);
    const sample = atom('png ', zero(6), u16(1), zero(16), u16(width), u16(height), u32(72 * 65536), u32(72 * 65536), u32(0), u16(1), name, u16(32), u16(65535));
    const stsd = full('stsd', 0, u32(1), sample);
    const stts = full('stts', 0, u32(frames.length), ...durations.map(n => join(u32(1), u32(n))));
    const stsc = full('stsc', 0, u32(1), u32(1), u32(frames.length), u32(1));
    const stsz = full('stsz', 0, u32(0), u32(frames.length), ...frames.map(f => u32(f.size)));
    const stco = full('stco', 0, u32(1), u32(ftyp.length + 8));
    const stbl = atom('stbl', stsd, stts, stsc, stsz, stco);
    const dinf = atom('dinf', full('dref', 0, u32(1), full('url ', 1)));
    const minf = atom('minf', full('vmhd', 1, zero(8)), dinf, stbl);
    const moov = atom('moov', mvhd, atom('trak', tkhd, atom('mdia', mdhd, hdlr, minf)));
    return new Blob([ftyp, u32(size + 8), bytes('mdat'), ...frames, moov], { type: 'video/quicktime' });
  }
  if (typeof module !== 'undefined') module.exports = { makePngMov };
  else root.MHMedia = { makePngMov };
})(typeof window === 'undefined' ? this : window);
