import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appName = process.argv[2] || "owner";
const APP_ROOT = resolve(__dirname, "..", "apps", appName);
const SRC = join(APP_ROOT, "public", "images", "rakku_logo.png");
const APP_DIR = join(APP_ROOT, "src", "app");

async function main() {
  await mkdir(APP_DIR, { recursive: true });

  // icon.png (512x512) — Next.js auto-detect as /icon
  await sharp(SRC)
    .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(APP_DIR, "icon.png"));
  console.log("✓ icon.png (512x512)");

  // apple-icon.png (180x180)
  await sharp(SRC)
    .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(APP_DIR, "apple-icon.png"));
  console.log("✓ apple-icon.png (180x180)");

  // favicon.ico (32x32)
  await sharp(SRC)
    .resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toFile(join(APP_DIR, "favicon.ico"));
  console.log("✓ favicon.ico (32x32)");

  console.log(`\nIcons generated for @rakku/${appName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
