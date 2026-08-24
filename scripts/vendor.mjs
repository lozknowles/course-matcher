/*
 * Prepare local browser runtime dependencies.
 *
 * Why this script exists:
 * Course Match deliberately avoids loading OCR/PDF libraries from a CDN at
 * runtime. `npm install` provides pinned packages; this script copies only the
 * browser assets the static application needs into ./vendor.
 *
 * ./vendor is generated output and is intentionally ignored by Git. The
 * reproducible source of truth is package.json + this script.
 */

import { cp, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const vendor = path.join(root, 'vendor');

// Always rebuild from scratch so stale versions cannot survive an upgrade.
await rm(vendor, { recursive: true, force: true });
await mkdir(vendor, { recursive: true });

async function copyDir(src, dst) {
  if (!existsSync(src)) {
    throw new Error(`Missing ${src}. Run npm install first.`);
  }
  await cp(src, dst, { recursive: true });
}

// Tesseract browser wrapper and WebAssembly/core runtime.
await copyDir(
  path.join(root, 'node_modules', 'tesseract.js', 'dist'),
  path.join(vendor, 'tesseract')
);
await copyDir(
  path.join(root, 'node_modules', 'tesseract.js-core'),
  path.join(vendor, 'tesseract-core')
);

// Tesseract language packages can contain eng.traineddata at different nested
// paths, so discover the actual file instead of coupling to package internals.
await mkdir(path.join(vendor, 'tessdata'), { recursive: true });
const engRoot = path.join(root, 'node_modules', '@tesseract.js-data', 'eng');

async function findTrained(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const candidate = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await findTrained(candidate);
      if (found) return found;
    } else if (/^eng\.traineddata(?:\.gz)?$/.test(entry.name)) {
      return candidate;
    }
  }
  return null;
}

const trained = await findTrained(engRoot);
if (!trained) throw new Error('Could not find English traineddata');
await copyFile(trained, path.join(vendor, 'tessdata', path.basename(trained)));

// PDF.js is loaded as an ES module; its worker must be served beside it.
await mkdir(path.join(vendor, 'pdfjs'), { recursive: true });
for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
  await copyFile(
    path.join(root, 'node_modules', 'pdfjs-dist', 'build', name),
    path.join(vendor, 'pdfjs', name)
  );
}

console.log('Local runtime vendor assets prepared in ./vendor');
