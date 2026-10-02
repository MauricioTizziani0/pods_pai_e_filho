/**
 * Gera apenas os ícones de instalação mobile a partir da arte arredondada.
 * Uso: node scripts/generate-icons.mjs
 *
 * - mobile-icon-192 / mobile-icon-512: preservam a arte e sua transparência.
 * - apple-touch-icon-rounded: fundo branco para o recorte feito pelo iOS.
 * - mobile-icon-maskable-512: fundo opaco e arte na zona segura (círculo de 80%).
 * A logo interna e os favicons quadrados não são alterados.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("public/brand/mobile-icon-rounded.png");
const OUT = path.resolve("public/icons");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

if (!fs.existsSync(SOURCE)) {
  console.error(`Ícone mobile não encontrado em ${SOURCE}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/** Mantém a arte arredondada inteira, sem recortar sua borda. */
async function standardIcon(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { ...WHITE, alpha: 0 } })
    .png()
    .toBuffer();
}

/** O círculo da arte cabe na zona segura de 80% do ícone maskable. */
async function maskableIcon(size) {
  const inner = Math.round(size * 0.8);
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

fs.writeFileSync(path.join(OUT, "mobile-icon-192.png"), await standardIcon(192));
fs.writeFileSync(path.join(OUT, "mobile-icon-512.png"), await standardIcon(512));
fs.writeFileSync(
  path.join(OUT, "apple-touch-icon-rounded.png"),
  await sharp(await standardIcon(180)).flatten({ background: WHITE }).png().toBuffer(),
);
fs.writeFileSync(path.join(OUT, "mobile-icon-maskable-512.png"), await maskableIcon(512));

console.log("Ícones mobile gerados a partir da arte arredondada. Logo interna e favicons preservados.");
