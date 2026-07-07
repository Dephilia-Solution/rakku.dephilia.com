import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "public", "images", "rakku_logo.png");
const OUT = join(ROOT, "public", "icons");

const SIZES = [192, 512];
const APPLE_SIZES = [180];

async function main() {
  await mkdir(OUT, { recursive: true });
  const src = sharp(SRC);

  const meta = await src.metadata();
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`);

  for (const size of SIZES) {
    const out = join(OUT, `icon-${size}.png`);
    await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(out);
    console.log(`Generated: public/icons/icon-${size}.png`);
  }

  // Maskable icon: padded to safe zone (Android adaptive icons)
  for (const size of SIZES) {
    const out = join(OUT, `icon-${size}-maskable.png`);
    const bg = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 46, g: 125, b: 50, alpha: 1 } } }).png().toBuffer();
    const innerSize = Math.round(size * 0.8);
    const inner = await sharp(SRC).resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp(bg).composite([{ input: inner, gravity: "center" }]).png().toFile(out);
    console.log(`Generated: public/icons/icon-${size}-maskable.png`);
  }

  // Apple touch icon (180x180, no transparency, white bg)
  for (const size of APPLE_SIZES) {
    const out = join(OUT, `apple-touch-icon.png`);
    await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(out);
    console.log(`Generated: public/icons/apple-touch-icon.png`);
  }

  // Favicon 32x32
  const fav = join(ROOT, "public", "favicon.ico");
  await sharp(SRC).resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(join(OUT, "favicon-32.png"));
  console.log("Generated: public/icons/favicon-32.png");

  console.log("\nDone. Icons saved to public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
