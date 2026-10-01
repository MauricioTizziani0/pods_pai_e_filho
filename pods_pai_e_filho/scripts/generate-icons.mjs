import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function createPng(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = draw(x, y, size);
      const pixel = row + 1 + x * 4;
      raw[pixel] = r;
      raw[pixel + 1] = g;
      raw[pixel + 2] = b;
      raw[pixel + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRect(x, y, size, radius) {
  const left = x < radius;
  const right = x >= size - radius;
  const top = y < radius;
  const bottom = y >= size - radius;
  if (left && top) return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2;
  if (right && top) return (x - (size - radius - 1)) ** 2 + (y - radius) ** 2 <= radius ** 2;
  if (left && bottom) return (x - radius) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
  if (right && bottom) {
    return (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
  }
  return true;
}

function podIcon(x, y, size, maskable) {
  const green = [29, 74, 50, 255];
  const cream = [246, 241, 232, 255];
  const inset = maskable ? size * 0.18 : size * 0.08;
  const radius = size * (maskable ? 0.08 : 0.22);
  if (!maskable && !roundedRect(x, y, size, radius)) return [0, 0, 0, 0];

  const nx = (x - size / 2) / (size * 0.5);
  const ny = (y - size / 2) / (size * 0.5);
  const body = Math.abs(nx) < 0.34 && ny > -0.62 && ny < 0.62;
  const topPod = Math.abs(nx) < 0.22 && ny > -0.48 && ny < -0.08;
  const bottomPod = Math.abs(nx) < 0.16 && ny > 0.08 && ny < 0.46;
  if (topPod || bottomPod) return cream;
  if (body) return [23, 92, 62, 255];
  if (x < inset || y < inset || x > size - inset || y > size - inset) return green;
  return green;
}

const root = path.resolve("public/icons");
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, "icon-192.png"), createPng(192, (x, y, size) => podIcon(x, y, size, false)));
fs.writeFileSync(path.join(root, "icon-512.png"), createPng(512, (x, y, size) => podIcon(x, y, size, false)));
fs.writeFileSync(path.join(root, "icon-maskable-512.png"), createPng(512, (x, y, size) => podIcon(x, y, size, true)));
fs.writeFileSync(path.join(root, "apple-touch-icon.png"), createPng(180, (x, y, size) => podIcon(x, y, size, false)));
fs.mkdirSync("app", { recursive: true });
fs.writeFileSync(path.join("app", "icon.png"), createPng(512, (x, y, size) => podIcon(x, y, size, false)));
