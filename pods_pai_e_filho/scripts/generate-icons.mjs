/**
 * Gera os ícones da PWA a partir da logo oficial (public/brand/logo.png).
 * Uso: node scripts/generate-icons.mjs
 *
 * - icon-192 / icon-512 / apple-touch-icon: logo centralizada em fundo branco,
 *   recortando parte da margem vazia da arte para o ícone ficar mais presente.
 * - icon-maskable-512: logo reduzida para a zona segura (círculo de 80%).
 * - app/icon.png: favicon.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("public/brand/logo.png");
const OUT = path.resolve("public/icons");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

if (!fs.existsSync(SOURCE)) {
  console.error(`Logo não encontrada em ${SOURCE}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const meta = await sharp(SOURCE).metadata();
const side = Math.min(meta.width ?? 1024, meta.height ?? 1024);

/** Recorta a margem externa da arte (aprox. 7%) para o ícone não ficar pequeno. */
async function standardIcon(size) {
  const trim = Math.round(side * 0.07);
  return sharp(SOURCE)
    .extract({ left: trim, top: trim, width: side - trim * 2, height: side - trim * 2 })
    .resize(size, size, { fit: "cover" })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();
}

/** Logo inteira ocupando ~72% do canvas branco: cabe na zona segura maskable. */
async function maskableIcon(size) {
  const inner = Math.round(size * 0.72);
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

fs.writeFileSync(path.join(OUT, "icon-192.png"), await standardIcon(192));
fs.writeFileSync(path.join(OUT, "icon-512.png"), await standardIcon(512));
fs.writeFileSync(path.join(OUT, "apple-touch-icon.png"), await standardIcon(180));
fs.writeFileSync(path.join(OUT, "icon-maskable-512.png"), await maskableIcon(512));
fs.writeFileSync(path.join("app", "icon.png"), await standardIcon(512));

console.log("Ícones gerados a partir da logo oficial.");
