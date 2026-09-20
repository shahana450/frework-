// Generates icon.ico (FreWork purple, multi-size) — run before pkg build
"use strict";
const zlib = require("zlib");
const fs = require("fs");

const tbl = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  tbl[i] = c;
}
function crc32(buf) {
  let v = 0xFFFFFFFF;
  for (const b of buf) v = tbl[(v ^ b) & 0xFF] ^ (v >>> 8);
  return (v ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type), d = Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}

function makePng(size, pixels) {
  // pixels: flat RGBA array, size×size
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.from(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  // FreWork purple bg + white rounded "F"
  const px = new Uint8Array(size * size * 4);
  const bg = [139, 92, 246, 255];   // #8B5CF6 FreWork purple
  const fg = [255, 255, 255, 255];  // white

  // Fill background with rounded corners
  const r = size * 0.18; // corner radius
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Rounded rect check
      const cx = Math.min(x, size-1-x), cy = Math.min(y, size-1-y);
      const inRect = cx >= r || cy >= r || (Math.hypot(cx-r, cy-r) <= r);
      if (inRect) { px[i]=bg[0]; px[i+1]=bg[1]; px[i+2]=bg[2]; px[i+3]=bg[3]; }
    }
  }

  // Draw "F" in pixel art, scaled to icon size
  // Template at 8x10 grid, padded to fit
  const template = [
    "XXXXXXX",
    "X      ",
    "X      ",
    "XXXXXX ",
    "X      ",
    "X      ",
    "X      ",
    "X      ",
    "X      ",
    "X      ",
  ];
  const rows = template.length, cols = template[0].length;
  const pw = size * 0.55 / cols;   // pixel width
  const ph = size * 0.70 / rows;   // pixel height
  const ox = size * 0.20;           // x offset
  const oy = size * 0.15;           // y offset

  for (let r2 = 0; r2 < rows; r2++) {
    for (let c = 0; c < cols; c++) {
      if (template[r2][c] !== "X") continue;
      const x0 = Math.round(ox + c * pw);
      const y0 = Math.round(oy + r2 * ph);
      const x1 = Math.round(ox + (c+1) * pw);
      const y1 = Math.round(oy + (r2+1) * ph);
      for (let py = y0; py < y1 && py < size; py++) {
        for (let px2 = x0; px2 < x1 && px2 < size; px2++) {
          const i = (py * size + px2) * 4;
          if (px[i+3] > 0) { px[i]=fg[0]; px[i+1]=fg[1]; px[i+2]=fg[2]; px[i+3]=fg[3]; }
        }
      }
    }
  }
  return px;
}

function makeIco(sizes) {
  const pngs = sizes.map(s => makePng(s, drawIcon(s)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}

const ico = makeIco([16, 32, 48, 256]);
fs.writeFileSync("icon.ico", ico);
console.log("icon.ico created ✓");
