import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function png(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) set(x, y, 20, 24, 32);
  }
  const margin = Math.floor(size * 0.08);
  const radius = Math.floor(size * 0.18);
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin; x < size - margin; x++) {
      const dx = Math.min(x - margin, size - margin - 1 - x);
      const dy = Math.min(y - margin, size - margin - 1 - y);
      if (dx * dx + dy * dy < (radius - Math.min(dx, dy)) * (radius - Math.min(dx, dy)) && Math.min(dx, dy) < radius) {
        // keep square with soft corner by skipping outside rounded box
      }
      const inRound =
        x >= margin + (dx < radius && dy < radius ? 0 : 0) &&
        !(
          (x < margin + radius && y < margin + radius && (x - (margin + radius)) ** 2 + (y - (margin + radius)) ** 2 > radius ** 2) ||
          (x > size - margin - radius && y < margin + radius && (x - (size - margin - radius)) ** 2 + (y - (margin + radius)) ** 2 > radius ** 2) ||
          (x < margin + radius && y > size - margin - radius && (x - (margin + radius)) ** 2 + (y - (size - margin - radius)) ** 2 > radius ** 2) ||
          (x > size - margin - radius &&
            y > size - margin - radius &&
            (x - (size - margin - radius)) ** 2 + (y - (size - margin - radius)) ** 2 > radius ** 2)
        );
      if (inRound) set(x, y, 18, 22, 30);
    }
  }
  const s = size;
  const tile = (cx, cy, w, h, r, g, b) => {
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) set(x, y, r, g, b);
  };
  tile(Math.floor(s * 0.28), Math.floor(s * 0.42), Math.floor(s * 0.44), Math.floor(s * 0.12), 58, 72, 92);
  tile(Math.floor(s * 0.34), Math.floor(s * 0.34), Math.floor(s * 0.32), Math.floor(s * 0.1), 255, 193, 74);
  tile(Math.floor(s * 0.44), Math.floor(s * 0.36), Math.floor(s * 0.12), Math.floor(s * 0.2), 43, 184, 168);
  const raw = Buffer.alloc((s * 4 + 1) * s);
  for (let y = 0; y < s; y++) {
    raw[y * (s * 4 + 1)] = 0;
    rgba.copy(raw, y * (s * 4 + 1) + 1, y * s * 4, (y + 1) * s * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s, 0);
  ihdr.writeUInt32BE(s, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
console.log('icons written');
